/**
 * Straight-line (great-circle) distance between two plan stops.
 *
 * This is ONLY a geometric distance. It is never presented as a travel time,
 * because a Haversine distance cannot know roads, transit or walking routes.
 * Real journey distances and durations come from the routing provider (see
 * `lib/itineraries/routing.ts` and `/api/route`); this module exists so the UI
 * can still show an HONEST, clearly-labelled straight-line distance when no
 * route is available.
 */

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_000

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

/** Human-readable distance, e.g. "450 m" or "2.3 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/**
 * An explicitly-labelled straight-line distance between two located stops, or
 * null when either coordinate is missing. Deliberately contains NO time
 * estimate - it must never be mistaken for a real travel duration.
 */
export function straightLineLabel(from: LatLng | null, to: LatLng | null): string | null {
  if (!from || !to) return null
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return null
  }
  const meters = haversineMeters(from, to)
  if (meters < 30) return "Next door"
  return `Straight-line distance · ${formatDistance(meters)}`
}
