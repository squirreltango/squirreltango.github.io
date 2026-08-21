// Derives LookMeUp *presentation* insights from REAL Google Places data only.
//
// Rules enforced here:
// - Never fabricate data. Every insight is a factual interpretation of the
//   rating, review count, open-now flag, category or location we already have.
// - Insight wording is LookMeUp's interpretation, never attributed to Google.
// - "Trending" is intentionally NOT derivable from rating/review volume; it is
//   reserved for a genuine future social/trend signal.

import type { Business, CategoryId } from "@/lib/types/business"
import { getCategoryLabel } from "@/lib/business/category-mapping"

export type InsightTone = "top" | "popular" | "rated" | "gem" | "open" | "category"

export interface InsightBadge {
  label: string
  tone: InsightTone
}

/**
 * The single strongest hero badge for a card, chosen by a fixed priority.
 * Returns null when the real data doesn't justify any badge.
 *
 * Priority (strongest first):
 *   5★ favourite > London favourite > Highly rated > Popular choice >
 *   Hidden gem > Open now > gentle category badge
 */
export function getPrimaryInsightBadge(business: Business): InsightBadge | null {
  const google = business.providerRatings.google
  const rating = google?.rating
  const reviews = google?.reviews ?? 0

  if (rating !== undefined) {
    // Perfect score with meaningful volume.
    if (rating >= 5 && reviews >= 50) {
      return { label: "5★ favourite", tone: "top" }
    }
    // Very high volume - a genuine London-wide favourite.
    if (reviews >= 5000) {
      return { label: "London favourite", tone: "popular" }
    }
    // Exceptional rating backed by solid volume.
    if (rating >= 4.8 && reviews >= 100) {
      return { label: "Highly rated", tone: "rated" }
    }
    // Strong social proof by volume alone.
    if (reviews >= 1000) {
      return { label: "Popular choice", tone: "popular" }
    }
    // Excellent rating, modest but credible review count.
    if (rating >= 4.7 && reviews >= 30 && reviews <= 300) {
      return { label: "Hidden gem", tone: "gem" }
    }
  }

  // A genuine live signal: open right now.
  if (business.openNow === true) {
    return { label: "Open now", tone: "open" }
  }

  // Gentle, factual category badge so live cards aren't badge-less. Only for a
  // few categories where the label reads as a recommendation rather than raw
  // metadata.
  const categoryBadge = getCategoryBadge(business.category)
  if (categoryBadge) return { label: categoryBadge, tone: "category" }

  return null
}

function getCategoryBadge(category: CategoryId): string | null {
  switch (category) {
    case "wellness":
      return "Spa & wellness"
    case "beauty":
      return "Beauty favourite"
    case "cafes":
      return "Coffee favourite"
    case "nightlife":
      return "Cocktail spot"
    default:
      return null
  }
}

/**
 * LookMeUp's qualitative interpretation of a Google rating. Deliberately
 * returns nothing below 4.0 so we never put positive wording on a weak score.
 */
export function getRatingInterpretation(rating?: number): string | null {
  if (rating === undefined) return null
  if (rating >= 4.8) return "Exceptional"
  if (rating >= 4.5) return "Excellent"
  if (rating >= 4.2) return "Very good"
  if (rating >= 4.0) return "Highly rated"
  return null
}

/** Compact review count: 1240 -> "1.2k", 950 -> "950". */
export function formatReviewCount(count?: number): string {
  if (!count || count < 0) return "0"
  if (count < 1000) return String(count)
  const thousands = count / 1000
  // One decimal place, but drop a trailing ".0" (e.g. 2.0k -> 2k).
  const rounded = Math.round(thousands * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k`
}

/**
 * Google-attributed review-volume context, e.g. "1.2k Google reviews" or
 * "Loved by 361 reviewers". Never implies the reviewers are LookMeUp users.
 */
export function getReviewContext(count?: number): string | null {
  if (!count || count <= 0) return null
  if (count >= 1000) return `${formatReviewCount(count)} Google reviews`
  return `Loved by ${count} reviewers`
}

// Short, factual noun phrases per category for generated summaries.
const CATEGORY_NOUN: Record<CategoryId, string> = {
  food: "restaurant",
  fitness: "fitness spot",
  beauty: "beauty destination",
  cafes: "café",
  nightlife: "bar",
  wellness: "wellness destination",
  other: "local spot",
}

/**
 * Build a concise, factual one-line summary from real attributes only. Used to
 * fill the description slot for live listings that have no curated description.
 * Never introduces subjective claims (romantic, luxury, award-winning, etc.).
 *
 * Examples:
 *   "Highly rated beauty destination in London."
 *   "Popular café in Covent Garden, London."
 */
export function getFactualSummary(business: Business): string | null {
  const rating = business.providerRatings.google?.rating
  const reviews = business.providerRatings.google?.reviews ?? 0
  const noun = CATEGORY_NOUN[business.category] ?? "local spot"

  // A factual quality lead-in, only when the data supports it.
  let lead: string | null = null
  if (rating !== undefined) {
    if (rating >= 4.8 && reviews >= 100) lead = "Highly rated"
    else if (reviews >= 1000) lead = "Popular"
    else if (rating >= 4.7 && reviews >= 30) lead = "Well-reviewed"
  }

  const { neighbourhood, city } = business.location
  const place = [neighbourhood, city].filter(Boolean).join(", ") || city || neighbourhood || null

  const subject = lead ? `${lead} ${noun}` : noun.charAt(0).toUpperCase() + noun.slice(1)
  const withPlace = place ? `${subject} in ${place}` : subject
  return `${withPlace}.`
}

/** Category label passthrough for components that only import this module. */
export function categoryLabel(category: CategoryId): string {
  return getCategoryLabel(category)
}
