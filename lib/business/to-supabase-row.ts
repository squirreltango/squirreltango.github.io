import type { Business } from "@/lib/types/business"
import { formatPriceLevel } from "@/lib/business/category-mapping"
import { PLACEHOLDER_IMAGE } from "@/lib/business/normalise-business"

/**
 * The exact column set of the live `businesses` table. Keys are omitted when we
 * have no real value, so ingestion never overwrites existing data with nulls
 * and never invents values Google does not provide.
 */
export interface BusinessInsertRow {
  name: string
  category: string
  location: string | null
  description: string | null
  rating: number | null
  review_count: number | null
  image: string | null
  image_urls: string[] | null
  lat: number | null
  lng: number | null
  price_level: string | null
  tags: string[] | null
  google_rating: number | null
  google_reviews: number | null
}

/**
 * Convert a normalised Business into a row for the live table.
 *
 * `price_level` is stored as currency symbols ("£££") to match the existing
 * rows. Instagram / food hygiene / Booking.com columns are intentionally left
 * untouched: Google Places does not supply them and we do not fabricate data.
 */
export function businessToInsertRow(
  business: Business,
  areaLabel?: string,
): BusinessInsertRow {
  const { location, media, rating, providerRatings } = business

  // Prefer an explicit neighbourhood, then the search area, then the address.
  const locationLabel =
    location.neighbourhood ||
    areaLabel ||
    location.address ||
    location.city ||
    null

  // Never persist the local placeholder as if it were a real photo.
  const realImages = media.images.filter((src) => src && src !== PLACEHOLDER_IMAGE)
  const hero = media.hero && media.hero !== PLACEHOLDER_IMAGE ? media.hero : realImages[0] ?? null

  const priceLevel = formatPriceLevel(business.priceLevel)

  return {
    name: business.name,
    category: business.category,
    location: locationLabel,
    description: business.description ?? null,
    rating: rating.overall ?? null,
    review_count: rating.reviewCount ?? null,
    image: hero,
    image_urls: realImages.length > 0 ? realImages : null,
    lat: location.coordinates?.lat ?? null,
    lng: location.coordinates?.lng ?? null,
    price_level: priceLevel || null,
    tags: business.tags.length > 0 ? business.tags : null,
    google_rating: providerRatings.google?.rating ?? null,
    google_reviews: providerRatings.google?.reviews ?? null,
  }
}
