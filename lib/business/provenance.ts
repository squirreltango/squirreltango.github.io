import type { Business, FoodHygieneRating, GalleryImage } from "@/lib/types/business"

/**
 * Single source of truth for provider attribution in the UI.
 *
 * Rule: a provider label may only appear when the data genuinely came from
 * that provider. We never label content with a provider we have not
 * integrated, and we never invent an attribution string.
 */

/**
 * Instagram is NOT integrated yet. There is no Instagram API client, no OAuth
 * app and no ingestion job anywhere in this codebase.
 *
 * Note that curated records in `lib/data/businesses.ts` DO carry
 * `gallery[].source === "instagram"`, but those URLs are Unsplash stock
 * photos - they are placeholder seed data, not real Instagram media. The same
 * applies to `providerRatings.instagram` follower/trending values, which are
 * hand-authored seed values (and Supabase columns populated from that seed)
 * rather than anything returned by Instagram.
 *
 * So while this flag is false the UI must not present Instagram as a source.
 * Flip it to true only once a verified Instagram integration actually
 * populates these fields, and the labels below light up on their own.
 */
export const INSTAGRAM_INTEGRATION_ENABLED = false

/**
 * True only when THIS business has Instagram data that genuinely came from
 * Instagram. Gates every Instagram-branded surface.
 *
 * Deliberately per-business, not global: flipping the feature flag must not
 * light up Instagram UI for businesses that were never matched to an account.
 * Three independent conditions must all hold:
 *
 *   1. the integration exists at all,
 *   2. this business was explicitly verified by the ingestion path,
 *   3. the values are marked as coming from a live Instagram sync.
 *
 * Verification is never inferred from follower count, trending, or the
 * presence of a username - a large follower number is not evidence of
 * provenance. Absent metadata is untrusted by default, so legacy seed rows
 * (no `verified`, no `provenance`) can never satisfy this.
 */
export function hasVerifiedInstagramData(business: Business): boolean {
  if (!INSTAGRAM_INTEGRATION_ENABLED) return false
  const instagram = business.providerRatings.instagram
  if (!instagram) return false
  if (instagram.verified !== true) return false
  return instagram.provenance === "live"
}

/**
 * Legacy seed/mock Instagram values, i.e. present but not verifiably from
 * Instagram. Used by the data audit; these must never reach the UI.
 */
export function hasLegacySeedInstagramData(business: Business): boolean {
  const instagram = business.providerRatings.instagram
  if (!instagram) return false
  const hasValues =
    instagram.followers !== undefined || instagram.trending !== undefined
  return hasValues && !hasVerifiedInstagramData(business)
}

/**
 * Honest, provider-neutral trending signal.
 *
 * There is no genuine Instagram/social dataset, so trending must NOT pretend to
 * represent social trends. It also deliberately does NOT read the legacy
 * `providerRatings.instagram.trending` seed flag (or the `flags.trending` value
 * historically derived from it), because that data is fabricated.
 *
 * Instead this is a transparent ranking heuristic over data we genuinely hold:
 * a place is "trending" when Google shows it is both highly rated AND backed by
 * a substantial volume of real reviews - i.e. lots of people are genuinely
 * rating it well. Anything without real Google rating + review-count data can
 * never qualify, so the filter shows an honest (possibly empty) result set
 * rather than silently behaving like "All".
 */
const TRENDING_MIN_RATING = 4.5
const TRENDING_MIN_REVIEWS = 400

export function isTrending(business: Business): boolean {
  const rating = business.rating.overall ?? business.providerRatings.google?.rating
  const reviews = business.rating.reviewCount ?? business.providerRatings.google?.reviews
  if (typeof rating !== "number" || typeof reviews !== "number") return false
  return rating >= TRENDING_MIN_RATING && reviews >= TRENDING_MIN_REVIEWS
}

/**
 * Descriptor tags that name a provider we have not integrated. Rewritten to a
 * provider-neutral equivalent so a tag never implies a venue was validated
 * through Instagram. Applied at normalisation time, which means legacy rows
 * already stored in Supabase are covered without a destructive migration.
 */
const PROVIDER_NEUTRAL_TAGS: Record<string, string> = {
  instagrammable: "Design-led",
}

/** Rewrites provider-implying tags in place, preserving order and casing. */
export function sanitiseTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const replacement = PROVIDER_NEUTRAL_TAGS[tag.trim().toLowerCase()] ?? tag
    // Guard against a rewrite colliding with a tag the record already has.
    const key = replacement.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(replacement)
  }
  return result
}

/**
 * The ONLY sanctioned way to read a hygiene rating for display.
 *
 * `providerRatings.foodHygiene` is a legacy, hand-authored seed number from
 * `lib/data/businesses.ts` and `scripts/002_seed_businesses.sql`. It was never
 * sourced from the Food Standards Agency, so presenting it as a hygiene rating
 * - especially with an FSA attribution - would be a fabricated food-safety
 * claim. This function ignores it entirely.
 *
 * Returns the real FSA rating only when a confident match exists. Absent means
 * "render nothing"; callers must never fall back to the legacy number.
 */
export function getVerifiedHygieneRating(business: Business): FoodHygieneRating | null {
  const rating = business.providerRatings.foodHygieneRating
  if (!rating) return null
  // Belt and braces: the matcher, the cache layer and the DB CHECK constraint
  // all reject anything below "high", so this should be unreachable.
  if (rating.matchConfidence !== "exact" && rating.matchConfidence !== "high") return null
  if (!rating.ratingValue?.trim()) return null
  return rating
}

/**
 * True when a business carries a legacy fabricated hygiene number but no real
 * FSA match. Used by the data audit to quantify how much of the old seed data
 * is being (correctly) suppressed.
 */
export function hasLegacySeedHygieneData(business: Business): boolean {
  return (
    business.providerRatings.foodHygiene !== undefined &&
    getVerifiedHygieneRating(business) === null
  )
}

export type ImageProvenance = { provider: "google" | "instagram"; label: string }

/**
 * Provenance for a single gallery image, or null when we cannot honestly
 * attribute it. Callers must render nothing when this returns null rather
 * than falling back to a guess.
 */
export function getGalleryImageProvenance(image: GalleryImage): ImageProvenance | null {
  if (image.source === "google") return { provider: "google", label: "Google" }
  // Instagram needs the integration AND per-image verification. The existing
  // `source: "instagram"` gallery entries are Unsplash stock URLs from the
  // seed data, so the flag alone must not be enough to label them.
  if (
    image.source === "instagram" &&
    INSTAGRAM_INTEGRATION_ENABLED &&
    image.verified === true
  ) {
    return { provider: "instagram", label: "Instagram" }
  }
  // "curated", unset, or Instagram-before-integration: no honest label exists.
  return null
}

/**
 * Human-readable summary of which providers genuinely supplied the gallery.
 * Returns null when no image can be attributed, so the caller can omit the
 * line entirely instead of claiming a source.
 */
export function describeGallerySources(images: GalleryImage[]): string | null {
  const providers = new Set<string>()
  for (const image of images) {
    const provenance = getGalleryImageProvenance(image)
    if (provenance) providers.add(provenance.label)
  }
  if (providers.size === 0) return null
  return [...providers].join(" and ")
}
