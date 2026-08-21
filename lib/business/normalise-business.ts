import type {
  Business,
  BusinessReview,
  BusinessSource,
  GalleryImage,
  OpeningHours,
  TrustpilotRating,
} from "@/lib/types/business"
import { mapCategory, parsePriceLevel } from "@/lib/business/category-mapping"
import { getBusinessDisplayLocation } from "@/lib/business/location"

export const PLACEHOLDER_IMAGE = "/placeholder.svg"

// Loose ratings shape accepted from both the legacy model and the new model.
interface RatingsInput {
  google?: { rating?: number; reviews?: number } | null
  instagram?: { followers?: number; trending?: boolean } | null
  foodHygiene?: number
  bookingCom?: number
  trustpilot?: TrustpilotRating | null
}

// A permissive input type that accepts legacy-shaped data (flat rating,
// `ratings`, string `location`, `image`/`images`) as well as the new model.
export interface NormaliseBusinessInput {
  id?: string | number | null
  source?: BusinessSource
  externalIds?: Business["externalIds"]

  name?: string
  category?: string | string[] | null
  subcategory?: string
  description?: string | null

  // Location: object (new) or free-text string (legacy)
  location?: string | Partial<Business["location"]> | null
  neighbourhood?: string
  city?: string
  postcode?: string
  address?: string
  coordinates?: { lat?: number; lng?: number } | null

  distanceMeters?: number

  // Media: object (new) or individual fields (legacy)
  media?: Partial<Business["media"]> | null
  image?: string | null
  images?: string[] | null
  gallery?: GalleryImage[] | null

  // Rating: object (new) or number (legacy) plus optional review count
  rating?: number | Partial<Business["rating"]> | null
  overall?: number
  reviewCount?: number | null

  // Provider ratings: `providerRatings` (new) or `ratings` (legacy)
  providerRatings?: RatingsInput | null
  ratings?: RatingsInput | null

  priceLevel?: string | number | null
  openNow?: boolean | null

  tags?: string[] | null
  amenities?: string[] | null
  openingHours?: OpeningHours[] | null
  contact?: Partial<Business["contact"]> | null
  reviews?: BusinessReview[] | null
  flags?: Business["flags"] | null
  ai?: Business["ai"] | null

  createdAt?: string
  updatedAt?: string
}

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  )
}

/**
 * Safely converts partial data from any source into a complete, predictable
 * Business object. Never throws and never produces `undefined` where the model
 * expects an array or object. Does not fabricate business information.
 */
export function normaliseBusiness(
  input: NormaliseBusinessInput = {},
  source: BusinessSource = "curated",
): Business {
  const resolvedSource = input.source ?? source

  // ---- Location ------------------------------------------------------------
  const location: Business["location"] = {}
  if (typeof input.location === "string") {
    if (input.location.trim()) location.neighbourhood = input.location.trim()
  } else if (input.location && typeof input.location === "object") {
    Object.assign(location, input.location)
  }
  if (input.neighbourhood) location.neighbourhood = input.neighbourhood
  if (input.city) location.city = input.city
  if (input.postcode) location.postcode = input.postcode
  if (input.address) location.address = input.address

  const coords =
    input.coordinates ??
    (input.location && typeof input.location === "object"
      ? input.location.coordinates
      : undefined)
  if (
    coords &&
    typeof coords.lat === "number" &&
    typeof coords.lng === "number" &&
    !Number.isNaN(coords.lat) &&
    !Number.isNaN(coords.lng)
  ) {
    location.coordinates = { lat: coords.lat, lng: coords.lng }
  }

  // ---- Media ---------------------------------------------------------------
  const mediaInput = input.media ?? {}
  const images = toArray(mediaInput.images ?? input.images)
  const gallery = toArray(mediaInput.gallery ?? input.gallery)
  const heroCandidate = mediaInput.hero ?? input.image ?? images[0]
  const hero = heroCandidate || PLACEHOLDER_IMAGE
  const resolvedImages = images.length > 0 ? images : [hero]
  const media: Business["media"] = { hero, images: resolvedImages, gallery }

  // ---- Provider ratings ----------------------------------------------------
  const pr = input.providerRatings ?? input.ratings ?? {}
  const providerRatings: Business["providerRatings"] = {}
  if (pr.google && (pr.google.rating !== undefined || pr.google.reviews !== undefined)) {
    providerRatings.google = {
      rating: pr.google.rating,
      reviews: pr.google.reviews,
    }
  }
  if (
    pr.instagram &&
    (pr.instagram.followers !== undefined || pr.instagram.trending !== undefined)
  ) {
    providerRatings.instagram = {
      followers: pr.instagram.followers,
      trending: pr.instagram.trending,
    }
  }
  if (typeof pr.foodHygiene === "number") providerRatings.foodHygiene = pr.foodHygiene
  if (typeof pr.bookingCom === "number") providerRatings.bookingCom = pr.bookingCom
  // Trustpilot is optional; only pass it through when a valid Business Unit ID
  // is present so we never surface an empty Trustpilot section.
  if (pr.trustpilot && typeof pr.trustpilot.businessUnitId === "string" && pr.trustpilot.businessUnitId) {
    providerRatings.trustpilot = pr.trustpilot
  }

  // ---- Headline rating -----------------------------------------------------
  let overall: number | undefined
  let reviewCount: number | undefined
  if (typeof input.rating === "number") {
    overall = input.rating
  } else if (input.rating && typeof input.rating === "object") {
    overall = input.rating.overall
    reviewCount = input.rating.reviewCount
  }
  if (typeof input.overall === "number") overall = input.overall
  if (typeof input.reviewCount === "number") reviewCount = input.reviewCount
  // Fall back to Google data when no curated headline value exists.
  if (overall === undefined) overall = providerRatings.google?.rating
  if (reviewCount === undefined) reviewCount = providerRatings.google?.reviews

  const rating: Business["rating"] = {}
  if (typeof overall === "number") rating.overall = overall
  if (typeof reviewCount === "number") rating.reviewCount = reviewCount

  // ---- Identity ------------------------------------------------------------
  const name = input.name?.trim() || "Unknown"
  const id =
    input.id !== undefined && input.id !== null && String(input.id).trim()
      ? String(input.id)
      : input.externalIds?.googlePlaceId ?? slugify(name)

  return {
    id,
    source: resolvedSource,
    externalIds: input.externalIds,
    name,
    category: mapCategory(input.category),
    subcategory: input.subcategory,
    description: input.description ?? undefined,
    location,
    distanceMeters: input.distanceMeters,
    media,
    rating,
    providerRatings,
    priceLevel: parsePriceLevel(input.priceLevel),
    openNow: typeof input.openNow === "boolean" ? input.openNow : undefined,
    tags: toArray(input.tags),
    amenities: toArray(input.amenities),
    openingHours: toArray(input.openingHours),
    contact: input.contact ?? {},
    reviews: toArray(input.reviews),
    flags: input.flags ?? {},
    ai: input.ai ?? undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

// --------------------------------------------------------------------------
// Display helpers - keep UI components consistent and crash-free.
// --------------------------------------------------------------------------

/** Headline rating: curated overall, else Google, else undefined. */
export function getHeadlineRating(business: Business): number | undefined {
  return business.rating.overall ?? business.providerRatings.google?.rating
}

/** Headline review count: curated, else Google, else undefined. */
export function getHeadlineReviewCount(business: Business): number | undefined {
  return business.rating.reviewCount ?? business.providerRatings.google?.reviews
}

/** A guaranteed hero image (falls back to the local placeholder). */
export function getHeroImage(business: Business): string {
  return business.media.hero || business.media.images[0] || PLACEHOLDER_IMAGE
}

/** A non-empty list of image URLs for carousels. */
export function getBusinessImages(business: Business): string[] {
  if (business.media.images.length > 0) return business.media.images
  return [getHeroImage(business)]
}

/**
 * Human-readable short location label, empty string when unknown.
 *
 * Delegates to the single location resolver so cards, AI picks, search, map
 * popups and detail pages all show the SAME label derived from genuine Google
 * structured address data (with the city only ever a final fallback).
 */
export function getLocationLabel(business: Business): string {
  return getBusinessDisplayLocation(business)
}
