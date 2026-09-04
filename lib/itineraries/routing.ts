import type { LatLng } from "@/lib/itineraries/transport"

/**
 * Client helper for genuine point-to-point routing.
 *
 * All routing goes through our own `/api/route` endpoint, which calls the
 * Google Routes API server-side so the API key is never exposed to the browser.
 * Results are cached in `sessionStorage` keyed by origin+destination+mode, so
 * re-opening the same plan (or toggling a mode back and forth) does not trigger
 * repeated paid API calls within a session.
 *
 * Nothing here fabricates a route: when the provider cannot return one (for
 * example the Routes API is not yet enabled on the Google project) the endpoint
 * responds with `{ available: false }` and the UI falls back to an honest
 * straight-line distance instead of inventing a journey.
 */

export type TravelMode = "walk" | "cycle" | "drive" | "transit"

export interface TravelModeMeta {
  id: TravelMode
  /** Short label used on the selector, e.g. "Walk". */
  label: string
}

export const TRAVEL_MODES: TravelModeMeta[] = [
  { id: "walk", label: "Walk" },
  { id: "cycle", label: "Cycle" },
  { id: "drive", label: "Drive" },
  { id: "transit", label: "Public transport" },
]

export const DEFAULT_TRAVEL_MODE: TravelMode = "walk"

export function isTravelMode(value: unknown): value is TravelMode {
  return value === "walk" || value === "cycle" || value === "drive" || value === "transit"
}

export interface RouteResult {
  available: true
  mode: TravelMode
  distanceMeters: number
  durationSeconds: number
  /** Decoded polyline points [lat, lng][] for drawing on the map. */
  points: [number, number][]
  /** Present for transit routes when the provider returned line details. */
  transitSummary?: string
}

export interface RouteUnavailable {
  available: false
  reason: string
}

export type RouteResponse = RouteResult | RouteUnavailable

/** Format a routing duration (seconds) as a compact human string. */
export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`
}

/** Decode a Google encoded polyline into [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

function cacheKey(from: LatLng, to: LatLng, mode: TravelMode): string {
  const r = (n: number) => n.toFixed(5)
  return `lmu:route:${mode}:${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`
}

function readCache(key: string): RouteResponse | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as RouteResponse) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: RouteResponse): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sessionStorage can be unavailable/full; caching is best-effort.
  }
}

/**
 * Fetch a genuine route between two coordinates for a mode. Returns a cached
 * result when available. Never throws: on any failure it resolves to an
 * `available: false` response so callers degrade gracefully.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
): Promise<RouteResponse> {
  const key = cacheKey(from, to, mode)
  const cached = readCache(key)
  if (cached) return cached

  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: from, destination: to, mode }),
    })
    const data = (await res.json()) as
      | { available: true; mode: TravelMode; distanceMeters: number; durationSeconds: number; polyline: string; transitSummary?: string }
      | { available: false; reason?: string }

    let result: RouteResponse
    if (data.available) {
      result = {
        available: true,
        mode: data.mode,
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
        points: data.polyline ? decodePolyline(data.polyline) : [],
        transitSummary: data.transitSummary,
      }
    } else {
      result = { available: false, reason: data.reason ?? "Route unavailable" }
    }
    writeCache(key, result)
    return result
  } catch (err) {
    return { available: false, reason: (err as Error).message || "Route unavailable" }
  }
}
