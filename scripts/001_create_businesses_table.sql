-- Create the businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  description TEXT,
  image TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  gallery JSONB DEFAULT '[]',
  coordinates JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}',
  price_level TEXT NOT NULL DEFAULT '££',
  tags TEXT[] DEFAULT '{}',
  ratings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (no auth required for viewing businesses)
CREATE POLICY "Allow public read access" ON businesses
  FOR SELECT
  USING (true);

-- Create an index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);

-- Create an index on rating for sorting
CREATE INDEX IF NOT EXISTS idx_businesses_rating ON businesses(rating DESC);
