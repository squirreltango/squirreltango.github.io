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
  image_urls?: string[] | null
  gallery?: unknown
  coordinates?: unknown
  ratings?: unknown

  // Flat scalar columns as they exist in the live `businesses` table.
  lat?: number | null
  lng?: number | null
  instagram_followers?: number | null
  instagram_trending?: boolean | null
  google_rating?: number | null
  google_reviews?: number | null
  food_hygiene?: number | null
  booking_com_rating?: number | null

  // Google sync columns (scripts/003_add_google_places_sync_columns.sql)
  google_place_id?: string | null
  place_types?: string[] | null
  address?: string | null
  area?: string | null
  last_synced_at?: string | null

  // Curated columns preserved across syncs
  featured?: boolean | null
  verified?: boolean | null
  instagram_handle?: string | null

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

  // The live table stores provider ratings as flat scalar columns. Fold them
  // into the nested shape normaliseBusiness expects, preferring an explicit
  // JSONB `provider_ratings`/`ratings` column when one is present.
  const flatProviderRatings: Record<string, unknown> = {}
  if (typeof row.google_rating === "number" || typeof row.google_reviews === "number") {
    flatProviderRatings.google = {
      rating: row.google_rating ?? undefined,
      reviews: row.google_reviews ?? undefined,
    }
  }
  if (typeof row.instagram_followers === "number" || typeof row.instagram_trending === "boolean") {
    flatProviderRatings.instagram = {
      followers: row.instagram_followers ?? undefined,
      trending: row.instagram_trending ?? undefined,
    }
  }
  if (typeof row.food_hygiene === "number") flatProviderRatings.foodHygiene = row.food_hygiene
  if (typeof row.booking_com_rating === "number") flatProviderRatings.bookingCom = row.booking_com_rating

  const providerRatings =
    (row.provider_ratings as Business["providerRatings"]) ??
    (row.ratings as Business["providerRatings"]) ??
    (Object.keys(flatProviderRatings).length > 0
      ? (flatProviderRatings as Business["providerRatings"])
      : undefined)

  // Coordinates may arrive as a JSONB `coordinates` object or flat lat/lng.
  const coordinates =
    (row.coordinates as { lat?: number; lng?: number } | null) ??
    (typeof row.lat === "number" && typeof row.lng === "number"
      ? { lat: row.lat, lng: row.lng }
      : undefined)

  return normaliseBusiness(
    {
      id: row.id,
      externalIds:
        (row.external_ids as Business["externalIds"]) ??
        (row.google_place_id || row.instagram_handle
          ? {
              googlePlaceId: row.google_place_id ?? undefined,
              instagramHandle: row.instagram_handle ?? undefined,
            }
          : undefined),
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
      // `address` is a separate column from the short `location` label.
      address: row.address ?? undefined,
      coordinates,

      media:
        row.media && typeof row.media === "object"
          ? (row.media as Partial<Business["media"]>)
          : undefined,
      image: row.image ?? undefined,
      images: row.images ?? row.image_urls ?? undefined,
      gallery: (row.gallery as Business["media"]["gallery"]) ?? undefined,

      rating: ratingInput as number | Partial<Business["rating"]> | undefined,
      reviewCount: row.review_count ?? undefined,

      providerRatings,

      priceLevel: row.price_level ?? undefined,
      tags: row.tags ?? undefined,
      amenities: row.amenities ?? undefined,
      openingHours: (row.opening_hours as Business["openingHours"]) ?? undefined,
      contact: (row.contact as Business["contact"]) ?? undefined,
      reviews: (row.reviews as Business["reviews"]) ?? undefined,
      flags:
        (row.flags as Business["flags"]) ??
        (row.featured || row.verified || row.instagram_trending
          ? {
              featured: row.featured ?? undefined,
              verified: row.verified ?? undefined,
              trending: row.instagram_trending ?? undefined,
            }
          : undefined),

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    (row.source as Business["source"]) ?? "supabase",
  )
}
