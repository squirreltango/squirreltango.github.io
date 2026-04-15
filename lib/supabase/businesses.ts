import type { Business, GalleryImage, RatingsSummary } from '@/lib/data'

// Database row type (snake_case from Supabase)
export interface BusinessRow {
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

// Transform database row to Business type (camelCase)
// Exported for use in API routes
export function mapSupabaseBusinessToLocal(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    rating: row.rating,
    reviewCount: row.review_count,
    location: row.location,
    description: row.description || '',
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
