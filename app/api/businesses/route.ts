import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching businesses:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return Response.json([])
    }

    const businesses = (data as BusinessRow[]).map(mapSupabaseRowToBusiness)

    return Response.json(businesses)
  } catch (err) {
    console.error("[v0] Unexpected error in /api/businesses:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
