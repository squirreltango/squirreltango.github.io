-- Google Place Details (New) enrichment cache.
--
-- This table caches the "Atmosphere" fields we fetch from Google Place Details
-- keyed by the stable Google Place ID. It is intentionally SEPARATE from the
-- businesses table so that:
--   * live Google venues (which are not persisted as business rows) can still
--     be enriched and cached,
--   * no existing business row, id, or curated field is ever touched,
--   * we never create duplicate businesses.
--
-- Safe to run multiple times (IF NOT EXISTS). It does not modify or drop any
-- existing table, column, policy, or data.

CREATE TABLE IF NOT EXISTS google_place_details (
  place_id TEXT PRIMARY KEY,
  -- Structured amenity flags + editorial summary. Shape matches GoogleDetails
  -- in lib/types/business.ts. Example:
  --   { "amenities": { "servesCocktails": true, "outdoorSeating": true },
  --     "editorialSummary": "A cosy Chelsea wine bar." }
  details JSONB NOT NULL DEFAULT '{}',
  -- Drives the 7-day freshness window. When older than the window the admin
  -- enrichment job may refresh it; the homepage never triggers a refresh.
  details_last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read access so the homepage (anon key) can attach cached enrichment.
-- Writes are performed only server-side with the service role.
ALTER TABLE google_place_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'google_place_details'
      AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON google_place_details
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Fast freshness lookups when selecting stale rows to refresh.
CREATE INDEX IF NOT EXISTS idx_google_place_details_synced_at
  ON google_place_details (details_last_synced_at);
