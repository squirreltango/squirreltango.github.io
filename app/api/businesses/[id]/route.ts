import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"
import { fetchLiveBusinessById, isGooglePlaceId } from "@/lib/business/places-search"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const supabase = await createClient()

    // Google place ids are not Supabase uuids, so they need their own lookup.
    // Prefer the ingested row (it carries curated edits); fall back to a live
    // Google fetch for venues that have not been ingested yet.
    if (isGooglePlaceId(id)) {
      const { data: stored, error: storedError } = await supabase
        .from("businesses")
        .select("*")
        .eq("google_place_id", id)
        .maybeSingle()

      // A missing google_place_id column simply means ingestion hasn't been set
      // up yet; fall through to the live lookup instead of failing.
      if (storedError && !/google_place_id/.test(storedError.message)) {
        console.error("[v0] Error looking up business by place id:", storedError.message)
      }

      if (stored) {
        return Response.json(mapSupabaseRowToBusiness(stored as BusinessRow))
      }

      const live = await fetchLiveBusinessById(id)

      if (!live) {
        return Response.json({ error: "Business not found" }, { status: 404 })
      }

      return Response.json(live)
    }

    const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle()

    if (error) {
      console.error("[v0] Error fetching business:", error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return Response.json({ error: "Business not found" }, { status: 404 })
    }

    return Response.json(mapSupabaseRowToBusiness(data as BusinessRow))
  } catch (err) {
    console.error("[v0] Unexpected error in /api/businesses/[id]:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
