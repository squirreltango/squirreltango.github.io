import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { mapSupabaseBusinessToLocal } from "@/lib/supabase/businesses"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching business:", error)
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  const business = mapSupabaseBusinessToLocal(data)
  
  return NextResponse.json(business)
}
