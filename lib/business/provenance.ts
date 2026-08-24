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
 * True only when Instagram-derived numbers can be trusted as genuinely
 * originating from Instagram. Gates Instagram-branded stat tiles.
 */
export function hasVerifiedInstagramData(business: Business): boolean {
  if (!INSTAGRAM_INTEGRATION_ENABLED) return false
  const instagram = business.providerRatings.instagram
  return instagram?.followers !== undefined || instagram?.trending !== undefined
}

/** Trending is a real signal, but it is not an Instagram-attributed one today. */
export function isTrending(business: Business): boolean {
  return business.providerRatings.instagram?.trending === true
}

export type ImageProvenance = { provider: "google" | "instagram"; label: string }

/**
 * Provenance for a single gallery image, or null when we cannot honestly
 * attribute it. Callers must render nothing when this returns null rather
 * than falling back to a guess.
 */
export function getGalleryImageProvenance(image: GalleryImage): ImageProvenance | null {
  if (image.source === "google") return { provider: "google", label: "Google" }
  if (image.source === "instagram" && INSTAGRAM_INTEGRATION_ENABLED) {
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
