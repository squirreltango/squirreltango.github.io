-- Food Standards Agency (FSA) food hygiene rating cache.
--
-- This table caches confidently-matched FSA establishments keyed by the stable
-- Google Place ID. It is intentionally SEPARATE from the businesses table so
-- that:
--   * live Google venues (which are not persisted as business rows) can still
--     be enriched and cached,
--   * no existing business row, id, Google rating, review or photo is touched,
--   * Google Places remains the primary source and FSA is additive only.
--
-- Only "exact" and "high" confidence matches are ever written here. Ambiguous
-- matches are discarded at match time so a business can never inherit another
-- branch's rating.
--
-- Safe to run multiple times (IF NOT EXISTS). It does not modify or drop any
-- existing table, column, policy, or data.

CREATE TABLE IF NOT EXISTS fsa_hygiene_details (
  -- The Google Place ID is the cache key, mirroring google_place_details.
  google_place_id TEXT PRIMARY KEY,

  -- Our own business id where one exists (curated Supabase rows). NULL for
  -- live Google venues that have no persisted business row.
  business_id TEXT,

  -- FSA's stable establishment identifier. Once set, refreshes fetch
  -- Establishments/{fhrs_id} directly and skip the matching process entirely.
  fhrs_id BIGINT NOT NULL,

  -- The FSA establishment's own name/address, kept so an operator can audit
  -- exactly which establishment was matched.
  business_name TEXT,
  business_type TEXT,
  address TEXT,
  postcode TEXT,

  -- RAW scheme-specific rating value, stored as TEXT on purpose:
  --   FHRS (England/Wales/NI) -> "0".."5"
  --   FHIS (Scotland)         -> "Pass", "Improvement Required"
  -- Either scheme may also return "AwaitingInspection" or "Exempt".
  -- Storing TEXT avoids forcing every UK scheme into an X/5 shape.
  rating_value TEXT NOT NULL,
  rating_date DATE,
  local_authority TEXT,
  scheme_type TEXT,
  new_rating_pending BOOLEAN DEFAULT FALSE,

  -- FSA establishment coordinates + the computed distance to the Google
  -- coordinates, retained as match evidence.
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,

  -- 'exact' or 'high' only. A CHECK constraint enforces at the database level
  -- that an ambiguous match can never be persisted, even by a future caller.
  match_confidence TEXT NOT NULL CHECK (match_confidence IN ('exact', 'high')),

  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read access so the homepage (anon key) can attach cached ratings.
-- Writes are performed only server-side with the service role.
ALTER TABLE fsa_hygiene_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fsa_hygiene_details'
      AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON fsa_hygiene_details
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Fast freshness lookups when selecting stale rows to refresh.
CREATE INDEX IF NOT EXISTS idx_fsa_hygiene_synced_at
  ON fsa_hygiene_details (last_synced_at);

-- Lookup by FSA id (e.g. auditing which venues map to one establishment).
CREATE INDEX IF NOT EXISTS idx_fsa_hygiene_fhrs_id
  ON fsa_hygiene_details (fhrs_id);
