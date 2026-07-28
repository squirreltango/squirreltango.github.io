import { createClient } from "@/lib/supabase/server"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("[v0] Error fetching business:", error)
      return Response.json({ error: error.message }, { status: 404 })
    }

    if (!data) {
      return Response.json({ error: "Business not found" }, { status: 404 })
    }

    const business = mapSupabaseRowToBusiness(data as BusinessRow)

    return Response.json(business)
  } catch (err) {
    console.error("[v0] Unexpected error in /api/businesses/[id]:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
