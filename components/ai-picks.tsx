"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Star, TrendingUp, ShieldCheck, Sparkles, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Business } from "@/lib/types/business"
import {
  getHeadlineRating,
  getHeadlineReviewCount,
  getHeroImage,
  getLocationLabel,
} from "@/lib/business/normalise-business"
import { formatPriceLevel } from "@/lib/business/category-mapping"
import { isTrending, getVerifiedHygieneRating } from "@/lib/business/provenance"
import { hygieneRankingScore, isStrongHygiene, hygieneBadgeLabel } from "@/lib/business/hygiene-display"

interface AIPicksProps {
  businesses: Business[]
}

export function AIPicks({ businesses }: AIPicksProps) {
  // Select AI picks based on criteria:
  // - High Google rating (4.5+)
  // - Strong food hygiene (4+)
  // - Trending (ranking input only; not surfaced as an Instagram claim)
  const aiPicks = useMemo(() => {
    const scored = businesses.map((business) => {
      let score = 0

      const googleRating = business.providerRatings.google?.rating ?? getHeadlineRating(business) ?? 0
      const googleReviews = business.providerRatings.google?.reviews ?? getHeadlineReviewCount(business) ?? 0
      const instagram = business.providerRatings.instagram

      // Google rating score (max 30 points)
      score += googleRating * 6

      // Food hygiene score (max 25 points). Uses the REAL FSA rating only -
      // ranking previously multiplied the fabricated seed number, which meant
      // invented food-safety data decided which venues got promoted here.
      // Scheme-aware: absent, pending and exempt all contribute 0 rather than
      // being coerced into a low score.
      score += hygieneRankingScore(getVerifiedHygieneRating(business))

      // Trending bonus (20 points). Reads the provider-neutral flag, which the
      // normaliser derives from the same underlying value - ranking output is
      // unchanged, it just no longer depends on an Instagram-shaped field.
      if (isTrending(business)) {
        score += 20
      }

      // Instagram followers score (max 15 points)
      if (instagram?.followers) {
        score += Math.min(instagram.followers / 30000, 15)
      }

      // Review count score (max 10 points)
      score += Math.min(googleReviews / 500, 10)

      return { business, score }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.business)
  }, [businesses])

  if (aiPicks.length === 0) return null

  return (
    <section className="mb-14">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-semibold text-foreground">AI Picks</h2>
            <p className="text-sm text-muted-foreground">Curated just for you</p>
          </div>
        </div>
        <Link
          href="#all-places"
          className={cn(
            "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium",
            "bg-secondary/60 text-secondary-foreground",
            "transition-all duration-300 hover:bg-secondary hover:shadow-sm"
          )}
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative -mx-5 sm:-mx-8">
        <div
          className="flex gap-5 overflow-x-auto px-5 sm:px-8 pb-4 scrollbar-hide"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {aiPicks.map((business, index) => {
            const googleRating = business.providerRatings.google?.rating ?? getHeadlineRating(business)
            const verifiedHygiene = getVerifiedHygieneRating(business)
            const trending = isTrending(business)
            return (
              <Link
                key={business.id}
                href={`/business/${business.id}`}
                className={cn("group flex-shrink-0 w-[320px] sm:w-[360px]", "transition-all duration-500")}
                style={{ scrollSnapAlign: "start" }}
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-3xl bg-card border border-border/50",
                    "shadow-lg shadow-foreground/5",
                    "transition-all duration-500",
                    "hover:shadow-xl hover:shadow-foreground/10 hover:border-border",
                    "hover:-translate-y-1"
                  )}
                >
                  {/* Rank Badge */}
                  <div className="absolute top-4 left-4 z-20">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-serif font-bold text-sm",
                        index === 0
                          ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-card/90 backdrop-blur-sm text-foreground border border-border/50"
                      )}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={getHeroImage(business) || "/placeholder.svg"}
                      alt={business.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                    {/* AI Pick Badges */}
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                      {googleRating !== undefined && googleRating >= 4.5 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-xs font-medium shadow-sm">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          <span className="text-foreground">Top Rated</span>
                        </div>
                      )}
                      {trending && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-xs font-medium text-white shadow-sm">
                          <TrendingUp className="h-3 w-3" />
                          <span>Trending</span>
                        </div>
                      )}
                      {/* Only a real, strong FSA rating earns a highlight
                          badge. Label is scheme-aware, so Scotland shows
                          "Pass" rather than a fake "/5" score. */}
                      {isStrongHygiene(verifiedHygiene) && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-xs font-medium text-white shadow-sm">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          <span>{hygieneBadgeLabel(verifiedHygiene)}</span>
                          <span className="sr-only">Food Standards Agency hygiene rating</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-serif font-semibold text-lg text-foreground leading-tight group-hover:text-foreground/80 transition-colors line-clamp-1">
                        {business.name}
                      </h3>
                      {googleRating !== undefined && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/80 text-xs font-medium text-foreground flex-shrink-0">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {googleRating}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{business.description}</p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{getLocationLabel(business)}</span>
                      <span className="text-xs font-medium text-foreground">{formatPriceLevel(business.priceLevel)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-4 w-5 sm:w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-4 w-5 sm:w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </section>
  )
}
