import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"
import { fetchLiveBusinessById, isGooglePlaceId } from "@/lib/business/places-search"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Live venues are keyed by Google place id, which isn't a Supabase uuid, so
    // querying the table with it would error. Resolve those against Google.
    if (isGooglePlaceId(id)) {
      const live = await fetchLiveBusinessById(id)

      if (!live) {
        return Response.json({ error: "Business not found" }, { status: 404 })
      }

      return Response.json(live)
    }

    const supabase = await createClient()

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
