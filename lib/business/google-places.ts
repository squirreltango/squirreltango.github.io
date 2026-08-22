import type { Business, BusinessSource } from "@/lib/types/business"
import { normaliseBusiness } from "@/lib/business/normalise-business"

// Minimal shape of a Google Places Text Search result that we rely on.
export interface GooglePlaceResult {
  place_id?: string
  name?: string
  rating?: number
  user_ratings_total?: number
  formatted_address?: string
  vicinity?: string
  types?: string[]
  price_level?: number
  opening_hours?: { open_now?: boolean }
  geometry?: { location?: { lat?: number; lng?: number } }
  // Legacy Places photos include pixel dimensions, which we use to prefer a
  // landscape hero image deterministically. `html_attributions` carries the
  // photographer credit Google requires us to display.
  photos?: {
    photo_reference?: string
    width?: number
    height?: number
    html_attributions?: string[]
  }[]
}

/**
 * Map a Google Places result into the shared Business model. Only maps data
 * the API actually returns - never fabricates Instagram, hygiene, booking,
 * amenities, reviews or contact details.
 */
// Google returns broad, low-signal types alongside specific ones. These must
// not win category resolution (a cafe lists both "cafe" and "food") and are
// noise as tags.
const GENERIC_PLACE_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "food",
  "store",
  "health",
  "premise",
  "geocode",
])

/**
 * Order Google types so specific ones (cafe, bar, gym) resolve the category
 * before broad ones (food, establishment).
 */
function prioritiseTypes(types: string[]): string[] {
  const specific = types.filter((t) => !GENERIC_PLACE_TYPES.has(t))
  const generic = types.filter((t) => GENERIC_PLACE_TYPES.has(t))
  return [...specific, ...generic]
}

/**
 * Build a proxied photo URL for a Google photo reference. Routing through our
 * own endpoint keeps the API key server-side.
 */
export function buildPlacePhotoUrl(photoReference: string, width = 800): string {
  return `/api/place-photo?ref=${encodeURIComponent(photoReference)}&w=${width}`
}

/**
 * Convert Google's `html_attributions` (an anchor tag) into plain text so it can
 * be rendered safely without `dangerouslySetInnerHTML`. Returns undefined when
 * Google supplied no credit - we never invent one.
 */
export function toPlainAttribution(htmlAttributions?: string[]): string | undefined {
  const raw = htmlAttributions?.[0]
  if (!raw) return undefined
  const text = raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
  return text || undefined
}

export function mapGooglePlaceToBusiness(
  place: GooglePlaceResult,
  source: BusinessSource = "google",
): Business {
  const address = place.formatted_address || place.vicinity || undefined
  const types = Array.isArray(place.types) ? place.types.filter(Boolean) : []

  // Google returns photo references rather than URLs; proxy them. We reorder so
  // the first landscape photo becomes the hero (better for a 4:3 card) while
  // keeping the rest of Google's ordering. This is deterministic - the same
  // place always yields the same hero - and never invents imagery.
  const photoObjects = (place.photos || []).filter((photo) => Boolean(photo.photo_reference))
  const heroIndex = photoObjects.findIndex(
    (photo) =>
      typeof photo.width === "number" &&
      typeof photo.height === "number" &&
      photo.width >= photo.height,
  )
  const orderedPhotos =
    heroIndex > 0
      ? [photoObjects[heroIndex], ...photoObjects.filter((_, i) => i !== heroIndex)]
      : photoObjects
  const usablePhotos = orderedPhotos.filter((photo) => Boolean(photo.photo_reference))
  const images = usablePhotos.map((photo) => buildPlacePhotoUrl(photo.photo_reference as string))
  // Credits stay aligned by index with `images` above.
  const attributions = usablePhotos.map((photo) => toPlainAttribution(photo.html_attributions) ?? "")
  const hasAnyAttribution = attributions.some(Boolean)

  return normaliseBusiness(
    {
      id: place.place_id,
      externalIds: place.place_id ? { googlePlaceId: place.place_id } : undefined,
      name: place.name,
      // Google `types` are mapped to an internal category id; specific types
      // take precedence over broad ones.
      category: prioritiseTypes(types),
      description: undefined,
      address,
      city: "London",
      coordinates:
        place.geometry?.location &&
        typeof place.geometry.location.lat === "number" &&
        typeof place.geometry.location.lng === "number"
          ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
          : undefined,
      images: images.length > 0 ? images : undefined,
      attributions: hasAnyAttribution ? attributions : undefined,
      priceLevel: place.price_level,
      openNow: typeof place.opening_hours?.open_now === "boolean" ? place.opening_hours.open_now : undefined,
      // Specific Google types double as lightweight, human-readable tags.
      tags: types
        .filter((type) => !GENERIC_PLACE_TYPES.has(type))
        .map((type) => type.replace(/_/g, " ")),
      ratings: {
        google: {
          rating: place.rating,
          reviews: place.user_ratings_total,
        },
      },
    },
    source,
  )
}
