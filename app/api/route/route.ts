import { NextResponse } from "next/server"

/**
 * Genuine point-to-point routing via the Google Routes API.
 *
 * This calls `routes.googleapis.com/directions/v2:computeRoutes` SERVER-SIDE
 * with the existing `GOOGLE_PLACES_API_KEY`, so the key is never exposed to the
 * browser. It returns the real distance, duration and encoded route polyline
 * for the requested travel mode.
 *
 * IMPORTANT: the Routes API is a SEPARATE Google product from Places. If it is
 * not enabled on the Google Cloud project behind this key, Google responds with
 * a permission error and we return `{ available: false }` rather than
 * fabricating a journey. The client then shows an honest straight-line distance
 * and "Route unavailable". No new paid API is silently switched on here.
 */

type ClientMode = "walk" | "cycle" | "drive" | "transit"

const MODE_TO_GOOGLE: Record<ClientMode, string> = {
  walk: "WALK",
  cycle: "BICYCLE",
  drive: "DRIVE",
  transit: "TRANSIT",
}

interface LatLng {
  lat: number
  lng: number
}

// Small in-memory cache to avoid repeat paid calls for the same leg within a
// warm server process. Complements the client-side sessionStorage cache.
interface CacheEntry {
  at: number
  value: unknown
}
const CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

function isLatLng(v: unknown): v is LatLng {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as LatLng).lat === "number" &&
    typeof (v as LatLng).lng === "number" &&
    Number.isFinite((v as LatLng).lat) &&
    Number.isFinite((v as LatLng).lng)
  )
}

function round(n: number): string {
  return n.toFixed(5)
}

export async function POST(request: Request) {
  let body: { origin?: unknown; destination?: unknown; mode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ available: false, reason: "Invalid request body" }, { status: 400 })
  }

  const { origin, destination } = body
  const mode: ClientMode =
    body.mode === "cycle" || body.mode === "drive" || body.mode === "transit" ? body.mode : "walk"

  if (!isLatLng(origin) || !isLatLng(destination)) {
    return NextResponse.json(
      { available: false, reason: "origin and destination coordinates are required" },
      { status: 400 },
    )
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "Routing is not configured" })
  }

  const cacheKey = `${mode}:${round(origin.lat)},${round(origin.lng)}>${round(destination.lat)},${round(destination.lng)}`
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.value)
  }

  const requestBody: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: MODE_TO_GOOGLE[mode],
    polylineQuality: "OVERVIEW",
  }
  // Routing preference is only valid for DRIVE / TWO_WHEELER.
  if (mode === "drive") requestBody.routingPreference = "TRAFFIC_AWARE"

  // Request only the fields we use. Transit line details are included so the UI
  // can honestly show Tube/bus when Google genuinely returns them.
  const fieldMask = [
    "routes.duration",
    "routes.distanceMeters",
    "routes.polyline.encodedPolyline",
    "routes.legs.steps.transitDetails.transitLine.vehicle.type",
    "routes.legs.steps.transitDetails.transitLine.nameShort",
    "routes.legs.steps.transitDetails.transitLine.name",
  ].join(",")

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const text = await res.text()
      console.log("[v0] Routes API error", res.status, text.slice(0, 300))
      // 403 = Routes API not enabled / not authorised for this key.
      const reason =
        res.status === 403
          ? "Routes API is not enabled for this Google project"
          : "Route unavailable"
      const value = { available: false, reason }
      return NextResponse.json(value)
    }

    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route || !route.polyline?.encodedPolyline) {
      const value = { available: false, reason: "No route found" }
      return NextResponse.json(value)
    }

    // Google returns duration as a string like "1234s".
    const durationSeconds = Number.parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0

    // Summarise distinct transit vehicle types, when present.
    let transitSummary: string | undefined
    if (mode === "transit") {
      const vehicles = new Set<string>()
      for (const leg of route.legs ?? []) {
        for (const step of leg.steps ?? []) {
          const type = step?.transitDetails?.transitLine?.vehicle?.type
          if (type) vehicles.add(prettifyVehicle(String(type)))
        }
      }
      if (vehicles.size > 0) transitSummary = [...vehicles].join(" · ")
    }

    const value = {
      available: true as const,
      mode,
      distanceMeters: typeof route.distanceMeters === "number" ? route.distanceMeters : 0,
      durationSeconds,
      polyline: route.polyline.encodedPolyline as string,
      ...(transitSummary ? { transitSummary } : {}),
    }

    CACHE.set(cacheKey, { at: Date.now(), value })
    return NextResponse.json(value)
  } catch (err) {
    console.log("[v0] Routes API request failed", (err as Error).message)
    return NextResponse.json({ available: false, reason: "Route unavailable" })
  }
}

function prettifyVehicle(type: string): string {
  const map: Record<string, string> = {
    SUBWAY: "Tube",
    METRO_RAIL: "Tube",
    HEAVY_RAIL: "Train",
    RAIL: "Train",
    COMMUTER_TRAIN: "Train",
    HIGH_SPEED_TRAIN: "Train",
    LONG_DISTANCE_TRAIN: "Train",
    BUS: "Bus",
    INTERCITY_BUS: "Bus",
    TROLLEYBUS: "Bus",
    TRAM: "Tram",
    LIGHT_RAIL: "Tram",
    FERRY: "Ferry",
    CABLE_CAR: "Cable car",
    GONDOLA_LIFT: "Cable car",
  }
  return map[type] ?? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ")
}
