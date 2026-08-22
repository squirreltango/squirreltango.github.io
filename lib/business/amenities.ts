import type { CategoryId, GoogleAmenities, GoogleDetails } from "@/lib/types/business"

// A single amenity ready for display: a stable key and a short human label.
export interface AmenityChip {
  key: string
  label: string
}

// Master definition of every amenity we can surface, in a sensible default
// order. Each entry knows how to detect itself from Google's amenity flags.
// We only ever emit a chip when Google explicitly returned `true` - a `false`
// or missing value produces no chip (never a "No X" chip, never a placeholder).
const AMENITY_DEFINITIONS: { key: string; label: string; present: (a: GoogleAmenities) => boolean }[] = [
  { key: "cocktails", label: "Cocktails", present: (a) => a.servesCocktails === true },
  { key: "coffee", label: "Coffee", present: (a) => a.servesCoffee === true },
  { key: "breakfast", label: "Breakfast", present: (a) => a.servesBreakfast === true },
  { key: "brunch", label: "Brunch", present: (a) => a.servesBrunch === true },
  { key: "lunch", label: "Lunch", present: (a) => a.servesLunch === true },
  { key: "dinner", label: "Dinner", present: (a) => a.servesDinner === true },
  { key: "outdoor", label: "Outdoor Seating", present: (a) => a.outdoorSeating === true },
  { key: "reservations", label: "Reservations", present: (a) => a.reservable === true },
  { key: "takeaway", label: "Takeaway", present: (a) => a.takeout === true },
  { key: "delivery", label: "Delivery", present: (a) => a.delivery === true },
  { key: "accessible", label: "Accessible", present: (a) => a.wheelchairAccessible === true },
  { key: "parking", label: "Parking", present: (a) => a.freeParking === true || a.paidParking === true },
]

// Per-category priority. When a business has more amenities than a card can
// show, we surface the ones that matter most for that category first. Keys not
// listed keep their natural order after the prioritised keys.
const CATEGORY_PRIORITY: Record<CategoryId, string[]> = {
  food: ["brunch", "dinner", "outdoor", "reservations", "lunch", "breakfast", "cocktails"],
  cafes: ["coffee", "breakfast", "brunch", "outdoor", "lunch", "takeaway"],
  nightlife: ["cocktails", "dinner", "reservations", "outdoor", "delivery"],
  beauty: ["reservations", "accessible", "parking"],
  wellness: ["reservations", "accessible", "parking"],
  fitness: ["reservations", "parking", "accessible"],
  other: ["reservations", "outdoor", "coffee", "accessible", "parking"],
}

/**
 * Resolve every amenity Google explicitly confirmed for a business, ordered by
 * the business category's priority. Returns an empty array when there is no
 * confirmed amenity data - callers must render nothing in that case.
 */
export function getAmenityChips(
  googleDetails: GoogleDetails | undefined,
  category: CategoryId,
): AmenityChip[] {
  const amenities = googleDetails?.amenities
  if (!amenities) return []

  const present = AMENITY_DEFINITIONS.filter((def) => def.present(amenities))
  if (present.length === 0) return []

  const priority = CATEGORY_PRIORITY[category] ?? []
  const rank = (key: string) => {
    const index = priority.indexOf(key)
    return index === -1 ? priority.length + 1 : index
  }

  return present
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map(({ key, label }) => ({ key, label }))
}

/**
 * The top N amenity chips for a business card (default 3). The full list is
 * intended for the detail page.
 */
export function getTopAmenityChips(
  googleDetails: GoogleDetails | undefined,
  category: CategoryId,
  limit = 3,
): AmenityChip[] {
  return getAmenityChips(googleDetails, category).slice(0, limit)
}
