/**
 * Straight-line travel estimates between two stops on a plan.
 *
 * These are deliberately labelled as estimates: we compute the great-circle
 * (Haversine) distance between two coordinates and derive an approximate time
 * from typical speeds. There is no routing API behind this, so the numbers are
 * a lower bound on real travel and are always presented as "about" / "approx".
 * We never claim a precise door-to-door duration we cannot know.
 */

export type TravelMode = "walk" | "transit"

export interface TravelLeg {
  /** Great-circle distance in metres. */
  distanceMeters: number
  /** Suggested mode based purely on distance. */
  mode: TravelMode
  /** Estimated minutes for the suggested mode, rounded to a sensible value. */
  minutes: number
  /** Human label, e.g. "8 min walk" or "about 15 min by transit". */
  label: string
}

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_000
// Comfortable urban walking pace, ~4.8 km/h => 80 m/min.
const WALK_METERS_PER_MIN = 80
// Rough door-to-door transit pace incl. waiting/walking to stops, ~18 km/h.
const TRANSIT_METERS_PER_MIN = 300
// Above this straight-line distance, walking stops being the natural choice.
const WALK_THRESHOLD_METERS = 1500

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/**
 * Estimate a travel leg between two located stops. Returns null when either
 * coordinate is missing, so callers can simply omit the leg rather than
 * fabricate a distance.
 */
export function estimateLeg(from: LatLng | null, to: LatLng | null): TravelLeg | null {
  if (!from || !to) return null
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return null
  }

  const distanceMeters = haversineMeters(from, to)

  // Same spot (or effectively so): no meaningful leg.
  if (distanceMeters < 30) {
    return {
      distanceMeters,
      mode: "walk",
      minutes: 0,
      label: "Next door",
    }
  }

  const mode: TravelMode = distanceMeters <= WALK_THRESHOLD_METERS ? "walk" : "transit"
  const perMin = mode === "walk" ? WALK_METERS_PER_MIN : TRANSIT_METERS_PER_MIN
  const minutes = Math.max(1, Math.round(distanceMeters / perMin))

  const label =
    mode === "walk"
      ? `about ${minutes} min walk · ${formatDistance(distanceMeters)}`
      : `about ${minutes} min by transit · ${formatDistance(distanceMeters)} as the crow flies`

  return { distanceMeters, mode, minutes, label }
}
