import type { Business, GoogleLocation } from "@/lib/types/business"
import { resolvePostcode } from "@/lib/business/postcode"

/**
 * Location resolution for LookMeUp.
 *
 * Principles (per product requirements):
 *   * ONLY genuine Google address/location data is used - never the business
 *     name, never an AI guess, never a hardcoded neighbourhood table.
 *   * Prefer Google's STRUCTURED `addressComponents` over parsing a formatted
 *     address string.
 *   * The short "display location" shown on cards is separate from the full
 *     address, which stays available for detail pages, maps and directions.
 *   * "London" (or the city) is only ever a final fallback.
 */

// --- Raw Google shapes ------------------------------------------------------

// Places API (New): addressComponents: [{ longText, shortText, types[] }]
export interface NewAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}

// Legacy Places API: address_components: [{ long_name, short_name, types[] }]
export interface LegacyAddressComponent {
  long_name?: string
  short_name?: string
  types?: string[]
}

// Places API (New) Address Descriptor area. This is genuine Google data that
// names the human areas a place sits in (e.g. "Soho", "Covent Garden") - which
// UK addresses frequently omit from `addressComponents`. `containment` is one
// of WITHIN | OUTSKIRTS | NEAR; NEAR entries are proximity landmarks, not
// containing areas, so we never treat them as the neighbourhood.
export interface AddressDescriptorArea {
  displayName?: { text?: string; languageCode?: string }
  containment?: "WITHIN" | "OUTSKIRTS" | "NEAR" | "CONTAINMENT_UNSPECIFIED"
}

export interface AddressDescriptorLandmark {
  displayName?: { text?: string; languageCode?: string }
  types?: string[]
}

export interface AddressDescriptor {
  areas?: AddressDescriptorArea[]
  landmarks?: AddressDescriptorLandmark[]
}

// Prefer areas that actually contain the place (WITHIN) over ones the place is
// merely on the edge of (OUTSKIRTS). NEAR is excluded entirely - those are
// proximity references, not the containing neighbourhood.
const CONTAINMENT_RANK: Record<string, number> = { WITHIN: 0, OUTSKIRTS: 1 }

// Generic facility names Google sometimes returns as "areas" that are not real
// neighbourhoods. Matched case-insensitively as whole strings.
const NON_AREA_NAMES = new Set([
  "parking lot",
  "parking",
  "car park",
  "parking garage",
  "bus station",
  "train station",
  "railway station",
])

/**
 * Pick the single best neighbourhood-style area from Address Descriptor data.
 *
 * Google occasionally files specific POIs (e.g. "The National Gallery") or
 * generic facilities (e.g. "Parking lot") under `areas`. We reject those:
 *   - names that also appear as `landmarks` are POIs, not neighbourhoods;
 *   - names in NON_AREA_NAMES are generic facilities.
 * Returns undefined when nothing genuine remains - we never fabricate an area.
 */
export function pickBestArea(descriptor: AddressDescriptor | undefined): string | undefined {
  const areas = descriptor?.areas ?? []
  const landmarkNames = new Set(
    (descriptor?.landmarks ?? [])
      .map((l) => norm(l.displayName?.text))
      .filter((n) => n.length > 0),
  )

  const candidates = areas
    .map((a) => ({
      name: (a.displayName?.text ?? "").trim(),
      rank: CONTAINMENT_RANK[a.containment ?? ""],
    }))
    .filter((a) => {
      if (!a.name || a.rank === undefined) return false
      const lower = norm(a.name)
      if (NON_AREA_NAMES.has(lower)) return false
      // A name that is also a landmark is a POI, not a neighbourhood.
      if (landmarkNames.has(lower)) return false
      return true
    })

  if (candidates.length === 0) return undefined

  // Best containment first; within a tier prefer the more general (shorter) name.
  candidates.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length)
  return candidates[0].name
}

// Internal, API-agnostic component shape.
interface Component {
  long: string
  types: string[]
}

function fromNew(components: NewAddressComponent[] | undefined): Component[] {
  if (!Array.isArray(components)) return []
  return components
    .map((c) => ({ long: (c.longText ?? c.shortText ?? "").trim(), types: c.types ?? [] }))
    .filter((c) => c.long.length > 0)
}

function fromLegacy(components: LegacyAddressComponent[] | undefined): Component[] {
  if (!Array.isArray(components)) return []
  return components
    .map((c) => ({ long: (c.long_name ?? c.short_name ?? "").trim(), types: c.types ?? [] }))
    .filter((c) => c.long.length > 0)
}

/** Find the first component whose types include the given Google type. */
function pick(components: Component[], type: string): string | undefined {
  return components.find((c) => c.types.includes(type))?.long
}

/**
 * Build a structured GoogleLocation from a set of address components plus the
 * two formatted-address strings. Shared by both the New and legacy parsers.
 */
function buildLocation(
  components: Component[],
  opts: {
    formattedAddress?: string
    shortFormattedAddress?: string
    coordinates?: { lat: number; lng: number }
    // Best area from Address Descriptors, used as the neighbourhood when the
    // structured components don't carry a neighborhood/sublocality (common in
    // the UK). This is still genuine Google data - never a guess.
    area?: string
  } = {},
): GoogleLocation {
  const neighbourhood = pick(components, "neighborhood") ?? opts.area
  const sublocality =
    pick(components, "sublocality") ??
    pick(components, "sublocality_level_1") ??
    pick(components, "sublocality_level_2")
  const postalTown = pick(components, "postal_town")
  const locality = pick(components, "locality") ?? pick(components, "postal_town")
  const adminArea =
    pick(components, "administrative_area_level_2") ??
    pick(components, "administrative_area_level_1")
  // Structured `postal_code` wins; only when Google omits it (common for UK
  // places) do we parse the postcode back out of the formatted address.
  const postcode = resolvePostcode({
    structured: pick(components, "postal_code"),
    addressStrings: [opts.formattedAddress, opts.shortFormattedAddress],
  })

  const location: GoogleLocation = {}
  if (neighbourhood) location.neighbourhood = neighbourhood
  if (sublocality) location.sublocality = sublocality
  if (postalTown) location.postalTown = postalTown
  if (locality) location.locality = locality
  if (adminArea) location.adminArea = adminArea
  if (postcode) location.postcode = postcode
  if (opts.formattedAddress?.trim()) location.formattedAddress = opts.formattedAddress.trim()
  if (opts.shortFormattedAddress?.trim())
    location.shortFormattedAddress = opts.shortFormattedAddress.trim()
  if (opts.coordinates) location.coordinates = opts.coordinates

  location.displayLocation = computeDisplayLocation(location)
  return location
}

/** Parse Places API (New) address components into a structured GoogleLocation. */
export function parseNewAddressComponents(
  components: NewAddressComponent[] | undefined,
  opts: {
    formattedAddress?: string
    shortFormattedAddress?: string
    coordinates?: { lat: number; lng: number }
    area?: string
  } = {},
): GoogleLocation {
  return buildLocation(fromNew(components), opts)
}

/** Parse legacy Places API address components into a structured GoogleLocation. */
export function parseLegacyAddressComponents(
  components: LegacyAddressComponent[] | undefined,
  opts: {
    formattedAddress?: string
    coordinates?: { lat: number; lng: number }
    area?: string
  } = {},
): GoogleLocation {
  return buildLocation(fromLegacy(components), opts)
}

// --- Display formatting -----------------------------------------------------

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

/**
 * Two location names are "redundant" when they are equal or one contains the
 * other (e.g. "London" vs "London", or "City of London" vs "London"). Used to
 * avoid output like "London, London" or "Chelsea, London, London".
 */
function redundant(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * Compute the short, human-readable display location from structured data.
 *
 * Area (most specific): neighbourhood -> sublocality
 * City (broader):       postal town -> locality -> admin area
 *
 * Result formats:
 *   "Area, City"  (e.g. "Covent Garden, London")
 *   "Area"        (when no distinct city is known)
 *   "City"        (when no area is known)
 *   short/formatted address, then "" as the last resort.
 *
 * We deliberately never use `adminArea` (e.g. "Greater London") as the AREA, so
 * we never produce "Greater London, London".
 */
export function computeDisplayLocation(loc: GoogleLocation | undefined): string {
  if (!loc) return ""

  const area = loc.neighbourhood || loc.sublocality || ""
  const city = loc.postalTown || loc.locality || loc.adminArea || ""

  if (area && city && !redundant(area, city)) return `${area}, ${city}`
  if (area) return area
  if (city) return city

  // Structured data gave us nothing usable - fall back to a formatted address.
  return loc.shortFormattedAddress || loc.formattedAddress || ""
}

/**
 * The single source of truth for the short location label shown across cards,
 * AI picks, search, map popups and detail pages.
 *
 * Precedence:
 *   1. Structured Google location (googleDetails.location.displayLocation)
 *   2. Structured Google fields recomputed (in case displayLocation was absent)
 *   3. The base Business.location model (neighbourhood/city), deduplicated
 *   4. The stored formatted address
 *   5. "" (empty) - callers decide whether to show a city fallback
 */
export function getBusinessDisplayLocation(business: Business): string {
  const gl = business.googleDetails?.location
  if (gl) {
    const fromStructured = gl.displayLocation || computeDisplayLocation(gl)
    if (fromStructured) return fromStructured
  }

  // Fall back to the base model. Build the same "area, city" shape and dedupe.
  const { neighbourhood, city, address } = business.location
  if (neighbourhood && city && !redundant(neighbourhood, city)) {
    return `${neighbourhood}, ${city}`
  }
  return neighbourhood || city || address || ""
}

/**
 * The full address for detail pages, directions and maps. Prefers Google's
 * structured formatted address, then the base model address, then the short
 * display location.
 */
export function getBusinessFullAddress(business: Business): string {
  return (
    business.googleDetails?.location?.formattedAddress ||
    business.location.address ||
    business.googleDetails?.location?.shortFormattedAddress ||
    getBusinessDisplayLocation(business) ||
    ""
  )
}
