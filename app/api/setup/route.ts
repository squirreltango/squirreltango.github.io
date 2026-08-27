import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"


// New-model schema. `IF NOT EXISTS` guards a fresh install; the `ALTER TABLE`
// statements migrate an existing legacy table by adding the new columns
// (existing data is never deleted).
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'curated',
  external_ids JSONB DEFAULT '{}',
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  subcategory TEXT,
  description TEXT,
  location JSONB DEFAULT '{}',
  media JSONB DEFAULT '{}',
  rating JSONB DEFAULT '{}',
  provider_ratings JSONB DEFAULT '{}',
  price_level INTEGER,
  tags TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  opening_hours JSONB DEFAULT '[]',
  contact JSONB DEFAULT '{}',
  reviews JSONB DEFAULT '[]',
  flags JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'curated';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS provider_ratings JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '{}';

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON businesses;
CREATE POLICY "Allow public read access" ON businesses FOR SELECT USING (true);
`

export async function POST() {
  const supabase = await createClient()

  try {
    // Create/migrate table (best-effort; requires an `exec_sql` RPC).
    const { error: createError } = await supabase
      .rpc("exec_sql", { sql: CREATE_TABLE_SQL })
      .single()

    if (createError && !createError.message.includes("already exists")) {
      console.log("[v0] Table creation note:", createError.message)
    }

    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })

    // Seeding fabricated example businesses is DISABLED. This route used to
    // insert the curated dataset (Dishoom et al), which then surfaced in
    // discovery as if it were genuine live data - complete with invented
    // ratings, review counts and Instagram follower figures.
    //
    // The table is now populated exclusively by the real ingestion pipeline
    // (Google Places -> google_place_details -> fsa_hygiene_details), so this
    // route only ensures the schema exists.
    return NextResponse.json({
      message:
        "Schema ready. Businesses are ingested from Google Places; no example data is seeded.",
      count: count ?? 0,
    })
  } catch (err) {
    console.error("[v0] Setup error:", err)
    return NextResponse.json({ error: "Setup failed" }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true })

  if (error) {
    return NextResponse.json({ status: "not_setup", error: error.message })
  }

  return NextResponse.json({ status: "ready", count: count || 0 })
}
