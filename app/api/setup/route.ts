import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { businesses } from "@/lib/data/businesses"
import type { Business } from "@/lib/types/business"

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

// Transform a normalised Business into a snake_case row for insertion.
function toRow(business: Business) {
  return {
    source: business.source,
    external_ids: business.externalIds ?? {},
    name: business.name,
    category: business.category,
    subcategory: business.subcategory ?? null,
    description: business.description ?? null,
    location: business.location,
    media: business.media,
    rating: business.rating,
    provider_ratings: business.providerRatings,
    price_level: business.priceLevel ?? null,
    tags: business.tags,
    amenities: business.amenities,
    opening_hours: business.openingHours,
    contact: business.contact,
    reviews: business.reviews,
    flags: business.flags,
  }
}

// Single source of truth: seed rows are derived from the curated dataset.
const SEED_ROWS = businesses.map(toRow)

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

    // Only seed when empty - never overwrite existing rows.
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })

    if (count && count > 0) {
      return NextResponse.json({ message: "Database already seeded", count })
    }

    const { data, error: insertError } = await supabase
      .from("businesses")
      .insert(SEED_ROWS)
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "Database seeded successfully",
      count: data?.length || 0,
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
