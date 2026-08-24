import type { Business, GalleryImage } from "@/lib/types/business"

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
 * Provider-neutral trending signal, derived from LookMeUp's own ranking data.
 *
 * This intentionally does NOT read `providerRatings.instagram.trending`, which
 * is legacy seed data - reading it would make a LookMeUp label depend on an
 * Instagram-shaped field. `flags.trending` is our own editorial/ranking flag,
 * so the label stays honest and provider-neutral.
 */
export function isTrending(business: Business): boolean {
  return business.flags.trending === true
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
