import { supabase } from "./client"
import type { Business, GalleryImage, RatingsSummary } from "@/lib/data"

// Database row type from Supabase
interface BusinessRow {
  id: string
  name: string
  category: string
  rating: number
  review_count: number
  location: string
  description: string
  image: string
  images: string[]
  gallery: GalleryImage[] | null
  coordinates: { lat: number; lng: number }
  price_level: string
  tags: string[]
  ratings: RatingsSummary
  created_at?: string
  updated_at?: string
}

// Map Supabase row (snake_case) to local Business type (camelCase)
function mapRowToBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    rating: row.rating,
    reviewCount: row.review_count,
    location: row.location,
    description: row.description,
    image: row.image,
    images: row.images || [],
    gallery: row.gallery || [],
    coordinates: row.coordinates,
    priceLevel: row.price_level,
    tags: row.tags || [],
    ratings: row.ratings,
  }
}

export async function fetchBusinesses(): Promise<{ data: Business[]; error: string | null }> {
  console.log("[v0] Fetching businesses from Supabase...")
  
  const { data, error } = await supabase
    .from("businesses")
    .select("*")

  console.log("[v0] Supabase data:", data)
  console.log("[v0] Supabase error:", error)

  if (error) {
    console.error("[v0] Error fetching businesses:", error.message)
    return { data: [], error: error.message }
  }

  if (!data || data.length === 0) {
    console.log("[v0] No data returned from Supabase")
    return { data: [], error: null }
  }

  console.log("[v0] Successfully fetched", data.length, "businesses")
  return { data: (data as BusinessRow[]).map(mapRowToBusiness), error: null }
}

export async function fetchBusinessById(id: string): Promise<{ data: Business | null; error: string | null }> {
  console.log("[v0] Fetching business by ID:", id)
  
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single()

  console.log("[v0] Supabase data:", data)
  console.log("[v0] Supabase error:", error)

  if (error) {
    console.error("[v0] Error fetching business:", error.message)
    return { data: null, error: error.message }
  }

  if (!data) {
    console.log("[v0] No data returned from Supabase for ID:", id)
    return { data: null, error: null }
  }

  return { data: mapRowToBusiness(data as BusinessRow), error: null }
}
