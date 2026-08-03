import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { searchText, type PlacesV1Result } from "@/lib/business/places-api-v1"
import { businessToGoogleSyncRow } from "@/lib/business/to-supabase-row"

// Server-only. Never import anything from this file into a client component.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Hard ceiling so an accidental call cannot import all of London. */
const MAX_TOTAL = 120
const DEFAULT_LIMIT = 100

/**
 * The controlled test batch: one query per category/area pairing.
 * Areas: Central London, Camden, Chelsea, Shoreditch, Barnet.
 */
const TEST_BATCH: { query: string; area: string }[] = [
  // Restaurants and food
  { query: "restaurants in Central London", area: "Central London" },
  { query: "restaurants in Camden, London", area: "Camden" },
  { query: "restaurants in Chelsea, London", area: "Chelsea" },
  { query: "restaurants in Shoreditch, London", area: "Shoreditch" },
  { query: "restaurants in Barnet, London", area: "Barnet" },
  // Cafes
  { query: "cafes in Central London", area: "Central London" },
  { query: "cafes in Chelsea, London", area: "Chelsea" },
  { query: "coffee shops in Shoreditch, London", area: "Shoreditch" },
  // Fitness
  { query: "gyms in Camden, London", area: "Camden" },
  { query: "gyms in Barnet, London", area: "Barnet" },
  // Beauty
  { query: "beauty salons in Shoreditch, London", area: "Shoreditch" },
  { query: "beauty salons in Chelsea, London", area: "Chelsea" },
  // Nightlife
  { query: "bars in Central London", area: "Central London" },
  { query: "bars in Shoreditch, London", area: "Shoreditch" },
  // Wellness
  { query: "wellness centres in London", area: "London" },
  { query: "spas in Camden, London", area: "Camden" },
]

/** Constant-time secret comparison to avoid leaking length/prefix via timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  // ---- 1. Auth ------------------------------------------------------------
  const expectedSecret = process.env.INGESTION_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      {
        error: "INGESTION_SECRET is not configured",
        hint: "Add INGESTION_SECRET to your Vercel project environment variables, then redeploy.",
      },
      { status: 503 },
    )
  }

  const provided =
    request.headers.get("x-ingestion-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""

  if (!provided || !secretMatches(provided, expectedSecret)) {
    // Deliberately vague so this cannot be used as an oracle.
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  // ---- 2. Preconditions ---------------------------------------------------
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 503 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase service-role key is not configured",
        hint: "Add SUPABASE_SERVICE_ROLE_KEY (or service_role_secret) to the project environment. The businesses table has RLS enabled, so the anon key cannot write.",
      },
      { status: 503 },
    )
  }

  // ---- 3. Options ---------------------------------------------------------
  const body = (await request.json().catch(() => ({}))) as {
    limit?: number
    dryRun?: boolean
  }
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_TOTAL)
  const dryRun = body.dryRun === true

  // ---- 4. Query Google ----------------------------------------------------
  const report = {
    queriesExecuted: [] as { query: string; area: string; found: number; error?: string }[],
    googleResultsFound: 0,
    duplicatesSkipped: 0,
    inserted: 0,
    updated: 0,
    failed: [] as { name: string; reason: string }[],
    categories: {} as Record<string, number>,
    areas: {} as Record<string, number>,
    estimatedGoogleRequests: 0,
    dryRun,
  }

  // De-duplicate across queries by Google place id.
  const byPlaceId = new Map<string, { result: PlacesV1Result; area: string }>()

  for (const { query, area } of TEST_BATCH) {
    if (byPlaceId.size >= limit) break

    const outcome = await searchText({ query, area })
    report.estimatedGoogleRequests += 1
    report.queriesExecuted.push({
      query,
      area,
      found: outcome.results.length,
      error: outcome.error,
    })
    report.googleResultsFound += outcome.results.length

    for (const result of outcome.results) {
      if (byPlaceId.size >= limit) break
      const placeId = result.business.externalIds?.googlePlaceId
      if (!placeId) continue
      if (byPlaceId.has(placeId)) {
        report.duplicatesSkipped += 1
        continue
      }
      byPlaceId.set(placeId, { result, area })
    }
  }

  const collected = [...byPlaceId.values()]

  if (collected.length === 0) {
    return NextResponse.json(
      {
        ...report,
        message: "No Google results were returned; nothing was written.",
      },
      { status: 502 },
    )
  }

  // ---- 5. Determine insert vs update -------------------------------------
  const placeIds = collected
    .map(({ result }) => result.business.externalIds?.googlePlaceId)
    .filter((id): id is string => Boolean(id))

  const { data: existingRows, error: existingError } = await supabase
    .from("businesses")
    .select("google_place_id")
    .in("google_place_id", placeIds)

  if (existingError) {
    const missingColumn = /google_place_id/.test(existingError.message)
    return NextResponse.json(
      {
        error: "Could not read existing rows",
        detail: existingError.message,
        hint: missingColumn
          ? "Run scripts/003_add_google_places_sync_columns.sql in the Supabase SQL editor first — the google_place_id column does not exist yet."
          : undefined,
      },
      { status: 500 },
    )
  }

  const existing = new Set((existingRows ?? []).map((row) => row.google_place_id as string))

  // ---- 6. Upsert ----------------------------------------------------------
  const rows = collected.map(({ result, area }) =>
    businessToGoogleSyncRow(result.business, {
      area,
      placeTypes: result.placeTypes,
      openNow: result.openNow,
    }),
  )

  for (const row of rows) {
    const category = row.category || "other"
    report.categories[category] = (report.categories[category] ?? 0) + 1
    if (row.area) report.areas[row.area] = (report.areas[row.area] ?? 0) + 1
  }

  if (!dryRun) {
    // Chunked so one oversized request cannot fail the whole run.
    const CHUNK = 25
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await supabase
        .from("businesses")
        .upsert(chunk, { onConflict: "google_place_id", ignoreDuplicates: false })

      if (error) {
        for (const row of chunk) {
          report.failed.push({ name: row.name, reason: error.message })
        }
        continue
      }

      for (const row of chunk) {
        if (row.google_place_id && existing.has(row.google_place_id)) report.updated += 1
        else report.inserted += 1
      }
    }
  }

  // ---- 7. Confirm what is now stored -------------------------------------
  const { count: totalGoogleRows } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true })
    .eq("source", "google")

  const { count: totalRows } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true })

  return NextResponse.json({
    ...report,
    uniqueVenuesCollected: collected.length,
    storedGoogleRows: totalGoogleRows ?? null,
    storedTotalRows: totalRows ?? null,
  })
}
