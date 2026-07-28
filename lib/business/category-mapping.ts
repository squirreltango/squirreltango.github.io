import type { CategoryId } from "@/lib/types/business"

export const CATEGORY_IDS: CategoryId[] = [
  "food",
  "fitness",
  "beauty",
  "cafes",
  "nightlife",
  "wellness",
  "other",
]

// Maps external Google Places "types" (and a few common synonyms) to our
// internal category ids.
const EXTERNAL_TYPE_TO_CATEGORY: Record<string, CategoryId> = {
  // Food
  restaurant: "food",
  meal_takeaway: "food",
  meal_delivery: "food",
  bakery: "food",
  food: "food",
  // Cafes
  cafe: "cafes",
  coffee_shop: "cafes",
  // Fitness
  gym: "fitness",
  fitness_center: "fitness",
  // Beauty
  beauty_salon: "beauty",
  hair_care: "beauty",
  hair_salon: "beauty",
  nail_salon: "beauty",
  spa: "beauty",
  // Nightlife
  bar: "nightlife",
  night_club: "nightlife",
  nightclub: "nightlife",
  // Wellness
  physiotherapist: "wellness",
  yoga: "wellness",
  yoga_studio: "wellness",
  wellness: "wellness",
  wellness_center: "wellness",
}

/**
 * Convert an arbitrary category value (app category, single Google type, or a
 * list of Google types) into a valid CategoryId. Unknown values map to "other".
 */
export function mapCategory(input?: string | string[] | null): CategoryId {
  if (!input) return "other"
  const values = Array.isArray(input) ? input : [input]

  for (const raw of values) {
    if (!raw) continue
    const key = String(raw).toLowerCase().trim()
    if ((CATEGORY_IDS as string[]).includes(key)) return key as CategoryId
    if (EXTERNAL_TYPE_TO_CATEGORY[key]) return EXTERNAL_TYPE_TO_CATEGORY[key]
  }

  return "other"
}

/**
 * Convert a price representation (string of currency symbols like "£££",
 * a numeric string, or a number 0-4) into a numeric level 1-4.
 * Returns undefined when no meaningful value is present.
 */
export function parsePriceLevel(
  input?: string | number | null,
): 1 | 2 | 3 | 4 | undefined {
  if (input === null || input === undefined) return undefined

  if (typeof input === "number") {
    if (Number.isNaN(input)) return undefined
    if (input <= 0) return undefined
    return Math.min(Math.round(input), 4) as 1 | 2 | 3 | 4
  }

  const trimmed = input.trim()
  if (!trimmed) return undefined

  const symbolCount = (trimmed.match(/[£$€]/g) || []).length
  if (symbolCount > 0) return Math.min(symbolCount, 4) as 1 | 2 | 3 | 4

  const num = Number(trimmed)
  if (!Number.isNaN(num) && num >= 1) {
    return Math.min(Math.round(num), 4) as 1 | 2 | 3 | 4
  }

  return undefined
}

/** Render a numeric price level as currency symbols (empty string if none). */
export function formatPriceLevel(level?: number | null): string {
  if (!level || level < 1) return ""
  return "£".repeat(Math.min(Math.round(level), 4))
}
