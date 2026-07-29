import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapGooglePlaceToBusiness, type GooglePlaceResult } from "@/lib/business/google-places"
import { businessToInsertRow, type BusinessInsertRow } from "@/lib/business/to-supabase-row"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// A small, representative test batch spanning several categories so every
// filter in the UI has real data behind it.
const DEFAULT_SEARCHES: { query: string; area: string }[] = [
  { query: "restaurants in Shoreditch London", area: "Shoreditch, London" },
  { query: "coffee shops in Soho London", area: "Soho, London" },
  { query: "cocktail bars in Soho London", area: "Soho, London" },
  { query: "gyms in Islington London", area: "Islington, London" },
  { query: "spas in Mayfair London", area: "Mayfair, London" },
]

const DEFAULT_LIMIT = 10

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim()
}

async function searchPlaces(query: string, apiKey: string): Promise<GooglePlaceResult[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(query)}&location=51.5074,-0.1278&radius=10000&key=${apiKey}`

  const response = await fetch(url, { cache: "no-store" })
  const data = await response.json()

  if (data.status !== "OK") {
    console.log("[v0] ingest: Google status", data.status, data.error_message || "")
    return []
  }

  return (data.results || []) as GooglePlaceResult[]
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not configured." },
      { status: 500 },
    )
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Row-level security blocks " +
          "writes with the public anon key, so ingestion needs the service-role key.",
      },
      { status: 500 },
    )
  }

  // Optional overrides: { searches?: [{query, area}], limit?: number, dryRun?: boolean }
  let body: { searches?: { query: string; area?: string }[]; limit?: number; dryRun?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // No body provided - use defaults.
  }

  const searches = body.searches?.length ? body.searches : DEFAULT_SEARCHES
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), 60)

  // Existing names let us skip duplicates. The table has no unique constraint
  // or place-id column, so we dedupe on the normalised name.
  const { data: existing, error: readError } = await supabase.from("businesses").select("name")
  if (readError) {
    return NextResponse.json(
      { error: `Could not read existing businesses: ${readError.message}` },
      { status: 500 },
    )
  }

  const seen = new Set((existing || []).map((row) => normaliseName(String(row.name || ""))))

  const rows: BusinessInsertRow[] = []
  const skipped: string[] = []

  for (const search of searches) {
    if (rows.length >= limit) break

    const places = await searchPlaces(search.query, apiKey)

    for (const place of places) {
      if (rows.length >= limit) break
      if (!place.name) continue

      const key = normaliseName(place.name)
      if (seen.has(key)) {
        skipped.push(place.name)
        continue
      }

      const business = mapGooglePlaceToBusiness(place, "google")

      // Coordinates are what make the map view usable - require them.
      if (!business.location.coordinates) {
        skipped.push(`${place.name} (no coordinates)`)
        continue
      }

      seen.add(key)
      rows.push(businessToInsertRow(business, search.area))
    }
  }

  if (body.dryRun) {
    return NextResponse.json({ dryRun: true, wouldInsert: rows.length, rows, skipped })
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, message: "No new venues to insert." })
  }

  const { data: inserted, error: insertError } = await supabase
    .from("businesses")
    .insert(rows)
    .select("id, name, category, location, lat, lng")

  if (insertError) {
    return NextResponse.json(
      { error: `Insert failed: ${insertError.message}`, attempted: rows.length },
      { status: 500 },
    )
  }

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    businesses: inserted,
    skippedCount: skipped.length,
  })
}
