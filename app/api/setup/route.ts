import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  description TEXT,
  image TEXT,
  images TEXT[] DEFAULT '{}',
  gallery JSONB DEFAULT '[]',
  coordinates JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}',
  price_level TEXT DEFAULT '££',
  tags TEXT[] DEFAULT '{}',
  ratings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON businesses;
CREATE POLICY "Allow public read access" ON businesses FOR SELECT USING (true);
`

const SEED_DATA = [
  {
    name: "The Ivy Chelsea Garden",
    category: "food",
    rating: 4.8,
    review_count: 2340,
    location: "Chelsea, London",
    description: "Elegant all-day dining in a stunning garden setting with British classics and seasonal dishes.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop", source: "instagram", caption: "Garden dining at its finest", featured: true },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" }
    ],
    coordinates: { lat: 51.4875, lng: -0.1687 },
    price_level: "£££",
    tags: ["British", "Garden", "Brunch"],
    ratings: { instagram: { followers: 125000, trending: true }, google: { rating: 4.6, reviews: 2340 }, foodHygiene: 5 }
  },
  {
    name: "Barry's Bootcamp",
    category: "fitness",
    rating: 4.9,
    review_count: 1856,
    location: "Soho, London",
    description: "High-intensity interval training combining running and strength training in a red-lit studio.",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop", source: "instagram", caption: "Red room vibes", featured: true }
    ],
    coordinates: { lat: 51.5134, lng: -0.1365 },
    price_level: "££",
    tags: ["HIIT", "Classes", "Premium"],
    ratings: { instagram: { followers: 89000, trending: true }, google: { rating: 4.8, reviews: 1856 } }
  },
  {
    name: "Dishoom",
    category: "food",
    rating: 4.9,
    review_count: 4521,
    location: "Covent Garden, London",
    description: "Bombay-style cafe serving legendary bacon naan rolls and authentic Indian fare.",
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop", source: "instagram", caption: "Bombay cafe vibes", featured: true }
    ],
    coordinates: { lat: 51.5129, lng: -0.1243 },
    price_level: "££",
    tags: ["Indian", "Brunch", "Queue-worthy"],
    ratings: { instagram: { followers: 298000, trending: true }, google: { rating: 4.7, reviews: 4521 }, foodHygiene: 5 }
  },
  {
    name: "Sketch",
    category: "nightlife",
    rating: 4.8,
    review_count: 2876,
    location: "Mayfair, London",
    description: "Iconic venue with multiple themed rooms, from afternoon tea to late-night cocktails.",
    image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop", source: "instagram", caption: "Iconic pink room", featured: true }
    ],
    coordinates: { lat: 51.5127, lng: -0.1419 },
    price_level: "££££",
    tags: ["Cocktails", "Art", "Instagrammable"],
    ratings: { instagram: { followers: 412000, trending: true }, google: { rating: 4.5, reviews: 2876 }, foodHygiene: 5 }
  },
  {
    name: "Grind Coffee",
    category: "cafes",
    rating: 4.6,
    review_count: 987,
    location: "Shoreditch, London",
    description: "Specialty coffee roasters serving exceptional flat whites in a stylish industrial space.",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop", source: "instagram", caption: "Morning vibes", featured: true }
    ],
    coordinates: { lat: 51.5255, lng: -0.0839 },
    price_level: "£",
    tags: ["Coffee", "Brunch", "Instagrammable"],
    ratings: { instagram: { followers: 156000, trending: true }, google: { rating: 4.4, reviews: 987 }, foodHygiene: 5 }
  },
  {
    name: "The Ned",
    category: "wellness",
    rating: 4.7,
    review_count: 1654,
    location: "City of London",
    description: "Members club and hotel with a stunning rooftop pool and comprehensive spa facilities.",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&h=600&fit=crop"
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop", source: "instagram", caption: "Rooftop views", featured: true }
    ],
    coordinates: { lat: 51.5131, lng: -0.0876 },
    price_level: "££££",
    tags: ["Spa", "Pool", "Luxury"],
    ratings: { instagram: { followers: 187000, trending: true }, google: { rating: 4.4, reviews: 1654 }, bookingCom: 8.9 }
  }
]

export async function POST() {
  const supabase = await createClient()
  
  try {
    // Create table
    const { error: createError } = await supabase.rpc('exec_sql', { sql: CREATE_TABLE_SQL }).single()
    
    if (createError && !createError.message.includes('already exists')) {
      // Try direct insert - table might already exist
      console.log("Table creation note:", createError.message)
    }

    // Check if data already exists
    const { count } = await supabase.from("businesses").select("*", { count: "exact", head: true })
    
    if (count && count > 0) {
      return NextResponse.json({ message: "Database already seeded", count })
    }

    // Insert seed data
    const { data, error: insertError } = await supabase
      .from("businesses")
      .insert(SEED_DATA)
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Database seeded successfully", count: data?.length || 0 })
  } catch (err) {
    console.error("Setup error:", err)
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
