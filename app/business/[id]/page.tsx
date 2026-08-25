"use client"

import { use, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft, Star, MapPin, Heart, Share2, Instagram, Building2, TrendingUp, ExternalLink, Loader2 } from "lucide-react"
import { businesses as mockBusinesses } from "@/lib/data"
import type { Business } from "@/lib/types/business"
import {
  getBusinessPhotos,
  getHeroImage,
  getHeadlineRating,
  getHeadlineReviewCount,
  getLocationLabel,
} from "@/lib/business/normalise-business"
import { formatPriceLevel } from "@/lib/business/category-mapping"
import { getBusinessFullAddress } from "@/lib/business/location"
import { getAmenityChips } from "@/lib/business/amenities"
import { PhotoGallery } from "@/components/photo-gallery"
import { hasVerifiedInstagramData } from "@/lib/business/provenance"
import { HygieneBadgeDetail } from "@/components/hygiene-badge"
import { BusinessPhotoCarousel } from "@/components/business-photo-carousel"
import { BusinessInfoRows } from "@/components/business-info-rows"
import { cn } from "@/lib/utils"
import { notFound } from "next/navigation"

import type { BusinessReview } from "@/lib/types/business"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Generic fallback reviews, only shown when a business has no reviews of its own.
const fallbackReviews: BusinessReview[] = [
  {
    id: "fallback-1",
    author: "Sarah Mitchell",
    rating: 5,
    date: "2 weeks ago",
    text: "Absolutely loved this place! The atmosphere was perfect and the service was exceptional. Will definitely be coming back.",
  },
  {
    id: "fallback-2",
    author: "James Thompson",
    rating: 4,
    date: "1 month ago",
    text: "Great experience overall. The location is wonderful and staff were very friendly. Only minor issue was the wait time.",
  },
  {
    id: "fallback-3",
    author: "Emily Roberts",
    rating: 5,
    date: "2 months ago",
    text: "One of the best places I have been to in London. Highly recommend for anyone looking for a premium experience.",
  },
]

export default function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isSaved, setIsSaved] = useState(false)

  // Fetch from Supabase API
  const { data: supabaseBusiness, isLoading } = useSWR<Business>(
    `/api/businesses/${id}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Fallback to mock data if Supabase returns nothing. The API responds with
  // an `{ error }` object for non-UUID ids (all curated mock ids), and that
  // object is truthy - so require a real business shape before trusting it,
  // otherwise the fallback is skipped and `business.media` blows up.
  const mockBusiness = mockBusinesses.find((b) => b.id === id)
  const isBusinessShape = (value: unknown): value is Business =>
    typeof value === "object" && value !== null && "media" in value
  const business = isBusinessShape(supabaseBusiness) ? supabaseBusiness : mockBusiness

  if (!isLoading && !business) {
    notFound()
  }

  // Show loading skeleton while fetching
  if (isLoading && !mockBusiness) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading business details...</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return null
  }

  const displayReviews = business.reviews && business.reviews.length > 0 ? business.reviews : fallbackReviews

  // Real Google photos for this place (deduplicated, capped at 10). Falls back
  // to the single hero so the header never renders empty.
  const realPhotos = getBusinessPhotos(business)
  const photos = realPhotos.length > 0 ? realPhotos : [{ url: getHeroImage(business) }]

  return (
    <div className="min-h-screen bg-background">
      {/* Header image carousel - real Google Places photos for this venue */}
      <div className="relative h-72 sm:h-96 md:h-[28rem] overflow-hidden">
        <BusinessPhotoCarousel photos={photos} businessName={business.name} />

        {/* Navigation */}
        <div 
          className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-20"
          style={{ animation: 'fadeInUp 0.5s ease-out' }}
        >
          <Link
            href="/"
            className={cn(
              "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95"
            )}
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSaved(!isSaved)}
              className={cn(
                "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
                "transition-all duration-300",
                "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95",
                isSaved && "animate-pulse-once"
              )}
            >
              <Heart className={cn(
                "h-5 w-5 transition-all duration-300", 
                isSaved ? "fill-red-500 text-red-500 scale-110" : "text-foreground"
              )} />
            </button>
            <button className={cn(
              "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95"
            )}>
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 -mt-20 relative z-10 pb-10">
        <div 
          className="bg-card rounded-3xl shadow-xl border border-border/40 overflow-hidden"
          style={{ animation: 'slideInUp 0.6s ease-out' }}
        >
          {/* Main Info */}
          <div className="p-6 sm:p-8">
            {/* Price Badge */}
            <span 
              className="inline-block px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-semibold mb-5"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.1s forwards', opacity: 0 }}
            >
              {formatPriceLevel(business.priceLevel)}
            </span>
            
            <div className="mb-6">
              <h1 
                className="text-3xl sm:text-4xl font-serif font-semibold text-foreground mb-4"
                style={{ animation: 'fadeInUp 0.4s ease-out 0.15s forwards', opacity: 0 }}
              >
                {business.name}
              </h1>
              <div 
                className="flex flex-wrap items-center gap-4"
                style={{ animation: 'fadeInUp 0.4s ease-out 0.2s forwards', opacity: 0 }}
              >
                {getHeadlineRating(business) !== undefined && (
                  <div className="flex items-center gap-2 bg-secondary/80 px-3.5 py-2 rounded-full transition-all duration-300 hover:bg-amber-100">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span className="font-semibold text-foreground">{getHeadlineRating(business)}</span>
                    <span className="text-muted-foreground text-sm">({(getHeadlineReviewCount(business) || 0).toLocaleString()} reviews)</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{getLocationLabel(business)}</span>
                    {/* Full Google address, shown only when it adds detail
                        beyond the short area label. */}
                    {(() => {
                      const full = getBusinessFullAddress(business)
                      const short = getLocationLabel(business)
                      return full && full !== short ? (
                        <span className="text-xs text-muted-foreground/70">{full}</span>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {(business.description || business.googleDetails?.editorialSummary) && (
              <div style={{ animation: 'fadeInUp 0.4s ease-out 0.25s forwards', opacity: 0 }} className="mb-8">
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {business.description || business.googleDetails?.editorialSummary}
                </p>
                {/* Attribute the copy to Google when it comes from Google's
                    editorial summary (and there is no curated description). */}
                {!business.description && business.googleDetails?.editorialSummary && (
                  <span className="mt-2 inline-block text-xs text-muted-foreground/70">
                    Summary from Google
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            <div 
              className="flex items-center gap-2 flex-wrap mb-8"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.3s forwards', opacity: 0 }}
            >
              {(business.tags || []).map((tag, i) => (
                <span
                  key={tag}
                  className={cn(
                    "px-4 py-2 rounded-full bg-secondary/60 text-sm font-medium text-secondary-foreground",
                    "transition-all duration-300 hover:bg-secondary hover:scale-105"
                  )}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Google amenities - full set. Only real, Google-confirmed
                amenities appear; the section is hidden entirely when none. */}
            {(() => {
              const allAmenities = getAmenityChips(business.googleDetails, business.category)
              if (allAmenities.length === 0) return null
              return (
                <div
                  className="mb-8"
                  style={{ animation: 'fadeInUp 0.4s ease-out 0.31s forwards', opacity: 0 }}
                >
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Amenities
                    <span className="ml-2 normal-case font-normal text-muted-foreground/60">via Google</span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {allAmenities.map((chip) => (
                      <span
                        key={chip.key}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium",
                          "bg-primary/10 text-primary border border-primary/20",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Ratings Breakdown Section */}
            <div 
              className="mb-8"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.32s forwards', opacity: 0 }}
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Ratings Breakdown</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Instagram - suppressed until a verified Instagram
                    integration supplies these figures. The follower counts
                    currently in the data are hand-authored seed values, so
                    presenting them under Instagram branding would attribute
                    numbers to a provider we have not integrated. */}
                {hasVerifiedInstagramData(business) && business.providerRatings.instagram?.followers !== undefined && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl bg-secondary/40 border border-border/30",
                    "transition-all duration-300 hover:bg-secondary/60 hover:border-border/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center">
                          <Instagram className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Instagram</span>
                      </div>
                      {business.providerRatings.instagram?.trending && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs font-semibold">Trending</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-foreground">
                        {((business.providerRatings.instagram?.followers ?? 0) / 1000).toFixed(0)}K
                        <span className="text-sm font-normal text-muted-foreground ml-1">followers</span>
                      </span>
                      <button className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/5 text-xs font-medium text-muted-foreground",
                        "transition-all duration-300 hover:bg-foreground/10 hover:text-foreground"
                      )}>
                        <ExternalLink className="h-3 w-3" />
                        View
                      </button>
                    </div>
                  </div>
                )}

                {/* Google */}
                <div className={cn(
                  "flex flex-col gap-2 p-4 rounded-2xl bg-secondary/40 border border-border/30",
                  "transition-all duration-300 hover:bg-secondary/60 hover:border-border/50"
                )}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-border/50 flex items-center justify-center">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-foreground">Google</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                      <span className="text-lg font-semibold text-foreground">{business.providerRatings.google?.rating ?? getHeadlineRating(business) ?? 0}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({(business.providerRatings.google?.reviews ?? getHeadlineReviewCount(business) ?? 0).toLocaleString()} reviews)
                    </span>
                  </div>
                </div>

                {/* Official FSA hygiene rating. Carries its own attribution,
                    inspection date and link to the FSA register, and renders
                    nothing unless a confident FSA match exists. */}
                <HygieneBadgeDetail business={business} />

                {/* Booking.com Rating - Only for hotels */}
                {business.providerRatings.bookingCom !== undefined && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl bg-blue-50/50 border border-blue-200/50",
                    "transition-all duration-300 hover:shadow-sm"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Booking.com</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-blue-700">{business.providerRatings.bookingCom}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {business.providerRatings.bookingCom >= 9 
                            ? "Excellent" 
                            : business.providerRatings.bookingCom >= 8
                              ? "Very Good"
                              : business.providerRatings.bookingCom >= 7
                                ? "Good"
                                : "Pleasant"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                  </div>
                )}

                {/* Trustpilot - independent trust signal, only shown when a
                    confident match exists. Never averaged with Google. */}
                {business.providerRatings.trustpilot?.businessUnitId && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl bg-[#00b67a]/5 border border-[#00b67a]/25",
                    "transition-all duration-300 hover:bg-[#00b67a]/10 hover:border-[#00b67a]/40"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#00b67a] flex items-center justify-center">
                          <Star className="h-4 w-4 fill-white text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Trustpilot</span>
                      </div>
                      {business.providerRatings.trustpilot.profileUrl && (
                        <a
                          href={business.providerRatings.trustpilot.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/5 text-xs font-medium text-muted-foreground",
                            "transition-all duration-300 hover:bg-foreground/10 hover:text-foreground"
                          )}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5" aria-hidden="true">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-4 w-4",
                                i < Math.round(business.providerRatings.trustpilot?.stars ?? 0)
                                  ? "fill-[#00b67a] text-[#00b67a]"
                                  : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                        {business.providerRatings.trustpilot.trustScore !== undefined && (
                          <span className="text-lg font-semibold text-foreground ml-1">
                            {business.providerRatings.trustpilot.trustScore}
                          </span>
                        )}
                      </div>
                      {business.providerRatings.trustpilot.reviewCount !== undefined && (
                        <span className="text-sm text-muted-foreground">
                          {business.providerRatings.trustpilot.reviewCount.toLocaleString()} reviews
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">TrustScore on Trustpilot</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div 
              className="grid grid-cols-2 gap-4"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.35s forwards', opacity: 0 }}
            >
              <button
                onClick={() => setIsSaved(!isSaved)}
                className={cn(
                  "flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold",
                  "transition-all duration-300 active:scale-[0.98]",
                  isSaved
                    ? "bg-red-50 text-red-600 border-2 border-red-200"
                    : "bg-secondary/60 text-secondary-foreground border-2 border-transparent hover:border-border hover:bg-secondary"
                )}
              >
                <Heart className={cn("h-5 w-5 transition-transform duration-300", isSaved && "fill-current scale-110")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              {/* Keeps the user inside LookMeUp: opens the existing Map View
                  with this business already selected and centred. */}
              <Link
                href={`/?view=map&focus=${encodeURIComponent(business.id)}`}
                className={cn(
                  "flex items-center justify-center gap-2.5 py-4 rounded-2xl",
                  "bg-foreground text-background font-semibold",
                  "shadow-lg shadow-foreground/10",
                  "transition-all duration-300",
                  "hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15 hover:scale-[1.02]",
                  "active:scale-[0.98]"
                )}
              >
                <MapPin className="h-5 w-5" />
                Get Directions
              </Link>
            </div>
          </div>

          {/* Details - opening hours, contact and website as real controls.
              Rows with no genuine Google data are hidden entirely. */}
          <BusinessInfoRows business={business} />
        </div>

        {/* Photo Gallery Section */}
        {business.media.gallery && business.media.gallery.length > 0 && (
          <PhotoGallery images={business.media.gallery} businessName={business.name} />
        )}

        {/* Reviews Section */}
        <div 
          className="mt-8 bg-card rounded-3xl shadow-lg border border-border/40 overflow-hidden"
          style={{ animation: 'fadeInUp 0.5s ease-out 0.65s forwards', opacity: 0 }}
        >
          <div className="p-6 sm:p-8 border-b border-border/60">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-semibold text-foreground">Reviews</h2>
              <button className={cn(
                "text-sm font-semibold text-muted-foreground",
                "transition-all duration-300 hover:text-foreground hover:underline underline-offset-2"
              )}>
                See all
              </button>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {displayReviews.map((review, index) => (
              <div 
                key={review.id} 
                className="p-6 sm:p-8 transition-colors duration-300 hover:bg-secondary/20"
                style={{ animation: `fadeInUp 0.4s ease-out ${0.7 + index * 0.1}s forwards`, opacity: 0 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-13 h-13 shrink-0 rounded-2xl bg-secondary flex items-center justify-center">
                    <span className="text-lg font-serif font-semibold text-foreground">
                      {review.author.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{review.author}</h3>
                      {review.date && <span className="text-sm text-muted-foreground shrink-0">{review.date}</span>}
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4 transition-all duration-300",
                            i < review.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground/30"
                          )}
                          style={{ transitionDelay: `${i * 50}ms` }}
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{review.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
