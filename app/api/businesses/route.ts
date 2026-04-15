import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { mapSupabaseBusinessToLocal } from "@/lib/supabase/businesses"

export async function GET() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching businesses:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const businesses = data?.map(mapSupabaseBusinessToLocal) || []
  
  return NextResponse.json(businesses)
}
