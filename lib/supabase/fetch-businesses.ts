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

export async function fetchBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching businesses:", error.message)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  return (data as BusinessRow[]).map(mapRowToBusiness)
}

export async function fetchBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error("[v0] Error fetching business:", error.message)
    return null
  }

  if (!data) {
    return null
  }

  return mapRowToBusiness(data as BusinessRow)
}
