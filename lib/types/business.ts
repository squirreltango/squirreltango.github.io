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
  tags: string[]
  amenities: string[]

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
