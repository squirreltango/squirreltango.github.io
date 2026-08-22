import type { GoogleAmenities, GoogleDetails } from "@/lib/types/business"
import {
  parseNewAddressComponents,
  pickBestArea,
  type NewAddressComponent,
  type AddressDescriptor,
} from "@/lib/business/location"

/**
 * Google Place Details (New) enrichment client.
 *
 * COST CONTROL: this must only be called from server-side enrichment jobs, and
 * never on a homepage render. The homepage reads the Supabase cache instead.
 *
 * We send a STRICT FieldMask requesting only the Atmosphere fields LookMeUp
 * actually displays. Billing is determined by the single highest-tier SKU
 * among requested fields, so we deliberately keep the mask tight and never add
 * fields "just in case".
 *
 * All requested fields below are Google "Atmosphere" fields, which bill at the
 * Place Details Enterprise + Atmosphere SKU. See enrichment route docs.
 */

// The exact FieldMask sent to Google. Order/duplication is irrelevant to
// billing; only the set of fields matters. Keep this list minimal.
//
// The location fields (addressComponents/formattedAddress/shortFormattedAddress/
// location) belong to the cheapest "Place Details Essentials" tier. Billing for
// a single request is the highest tier among ALL requested fields, and this
// request already includes Atmosphere fields (the top tier), so adding these
// structured-location fields costs NOTHING extra.
const FIELD_MASK = [
  // Location (Essentials tier - no incremental cost given Atmosphere below).
  // addressDescriptor.areas supplies genuine neighbourhood names (e.g. "Soho")
  // that UK addressComponents routinely omit.
  "addressComponents",
  "addressDescriptor",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  // Editorial + Atmosphere (Enterprise + Atmosphere tier).
  "editorialSummary",
  "outdoorSeating",
  "reservable",
  "servesCocktails",
  "servesCoffee",
  "servesBreakfast",
  "servesBrunch",
  "servesLunch",
  "servesDinner",
  "takeout",
  "delivery",
  "accessibilityOptions",
  "parkingOptions",
].join(",")

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places/"

// Shape of the (partial) Place Details (New) response we care about. Every
// field is optional - Google omits anything it has no data for.
interface PlaceDetailsResponse {
  addressComponents?: NewAddressComponent[]
  addressDescriptor?: AddressDescriptor
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  editorialSummary?: { text?: string; languageCode?: string }
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
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean }
  parkingOptions?: {
    freeParkingLot?: boolean
    paidParkingLot?: boolean
    freeStreetParking?: boolean
    paidStreetParking?: boolean
    freeGarageParking?: boolean
    paidGarageParking?: boolean
  }
}

export interface PlaceDetailsResult {
  ok: boolean
  status: number
  googleDetails?: GoogleDetails
  hasAmenities: boolean
  hasEditorialSummary: boolean
  // True when Google returned structured components that produced a display
  // location more specific than a bare city fallback.
  hasStructuredLocation: boolean
  displayLocation?: string
  error?: string
}

// Copy a boolean through only when Google returned an explicit boolean. This
// preserves the tri-state semantics (true / false / unknown) so we never
// invent a value or coerce "unknown" into "false".
function passBool(value: boolean | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function toAmenities(data: PlaceDetailsResponse): GoogleAmenities {
  const parking = data.parkingOptions
  const freeParking = parking
    ? parking.freeParkingLot === true || parking.freeStreetParking === true || parking.freeGarageParking === true
    : undefined
  const paidParking = parking
    ? parking.paidParkingLot === true || parking.paidStreetParking === true || parking.paidGarageParking === true
    : undefined

  return {
    outdoorSeating: passBool(data.outdoorSeating),
    reservable: passBool(data.reservable),
    servesCocktails: passBool(data.servesCocktails),
    servesCoffee: passBool(data.servesCoffee),
    servesBreakfast: passBool(data.servesBreakfast),
    servesBrunch: passBool(data.servesBrunch),
    servesLunch: passBool(data.servesLunch),
    servesDinner: passBool(data.servesDinner),
    takeout: passBool(data.takeout),
    delivery: passBool(data.delivery),
    wheelchairAccessible: passBool(data.accessibilityOptions?.wheelchairAccessibleEntrance),
    freeParking,
    paidParking,
  }
}

// Drop keys whose value is undefined so the cached JSON stays compact and only
// ever contains real Google answers.
function pruneAmenities(amenities: GoogleAmenities): GoogleAmenities {
  const cleaned: GoogleAmenities = {}
  for (const [key, value] of Object.entries(amenities)) {
    if (typeof value === "boolean") {
      cleaned[key as keyof GoogleAmenities] = value
    }
  }
  return cleaned
}

/**
 * Fetch Place Details (New) for a single Google Place ID and map it into our
 * GoogleDetails shape. Never throws - failures are returned as a result with
 * `ok: false` so batch callers can tally errors and continue.
 */
export async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetailsResult> {
  try {
    const response = await fetch(`${PLACES_ENDPOINT}${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      // Enrichment is a background job; do not let Next cache the upstream call.
      cache: "no-store",
    })

    if (!response.ok) {
      let message = `HTTP ${response.status}`
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        if (body.error?.message) message = body.error.message
      } catch {
        // ignore body parse failure; keep the HTTP status message
      }
      return {
        ok: false,
        status: response.status,
        hasAmenities: false,
        hasEditorialSummary: false,
        hasStructuredLocation: false,
        error: message,
      }
    }

    const data = (await response.json()) as PlaceDetailsResponse

    const amenities = pruneAmenities(toAmenities(data))
    const hasAmenities = Object.keys(amenities).length > 0
    const editorialSummary = data.editorialSummary?.text?.trim() || undefined
    const hasEditorialSummary = Boolean(editorialSummary)

    // Structured location from Google's addressComponents. Coordinates come from
    // the `location` field (New API uses latitude/longitude).
    const coordinates =
      typeof data.location?.latitude === "number" && typeof data.location?.longitude === "number"
        ? { lat: data.location.latitude, lng: data.location.longitude }
        : undefined
    // Address Descriptors provide the genuine neighbourhood name when the
    // structured components omit it (common for UK city-centre addresses).
    const area = pickBestArea(data.addressDescriptor)
    const location = parseNewAddressComponents(data.addressComponents, {
      formattedAddress: data.formattedAddress,
      shortFormattedAddress: data.shortFormattedAddress,
      coordinates,
      area,
    })
    // "Structured" means we resolved something more specific than just a city -
    // i.e. an actual neighbourhood/sublocality is present.
    const hasStructuredLocation = Boolean(location.neighbourhood || location.sublocality)
    const hasAnyLocation = Object.keys(location).some(
      (k) => k !== "displayLocation" && (location as Record<string, unknown>)[k],
    )

    const googleDetails: GoogleDetails = {
      detailsLastSyncedAt: new Date().toISOString(),
    }
    if (hasAmenities) googleDetails.amenities = amenities
    if (editorialSummary) googleDetails.editorialSummary = editorialSummary
    if (hasAnyLocation) googleDetails.location = location

    return {
      ok: true,
      status: response.status,
      googleDetails,
      hasAmenities,
      hasEditorialSummary,
      hasStructuredLocation,
      displayLocation: location.displayLocation || undefined,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      hasAmenities: false,
      hasEditorialSummary: false,
      hasStructuredLocation: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** The FieldMask this client sends, exposed for reporting/telemetry. */
export function getFieldMask(): string {
  return FIELD_MASK
}
