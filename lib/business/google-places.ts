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
  photos?: { photo_reference?: string }[]
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

export function mapGooglePlaceToBusiness(
  place: GooglePlaceResult,
  source: BusinessSource = "google",
): Business {
  const address = place.formatted_address || place.vicinity || undefined
  const types = Array.isArray(place.types) ? place.types.filter(Boolean) : []

  // Google returns photo references rather than URLs; proxy them.
  const images = (place.photos || [])
    .map((photo) => photo.photo_reference)
    .filter((ref): ref is string => Boolean(ref))
    .map((ref) => buildPlacePhotoUrl(ref))

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
      priceLevel: place.price_level,
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
