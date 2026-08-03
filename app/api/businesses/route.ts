import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"
import { businesses as mockBusinesses } from "@/lib/data/businesses"
import type { Business } from "@/lib/types/business"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface SupabaseOutcome {
  businesses: Business[]
  available: boolean
}

/**
 * Read every business stored in Supabase.
 *
 * `available` distinguishes "the database answered but is empty" from "the
 * database could not be reached", which decides whether we fall back to the
 * bundled sample data.
 */
async function fetchSupabaseBusinesses(): Promise<SupabaseOutcome> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching businesses from Supabase:", error.message)
      return { businesses: [], available: false }
    }

    const rows = (data as BusinessRow[] | null) ?? []
    return { businesses: rows.map(mapSupabaseRowToBusiness), available: true }
  } catch (err) {
    console.error("[v0] Unexpected error reading Supabase businesses:", err)
    return { businesses: [], available: false }
  }
}

export async function GET() {
  const { businesses, available } = await fetchSupabaseBusinesses()

  // Supabase is the source of truth. The bundled sample data is only used when
  // the database is unreachable or has no rows yet, so the UI is never empty.
  if (businesses.length > 0) {
    return Response.json(businesses, {
      headers: { "x-data-source": "supabase" },
    })
  }

  console.warn(
    available
      ? "[v0] Supabase returned no businesses; serving bundled sample data. Run the ingestion route to populate it."
      : "[v0] Supabase unavailable; serving bundled sample data.",
  )

  return Response.json(mockBusinesses, {
    headers: { "x-data-source": available ? "mock-empty" : "mock-unavailable" },
  })
}
