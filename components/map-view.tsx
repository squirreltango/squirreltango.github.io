"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, X, Navigation, Heart, ExternalLink, Instagram, ShieldCheck, Building2, TrendingUp, Bookmark, ChevronLeft, ChevronRight, Loader2, Maximize2, Search } from "lucide-react"
import type { Business } from "@/lib/types/business"
import {
  getHeadlineRating,
  getHeroImage,
  getBusinessImages,
  getLocationLabel,
} from "@/lib/business/normalise-business"
import { formatPriceLevel } from "@/lib/business/category-mapping"
import { cn } from "@/lib/utils"

// Type for Leaflet - imported dynamically
type LeafletType = typeof import("leaflet")

interface MapViewProps {
  businesses: Business[]
  /**
   * Business id to open the map on, supplied by "Get Directions" on the detail
   * page. When set, the map centres on that venue and opens its marker card.
   */
  focusBusinessId?: string | null
}

export function MapView({ businesses, focusBusinessId }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  // Keyed by business id so icon refreshes never depend on array ordering.
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  // Derived from the factory so it resolves through the module augmentation.
  const clusterRef = useRef<ReturnType<LeafletType["markerClusterGroup"]> | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const leafletRef = useRef<LeafletType | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [hoveredBusiness, setHoveredBusiness] = useState<Business | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set())
  const [showSavedPanel, setShowSavedPanel] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)
  // Shown once the user pans away from where the results were loaded. The
  // button is intentionally inert until the bounds-search API is approved.
  const [showSearchArea, setShowSearchArea] = useState(false)
  // Ensures the incoming "Get Directions" focus is applied once, so later
  // interactions (selecting another marker) are never overridden.
  const focusAppliedRef = useRef(false)

  // A new focus target should be honoured even without a remount.
  useEffect(() => {
    focusAppliedRef.current = false
  }, [focusBusinessId])

  // Toggle save
  const toggleSave = (businessId: string, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setSavedPlaces((prev) => {
      const next = new Set(prev)
      if (next.has(businessId)) {
        next.delete(businessId)
      } else {
        next.add(businessId)
      }
      return next
    })
  }

  /**
   * Marker hierarchy, tuned to keep central London legible:
   *   selected  - large dark "premium" pin, always on top
   *   top rated - white pin carrying its real Google rating (>= 4.5 only)
   *   saved     - small heart badge
   *   default   - compact neutral pin, no price symbols (they caused the
   *               heavy overlap in the old design)
   * Ratings shown here are genuine Google values; nothing is invented.
   */
  const createCustomIcon = useCallback(
    (L: LeafletType, business: Business, isSelected: boolean, isHovered: boolean, isSaved: boolean) => {
      const isActive = isSelected || isHovered
      const rating = business.providerRatings.google?.rating ?? getHeadlineRating(business)
      const isTopRated = typeof rating === "number" && rating >= 4.5

      const size = isSelected ? 42 : isActive ? 36 : 30
      const bg = isActive ? "#191919" : "#ffffff"
      const fg = isActive ? "#ffffff" : "#191919"
      const ring = isActive ? "#191919" : "rgba(25,25,25,0.14)"
      const shadow = isActive ? "0 10px 26px rgba(0,0,0,0.32)" : "0 3px 10px rgba(0,0,0,0.16)"

      // Top-rated pins carry the score; everything else stays a quiet dot.
      const label =
        isTopRated || isSelected
          ? `<span style="font-size:${isSelected ? 13 : 11}px;font-weight:700;letter-spacing:-0.2px;">${
              typeof rating === "number" ? rating.toFixed(1) : ""
            }</span>`
          : `<span style="width:7px;height:7px;border-radius:50%;background:${fg};display:block;"></span>`

      return L.divIcon({
        className: "lmu-marker",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${bg};color:${fg};
              border:2px solid ${ring};
              box-shadow:${shadow};
              display:flex;align-items:center;justify-content:center;
              font-family:system-ui,-apple-system,sans-serif;
              cursor:pointer;
            ">${label}</div>
            <div style="
              width:8px;height:8px;background:${bg};
              border-right:2px solid ${ring};border-bottom:2px solid ${ring};
              transform:rotate(45deg);margin-top:-5px;
            "></div>
            ${
              isSaved
                ? `<div style="
                     position:absolute;top:-3px;right:-3px;
                     width:14px;height:14px;border-radius:50%;
                     background:#ec4899;border:1.5px solid #fff;
                     display:flex;align-items:center;justify-content:center;
                   ">
                     <svg width="8" height="8" viewBox="0 0 24 24" fill="#fff"><path d="M12 21s-8-4.9-8-10a4.7 4.7 0 0 1 8-3.3A4.7 4.7 0 0 1 20 11c0 5.1-8 10-8 10z"/></svg>
                   </div>`
                : ""
            }
          </div>
        `,
        iconSize: [size, size + 8],
        iconAnchor: [size / 2, size + 8],
      })
    },
    [],
  )

  /** Cluster bubble: "18 places" at wide zoom, scaled by density. */
  const createClusterIcon = useCallback((L: LeafletType, count: number) => {
    const size = count >= 50 ? 62 : count >= 20 ? 54 : count >= 10 ? 48 : 42
    return L.divIcon({
      className: "lmu-cluster",
      html: `
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:#191919;color:#fff;
          border:2.5px solid rgba(255,255,255,0.9);
          box-shadow:0 8px 22px rgba(0,0,0,0.28);
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          font-family:system-ui,-apple-system,sans-serif;line-height:1;
        ">
          <span style="font-size:${count >= 100 ? 14 : 15}px;font-weight:700;">${count}</span>
          <span style="font-size:8px;opacity:0.7;margin-top:2px;letter-spacing:0.3px;">PLACES</span>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [])

  // Initialize map - dynamically import Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainer.current || mapInstance.current) return

    let isMounted = true

    const initMap = async () => {
      // Dynamically import Leaflet and CSS.
      const leafletModule = await import("leaflet")
      await import("leaflet/dist/leaflet.css")

      // Use the default export, not the ESM namespace: the markercluster
      // plugin attaches `markerClusterGroup` to that object, and namespace
      // re-exports are static so the addition would be invisible there.
      const L = ((leafletModule as unknown as { default?: LeafletType }).default ??
        leafletModule) as LeafletType

      // The plugin also expects a global L, so expose it before importing.
      ;(window as unknown as { L: LeafletType }).L = L
      await import("leaflet.markercluster")
      await import("leaflet.markercluster/dist/MarkerCluster.css")

      if (!isMounted || !mapContainer.current) return

      leafletRef.current = L

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      // Create map centered on London
      const map = L.map(mapContainer.current, {
        center: [51.505, -0.1276],
        zoom: 12,
        zoomControl: false,
      })

      // CARTO "Voyager" basemap: same free provider as before, but a warmer
      // off-white canvas with genuine park greens, teal water, stronger road
      // hierarchy and darker place labels. Keeps the premium editorial feel
      // without the washed-out look of light_all.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      }).addTo(map)

      // Dedicated pane so the user-location marker always sits above business
      // pins and cluster bubbles.
      map.createPane("userLocation")
      const userPane = map.getPane("userLocation")
      if (userPane) userPane.style.zIndex = "650"

      // Add zoom control to top right
      L.control.zoom({ position: "topright" }).addTo(map)

      mapInstance.current = map
      setMapReady(true)
    }

    initMap()

    return () => {
      isMounted = false
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        setMapReady(false)
      }
    }
  }, [])

  // Add markers when map is ready and businesses change
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !leafletRef.current) return

    const L = leafletRef.current
    const map = mapInstance.current

    // Rebuild the cluster group from scratch when the business set changes.
    if (clusterRef.current) {
      clusterRef.current.clearLayers()
      map.removeLayer(clusterRef.current)
      clusterRef.current = null
    }
    markersRef.current.clear()

    if (businesses.length === 0) return

    const cluster = L.markerClusterGroup({
      // Clusters break apart as the user zooms in; individual pins from 16.
      disableClusteringAtZoom: 16,
      maxClusterRadius: 58,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (c) => createClusterIcon(L, c.getChildCount()),
    })

    businesses.forEach((business) => {
      const coords = business.location.coordinates
      if (!coords) return
      const marker = L.marker([coords.lat, coords.lng], {
        icon: createCustomIcon(
          L,
          business,
          selectedBusiness?.id === business.id,
          hoveredBusiness?.id === business.id,
          savedPlaces.has(business.id),
        ),
      })

      marker.on("click", () => {
        setSelectedBusiness((prev) => (prev?.id === business.id ? null : business))
        setHoveredBusiness(null)
        setCurrentImageIndex(0)
      })

      marker.on("mouseover", () => {
        if (selectedBusiness?.id !== business.id) {
          setHoveredBusiness(business)
          setCurrentImageIndex(0)
        }
      })

      marker.on("mouseout", () => {
        setHoveredBusiness(null)
      })

      cluster.addLayer(marker)
      markersRef.current.set(business.id, marker)
    })

    cluster.addTo(map)
    clusterRef.current = cluster

    // Only auto-fit when we are not honouring an incoming focus request,
    // otherwise the fit would fight the deep-linked centre.
    if (!focusBusinessId && markersRef.current.size > 0) {
      map.fitBounds(cluster.getBounds(), { padding: [50, 50], maxZoom: 14 })
    }
    // Icon appearance is refreshed by the effect below, so selection/hover are
    // deliberately excluded here to avoid rebuilding every marker on hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, businesses, createCustomIcon, createClusterIcon, focusBusinessId])

  // Refresh only the icons affected by selection, hover or saved state.
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return
    const L = leafletRef.current

    businesses.forEach((business) => {
      const marker = markersRef.current.get(business.id)
      if (!marker) return
      marker.setIcon(
        createCustomIcon(
          L,
          business,
          selectedBusiness?.id === business.id,
          hoveredBusiness?.id === business.id,
          savedPlaces.has(business.id),
        ),
      )
    })
  }, [selectedBusiness?.id, hoveredBusiness?.id, savedPlaces, mapReady, businesses, createCustomIcon])

  // Apply an incoming "Get Directions" focus once the map and markers exist:
  // centre on the venue and open its preview card. Only runs when the focused
  // business actually has coordinates - nothing is invented.
  useEffect(() => {
    if (!mapReady || !focusBusinessId || focusAppliedRef.current) return
    const target = businesses.find((b) => b.id === focusBusinessId)
    const coords = target?.location.coordinates
    if (!target || !coords) return

    focusAppliedRef.current = true
    mapInstance.current?.setView([coords.lat, coords.lng], 16, { animate: true })
    setSelectedBusiness(target)
  }, [mapReady, focusBusinessId, businesses])

  /**
   * Request browser geolocation, centre on the user and drop a distinct
   * "You are here" marker. A denial is non-blocking: the rest of the map keeps
   * working and the UI offers a manual starting point instead.
   */
  const handleLocate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationDenied(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
        setUserLocation(coords)
        setLocationDenied(false)
        setLocating(false)
        mapInstance.current?.setView([coords.lat, coords.lng], 15, { animate: true })
      },
      () => {
        // Covers denial, unavailable position and timeout alike.
        setLocating(false)
        setLocationDenied(true)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // Render / move the "You are here" marker in its own pane.
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstance.current) return
    const L = leafletRef.current
    const map = mapInstance.current

    if (!userLocation) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }

    const icon = L.divIcon({
      className: "lmu-user-location",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px;">
          <span style="position:absolute;width:26px;height:26px;border-radius:50%;background:rgba(37,99,235,0.22);"></span>
          <span style="position:absolute;width:13px;height:13px;border-radius:50%;background:#2563eb;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
      userMarkerRef.current.setIcon(icon)
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon,
        pane: "userLocation",
        keyboard: false,
      })
        .addTo(map)
        .bindTooltip("You are here", { direction: "top", offset: [0, -12] })
    }
  }, [userLocation, mapReady])

  // Surface "Search this area" once the user pans away from the loaded results.
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const map = mapInstance.current
    const onMoveEnd = () => setShowSearchArea(true)
    map.on("dragend", onMoveEnd)
    return () => {
      map.off("dragend", onMoveEnd)
    }
  }, [mapReady])

  const handleRecenter = () => {
    const located = businesses.filter((b) => b.location.coordinates)
    if (mapInstance.current && leafletRef.current && located.length > 0) {
      const L = leafletRef.current
      const bounds = L.latLngBounds(
        located.map((b) => [b.location.coordinates!.lat, b.location.coordinates!.lng] as [number, number])
      )
      mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
      setShowSearchArea(false)
    }
  }

  const savedBusinesses = businesses.filter((b) => savedPlaces.has(b.id))

  // Preview card component for both hover and selected states
  const PreviewCard = ({ business, isHover = false }: { business: Business; isHover?: boolean }) => {
    const images = getBusinessImages(business)
    const isSaved = savedPlaces.has(business.id)

    return (
      <div 
        className={cn(
          "bg-card rounded-3xl shadow-2xl border border-border/40 overflow-hidden",
          "backdrop-blur-sm",
          isHover ? "w-80" : "w-full sm:w-96",
          "transition-all duration-300"
        )}
        style={{
          animation: isHover ? 'fadeIn 0.2s ease-out' : 'slideInUp 0.3s ease-out',
        }}
      >
        {/* Close button for selected card */}
        {!isHover && (
          <button
            onClick={() => setSelectedBusiness(null)}
            className={cn(
              "absolute top-4 right-4 z-20 p-2 rounded-full bg-card/90",
              "shadow-lg transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:rotate-90 active:scale-90"
            )}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Image Section */}
        <div className="relative h-44 overflow-hidden group" style={{ position: 'relative' }}>
          <Image
            src={images[currentImageIndex]}
            alt={business.name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent" />
          
          {/* Instagram Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/90 backdrop-blur-sm shadow-lg">
            <Instagram className="h-3.5 w-3.5 text-pink-500" />
            <span className="text-xs font-medium text-foreground">From Instagram</span>
          </div>

          {/* Image Navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                }}
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full",
                  "bg-card/90 backdrop-blur-sm shadow-lg",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  "hover:bg-card hover:scale-110"
                )}
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                }}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full",
                  "bg-card/90 backdrop-blur-sm shadow-lg",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  "hover:bg-card hover:scale-110"
                )}
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      idx === currentImageIndex ? "bg-white w-3" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            </>
          )}

          {/* Trending/Popular Badge */}
          {business.providerRatings.instagram?.trending && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-pink-500/90 backdrop-blur-sm shadow-lg">
              <TrendingUp className="h-3 w-3 text-white" />
              <span className="text-xs font-semibold text-white">Trending</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Name & Category */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-serif font-semibold text-lg text-foreground line-clamp-1 mb-1">
                {business.name}
              </h3>
              {/* Price moved off the markers to cut congestion - shown here instead. */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="capitalize">{business.category}</span>
                {formatPriceLevel(business.priceLevel) && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span className="font-medium text-foreground">
                      {formatPriceLevel(business.priceLevel)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={(e) => toggleSave(business.id, e)}
              className={cn(
                "p-2.5 rounded-full transition-all duration-300",
                isSaved 
                  ? "bg-pink-100 text-pink-500 hover:bg-pink-200" 
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
            </button>
          </div>

          {/* Ratings Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Google Rating */}
            {(() => {
              const googleRating = business.providerRatings.google?.rating ?? getHeadlineRating(business)
              const googleReviews = business.providerRatings.google?.reviews
              if (googleRating === undefined) return null
              return (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span className="text-sm font-semibold text-foreground">{googleRating}</span>
                    {googleReviews !== undefined && (
                      <span className="text-xs text-muted-foreground">({(googleReviews / 1000).toFixed(1)}k)</span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Instagram Followers */}
            {business.providerRatings.instagram?.followers !== undefined && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40">
                <Instagram className="h-4 w-4 text-pink-500 shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {(business.providerRatings.instagram.followers / 1000).toFixed(0)}K
                </span>
              </div>
            )}

            {/* Food Hygiene */}
            {business.providerRatings.foodHygiene !== undefined && (
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-xl",
                business.providerRatings.foodHygiene >= 4 ? "bg-emerald-50" : "bg-amber-50"
              )}>
                <ShieldCheck className={cn(
                  "h-4 w-4 shrink-0",
                  business.providerRatings.foodHygiene >= 4 ? "text-emerald-600" : "text-amber-600"
                )} />
                <span className={cn(
                  "text-sm font-semibold",
                  business.providerRatings.foodHygiene >= 4 ? "text-emerald-700" : "text-amber-700"
                )}>
                  {business.providerRatings.foodHygiene}/5
                </span>
              </div>
            )}

            {/* Booking.com */}
            {business.providerRatings.bookingCom !== undefined && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50">
                <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-blue-700">{business.providerRatings.bookingCom}/10</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
            <MapPin className="h-3.5 w-3.5" />
              <span className="text-sm">{getLocationLabel(business)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={`/business/${business.id}`}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 rounded-2xl",
                "bg-foreground text-background text-sm font-medium",
                "transition-all duration-300 hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <ExternalLink className="h-4 w-4" />
              View details
            </Link>
            {/* Hands off to the user's own maps app for turn-by-turn routing. */}
            {business.location.coordinates && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${business.location.coordinates.lat},${business.location.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Get directions to ${business.name} in Google Maps`}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-2xl",
                  "border border-border/60 bg-card text-sm font-medium text-foreground",
                  "transition-all duration-300 hover:bg-secondary/60 active:scale-[0.98]"
                )}
              >
                <Navigation className="h-4 w-4" />
                Directions
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[500px] md:h-[600px] rounded-3xl overflow-hidden border border-border/40 shadow-lg">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Loading State */}
      {!mapReady && (
        <div className="absolute inset-0 bg-secondary/50 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
        {/* Current location - requests browser geolocation */}
        <button
          onClick={handleLocate}
          disabled={locating}
          aria-label="Show my current location"
          className={cn(
            "w-11 h-11 rounded-2xl bg-card border border-border/60 shadow-lg",
            "flex items-center justify-center text-foreground",
            "transition-all duration-300",
            "hover:bg-secondary/80 hover:scale-110 hover:shadow-xl active:scale-95",
            "disabled:opacity-60 disabled:hover:scale-100",
            userLocation && "bg-foreground text-background hover:bg-foreground/90"
          )}
          title={userLocation ? "Centre on my location" : "Use my current location"}
        >
          {locating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Navigation className={cn("h-5 w-5", userLocation && "fill-current")} />
          )}
        </button>

        {/* Fit all businesses back into view */}
        <button
          onClick={handleRecenter}
          aria-label="Fit all places into view"
          className={cn(
            "w-11 h-11 rounded-2xl bg-card border border-border/60 shadow-lg",
            "flex items-center justify-center text-foreground",
            "transition-all duration-300",
            "hover:bg-secondary/80 hover:scale-110 hover:shadow-xl active:scale-95"
          )}
          title="Fit all places"
        >
          <Maximize2 className="h-[18px] w-[18px]" />
        </button>

        {/* Saved Places Button */}
        <button
          onClick={() => setShowSavedPanel(!showSavedPanel)}
          className={cn(
            "flex items-center gap-2 px-4 h-11 rounded-2xl bg-card border border-border/60 shadow-lg",
            "text-foreground transition-all duration-300",
            "hover:bg-secondary/80 hover:shadow-xl",
            showSavedPanel && "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          <Bookmark className={cn("h-4 w-4", savedPlaces.size > 0 && !showSavedPanel && "fill-current text-pink-500")} />
          <span className="text-sm font-medium">Saved</span>
          {savedPlaces.size > 0 && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold",
              showSavedPanel ? "bg-background text-foreground" : "bg-pink-500 text-white"
            )}>
              {savedPlaces.size}
            </span>
          )}
        </button>
      </div>

      {/* "Search this area" - UI only for now. Wiring this to a bounds-based
          Places request would add per-pan Google cost, so it stays inert until
          that spend is approved. Never fires automatically on map movement. */}
      {showSearchArea && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            type="button"
            disabled
            title="Coming soon - searching new areas needs Places API approval"
            className={cn(
              "flex items-center gap-2 px-4 h-10 rounded-2xl",
              "bg-card/95 backdrop-blur-md border border-border/60 shadow-lg",
              "text-sm font-medium text-muted-foreground cursor-not-allowed"
            )}
          >
            <Search className="h-4 w-4" />
            Search this area
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-secondary/80">
              Soon
            </span>
          </button>
        </div>
      )}

      {/* Geolocation denial is non-blocking - the map stays fully usable. */}
      {locationDenied && (
        <div
          role="status"
          className={cn(
            "absolute top-[4.75rem] left-4 z-[1000] max-w-xs",
            "flex items-start gap-2.5 px-4 py-3 rounded-2xl",
            "bg-card/95 backdrop-blur-md border border-border/60 shadow-lg"
          )}
        >
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-foreground">Location unavailable</p>
            <p className="text-muted-foreground">
              Enable location access in your browser, or pick a starting point manually when you
              request directions.
            </p>
          </div>
          <button
            onClick={() => setLocationDenied(false)}
            aria-label="Dismiss location message"
            className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Saved Places Panel */}
      {showSavedPanel && (
        <div 
          className={cn(
            "absolute top-20 left-4 z-[1000] w-80 max-h-[400px] overflow-hidden",
            "bg-card/95 backdrop-blur-md rounded-3xl shadow-2xl border border-border/40"
          )}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div className="p-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-semibold text-foreground">Saved Places</h3>
              <button
                onClick={() => setShowSavedPanel(false)}
                className="p-1.5 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {savedBusinesses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                  <Heart className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No saved places yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Click the heart icon on a place to save it</p>
              </div>
            ) : (
              <div className="p-2">
                {savedBusinesses.map((business) => (
                  <button
                    key={business.id}
                    onClick={() => {
                      setSelectedBusiness(business)
                      setShowSavedPanel(false)
                      if (mapInstance.current && business.location.coordinates) {
                        mapInstance.current.setView([business.location.coordinates.lat, business.location.coordinates.lng], 15)
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl",
                      "hover:bg-secondary/60 transition-colors text-left"
                    )}
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ position: 'relative' }}>
                      <Image
                        src={getHeroImage(business) || "/placeholder.svg"}
                        alt={business.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">{business.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{getLocationLabel(business)}</p>
                      {getHeadlineRating(business) !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          <span className="text-xs font-medium text-foreground">{getHeadlineRating(business)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] px-4 py-2 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/40 shadow-lg">
        <span className="text-xs font-medium text-muted-foreground">
          {businesses.length} {businesses.length === 1 ? 'place' : 'places'} found
        </span>
      </div>

      {/* Hover Preview Card */}
      {hoveredBusiness && !selectedBusiness && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <PreviewCard business={hoveredBusiness} isHover />
        </div>
      )}

      {/* Selected Business Card */}
      {selectedBusiness && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <PreviewCard business={selectedBusiness} />
        </div>
      )}

      {/* Custom styles for Leaflet */}
      <style jsx global>{`
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          border-radius: 16px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          width: 44px !important;
          height: 44px !important;
          line-height: 44px !important;
          color: #1a1a1a !important;
          font-size: 18px !important;
          border: none !important;
          background: white !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f5f5f5 !important;
        }
        .leaflet-control-zoom-in {
          border-radius: 16px 16px 0 0 !important;
        }
        .leaflet-control-zoom-out {
          border-radius: 0 0 16px 16px !important;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.3;
            transform: translateX(-50%) scale(1.2);
          }
        }
      `}</style>
    </div>
  )
}
