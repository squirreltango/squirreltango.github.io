/**
 * Tier capability model for the business portal.
 *
 * Single source of truth for what each plan unlocks, so the portal, the
 * pricing page and the public business page cannot drift apart.
 *
 * IMPORTANT: this is a PRESENTATION layer only. It decides what a merchant is
 * shown and what the UI offers. It is not a security boundary — the database
 * policies in migrations 005/006 are what actually authorise writes.
 */

export type Tier = "none" | "bronze" | "silver" | "gold"

export const TIER_ORDER: Record<Tier, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
}

export interface TierCapabilities {
  /** Core listing accuracy: name, address, hours, hygiene rating. */
  editCoreDetails: boolean
  /** Description, tagline, booking/menu/social links. */
  editRichContent: boolean
  /** Accept booking requests inside LookMeUp (Silver+). */
  nativeBookings: boolean
  /** Profile views, saves and click analytics (Silver+). */
  analytics: boolean
  /** Priority placement in relevant searches (Silver+). */
  priorityPlacement: boolean
  /** Connect a genuine Instagram business account (Silver+). */
  instagramConnect: boolean
  /** Create promotions and offers shown on the listing (Silver+). */
  promotions: boolean
  /** Build a hosted microsite from the listing (Gold). */
  websiteBuilder: boolean
  /** Growth services: domains, trademarks, campaigns (Gold). */
  growthServices: boolean
}

const CAPABILITIES: Record<Tier, TierCapabilities> = {
  none: {
    editCoreDetails: false,
    editRichContent: false,
    nativeBookings: false,
    analytics: false,
    priorityPlacement: false,
    instagramConnect: false,
    promotions: false,
    websiteBuilder: false,
    growthServices: false,
  },
  // Bronze is free and deliberately generous: an accurate listing benefits
  // consumers, so content editing is not paywalled.
  bronze: {
    editCoreDetails: true,
    editRichContent: true,
    nativeBookings: false,
    analytics: false,
    priorityPlacement: false,
    instagramConnect: false,
    promotions: false,
    websiteBuilder: false,
    growthServices: false,
  },
  silver: {
    editCoreDetails: true,
    editRichContent: true,
    nativeBookings: true,
    analytics: true,
    priorityPlacement: true,
    instagramConnect: true,
    promotions: true,
    websiteBuilder: false,
    growthServices: false,
  },
  gold: {
    editCoreDetails: true,
    editRichContent: true,
    nativeBookings: true,
    analytics: true,
    priorityPlacement: true,
    instagramConnect: true,
    promotions: true,
    websiteBuilder: true,
    growthServices: true,
  },
}

/**
 * An approved claim with no subscription row is treated as Bronze: claiming is
 * free, so an owner is never left with a read-only listing.
 */
export function resolveTier(
  subscriptionTier: string | null | undefined,
  claimApproved: boolean,
): Tier {
  if (!claimApproved) return "none"
  const tier = (subscriptionTier ?? "").toLowerCase()
  if (tier === "gold") return "gold"
  if (tier === "silver") return "silver"
  return "bronze"
}

export function capabilitiesFor(tier: Tier): TierCapabilities {
  return CAPABILITIES[tier]
}

export function hasAtLeast(tier: Tier, required: Tier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[required]
}

/** The plan a merchant must reach to unlock a locked capability. */
export const REQUIRED_TIER: Partial<Record<keyof TierCapabilities, Tier>> = {
  nativeBookings: "silver",
  analytics: "silver",
  priorityPlacement: "silver",
  instagramConnect: "silver",
  promotions: "silver",
  websiteBuilder: "gold",
  growthServices: "gold",
}

export const TIER_LABEL: Record<Tier, string> = {
  none: "Unclaimed",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
}
