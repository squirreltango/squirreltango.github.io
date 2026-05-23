import { supabase } from "./client"
import type { Business, GalleryImage } from "@/lib/data"

// Database row type from Supabase (flat structure)
interface BusinessRow {
  id: string
  name: string
  category: string
  rating: number
  review_count: number
  location: string
  description: string
  image: string
  image_urls: string[] | null
  lat: number | null
  lng: number | null
  price_level: string
  tags: string[]
  // Flat rating fields from Supabase
  google_rating: number | null
  google_reviews: number | null
  instagram_followers: number | null
  instagram_trending: boolean | null
  food_hygiene: number | null
  booking_com_rating: number | null
  created_at?: string
}

// Map Supabase row (flat structure) to local Business type (nested structure)
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
    images: row.image_urls || [row.image],
    gallery: [] as GalleryImage[],
    coordinates: { 
      lat: row.lat ?? 51.5074, 
      lng: row.lng ?? -0.1278 
    },
    priceLevel: row.price_level,
    tags: row.tags || [],
    ratings: {
      google: { 
        rating: row.google_rating ?? row.rating, 
        reviews: row.google_reviews ?? row.review_count 
      },
      instagram: row.instagram_followers ? {
        followers: row.instagram_followers,
        trending: row.instagram_trending ?? false
      } : undefined,
      foodHygiene: row.food_hygiene ?? undefined,
      bookingCom: row.booking_com_rating ?? undefined,
    },
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
