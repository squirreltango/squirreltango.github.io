import type { Business } from "@/lib/types/business"
import { normaliseBusiness } from "@/lib/business/normalise-business"

// Supabase row type. Includes both the new model columns and the legacy
// columns so existing rows keep working during/after migration.
export interface BusinessRow {
  id: string
  source?: string | null
  external_ids?: Record<string, unknown> | null

  name: string
  category: string
  subcategory?: string | null
  description?: string | null

  // New model columns (JSONB / scalar)
  location?: unknown
  media?: unknown
  rating?: unknown
  provider_ratings?: unknown
  price_level?: string | number | null
  tags?: string[] | null
  amenities?: string[] | null
  opening_hours?: unknown
  contact?: unknown
  reviews?: unknown
  flags?: unknown

  // Legacy columns (kept for backwards compatibility)
  review_count?: number | null
  image?: string | null
  images?: string[] | null
  gallery?: unknown
  coordinates?: unknown
  ratings?: unknown

  created_at?: string
  updated_at?: string
}

/**
 * Single shared Supabase row -> Business mapper. Tolerant of both the new
 * schema and legacy rows; delegates all defaulting to normaliseBusiness.
 */
export function mapSupabaseRowToBusiness(row: BusinessRow): Business {
  // `rating` may be a number (legacy column) or a JSONB object (new model).
  const ratingInput =
    typeof row.rating === "number" || (row.rating && typeof row.rating === "object")
      ? (row.rating as number | Record<string, unknown>)
      : undefined

  return normaliseBusiness(
    {
      id: row.id,
      externalIds: (row.external_ids as Business["externalIds"]) ?? undefined,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory ?? undefined,
      description: row.description ?? undefined,

      location:
        row.location && typeof row.location === "object"
          ? (row.location as Partial<Business["location"]>)
          : typeof row.location === "string"
            ? row.location
            : undefined,
      coordinates: (row.coordinates as { lat?: number; lng?: number }) ?? undefined,

      media:
        row.media && typeof row.media === "object"
          ? (row.media as Partial<Business["media"]>)
          : undefined,
      image: row.image ?? undefined,
      images: row.images ?? undefined,
      gallery: (row.gallery as Business["media"]["gallery"]) ?? undefined,

      rating: ratingInput as number | Partial<Business["rating"]> | undefined,
      reviewCount: row.review_count ?? undefined,

      providerRatings: (row.provider_ratings as Business["providerRatings"]) ?? undefined,
      ratings: (row.ratings as Business["providerRatings"]) ?? undefined,

      priceLevel: row.price_level ?? undefined,
      tags: row.tags ?? undefined,
      amenities: row.amenities ?? undefined,
      openingHours: (row.opening_hours as Business["openingHours"]) ?? undefined,
      contact: (row.contact as Business["contact"]) ?? undefined,
      reviews: (row.reviews as Business["reviews"]) ?? undefined,
      flags: (row.flags as Business["flags"]) ?? undefined,

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    (row.source as Business["source"]) ?? "supabase",
  )
}
