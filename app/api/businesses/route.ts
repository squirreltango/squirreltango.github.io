import { createClient } from "@/lib/supabase/server"
import type { Business, GalleryImage, RatingsSummary } from "@/lib/data"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface BusinessRow {
  id: string
  name: string
  category: string
  rating: number
  review_count: number
  location: string
  description: string | null
  image: string
  images: string[]
  gallery: GalleryImage[]
  coordinates: { lat: number; lng: number }
  price_level: string
  tags: string[]
  ratings: RatingsSummary
  created_at: string
  updated_at: string
}

function mapRowToBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    rating: row.rating,
    reviewCount: row.review_count,
    location: row.location,
    description: row.description || "",
    image: row.image,
    images: row.images || [],
    gallery: row.gallery || [],
    coordinates: row.coordinates || { lat: 51.5074, lng: -0.1278 },
    priceLevel: row.price_level,
    tags: row.tags || [],
    ratings: row.ratings || {
      google: { rating: row.rating, reviews: row.review_count },
    },
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("rating", { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return Response.json([])
    }

    const businesses = (data as BusinessRow[]).map(mapRowToBusiness)

    return Response.json(businesses)
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
