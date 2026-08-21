import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { GoogleDetails } from "@/lib/types/business"

/**
 * Durable cache for Google Place Details (New) enrichment, keyed by Google
 * Place ID, backed by the `google_place_details` Supabase table.
 *
 * Design goals:
 *   * The homepage NEVER calls Google - it only reads this cache.
 *   * Enrichment is considered fresh for 7 days; only the admin job refreshes.
 *   * Everything degrades gracefully: if the table does not exist yet (before
 *     the migration is applied) all reads return empty and writes report a
 *     clear reason instead of throwing.
 *
 * A tiny in-process mirror sits in front of Supabase so that, within a single
 * running server, enrichment written by the admin job is visible to the
 * homepage immediately (and before the migration is applied). Supabase remains
 * the durable source of truth across restarts and deployments.
 */

export const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const TABLE = "google_place_details"

// In-process mirror. Not a substitute for Supabase - just an accelerator.
//
// It is pinned to globalThis so every route bundle in the same server process
// shares ONE map. Without this, Next.js gives each route (e.g. the admin
// enrich route vs. the businesses API) its own module instance, so enrichment
// written by one route would be invisible to another until it hit Supabase.
const globalForCache = globalThis as unknown as {
  __googleDetailsMemoryCache?: Map<string, GoogleDetails>
}
const memoryCache: Map<string, GoogleDetails> =
  globalForCache.__googleDetailsMemoryCache ?? new Map<string, GoogleDetails>()
globalForCache.__googleDetailsMemoryCache = memoryCache

// Detect the "relation does not exist" / "table not found" family of errors so
// we can degrade quietly before the migration has been applied.
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

export function isFresh(details: GoogleDetails | undefined, now = Date.now()): boolean {
  if (!details?.detailsLastSyncedAt) return false
  const syncedAt = Date.parse(details.detailsLastSyncedAt)
  if (Number.isNaN(syncedAt)) return false
  return now - syncedAt < FRESHNESS_WINDOW_MS
}

interface CacheRow {
  place_id: string
  details: GoogleDetails
  details_last_synced_at: string
}

function rowToDetails(row: CacheRow): GoogleDetails {
  return {
    ...(row.details ?? {}),
    detailsLastSyncedAt: row.details_last_synced_at ?? row.details?.detailsLastSyncedAt,
  }
}

/**
 * Read cached enrichment for a set of place ids. Returns a map of place id ->
 * GoogleDetails, omitting any that are absent. Uses the public (anon) client so
 * it works on the homepage; never fetches from Google.
 */
export async function readCachedDetails(placeIds: string[]): Promise<Map<string, GoogleDetails>> {
  const result = new Map<string, GoogleDetails>()
  const ids = [...new Set(placeIds.filter(Boolean))]
  if (ids.length === 0) return result

  // Serve from the in-process mirror first.
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
      .select("place_id, details, details_last_synced_at")
      .in("place_id", missing)

    if (error) {
      if (!isMissingTableError(error)) {
        console.error("[v0] readCachedDetails error:", error.message)
      }
      return result
    }

    for (const row of (data as CacheRow[] | null) ?? []) {
      const details = rowToDetails(row)
      memoryCache.set(row.place_id, details)
      result.set(row.place_id, details)
    }
  } catch (err) {
    console.error("[v0] readCachedDetails unexpected error:", err)
  }

  return result
}

export interface WriteResult {
  ok: boolean
  durable: boolean // true when persisted to Supabase, false when memory-only
  reason?: string
}

/**
 * Persist enrichment for a place id. Writes to Supabase with the service role
 * and mirrors into memory. When the table is missing (pre-migration) the write
 * still succeeds in memory and reports `durable: false` with a clear reason.
 */
export async function writeCachedDetails(placeId: string, details: GoogleDetails): Promise<WriteResult> {
  // Always update the in-process mirror so the running server reflects it now.
  memoryCache.set(placeId, details)

  const admin = createAdminClient()
  if (!admin) {
    return { ok: true, durable: false, reason: "service role key not configured" }
  }

  try {
    const { error } = await admin.from(TABLE).upsert(
      {
        place_id: placeId,
        details,
        details_last_synced_at: details.detailsLastSyncedAt ?? new Date().toISOString(),
      },
      { onConflict: "place_id" },
    )

    if (error) {
      if (isMissingTableError(error)) {
        return { ok: true, durable: false, reason: "cache table not found - run scripts/003_add_google_place_details_cache.sql" }
      }
      return { ok: false, durable: false, reason: error.message }
    }

    return { ok: true, durable: true }
  } catch (err) {
    return { ok: false, durable: false, reason: err instanceof Error ? err.message : "unknown error" }
  }
}
