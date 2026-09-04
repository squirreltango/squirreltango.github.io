"use client"

import { createClient } from "@/lib/supabase/client"

export type ClaimStatus = "pending" | "approved" | "rejected"
export type Tier = "bronze" | "silver" | "gold"

export interface BusinessClaim {
  id: string
  user_id: string
  business_ref: string
  business_name: string
  status: ClaimStatus
  contact_email: string | null
  contact_phone: string | null
  evidence_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export interface BusinessProfile {
  id: string
  claim_id: string
  user_id: string
  business_ref: string
  tagline: string | null
  description: string | null
  booking_url: string | null
  menu_url: string | null
  order_url: string | null
  website_url: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram_url: string | null
  facebook_url: string | null
  x_url: string | null
  tiktok_url: string | null
}

export interface Subscription {
  id: string
  user_id: string
  claim_id: string | null
  tier: Tier
  status: "active" | "cancelled" | "past_due"
  started_at: string
  renews_at: string | null
}

/** Editable merchant fields, all optional so the form can submit partials. */
export type BusinessProfileDraft = Partial<
  Omit<BusinessProfile, "id" | "claim_id" | "user_id" | "business_ref">
>

export async function listClaims(): Promise<BusinessClaim[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_claims")
    .select(
      "id,user_id,business_ref,business_name,status,contact_email,contact_phone,evidence_notes,created_at,reviewed_at",
    )
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as BusinessClaim[]
}

export async function submitClaim(input: {
  businessRef: string
  businessName: string
  contactEmail?: string
  contactPhone?: string
  evidenceNotes?: string
}): Promise<BusinessClaim> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in to claim a business.")

  const { data, error } = await supabase
    .from("business_claims")
    .insert({
      user_id: user.id,
      business_ref: input.businessRef.trim(),
      business_name: input.businessName.trim(),
      contact_email: input.contactEmail?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      evidence_notes: input.evidenceNotes?.trim() || null,
      // status intentionally omitted - the DB default is 'pending' and the RLS
      // insert policy requires it, so a claim can never be self-approved.
    })
    .select(
      "id,user_id,business_ref,business_name,status,contact_email,contact_phone,evidence_notes,created_at,reviewed_at",
    )
    .single()

  if (error) {
    // 23505 = unique_violation on (user_id, business_ref)
    if (error.code === "23505") {
      throw new Error("You have already submitted a claim for this venue.")
    }
    throw new Error(error.message)
  }
  return data as BusinessClaim
}

export async function getProfileForClaim(claimId: string): Promise<BusinessProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id,claim_id,user_id,business_ref,tagline,description,booking_url,menu_url,order_url,website_url,contact_phone,contact_email,instagram_url,facebook_url,x_url,tiktok_url",
    )
    .eq("claim_id", claimId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as BusinessProfile | null) ?? null
}

/**
 * Creates or updates the merchant profile for an approved claim.
 *
 * RLS enforces that the claim is approved and owned by the caller, so a
 * pending claim cannot publish content even if this is called directly.
 */
export async function saveProfile(
  claim: Pick<BusinessClaim, "id" | "business_ref">,
  draft: BusinessProfileDraft,
): Promise<BusinessProfile> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in.")

  const existing = await getProfileForClaim(claim.id)
  const payload = { ...normaliseDraft(draft) }

  if (existing) {
    const { data, error } = await supabase
      .from("business_profiles")
      .update(payload)
      .eq("id", existing.id)
      .select(
        "id,claim_id,user_id,business_ref,tagline,description,booking_url,menu_url,order_url,website_url,contact_phone,contact_email,instagram_url,facebook_url,x_url,tiktok_url",
      )
      .single()
    if (error) throw new Error(friendlyWriteError(error.message))
    return data as BusinessProfile
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .insert({
      claim_id: claim.id,
      user_id: user.id,
      business_ref: claim.business_ref,
      ...payload,
    })
    .select(
      "id,claim_id,user_id,business_ref,tagline,description,booking_url,menu_url,order_url,website_url,contact_phone,contact_email,instagram_url,facebook_url,x_url,tiktok_url",
    )
    .single()

  if (error) throw new Error(friendlyWriteError(error.message))
  return data as BusinessProfile
}

export async function getSubscription(): Promise<Subscription | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,user_id,claim_id,tier,status,started_at,renews_at")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Subscription | null) ?? null
}

export async function joinGoldWaitlist(input: {
  businessRef?: string
  businessName?: string
  contactEmail?: string
}): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in to join the waitlist.")

  const { error } = await supabase.from("gold_waitlist").insert({
    user_id: user.id,
    business_ref: input.businessRef?.trim() || null,
    business_name: input.businessName?.trim() || null,
    contact_email: input.contactEmail?.trim() || null,
  })

  if (error) {
    if (error.code === "23505") throw new Error("You are already on the Gold waitlist.")
    throw new Error(error.message)
  }
}

export async function isOnGoldWaitlist(): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.from("gold_waitlist").select("id").limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}

// ===========================================================================
// SILVER: booking configuration, promotions, website builder, analytics.
// All writes are still authorised by the RLS policies in migrations 006/007
// (owner + approved claim); these helpers just shape the requests.
// ===========================================================================

export type BookingType = "table" | "service" | "class"
export type ServiceKind = "table" | "service" | "class"

export interface BookingSettings {
  id: string
  claim_id: string
  business_ref: string
  booking_type: BookingType
  accepts_bookings: boolean
  slot_interval_minutes: number
  default_duration_minutes: number
  capacity: number | null
  opening_hours: { day: number; open: string; close: string }[]
  blackout_dates: string[]
  confirmation_mode: "manual" | "auto"
  cancellation_policy: string | null
}
export type BookingSettingsDraft = Partial<
  Omit<BookingSettings, "id" | "claim_id" | "business_ref">
>

export interface BusinessService {
  id: string
  claim_id: string
  business_ref: string
  kind: ServiceKind
  name: string
  duration_minutes: number | null
  capacity: number | null
  price_pennies: number | null
  staff_name: string | null
  notes: string | null
  active: boolean
  sort_order: number
}
export type ServiceDraft = Partial<Omit<BusinessService, "id" | "claim_id" | "business_ref">>

export interface BookingRequest {
  id: string
  business_ref: string
  service_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  party_size: number | null
  requested_at: string
  notes: string | null
  status: "pending" | "confirmed" | "declined" | "cancelled"
  created_at: string
}

export interface Promotion {
  id: string
  claim_id: string
  business_ref: string
  title: string
  description: string | null
  cta_label: string | null
  cta_url: string | null
  starts_on: string | null
  ends_on: string | null
  audience: "all" | "saved" | "itinerary" | "nearby" | "category"
  status: "draft" | "scheduled" | "active" | "ended"
  is_paid_boost: boolean
  created_at: string
}
export type PromotionDraft = Partial<Omit<Promotion, "id" | "claim_id" | "business_ref" | "created_at">>

export interface WebsiteConfig {
  id: string
  claim_id: string
  business_ref: string
  template: "classic" | "bold" | "minimal"
  hero_image_url: string | null
  headline: string | null
  about: string | null
  cta_label: string | null
  cta_url: string | null
  section_order: string[]
  selected_photos: string[]
  custom_domain: string | null
  published: boolean
}
export type WebsiteDraft = Partial<Omit<WebsiteConfig, "id" | "claim_id" | "business_ref">>

export type BusinessAnalytics = Record<string, number>

const BOOKING_SETTINGS_COLS =
  "id,claim_id,business_ref,booking_type,accepts_bookings,slot_interval_minutes,default_duration_minutes,capacity,opening_hours,blackout_dates,confirmation_mode,cancellation_policy"
const SERVICE_COLS =
  "id,claim_id,business_ref,kind,name,duration_minutes,capacity,price_pennies,staff_name,notes,active,sort_order"
const PROMO_COLS =
  "id,claim_id,business_ref,title,description,cta_label,cta_url,starts_on,ends_on,audience,status,is_paid_boost,created_at"
const WEBSITE_COLS =
  "id,claim_id,business_ref,template,hero_image_url,headline,about,cta_label,cta_url,section_order,selected_photos,custom_domain,published"

export async function getBookingSettings(claimId: string): Promise<BookingSettings | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_booking_settings")
    .select(BOOKING_SETTINGS_COLS)
    .eq("claim_id", claimId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BookingSettings | null) ?? null
}

export async function saveBookingSettings(
  claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
  draft: BookingSettingsDraft,
): Promise<BookingSettings> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in.")

  const existing = await getBookingSettings(claim.id)
  if (existing) {
    const { data, error } = await supabase
      .from("business_booking_settings")
      .update(draft)
      .eq("id", existing.id)
      .select(BOOKING_SETTINGS_COLS)
      .single()
    if (error) throw new Error(friendlyWriteError(error.message))
    return data as BookingSettings
  }
  const { data, error } = await supabase
    .from("business_booking_settings")
    .insert({ claim_id: claim.id, user_id: user.id, business_ref: claim.business_ref, ...draft })
    .select(BOOKING_SETTINGS_COLS)
    .single()
  if (error) throw new Error(friendlyWriteError(error.message))
  return data as BookingSettings
}

export async function listServices(claimId: string): Promise<BusinessService[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_services")
    .select(SERVICE_COLS)
    .eq("claim_id", claimId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BusinessService[]
}

export async function upsertService(
  claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
  service: ServiceDraft & { id?: string },
): Promise<BusinessService> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in.")

  if (service.id) {
    const { id, ...rest } = service
    const { data, error } = await supabase
      .from("business_services")
      .update(rest)
      .eq("id", id)
      .select(SERVICE_COLS)
      .single()
    if (error) throw new Error(friendlyWriteError(error.message))
    return data as BusinessService
  }
  const { data, error } = await supabase
    .from("business_services")
    .insert({ claim_id: claim.id, user_id: user.id, business_ref: claim.business_ref, ...service })
    .select(SERVICE_COLS)
    .single()
  if (error) throw new Error(friendlyWriteError(error.message))
  return data as BusinessService
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("business_services").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function listBookingRequests(businessRef: string): Promise<BookingRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("booking_requests")
    .select(
      "id,business_ref,service_id,customer_name,customer_email,customer_phone,party_size,requested_at,notes,status,created_at",
    )
    .eq("business_ref", businessRef)
    .order("requested_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as BookingRequest[]
}

export async function updateBookingStatus(
  id: string,
  status: BookingRequest["status"],
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("booking_requests").update({ status }).eq("id", id)
  if (error) throw new Error(friendlyWriteError(error.message))
}

export async function listPromotions(claimId: string): Promise<Promotion[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_promotions")
    .select(PROMO_COLS)
    .eq("claim_id", claimId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Promotion[]
}

export async function upsertPromotion(
  claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
  promo: PromotionDraft & { id?: string },
): Promise<Promotion> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in.")

  if (promo.id) {
    const { id, ...rest } = promo
    const { data, error } = await supabase
      .from("business_promotions")
      .update(rest)
      .eq("id", id)
      .select(PROMO_COLS)
      .single()
    if (error) throw new Error(friendlyWriteError(error.message))
    return data as Promotion
  }
  const { data, error } = await supabase
    .from("business_promotions")
    .insert({ claim_id: claim.id, user_id: user.id, business_ref: claim.business_ref, ...promo })
    .select(PROMO_COLS)
    .single()
  if (error) throw new Error(friendlyWriteError(error.message))
  return data as Promotion
}

export async function deletePromotion(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("business_promotions").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getWebsite(claimId: string): Promise<WebsiteConfig | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_websites")
    .select(WEBSITE_COLS)
    .eq("claim_id", claimId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as WebsiteConfig | null) ?? null
}

export async function saveWebsite(
  claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
  draft: WebsiteDraft,
): Promise<WebsiteConfig> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You need to be signed in.")

  const existing = await getWebsite(claim.id)
  if (existing) {
    const { data, error } = await supabase
      .from("business_websites")
      .update(draft)
      .eq("id", existing.id)
      .select(WEBSITE_COLS)
      .single()
    if (error) throw new Error(friendlyWriteError(error.message))
    return data as WebsiteConfig
  }
  const { data, error } = await supabase
    .from("business_websites")
    .insert({ claim_id: claim.id, user_id: user.id, business_ref: claim.business_ref, ...draft })
    .select(WEBSITE_COLS)
    .single()
  if (error) throw new Error(friendlyWriteError(error.message))
  return data as WebsiteConfig
}

/** Aggregated analytics for a business the caller owns. Never returns identities. */
export async function getBusinessAnalytics(
  businessRef: string,
  days = 30,
): Promise<BusinessAnalytics> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_business_analytics", {
    p_business_ref: businessRef,
    p_days: days,
  })
  if (error) throw new Error(error.message)
  return (data as BusinessAnalytics) ?? {}
}

/** Trims values and converts empty strings to null so the DB holds real absence. */
function normaliseDraft(draft: BusinessProfileDraft): BusinessProfileDraft {
  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(draft)) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    out[key] = trimmed === "" ? null : trimmed
  }
  return out as BusinessProfileDraft
}

function friendlyWriteError(message: string): string {
  // The RLS policy rejects writes unless the claim is approved. Surface that as
  // the actionable cause instead of a raw policy-violation string.
  if (/row-level security|violates row-level/i.test(message)) {
    return "This venue is not approved yet, so its details cannot be published."
  }
  return message
}
