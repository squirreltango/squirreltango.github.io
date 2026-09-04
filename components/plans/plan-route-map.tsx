"use client"

import { useEffect, useRef, useState } from "react"

type LeafletType = typeof import("leaflet")

export interface RouteStop {
  id: string
  label: string
  lat: number
  lng: number
  /** 1-based position shown in the marker. */
  order: number
}

interface PlanRouteMapProps {
  stops: RouteStop[]
  /**
   * Genuine route polylines between consecutive located stops, in visiting
   * order (index i is the leg from stop i to stop i+1). A `null` entry means no
   * real route was available for that leg, so it falls back to a dashed
   * straight line. Optional; omitting it draws only dashed straight lines.
   */
  routePaths?: (([number, number][]) | null)[]
}

/**
 * Read-only route map for a plan. Draws a numbered pin per located stop and,
 * between consecutive stops, either a solid genuine route polyline (from the
 * Google Routes API) or, when no route is available, a dashed straight line -
 * so the map never implies a real route it does not have. Uses the same free
 * CARTO Voyager basemap as the main discovery map. Leaflet is imported
 * dynamically so it never runs on the server or bloats the initial bundle.
 *
 * Only stops that actually have coordinates are passed in; this component never
 * fabricates a location for a stop it cannot place.
 */
export function PlanRouteMap({ stops, routePaths }: PlanRouteMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const leafletRef = useRef<LeafletType | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [ready, setReady] = useState(false)

  // Initialise the map once.
  useEffect(() => {
    if (typeof window === "undefined" || !container.current || mapInstance.current) return
    let mounted = true

    const init = async () => {
      const mod = await import("leaflet")
      await import("leaflet/dist/leaflet.css")
      const L = ((mod as unknown as { default?: LeafletType }).default ?? mod) as LeafletType
      if (!mounted || !container.current) return

      leafletRef.current = L
      const map = L.map(container.current, {
        center: [51.505, -0.1276],
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: false,
      })
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      }).addTo(map)
      L.control.zoom({ position: "topright" }).addTo(map)

      mapInstance.current = map
      setReady(true)
    }

    void init()
    return () => {
      mounted = false
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        setReady(false)
      }
    }
  }, [])

  // Draw / redraw markers and the connecting route whenever stops change.
  useEffect(() => {
    if (!ready || !mapInstance.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstance.current

    if (layerRef.current) {
      layerRef.current.clearLayers()
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (stops.length === 0) return

    const group = L.layerGroup()
    const latlngs: [number, number][] = []

    stops.forEach((stop) => {
      const point: [number, number] = [stop.lat, stop.lng]
      latlngs.push(point)

      const icon = L.divIcon({
        className: "lmu-plan-marker",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="
              width:32px;height:32px;border-radius:50%;
              background:#191919;color:#fff;
              border:2.5px solid #fff;
              box-shadow:0 4px 12px rgba(0,0,0,0.28);
              display:flex;align-items:center;justify-content:center;
              font-family:system-ui,-apple-system,sans-serif;
              font-size:13px;font-weight:700;
            ">${stop.order}</div>
            <div style="
              width:8px;height:8px;background:#191919;
              border-right:2.5px solid #fff;border-bottom:2.5px solid #fff;
              transform:rotate(45deg);margin-top:-5px;
            "></div>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      })

      L.marker(point, { icon })
        .bindTooltip(`${stop.order}. ${stop.label}`, { direction: "top", offset: [0, -34] })
        .addTo(group)
    })

    // Connect consecutive stops. For each leg, draw the genuine route polyline
    // when we have one; otherwise a dashed straight line, so the map is honest
    // about which connections are real routes.
    const boundsPoints: [number, number][] = [...latlngs]
    for (let i = 0; i < latlngs.length - 1; i++) {
      const realPath = routePaths?.[i]
      if (realPath && realPath.length >= 2) {
        L.polyline(realPath, {
          color: "#191919",
          weight: 3.5,
          opacity: 0.8,
        }).addTo(group)
        boundsPoints.push(...realPath)
      } else {
        L.polyline([latlngs[i], latlngs[i + 1]], {
          color: "#191919",
          weight: 2.5,
          opacity: 0.5,
          dashArray: "6 8",
        }).addTo(group)
      }
    }

    group.addTo(map)
    layerRef.current = group

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 15)
    } else {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [48, 48], maxZoom: 15 })
    }
  }, [ready, stops, routePaths])

  return (
    <div
      ref={container}
      className="h-80 w-full overflow-hidden rounded-3xl border border-border/60"
      role="application"
      aria-label="Map showing the route between your plan stops"
    />
  )
}
