import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Business, FoodHygieneRating, FsaMatchConfidence } from "@/lib/types/business"

/**
 * Durable cache for FSA hygiene ratings, keyed by Google Place ID and backed
 * by the `fsa_hygiene_details` Supabase table (scripts/004_...sql).
 *
 * Mirrors the design of `google-details-cache.ts` deliberately:
 *   * The homepage NEVER calls the FSA API - it only reads this cache.
 *   * Refreshes happen only via the admin job.
 *   * Everything degrades quietly: before the migration is applied, reads
 *     return empty and writes report `durable: false` with a clear reason
 *     rather than throwing.
 *
 * Keyed by Google Place ID (not our business id) so live Google venues that
 * have no persisted business row can still be enriched and cached, exactly
 * like the Google details cache. The existing `google_place_details` table and
 * its flow are untouched.
 */

/**
 * Hygiene ratings change only when a re-inspection is published, so a longer
 * window than Google enrichment is appropriate. 30 days keeps us current
 * without hammering a free public API.
 */
export const FSA_FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const TABLE = "fsa_hygiene_details"

// In-process mirror, pinned to globalThis so every route bundle in the same
// server process shares ONE map (same rationale as the Google details cache:
// Next.js otherwise gives each route its own module instance).
const globalForCache = globalThis as unknown as {
  __fsaHygieneMemoryCache?: Map<string, FoodHygieneRating>
}
const memoryCache: Map<string, FoodHygieneRating> =
  globalForCache.__fsaHygieneMemoryCache ?? new Map<string, FoodHygieneRating>()
globalForCache.__fsaHygieneMemoryCache = memoryCache

/** Detect "table missing" so we can degrade before the migration is applied. */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const message = error.message ?? ""
  return (
    code === "42P01" || // postgres: undefined_table
    code === "PGRST205" || // postgrest: table not found in schema cache
    /does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  )
}

export function isFsaRatingFresh(rating: FoodHygieneRating | undefined, now = Date.now()): boolean {
  if (!rating?.lastSyncedAt) return false
  const syncedAt = Date.parse(rating.lastSyncedAt)
  if (Number.isNaN(syncedAt)) return false
  return now - syncedAt < FSA_FRESHNESS_WINDOW_MS
}

interface FsaCacheRow {
  google_place_id: string
  business_id: string | null
  fhrs_id: number
  business_name: string | null
  business_type: string | null
  address: string | null
  postcode: string | null
  rating_value: string
  rating_date: string | null
  local_authority: string | null
  scheme_type: string | null
  new_rating_pending: boolean | null
  latitude: number | null
  longitude: number | null
  distance_meters: number | null
  match_confidence: string
  last_synced_at: string
}

function rowToRating(row: FsaCacheRow): FoodHygieneRating | null {
  // Defence in depth: the DB has a CHECK constraint, but if an unexpected
  // confidence value ever appears we drop the row rather than display it.
  if (row.match_confidence !== "exact" && row.match_confidence !== "high") return null

  return {
    fhrsId: row.fhrs_id,
    businessName: row.business_name ?? "",
    businessType: row.business_type ?? undefined,
    address: row.address ?? undefined,
    postcode: row.postcode ?? undefined,
    ratingValue: row.rating_value,
    ratingDate: row.rating_date ?? undefined,
    localAuthority: row.local_authority ?? undefined,
    schemeType: row.scheme_type ?? undefined,
    newRatingPending: row.new_rating_pending ?? false,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    matchConfidence: row.match_confidence as FsaMatchConfidence,
    distanceMeters: row.distance_meters ?? undefined,
    lastSyncedAt: row.last_synced_at,
  }
}

/**
 * Read cached hygiene ratings for a set of Google place ids. Returns a map of
 * place id -> rating, omitting any that are absent. Uses the public (anon)
 * client so the homepage can call it; never contacts the FSA.
 */
export async function readCachedHygiene(placeIds: string[]): Promise<Map<string, FoodHygieneRating>> {
  const result = new Map<string, FoodHygieneRating>()
  const ids = [...new Set(placeIds.filter(Boolean))]
  if (ids.length === 0) return result

  const missing: string[] = []
  for (const id of ids) {
    const mem = memoryCache.get(id)
    if (mem) result.set(id, mem)
    else missing.push(id)
  }
  if (missing.length === 0) return result

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "google_place_id, business_id, fhrs_id, business_name, business_type, address, postcode, rating_value, rating_date, local_authority, scheme_type, new_rating_pending, latitude, longitude, distance_meters, match_confidence, last_synced_at",
      )
      .in("google_place_id", missing)

    if (error) {
      if (!isMissingTableError(error)) {
        console.error("[v0] readCachedHygiene error:", error.message)
      }
      return result
    }

    for (const row of (data as FsaCacheRow[] | null) ?? []) {
      const rating = rowToRating(row)
      if (!rating) continue
      memoryCache.set(row.google_place_id, rating)
      result.set(row.google_place_id, rating)
    }
  } catch (err) {
    console.error("[v0] readCachedHygiene unexpected error:", err)
  }

  return result
}

/**
 * Attach cached hygiene ratings to a list of businesses, matched on Google
 * Place ID. Used for curated Supabase rows; live Google venues get the same
 * treatment inside `places-search.ts`.
 *
 * Purely additive and failure-tolerant - spreads over the existing
 * `providerRatings` so Google ratings, review counts and Trustpilot data are
 * preserved, and returns the input untouched on any error.
 */
export async function attachCachedHygiene(businesses: Business[]): Promise<Business[]> {
  const placeIds = businesses
    .map((b) => b.externalIds?.googlePlaceId)
    .filter((id): id is string => Boolean(id))

  if (placeIds.length === 0) return businesses

  try {
    const hygiene = await readCachedHygiene(placeIds)
    if (hygiene.size === 0) return businesses

    return businesses.map((business) => {
      const key = business.externalIds?.googlePlaceId
      const foodHygieneRating = key ? hygiene.get(key) : undefined
      return foodHygieneRating
        ? { ...business, providerRatings: { ...business.providerRatings, foodHygieneRating } }
        : business
    })
  } catch (error) {
    console.error("[v0] attachCachedHygiene failed; serving without hygiene:", error)
    return businesses
  }
}

export interface FsaWriteResult {
  ok: boolean
  durable: boolean
  reason?: string
}

/**
 * Persist a confidently-matched hygiene rating for a place id.
 *
 * Refuses to write anything other than an "exact" or "high" match. The DB
 * CHECK constraint enforces the same rule, but failing here too means an
 * ambiguous match cannot even reach the in-memory mirror.
 */
export async function writeCachedHygiene(
  placeId: string,
  rating: FoodHygieneRating,
  businessId?: string | null,
): Promise<FsaWriteResult> {
  if (rating.matchConfidence !== "exact" && rating.matchConfidence !== "high") {
    return { ok: false, durable: false, reason: `refusing to cache ${rating.matchConfidence} match` }
  }

  memoryCache.set(placeId, rating)

  const admin = createAdminClient()
  if (!admin) {
    return { ok: true, durable: false, reason: "service role key not configured" }
  }

  try {
    const { error } = await admin.from(TABLE).upsert(
      {
        google_place_id: placeId,
        business_id: businessId ?? null,
        fhrs_id: rating.fhrsId,
        business_name: rating.businessName || null,
        business_type: rating.businessType ?? null,
        address: rating.address ?? null,
        postcode: rating.postcode ?? null,
        rating_value: rating.ratingValue,
        rating_date: rating.ratingDate ?? null,
        local_authority: rating.localAuthority ?? null,
        scheme_type: rating.schemeType ?? null,
        new_rating_pending: rating.newRatingPending ?? false,
        latitude: rating.latitude ?? null,
        longitude: rating.longitude ?? null,
        distance_meters: rating.distanceMeters ?? null,
        match_confidence: rating.matchConfidence,
        last_synced_at: rating.lastSyncedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "google_place_id" },
    )

    if (error) {
      if (isMissingTableError(error)) {
        return {
          ok: true,
          durable: false,
          reason: "cache table not found - run scripts/004_add_fsa_hygiene_details.sql",
        }
      }
      return { ok: false, durable: false, reason: error.message }
    }

    return { ok: true, durable: true }
  } catch (err) {
    return { ok: false, durable: false, reason: err instanceof Error ? err.message : "unknown error" }
  }
}
