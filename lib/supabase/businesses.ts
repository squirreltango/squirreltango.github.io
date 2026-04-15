import { createClient } from './client'
import type { Business, GalleryImage, RatingsSummary } from '@/lib/data'

// Database row type (snake_case from Supabase)
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

// Transform database row to Business type (camelCase)
function mapRowToBusiness(row: BusinessRow): Business {
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
    coordinates: row.coordinates,
    priceLevel: row.price_level,
    tags: row.tags || [],
    ratings: row.ratings,
  }
}

export async function getBusinesses(): Promise<Business[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('rating', { ascending: false })
  
  if (error) {
    console.error('Error fetching businesses:', error)
    return []
  }
  
  return (data as BusinessRow[]).map(mapRowToBusiness)
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching business:', error)
    return null
  }
  
  return mapRowToBusiness(data as BusinessRow)
}

export async function getBusinessesByCategory(category: string): Promise<Business[]> {
  const supabase = createClient()
  
  let query = supabase.from('businesses').select('*')
  
  if (category !== 'all') {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query.order('rating', { ascending: false })
  
  if (error) {
    console.error('Error fetching businesses:', error)
    return []
  }
  
  return (data as BusinessRow[]).map(mapRowToBusiness)
}
