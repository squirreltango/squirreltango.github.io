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
  /**
   * True only when a real integration confirmed this media genuinely came from
   * the stated `source`. Required before an Instagram label is shown; existing
   * `source: "instagram"` seed entries are Unsplash stock and leave this unset.
   */
  verified?: boolean
  // Plain-text photo credit. Google requires photo attributions to be shown
  // wherever the photo appears, so this travels with the image itself.
  attribution?: string
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

// Structured location derived from Google's `addressComponents`. Every field is
// optional - we only ever populate what Google actually returns, and never
// guess or infer an area from a business name. `displayLocation` is the
// short, deduplicated human label used on cards (e.g. "Covent Garden, London").
export interface GoogleLocation {
  displayLocation?: string
  neighbourhood?: string
  sublocality?: string
  locality?: string
  postalTown?: string
  adminArea?: string
  postcode?: string
  formattedAddress?: string
  shortFormattedAddress?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

// Enrichment sourced from Google Place Details (New). Kept clearly namespaced
// so this data is always identifiable as Google-derived and never conflated
// with curated LookMeUp content or other providers.
export interface GoogleDetails {
  amenities?: GoogleAmenities
  editorialSummary?: string
  // Structured, Google-sourced location. Populated by enrichment (Place Details
  // New `addressComponents`) or the live detail fetch (legacy address_components).
  location?: GoogleLocation
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
    // Plain-text photo credits aligned BY INDEX with `images`. Optional and
    // sparse - an entry is only present when Google supplied an attribution
    // for that photo. Never fabricated.
    attributions?: string[]
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
    // Instagram is NOT integrated yet. Everything here is gated in the UI by
    // `hasVerifiedInstagramData` (lib/business/provenance.ts) and must never
    // render under Instagram branding unless it genuinely came from Instagram.
    instagram?: {
      followers?: number
      trending?: boolean
      /** Handle of the matched account, once an integration resolves one. */
      username?: string
      /**
       * True ONLY when a real integration has matched this business to an
       * Instagram account. Never inferred from follower count or any other
       * heuristic - it must be written by the ingestion path itself.
       */
      verified?: boolean
      /**
       * Where these values came from:
       * - "live"    - fetched from Instagram by a real integration
       * - "curated" - entered by hand by our team, NOT from Instagram
       * - "seed"    - legacy placeholder/mock data (the current state)
       * Absent means unknown, which is treated as untrusted.
       */
      provenance?: "live" | "curated" | "seed"
      /** ISO timestamp of the last successful live sync. */
      lastSyncedAt?: string
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
