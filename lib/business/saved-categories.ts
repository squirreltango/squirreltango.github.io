import type { CategoryId } from "@/lib/types/business"

/**
 * Consumer-friendly grouping for Saved places (and the My Plans quick-add).
 *
 * This is a thin presentation layer over the data we ALREADY hold: the internal
 * `CategoryId` (resolved from genuine Google Places types at ingest time) and,
 * where available, the raw Google `types` we keep on a business as `tags`. It
 * never inspects the business NAME and never hardcodes individual venues - the
 * grouping is derived purely from provider category data.
 *
 * The coarse `CategoryId` taxonomy cannot express Stays / Shopping / Things to
 * do on its own, so those groups are only reached when the genuine Google type
 * tags say so. When no tags were captured (older saves), we fall back to the
 * category alone, which still produces useful Eat / Nightlife / Beauty /
 * Fitness groupings rather than a single "General" bucket.
 */

export type SavedGroupId =
  | "eat"
  | "nightlife"
  | "beauty"
  | "wellness"
  | "thingsToDo"
  | "shopping"
  | "stays"
  | "other"

export interface SavedGroup {
  id: SavedGroupId
  label: string
}

/** Display order for the Saved category tabs. */
export const SAVED_GROUPS: SavedGroup[] = [
  { id: "eat", label: "Places to Eat" },
  { id: "nightlife", label: "Nightlife" },
  { id: "beauty", label: "Hair & Beauty" },
  { id: "wellness", label: "Fitness & Wellness" },
  { id: "thingsToDo", label: "Things to Do" },
  { id: "shopping", label: "Shopping" },
  { id: "stays", label: "Stays" },
  { id: "other", label: "Other" },
]

const SAVED_GROUP_LABEL: Record<SavedGroupId, string> = SAVED_GROUPS.reduce(
  (acc, g) => {
    acc[g.id] = g.label
    return acc
  },
  {} as Record<SavedGroupId, string>,
)

export function savedGroupLabel(id: SavedGroupId): string {
  return SAVED_GROUP_LABEL[id] ?? "Other"
}

// Genuine Google Places accommodation types. Kept in one place so the Saved
// "Stays" group and the discovery "Hotels" filter agree on what counts.
const STAY_TYPES = new Set([
  "lodging",
  "hotel",
  "resort_hotel",
  "motel",
  "hostel",
  "bed_and_breakfast",
  "guest_house",
  "extended_stay_hotel",
  "budget_japanese_inn",
  "japanese_inn",
  "inn",
  "campground",
  "rv_park",
  "cottage",
  "farmstay",
  "private_guest_room",
])

const THINGS_TO_DO_TYPES = new Set([
  "tourist_attraction",
  "museum",
  "art_gallery",
  "movie_theater",
  "performing_arts_theater",
  "theater",
  "concert_hall",
  "amusement_park",
  "aquarium",
  "zoo",
  "stadium",
  "park",
  "national_park",
  "cultural_center",
  "planetarium",
  "bowling_alley",
  "casino",
  "historical_landmark",
])

const SHOPPING_TYPES = new Set([
  "shopping_mall",
  "clothing_store",
  "shoe_store",
  "jewelry_store",
  "book_store",
  "department_store",
  "furniture_store",
  "home_goods_store",
  "electronics_store",
  "gift_shop",
  "boutique",
  "market",
])

const EAT_TYPES = new Set([
  "restaurant",
  "cafe",
  "coffee_shop",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food_court",
  "brunch_restaurant",
])

const NIGHTLIFE_TYPES = new Set(["bar", "night_club", "nightclub", "pub", "wine_bar"])

const BEAUTY_TYPES = new Set([
  "beauty_salon",
  "hair_salon",
  "hair_care",
  "nail_salon",
  "spa",
  "skin_care_clinic",
])

const WELLNESS_TYPES = new Set([
  "gym",
  "fitness_center",
  "yoga",
  "yoga_studio",
  "pilates_studio",
  "physiotherapist",
  "wellness_center",
  "sauna",
  "massage",
])

function normaliseTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return []
  return tags.map((t) => String(t).toLowerCase().trim().replace(/\s+/g, "_"))
}

/** True when the business's genuine Google types mark it as accommodation. */
export function isAccommodationTags(tags?: string[] | null): boolean {
  return normaliseTags(tags).some((t) => STAY_TYPES.has(t))
}

/**
 * Resolve the consumer-friendly Saved group for a business, from its internal
 * category and (when present) genuine Google type tags. Never inspects the name.
 */
export function getSavedGroup(
  category?: string | null,
  tags?: string[] | null,
): SavedGroupId {
  const t = normaliseTags(tags)
  const has = (set: Set<string>) => t.some((v) => set.has(v))

  // Tag-only groups first: the coarse category can't express these.
  if (has(STAY_TYPES)) return "stays"
  if (has(THINGS_TO_DO_TYPES)) return "thingsToDo"
  if (has(SHOPPING_TYPES)) return "shopping"

  // Core groups from the resolved internal category.
  switch (category) {
    case "food":
    case "cafes":
      return "eat"
    case "nightlife":
      return "nightlife"
    case "beauty":
      return "beauty"
    case "fitness":
    case "wellness":
      return "wellness"
  }

  // Category was "other" (or unknown): try to rescue it from the type tags.
  if (has(EAT_TYPES)) return "eat"
  if (has(NIGHTLIFE_TYPES)) return "nightlife"
  if (has(BEAUTY_TYPES)) return "beauty"
  if (has(WELLNESS_TYPES)) return "wellness"

  return "other"
}

/**
 * Given a list of items each carrying a category + tags, return the groups that
 * actually contain items, in display order, with counts. Used to render only
 * the Saved category tabs that have something in them.
 */
export function groupsPresent(
  items: { category?: string | null; tags?: string[] | null }[],
): { id: SavedGroupId; label: string; count: number }[] {
  const counts = new Map<SavedGroupId, number>()
  for (const item of items) {
    const id = getSavedGroup(item.category, item.tags)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return SAVED_GROUPS.filter((g) => counts.has(g.id)).map((g) => ({
    id: g.id,
    label: g.label,
    count: counts.get(g.id) ?? 0,
  }))
}
