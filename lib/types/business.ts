// Single authoritative data model for a Business across every source
// (curated mock data, Supabase, Google Places and AI search).

export type BusinessSource = "curated" | "supabase" | "google" | "ai"

export type CategoryId =
  | "food"
  | "fitness"
  | "beauty"
  | "cafes"
  | "nightlife"
  | "wellness"
  | "other"

export interface GalleryImage {
  url: string
  source?: "instagram" | "google" | "curated"
  caption?: string
  featured?: boolean
}

export interface BusinessReview {
  id: string
  author: string
  rating: number
  text: string
  date?: string
  source?: string
}

// Trustpilot enrichment attached to an existing business. The Business Unit ID
// is Trustpilot's stable external identifier for the profile.
export interface TrustpilotRating {
  businessUnitId: string
  trustScore?: number
  stars?: number
  reviewCount?: number
  profileUrl?: string
  lastSyncedAt?: string
  matchConfidence?: number
}

export interface OpeningHours {
  day: number // 0 = Sunday ... 6 = Saturday
  open?: string
  close?: string
  closed?: boolean
}

// The set of Google "Atmosphere" amenity flags we request and display. Every
// field is optional and tri-state by absence: `true` means Google explicitly
// says yes, `false` means Google explicitly says no, and `undefined` means
// Google returned nothing - in which case we show nothing (never a "No" chip).
export interface GoogleAmenities {
  outdoorSeating?: boolean
  reservable?: boolean
  servesCocktails?: boolean
  servesCoffee?: boolean
  servesBreakfast?: boolean
  servesBrunch?: boolean
  servesLunch?: boolean
  servesDinner?: boolean
  takeout?: boolean
  delivery?: boolean
  wheelchairAccessible?: boolean
  freeParking?: boolean
  paidParking?: boolean
}

// Enrichment sourced from Google Place Details (New). Kept clearly namespaced
// so this data is always identifiable as Google-derived and never conflated
// with curated LookMeUp content or other providers.
export interface GoogleDetails {
  amenities?: GoogleAmenities
  editorialSummary?: string
  // ISO timestamp of the last successful Place Details sync. Drives the 7-day
  // freshness window that keeps us from re-billing Google on every load.
  detailsLastSyncedAt?: string
}

export interface Business {
  id: string
  source: BusinessSource

  externalIds?: {
    googlePlaceId?: string
    instagramHandle?: string
  }

  name: string
  category: CategoryId
  subcategory?: string
  description?: string

  location: {
    address?: string
    neighbourhood?: string
    city?: string
    postcode?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }

  distanceMeters?: number

  media: {
    hero?: string
    images: string[]
    gallery: GalleryImage[]
  }

  rating: {
    overall?: number
    reviewCount?: number
  }

  providerRatings: {
    google?: {
      rating?: number
      reviews?: number
    }
    instagram?: {
      followers?: number
      trending?: boolean
    }
    foodHygiene?: number
    bookingCom?: number
    // Optional Trustpilot enrichment. Stored independently from Google data and
    // never averaged together. Absent when there is no confident match.
    trustpilot?: TrustpilotRating
  }

  priceLevel?: 1 | 2 | 3 | 4
  // Live "open right now" flag from Google's `open_now`. Only set for live
  // listings; undefined means "unknown", never "closed".
  openNow?: boolean
  tags: string[]
  amenities: string[]

  // Optional Google Place Details (New) enrichment. Absent until a business has
  // been enriched; the UI renders nothing extra when it is missing.
  googleDetails?: GoogleDetails

  openingHours: OpeningHours[]

  contact: {
    phone?: string
    website?: string
    email?: string
    socials?: {
      instagram?: string
      facebook?: string
      tiktok?: string
    }
  }

  reviews: BusinessReview[]

  flags: {
    featured?: boolean
    verified?: boolean
    trending?: boolean
  }

  ai?: {
    score?: number
    matchReasons?: string[]
  }

  createdAt?: string
  updatedAt?: string
}
