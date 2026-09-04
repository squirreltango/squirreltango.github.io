import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"
import { fetchLiveBusinesses } from "@/lib/business/places-search"
import { attachCachedHygiene } from "@/lib/business/fsa-hygiene-cache"
import type { Business } from "@/lib/types/business"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Fetch the curated rows stored in Supabase. Returns an empty list (rather than
 * throwing) so a database problem can't stop live results being served.
 */
async function fetchSupabaseBusinesses(): Promise<Business[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching businesses from Supabase:", error.message)
      return []
    }

    const rows = (data as BusinessRow[] | null) ?? []

    // Exclude legacy curated/seed rows from the consumer discovery experience.
    // These carry fabricated ratings, review counts and Instagram figures, so
    // presenting them beside genuine Google results would misrepresent them as
    // real businesses. The rows are LEFT IN PLACE (not deleted) so existing
    // saves, itinerary references and claims keep resolving.
    const businesses = rows
      .filter((row) => row.source !== "curated")
      .map(mapSupabaseRowToBusiness)

    // Attach cached FSA hygiene ratings. Live Google venues already get this
    // inside fetchLiveBusinesses; curated rows need it here. Pure cache read -
    // never calls the FSA, and never touches any existing field.
    return attachCachedHygiene(businesses)
  } catch (err) {
    console.error("[v0] Unexpected error reading Supabase businesses:", err)
    return []
  }
}

export async function GET() {
  // Curated Supabase rows and live Google venues are fetched together; neither
  // is allowed to fail the request.
  const [curated, live] = await Promise.all([fetchSupabaseBusinesses(), fetchLiveBusinesses()])

  // LIVE data wins for the same business, matched on Google place id where
  // available and otherwise on a normalised name. Live Google facts are the
  // freshest and most trustworthy, so a stale stored row must never mask them.
  const identityKey = (business: Business) =>
    business.externalIds?.googlePlaceId ?? business.name.trim().toLowerCase()

  const merged = new Map<string, Business>()
  for (const business of curated) merged.set(identityKey(business), business)
  for (const business of live) merged.set(identityKey(business), business)

  const businesses = [...merged.values()]

  if (businesses.length === 0) {
    console.error("[v0] No businesses available from Supabase or Google Places")
  }

  return Response.json(businesses)
}
