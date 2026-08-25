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

    const businesses = (data as BusinessRow[] | null)?.map(mapSupabaseRowToBusiness) ?? []

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

  // Curated rows win over live ones for the same venue, matched on Google place
  // id where available and otherwise on a normalised name.
  const identityKey = (business: Business) =>
    business.externalIds?.googlePlaceId ?? business.name.trim().toLowerCase()

  const merged = new Map<string, Business>()
  for (const business of curated) merged.set(identityKey(business), business)
  for (const business of live) {
    const key = identityKey(business)
    if (!merged.has(key)) merged.set(key, business)
  }

  const businesses = [...merged.values()]

  if (businesses.length === 0) {
    console.error("[v0] No businesses available from Supabase or Google Places")
  }

  return Response.json(businesses)
}
