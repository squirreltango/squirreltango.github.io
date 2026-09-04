"use client"

import { useEffect, useRef, useState } from "react"
import { Footprints, Bike, Car, TrainFront, Loader2 } from "lucide-react"
import {
  fetchRoute,
  formatDuration,
  TRAVEL_MODES,
  type TravelMode,
  type RouteResponse,
} from "@/lib/itineraries/routing"
import { straightLineLabel, type LatLng } from "@/lib/itineraries/transport"
import { cn } from "@/lib/utils"

const MODE_ICON: Record<TravelMode, typeof Footprints> = {
  walk: Footprints,
  cycle: Bike,
  drive: Car,
  transit: TrainFront,
}

interface PlanLegProps {
  /** Coordinates of the earlier stop, or null if it has no location. */
  from: LatLng | null
  /** Coordinates of the later stop, or null if it has no location. */
  to: LatLng | null
  /** Currently selected travel mode for this leg. */
  mode: TravelMode
  onModeChange: (mode: TravelMode) => void
  /**
   * Reports the genuine route polyline (or null when unavailable) so the parent
   * can draw it on the map. Called whenever the fetched route changes.
   */
  onRoute: (points: [number, number][] | null) => void
}

/**
 * The travel connector shown between two itinerary stops.
 *
 * When both stops are located it lets the traveller choose a mode and fetches a
 * genuine Google Routes journey (distance + duration + map polyline) for that
 * mode. Every number shown comes from the provider. If routing is unavailable
 * it falls back to an explicitly-labelled straight-line distance and never
 * invents a duration.
 */
export function PlanLeg({ from, to, mode, onModeChange, onRoute }: PlanLegProps) {
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  // Keep the latest onRoute without retriggering the fetch effect.
  const onRouteRef = useRef(onRoute)
  useEffect(() => {
    onRouteRef.current = onRoute
  }, [onRoute])

  const hasBoth = Boolean(from && to)

  useEffect(() => {
    if (!from || !to) {
      setRoute(null)
      onRouteRef.current(null)
      return
    }
    let active = true
    setLoading(true)
    fetchRoute(from, to, mode)
      .then((res) => {
        if (!active) return
        setRoute(res)
        onRouteRef.current(res.available ? res.points : null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [from?.lat, from?.lng, to?.lat, to?.lng, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // No location on one side: honest prompt, no fabricated travel.
  if (!hasBoth) {
    return (
      <div className="flex items-center gap-2 py-2 pl-10 text-xs text-muted-foreground">
        <span className="h-px w-6 bg-border" aria-hidden="true" />
        Add a location to both stops to see travel between them
      </div>
    )
  }

  const straight = straightLineLabel(from, to)

  return (
    <div className="flex flex-col gap-2 py-2 pl-10">
      <div className="flex flex-wrap items-center gap-1.5">
        {TRAVEL_MODES.map((m) => {
          const Icon = MODE_ICON[m.id]
          const active = m.id === mode
          return (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              aria-pressed={active}
              title={m.label}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{m.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {loading ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Finding route…
          </span>
        ) : route?.available ? (
          <span className="text-foreground">
            <span className="font-medium">{formatDuration(route.durationSeconds)}</span>
            <span className="text-muted-foreground">
              {" · "}
              {route.distanceMeters < 1000
                ? `${Math.round(route.distanceMeters / 10) * 10} m`
                : `${(route.distanceMeters / 1000).toFixed(1)} km`}
              {route.transitSummary ? ` · ${route.transitSummary}` : ""}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {straight ? `${straight} · route unavailable for this mode` : "Travel estimate unavailable"}
          </span>
        )}
      </div>
    </div>
  )
}
