import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Schema changes are reviewed and applied manually to the existing production
// Supabase project. This route intentionally does not execute runtime DDL.

/* New-model schema. `IF NOT EXISTS` guards a fresh install; the `ALTER TABLE`
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
` */

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Runtime schema setup is disabled. Review scripts/008_production_security_hardening.sql and apply approved SQL manually to the existing Supabase project.",
    },
    { status: 410 },
  )
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
