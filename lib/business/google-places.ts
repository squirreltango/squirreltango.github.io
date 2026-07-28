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
export function mapGooglePlaceToBusiness(
  place: GooglePlaceResult,
  source: BusinessSource = "google",
): Business {
  const address = place.formatted_address || place.vicinity || undefined

  return normaliseBusiness(
    {
      id: place.place_id,
      externalIds: place.place_id ? { googlePlaceId: place.place_id } : undefined,
      name: place.name,
      // Google `types` are mapped to an internal category id.
      category: place.types,
      description: undefined,
      address,
      city: "London",
      coordinates:
        place.geometry?.location &&
        typeof place.geometry.location.lat === "number" &&
        typeof place.geometry.location.lng === "number"
          ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
          : undefined,
      priceLevel: place.price_level,
      // Google types double as lightweight tags for search/context.
      tags: Array.isArray(place.types) ? place.types : [],
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
