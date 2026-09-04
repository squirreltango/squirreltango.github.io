"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import {
  getProfileForClaim,
  saveProfile,
  getBookingSettings,
  saveBookingSettings,
  listServices,
  upsertService,
  deleteService,
  listBookingRequests,
  updateBookingStatus,
  listPromotions,
  upsertPromotion,
  deletePromotion,
  getWebsite,
  saveWebsite,
  getBusinessAnalytics,
  type BusinessClaim,
  type BusinessProfile,
  type BusinessProfileDraft,
  type BookingSettings,
  type BookingSettingsDraft,
  type BusinessService,
  type ServiceDraft,
  type BookingRequest,
  type Promotion,
  type PromotionDraft,
  type WebsiteConfig,
  type WebsiteDraft,
  type BusinessAnalytics,
  type Tier,
} from "@/lib/business-portal/client"

/**
 * Pluggable data layer for the business portal.
 *
 * The production sections talk to Supabase through `realPortalClient`. The
 * PREVIEW mode swaps in an in-memory client so a merchant can experience the
 * Bronze/Silver dashboard end-to-end WITHOUT an approved claim, without a
 * service-role key, and without ever touching the database or RLS. Preview
 * state is non-persistent: it resets on reload and is scoped to the browser
 * tab. No real subscription or claim status is modified.
 */
export interface PortalDataClient {
  getProfileForClaim(claimId: string): Promise<BusinessProfile | null>
  saveProfile(claim: Pick<BusinessClaim, "id" | "business_ref">, draft: BusinessProfileDraft): Promise<BusinessProfile>
  getBookingSettings(claimId: string): Promise<BookingSettings | null>
  saveBookingSettings(
    claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
    draft: BookingSettingsDraft,
  ): Promise<BookingSettings>
  listServices(claimId: string): Promise<BusinessService[]>
  upsertService(
    claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
    service: ServiceDraft & { id?: string },
  ): Promise<BusinessService>
  deleteService(id: string): Promise<void>
  listBookingRequests(businessRef: string): Promise<BookingRequest[]>
  updateBookingStatus(id: string, status: BookingRequest["status"]): Promise<void>
  listPromotions(claimId: string): Promise<Promotion[]>
  upsertPromotion(
    claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
    promo: PromotionDraft & { id?: string },
  ): Promise<Promotion>
  deletePromotion(id: string): Promise<void>
  getWebsite(claimId: string): Promise<WebsiteConfig | null>
  saveWebsite(
    claim: Pick<BusinessClaim, "id" | "business_ref" | "user_id">,
    draft: WebsiteDraft,
  ): Promise<WebsiteConfig>
  getBusinessAnalytics(businessRef: string, days: number): Promise<BusinessAnalytics>
  /** True only for the in-memory preview client. Lets UIs add honest labelling. */
  readonly isPreview: boolean
}

/** The genuine Supabase-backed client used by real, approved merchants. */
export const realPortalClient: PortalDataClient = {
  getProfileForClaim,
  saveProfile,
  getBookingSettings,
  saveBookingSettings,
  listServices,
  upsertService,
  deleteService,
  listBookingRequests,
  updateBookingStatus,
  listPromotions,
  upsertPromotion,
  deletePromotion,
  getWebsite,
  saveWebsite,
  getBusinessAnalytics,
  isPreview: false,
}

const PortalDataContext = createContext<PortalDataClient>(realPortalClient)

export function usePortalData(): PortalDataClient {
  return useContext(PortalDataContext)
}

export function PortalDataProvider({ client, children }: { client: PortalDataClient; children: ReactNode }) {
  return <PortalDataContext.Provider value={client}>{children}</PortalDataContext.Provider>
}

// ===========================================================================
// PREVIEW: in-memory implementation. Everything lives in a closure and is lost
// on reload. Nothing is fabricated as production data — the merchant is told,
// throughout the UI, that this is a preview sandbox.
// ===========================================================================

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 140))
}

function pid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/** A synthetic claim used to render the preview portal. Never persisted. */
export function previewClaim(tier: Tier): BusinessClaim {
  return {
    id: "preview-claim",
    user_id: "preview-user",
    business_ref: "preview-business",
    business_name: tier === "silver" ? "The Preview Kitchen (Silver demo)" : "The Preview Kitchen (Bronze demo)",
    status: "approved",
    contact_email: "hello@preview.example",
    contact_phone: "020 0000 0000",
    evidence_notes: null,
    created_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }
}

/**
 * Build a fresh in-memory client for a preview session. Seeded with a demo
 * profile and a couple of clearly-labelled sample booking requests so the
 * merchant can exercise confirm/decline. Analytics intentionally return zeros:
 * inventing engagement figures is never acceptable, even in preview.
 */
export function createPreviewClient(tier: Tier): PortalDataClient {
  const claimId = "preview-claim"
  const ref = "preview-business"

  let profile: BusinessProfile | null = {
    id: "preview-profile",
    claim_id: claimId,
    user_id: "preview-user",
    business_ref: ref,
    tagline: "Seasonal small plates in the heart of Soho",
    description:
      "A preview of how your listing reads on LookMeUp. Edit any field and press save — changes stay in this preview session only.",
    booking_url: null,
    menu_url: null,
    order_url: null,
    website_url: null,
    contact_phone: "020 0000 0000",
    contact_email: "hello@preview.example",
    instagram_url: "https://instagram.com/",
    facebook_url: null,
    x_url: null,
    tiktok_url: null,
  }

  let bookingSettings: BookingSettings | null = null
  const services: BusinessService[] = []
  const promotions: Promotion[] = []
  let website: WebsiteConfig | null = null

  const requests: BookingRequest[] = [
    {
      id: pid("preview-req"),
      business_ref: ref,
      service_id: null,
      customer_name: "Sample request (preview)",
      customer_email: "guest@preview.example",
      customer_phone: null,
      party_size: 2,
      requested_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      notes: "Window table if possible.",
      status: "pending",
      created_at: new Date().toISOString(),
    },
    {
      id: pid("preview-req"),
      business_ref: ref,
      service_id: null,
      customer_name: "Sample request (preview)",
      customer_email: "guest2@preview.example",
      customer_phone: null,
      party_size: 4,
      requested_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      notes: null,
      status: "pending",
      created_at: new Date().toISOString(),
    },
  ]

  return {
    isPreview: true,

    async getProfileForClaim() {
      return delay(profile)
    },
    async saveProfile(_claim, draft) {
      profile = {
        ...(profile as BusinessProfile),
        ...Object.fromEntries(
          Object.entries(draft).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]),
        ),
      } as BusinessProfile
      return delay(profile)
    },

    async getBookingSettings() {
      return delay(bookingSettings)
    },
    async saveBookingSettings(_claim, draft) {
      bookingSettings = {
        id: bookingSettings?.id ?? "preview-booking-settings",
        claim_id: claimId,
        business_ref: ref,
        booking_type: draft.booking_type ?? bookingSettings?.booking_type ?? "table",
        accepts_bookings: draft.accepts_bookings ?? bookingSettings?.accepts_bookings ?? false,
        slot_interval_minutes: draft.slot_interval_minutes ?? bookingSettings?.slot_interval_minutes ?? 30,
        default_duration_minutes: draft.default_duration_minutes ?? bookingSettings?.default_duration_minutes ?? 90,
        capacity: draft.capacity ?? bookingSettings?.capacity ?? null,
        opening_hours: draft.opening_hours ?? bookingSettings?.opening_hours ?? [],
        blackout_dates: draft.blackout_dates ?? bookingSettings?.blackout_dates ?? [],
        confirmation_mode: draft.confirmation_mode ?? bookingSettings?.confirmation_mode ?? "manual",
        cancellation_policy: draft.cancellation_policy ?? bookingSettings?.cancellation_policy ?? null,
      }
      return delay(bookingSettings)
    },

    async listServices() {
      return delay([...services].sort((a, b) => a.sort_order - b.sort_order))
    },
    async upsertService(_claim, service) {
      if (service.id) {
        const i = services.findIndex((s) => s.id === service.id)
        if (i >= 0) {
          services[i] = { ...services[i], ...service } as BusinessService
          return delay(services[i])
        }
      }
      const created: BusinessService = {
        id: pid("preview-service"),
        claim_id: claimId,
        business_ref: ref,
        kind: service.kind ?? "service",
        name: service.name ?? "Untitled service",
        duration_minutes: service.duration_minutes ?? null,
        capacity: service.capacity ?? null,
        price_pennies: service.price_pennies ?? null,
        staff_name: service.staff_name ?? null,
        notes: service.notes ?? null,
        active: service.active ?? true,
        sort_order: service.sort_order ?? services.length,
      }
      services.push(created)
      return delay(created)
    },
    async deleteService(id) {
      const i = services.findIndex((s) => s.id === id)
      if (i >= 0) services.splice(i, 1)
      return delay(undefined)
    },

    async listBookingRequests() {
      return delay([...requests])
    },
    async updateBookingStatus(id, status) {
      const r = requests.find((x) => x.id === id)
      if (r) r.status = status
      return delay(undefined)
    },

    async listPromotions() {
      return delay([...promotions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)))
    },
    async upsertPromotion(_claim, promo) {
      if (promo.id) {
        const i = promotions.findIndex((p) => p.id === promo.id)
        if (i >= 0) {
          promotions[i] = { ...promotions[i], ...promo } as Promotion
          return delay(promotions[i])
        }
      }
      const created: Promotion = {
        id: pid("preview-promo"),
        claim_id: claimId,
        business_ref: ref,
        title: promo.title ?? "Untitled offer",
        description: promo.description ?? null,
        cta_label: promo.cta_label ?? null,
        cta_url: promo.cta_url ?? null,
        starts_on: promo.starts_on ?? null,
        ends_on: promo.ends_on ?? null,
        audience: promo.audience ?? "all",
        status: promo.status ?? "draft",
        is_paid_boost: promo.is_paid_boost ?? false,
        created_at: new Date().toISOString(),
      }
      promotions.push(created)
      return delay(created)
    },
    async deletePromotion(id) {
      const i = promotions.findIndex((p) => p.id === id)
      if (i >= 0) promotions.splice(i, 1)
      return delay(undefined)
    },

    async getWebsite() {
      return delay(website)
    },
    async saveWebsite(_claim, draft) {
      website = {
        id: website?.id ?? "preview-website",
        claim_id: claimId,
        business_ref: ref,
        template: draft.template ?? website?.template ?? "classic",
        hero_image_url: draft.hero_image_url ?? website?.hero_image_url ?? null,
        headline: draft.headline ?? website?.headline ?? null,
        about: draft.about ?? website?.about ?? null,
        cta_label: draft.cta_label ?? website?.cta_label ?? null,
        cta_url: draft.cta_url ?? website?.cta_url ?? null,
        section_order: draft.section_order ?? website?.section_order ?? [],
        selected_photos: draft.selected_photos ?? website?.selected_photos ?? [],
        custom_domain: draft.custom_domain ?? website?.custom_domain ?? null,
        published: draft.published ?? website?.published ?? false,
      }
      return delay(website)
    },

    async getBusinessAnalytics() {
      // Honest: a demo business has had no genuine activity, so every metric is
      // zero. We never invent engagement figures, even in preview.
      return delay({})
    },
  }
}

/**
 * Whether the preview controls should be available in the current runtime.
 *
 * Preview is a testing aid, so it must never function on a real production
 * domain. It is enabled on local dev and on v0 / Vercel preview hosts, and
 * disabled everywhere else (i.e. a live custom domain).
 */
export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  if (host === "localhost" || host === "127.0.0.1") return true
  if (host.endsWith(".vusercontent.net")) return true
  if (host.endsWith(".vercel.app")) return true
  return false
}
