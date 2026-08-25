import "server-only"

import type { Business, OpeningHours } from "@/lib/types/business"
import { mapGooglePlaceToBusiness, type GooglePlaceResult } from "@/lib/business/google-places"
import { readCachedDetails } from "@/lib/business/google-details-cache"
import { readCachedHygiene } from "@/lib/business/fsa-hygiene-cache"
import { parseLegacyAddressComponents, type LegacyAddressComponent } from "@/lib/business/location"
import type { GoogleDetails } from "@/lib/types/business"

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

/** Google place ids are opaque strings that start with a known prefix. */
export function isGooglePlaceId(id: string): boolean {
  return /^ChI|^Ei|^Gh/.test(id)
}

// London city centre, used to bias results geographically.
const LONDON = { lat: 51.5074, lng: -0.1278 }
const RADIUS_METRES = 8000

/**
 * Seed queries used to populate the directory with live venues. Each maps onto
 * one of the app's categories so every filter has real results.
 */
export const SEED_QUERIES = [
  "best restaurants in London",
  "best bars in London",
  "speciality coffee shops in London",
  "gyms in London",
  "spas and beauty salons in London",
  "yoga and wellness studios in London",
] as const

interface CacheEntry {
  businesses: Business[]
  expiresAt: number
}

// In-memory cache so we don't re-hit Google (and burn quota) on every request.
// Lives for the lifetime of the server process.
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

/**
 * Run a single Google Places text search and map the results into the shared
 * Business model. Returns an empty array on failure so one bad query can never
 * take down the whole listing.
 */
async function searchOnce(query: string, apiKey: string): Promise<Business[]> {
  const url = new URL(TEXT_SEARCH_URL)
  url.searchParams.set("query", query)
  url.searchParams.set("location", `${LONDON.lat},${LONDON.lng}`)
  url.searchParams.set("radius", String(RADIUS_METRES))
  url.searchParams.set("key", apiKey)

  try {
    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      console.error(`[v0] Places search failed for "${query}": HTTP ${response.status}`)
      return []
    }

    const payload = (await response.json()) as {
      status?: string
      error_message?: string
      results?: GooglePlaceResult[]
    }

    // ZERO_RESULTS is a valid, non-error outcome.
    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      console.error(
        `[v0] Places search for "${query}" returned ${payload.status}: ${payload.error_message ?? "no message"}`,
      )
      return []
    }

    return (payload.results ?? []).map((place) => mapGooglePlaceToBusiness(place))
  } catch (error) {
    console.error(`[v0] Places search threw for "${query}":`, error)
    return []
  }
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/**
 * Convert Google's human-readable `weekday_text` (e.g.
 * "Monday: 9:00 AM – 5:00 PM") into the app's structured OpeningHours model.
 */
function parseWeekdayText(weekdayText: string[]): OpeningHours[] {
  const hours: OpeningHours[] = []

  for (const line of weekdayText) {
    const separator = line.indexOf(":")
    if (separator === -1) continue

    const dayName = line.slice(0, separator).trim().toLowerCase()
    const day = DAY_INDEX[dayName]
    if (day === undefined) continue

    const value = line.slice(separator + 1).trim()

    if (/closed/i.test(value)) {
      hours.push({ day, closed: true })
      continue
    }

    if (/open 24 hours/i.test(value)) {
      hours.push({ day, open: "00:00", close: "23:59" })
      continue
    }

    // Google uses an en dash between times, and may list multiple ranges.
    const [open, close] = value.split(/\s*[–-]\s*/)
    hours.push({ day, open: open?.trim(), close: close?.trim() })
  }

  return hours
}

/**
 * Fetch a single venue by Google place id, including the richer fields the
 * Details endpoint exposes (opening hours, phone, website, reviews).
 */
export async function fetchLiveBusinessById(placeId: string): Promise<Business | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error("[v0] GOOGLE_PLACES_API_KEY is not set; cannot fetch place details")
    return null
  }

  const url = new URL(DETAILS_URL)
  url.searchParams.set("place_id", placeId)
  url.searchParams.set("key", apiKey)
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "rating",
      "user_ratings_total",
      "formatted_address",
      // Structured location. `address_component` is a Basic Data field and adds
      // no incremental cost to this Details call (which already requests
      // reviews/opening_hours), so the detail page gets an accurate area for
      // free even before background enrichment runs.
      "address_component",
      "types",
      "price_level",
      "geometry",
      "photos",
      "opening_hours",
      "formatted_phone_number",
      "website",
      "reviews",
    ].join(","),
  )

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) {
      console.error(`[v0] Place details failed for ${placeId}: HTTP ${response.status}`)
      return null
    }

    const payload = (await response.json()) as {
      status?: string
      error_message?: string
      result?: GooglePlaceResult & {
        address_components?: LegacyAddressComponent[]
        opening_hours?: { weekday_text?: string[]; open_now?: boolean }
        formatted_phone_number?: string
        website?: string
        reviews?: {
          author_name?: string
          rating?: number
          text?: string
          relative_time_description?: string
        }[]
      }
    }

    if (payload.status !== "OK" || !payload.result) {
      console.error(
        `[v0] Place details for ${placeId} returned ${payload.status}: ${payload.error_message ?? "no message"}`,
      )
      return null
    }

    const result = payload.result
    const business = mapGooglePlaceToBusiness(result)

    // Attach cached Google Place Details enrichment (amenities/editorial summary)
    // for this venue. Pure cache read - never calls Place Details (New) here.
    // Also read the cached FSA hygiene rating for this venue. Same contract:
    // pure cache read, never calls the FSA, and a miss simply means the venue
    // shows no hygiene rating.
    const [cached, cachedHygieneMap] = await Promise.all([
      readCachedDetails([placeId]),
      readCachedHygiene([placeId]).catch((error) => {
        console.error("[v0] readCachedHygiene failed for detail view:", error)
        return new Map()
      }),
    ])
    const cachedDetails = cached.get(placeId)
    const foodHygieneRating = cachedHygieneMap.get(placeId)

    // Parse the structured address components this Details call returned (legacy
    // Basic Data - no extra cost). Prefer the enrichment cache's location when
    // it already resolved a specific area; otherwise use this live parse.
    const liveLocation = parseLegacyAddressComponents(result.address_components, {
      formattedAddress: result.formatted_address,
      coordinates: business.location.coordinates,
    })
    const cachedHasArea = Boolean(
      cachedDetails?.location?.neighbourhood || cachedDetails?.location?.sublocality,
    )
    const resolvedLocation = cachedHasArea ? cachedDetails!.location : liveLocation

    const googleDetails: GoogleDetails | undefined =
      cachedDetails || resolvedLocation
        ? { ...(cachedDetails ?? {}), ...(resolvedLocation ? { location: resolvedLocation } : {}) }
        : undefined

    // Merge structured location into the base model WITHOUT touching existing
    // coordinates (per requirement: never change map coordinates).
    const mergedLocation = {
      ...business.location,
      address: resolvedLocation?.formattedAddress ?? business.location.address,
      neighbourhood:
        resolvedLocation?.neighbourhood ??
        resolvedLocation?.sublocality ??
        business.location.neighbourhood,
      postcode: resolvedLocation?.postcode ?? business.location.postcode,
    }

    // Layer on the detail-only fields the search endpoint doesn't return.
    return {
      ...business,
      location: mergedLocation,
      ...(googleDetails ? { googleDetails } : {}),
      // Additive only - spreads over the existing providerRatings so the
      // Google rating, review count and any other provider data are preserved.
      ...(foodHygieneRating
        ? { providerRatings: { ...business.providerRatings, foodHygieneRating } }
        : {}),
      openingHours: result.opening_hours?.weekday_text?.length
        ? parseWeekdayText(result.opening_hours.weekday_text)
        : business.openingHours,
      contact: {
        ...business.contact,
        phone: result.formatted_phone_number ?? business.contact?.phone,
        website: result.website ?? business.contact?.website,
      },
      reviews: result.reviews?.length
        ? result.reviews.map((review, index) => ({
            id: `${placeId}-review-${index}`,
            author: review.author_name ?? "Google reviewer",
            rating: review.rating ?? 0,
            text: review.text ?? "",
            date: review.relative_time_description,
            source: "google",
          }))
        : business.reviews,
    }
  } catch (error) {
    console.error(`[v0] Place details threw for ${placeId}:`, error)
    return null
  }
}

/**
 * Fetch live venues from Google Places for the given queries, de-duplicated by
 * Google place id and sorted by rating. Results are cached in-process.
 */
export async function fetchLiveBusinesses(
  queries: readonly string[] = SEED_QUERIES,
): Promise<Business[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    console.error("[v0] GOOGLE_PLACES_API_KEY is not set; skipping live venue fetch")
    return []
  }

  const cacheKey = queries.join("|")
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    // Re-attach enrichment on the cached path too. The Text Search cache stores
    // only the raw venues; enrichment freshness is governed separately by the
    // Supabase cache, so newly-enriched data appears without waiting for the
    // Text Search cache to expire. This is a pure read - no Google Details call.
    return attachCachedDetails(cached.businesses)
  }

  const settled = await Promise.all(queries.map((query) => searchOnce(query, apiKey)))

  // De-duplicate: the same venue can surface across multiple queries.
  const byId = new Map<string, Business>()
  for (const business of settled.flat()) {
    const key = business.externalIds?.googlePlaceId ?? business.id
    if (key && !byId.has(key)) byId.set(key, business)
  }

  // Highest rated first; unrated venues sink to the bottom.
  const businesses = [...byId.values()].sort(
    (a, b) => (b.rating?.overall ?? 0) - (a.rating?.overall ?? 0),
  )

  // Cache the RAW venues (without enrichment) so enrichment stays decoupled.
  cache.set(cacheKey, { businesses, expiresAt: Date.now() + CACHE_TTL_MS })

  // Attach any cached Google Place Details enrichment. This is a pure READ of
  // the Supabase cache - it never calls Google, so the homepage stays on the
  // cheap Text Search SKU. Businesses without cached enrichment are unchanged.
  return attachCachedDetails(businesses)
}

/**
 * Attach cached Google Place Details enrichment AND cached FSA hygiene ratings
 * to live businesses by place id.
 *
 * Read-only and failure-tolerant: on any cache miss or error the businesses are
 * returned exactly as they came in. Neither Google nor the FSA is ever called
 * from here, so the homepage stays on the cheap Text Search SKU.
 *
 * The two caches are independent - a venue can have Google enrichment without a
 * hygiene rating (no confident FSA match) and vice versa. Hygiene is purely
 * additive: it never modifies coordinates, Google ratings, reviews or photos.
 */
async function attachCachedDetails(businesses: Business[]): Promise<Business[]> {
  const placeIds = businesses
    .map((b) => b.externalIds?.googlePlaceId ?? b.id)
    .filter((id): id is string => Boolean(id))

  if (placeIds.length === 0) return businesses

  // Read both caches concurrently, and let either fail independently so a
  // problem with one never suppresses the other.
  const [detailsResult, hygieneResult] = await Promise.allSettled([
    readCachedDetails(placeIds),
    readCachedHygiene(placeIds),
  ])

  if (detailsResult.status === "rejected") {
    console.error("[v0] readCachedDetails failed; serving un-enriched:", detailsResult.reason)
  }
  if (hygieneResult.status === "rejected") {
    console.error("[v0] readCachedHygiene failed; serving without hygiene:", hygieneResult.reason)
  }

  const details = detailsResult.status === "fulfilled" ? detailsResult.value : new Map()
  const hygiene = hygieneResult.status === "fulfilled" ? hygieneResult.value : new Map()

  if (details.size === 0 && hygiene.size === 0) return businesses

  return businesses.map((business) => {
    const key = business.externalIds?.googlePlaceId ?? business.id
    if (!key) return business

    const googleDetails = details.get(key)
    const foodHygieneRating = hygiene.get(key)
    if (!googleDetails && !foodHygieneRating) return business

    return {
      ...business,
      ...(googleDetails ? { googleDetails } : {}),
      ...(foodHygieneRating
        ? { providerRatings: { ...business.providerRatings, foodHygieneRating } }
        : {}),
    }
  })
}
