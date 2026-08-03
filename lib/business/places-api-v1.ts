// Google Places API (New) — Text Search.
//
// Uses an explicit field mask so we only pay for the fields we actually map
// into the Business model. Server-only: never import into a client component.

import type { Business } from "@/lib/types/business"
import { normaliseBusiness } from "@/lib/business/normalise-business"

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"

/**
 * The only fields we request. Keeping this tight controls Places SKU cost and
 * guarantees we never receive data we have no home for.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.primaryType",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.businessStatus",
  "places.currentOpeningHours.openNow",
  "places.photos.name",
].join(",")

/** Places API (New) returns price level as an enum rather than an integer. */
const PRICE_LEVEL_BY_ENUM: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

// Broad, low-signal types must not win category resolution and are noise as
// tags (a cafe reports both "cafe" and "food").
const GENERIC_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "food",
  "store",
  "health",
  "premise",
  "geocode",
])

export interface PlacesV1Place {
  id?: string
  displayName?: { text?: string }
  types?: string[]
  primaryType?: string
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  businessStatus?: string
  currentOpeningHours?: { openNow?: boolean }
  photos?: { name?: string }[]
}

export interface PlacesV1Result {
  business: Business
  openNow?: boolean
  placeTypes: string[]
  address?: string
}

/**
 * Map a Places API (New) place into the shared Business model.
 *
 * Only fields Google actually returned are populated. Instagram followers,
 * food-hygiene scores, Booking.com ratings, amenities, reviews, phone numbers
 * and websites are deliberately left empty — Google's Text Search does not
 * provide them and fabricating them is not acceptable.
 */
export function mapPlacesV1ToBusiness(
  place: PlacesV1Place,
  fallbackArea?: string,
): PlacesV1Result | null {
  const placeId = place.id
  const name = place.displayName?.text
  if (!placeId || !name) return null

  const types = (place.types ?? []).filter(Boolean)
  // primaryType is the most specific signal Google gives us, so try it first.
  const categorySignals = [
    place.primaryType,
    ...types.filter((type) => !GENERIC_TYPES.has(type)),
    ...types.filter((type) => GENERIC_TYPES.has(type)),
  ].filter((value): value is string => Boolean(value))

  const lat = place.location?.latitude
  const lng = place.location?.longitude

  const business = normaliseBusiness({
    id: placeId,
    source: "google",
    externalIds: { googlePlaceId: placeId },
    name,
    // normaliseBusiness maps the ordered signals onto an internal category id.
    category: categorySignals,
    subcategory: place.primaryType?.replace(/_/g, " "),
    address: place.formattedAddress,
    neighbourhood: fallbackArea,
    city: "London",
    coordinates:
      typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined,
    // Photos are resource names; they are resolved through our proxy so the
    // API key stays server-side.
    images: (place.photos ?? [])
      .map((photo) => photo.name)
      .filter((photoName): photoName is string => Boolean(photoName))
      .map((photoName) => `/api/place-photo?name=${encodeURIComponent(photoName)}&w=800`),
    rating: place.rating,
    reviewCount: place.userRatingCount,
    providerRatings: {
      google: { rating: place.rating, reviews: place.userRatingCount },
    },
    priceLevel: place.priceLevel ? PRICE_LEVEL_BY_ENUM[place.priceLevel] : undefined,
    tags: types.filter((type) => !GENERIC_TYPES.has(type)).map((type) => type.replace(/_/g, " ")),
  })

  return {
    business,
    openNow: place.currentOpeningHours?.openNow,
    placeTypes: types,
    address: place.formattedAddress,
  }
}

export interface SearchTextOptions {
  query: string
  area?: string
  maxResults?: number
}

export interface SearchTextOutcome {
  query: string
  results: PlacesV1Result[]
  error?: string
}

/**
 * Run a single Text Search (New) request.
 *
 * Failures are returned rather than thrown so one bad query cannot abort a
 * whole ingestion run.
 */
export async function searchText({
  query,
  area,
  maxResults = 20,
}: SearchTextOptions): Promise<SearchTextOutcome> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { query, results: [], error: "GOOGLE_PLACES_API_KEY is not configured" }
  }

  try {
    const response = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: Math.min(maxResults, 20),
        languageCode: "en-GB",
        regionCode: "GB",
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const detail = await response.text()
      return {
        query,
        results: [],
        error: `HTTP ${response.status}: ${detail.slice(0, 300)}`,
      }
    }

    const payload = (await response.json()) as { places?: PlacesV1Place[] }
    const results = (payload.places ?? [])
      .map((place) => mapPlacesV1ToBusiness(place, area))
      .filter((result): result is PlacesV1Result => result !== null)

    return { query, results }
  } catch (error) {
    return {
      query,
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
