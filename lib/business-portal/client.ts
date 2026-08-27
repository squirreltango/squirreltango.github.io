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
