"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  Heart,
  Plus,
  Share2,
  Trash2,
  Check,
  Map as MapIcon,
  List,
  Footprints,
  Bus,
  MapPin,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useSavedPlaces } from "@/components/saved-places-provider"
import {
  addItem,
  backfillItemCoordinates,
  deleteItem,
  getItinerary,
  listItems,
  persistOrder,
  updateItem,
  updateItinerary,
  type Itinerary,
  type ItineraryItem,
} from "@/lib/itineraries/client"
  import type { LatLng } from "@/lib/itineraries/transport"
  import { DEFAULT_TRAVEL_MODE, isTravelMode, type TravelMode } from "@/lib/itineraries/routing"
  import { PlanRouteMap, type RouteStop } from "@/components/plans/plan-route-map"
  import { PlanLeg } from "@/components/plans/plan-leg"
import { PlaceSearch } from "@/components/plans/place-search"
import type { Business } from "@/lib/types/business"
import type { SavedSnapshot } from "@/components/saved-places-provider"
import { cn } from "@/lib/utils"

/** Build an itinerary snapshot from a searched Business, keeping coordinates. */
function snapshotFromBusiness(business: Business): SavedSnapshot {
  return {
    name: business.name,
    category: business.category,
    address: business.location?.address,
    neighbourhood: business.location?.neighbourhood,
    image: business.media?.hero ?? business.media?.images?.[0],
    rating: business.rating?.overall,
    reviewCount: business.rating?.reviewCount,
    priceLevel: business.priceLevel,
    lat: business.location?.coordinates?.lat,
    lng: business.location?.coordinates?.lng,
  }
}

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
]

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const planId = params.id
  const { user, loading: authLoading } = useAuth()
  const { saved } = useSavedPlaces()

  const [plan, setPlan] = useState<Itinerary | null>(null)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [customOpen, setCustomOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState("")
  const [copied, setCopied] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [view, setView] = useState<"timeline" | "map">("timeline")

  const load = useCallback(async () => {
    setLoading(true)
    const [p, i] = await Promise.all([getItinerary(planId), listItems(planId)])
    setPlan(p)
    setItems(i)
    setLoading(false)
    // Fill in coordinates for older stops that predate coordinate capture, so
    // the map and travel estimates can include them. Runs after first paint.
    const filled = await backfillItemCoordinates(i)
    if (filled !== i) setItems(filled)
  }, [planId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, authLoading, load])

  // Refs already on the plan, used to dedupe both the saved-place chips and
  // the live search results.
  const existingRefs = useMemo(
    () => new Set(items.map((i) => i.businessRef).filter(Boolean) as string[]),
    [items],
  )

  // Saved places not already on the plan are the candidates worth offering.
  const candidates = useMemo(
    () => saved.filter((s) => !existingRefs.has(s.businessRef)),
    [saved, existingRefs],
  )

  // Stops that have real coordinates, in visiting order, for the map.
  const routeStops = useMemo<RouteStop[]>(() => {
    const located: RouteStop[] = []
    items.forEach((item, index) => {
      const lat = item.snapshot?.lat
      const lng = item.snapshot?.lng
      if (typeof lat === "number" && typeof lng === "number") {
        located.push({
          id: item.id,
          label: item.snapshot?.name ?? item.customTitle ?? "Stop",
          lat,
          lng,
          order: index + 1,
        })
      }
    })
    return located
  }, [items])

  // Estimated travel leg from each stop to the next, keyed by the earlier
  // stop's id. Null when either endpoint lacks coordinates.
  const legs = useMemo<Record<string, TravelLeg | null>>(() => {
    const out: Record<string, TravelLeg | null> = {}
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i]
      const b = items[i + 1]
      const from =
        typeof a.snapshot?.lat === "number" && typeof a.snapshot?.lng === "number"
          ? { lat: a.snapshot.lat, lng: a.snapshot.lng }
          : null
      const to =
        typeof b.snapshot?.lat === "number" && typeof b.snapshot?.lng === "number"
          ? { lat: b.snapshot.lat, lng: b.snapshot.lng }
          : null
      out[a.id] = estimateLeg(from, to)
    }
    return out
  }, [items])

  async function handleAddSaved(ref: string) {
    const source = saved.find((s) => s.businessRef === ref)
    if (!source) return
    const created = await addItem({
      itineraryId: planId,
      businessRef: ref,
      snapshot: source.snapshot,
      position: items.length,
    })
    if (created) {
      setItems((prev) => [...prev, created])
    }
  }

  async function handleAddPlace(business: Business) {
    const created = await addItem({
      itineraryId: planId,
      businessRef: business.id,
      snapshot: snapshotFromBusiness(business),
      position: items.length,
    })
    if (created) {
      setItems((prev) => [...prev, created])
    }
  }

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault()
    const label = customTitle.trim()
    if (!label) return
    const created = await addItem({
      itineraryId: planId,
      customTitle: label,
      position: items.length,
    })
    if (created) {
      setItems((prev) => [...prev, created])
      setCustomTitle("")
      setCustomOpen(false)
    }
  }

  async function handleRemove(id: string) {
    const previous = items
    const next = items.filter((i) => i.id !== id)
    setItems(next)
    const ok = await deleteItem(id)
    if (!ok) {
      setItems(previous)
      return
    }
    await persistOrder(next)
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await persistOrder(next)
  }

  async function handleTime(id: string, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, startTime: value || null } : i)))
    await updateItem(id, { startTime: value || null })
  }

  async function handleDuration(id: string, value: number | null) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, durationMinutes: value } : i)))
    await updateItem(id, { durationMinutes: value })
  }

  async function handleShare() {
    if (!plan) return
    if (!plan.isPublic) {
      const ok = await updateItinerary(plan.id, { isPublic: true })
      if (!ok) return
      setPlan({ ...plan, isPublic: true })
    }
    const token = plan.shareToken
    if (!token) return
    const url = `${window.location.origin}/plans/shared/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the plan is still shared and the link is shown below.
      setCopied(false)
    }
  }

  async function handleRename(nextTitle: string) {
    if (!plan) return
    const trimmed = nextTitle.trim()
    if (!trimmed || trimmed === plan.title) {
      setEditingTitle(false)
      return
    }
    const previous = plan.title
    setPlan({ ...plan, title: trimmed })
    setEditingTitle(false)
    const ok = await updateItinerary(plan.id, { title: trimmed })
    if (!ok) setPlan({ ...plan, title: previous })
  }

  const shareUrl =
    plan?.isPublic && plan.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/plans/shared/${plan.shareToken}`
      : null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="flex h-18 items-center gap-3">
            <Link href="/plans" className="-ml-2 rounded-xl p-2.5 transition-colors hover:bg-secondary/80">
              <ArrowLeft className="h-5 w-5 text-foreground" />
              <span className="sr-only">Back to plans</span>
            </Link>
            {editingTitle && plan ? (
              <input
                autoFocus
                defaultValue={plan.title}
                aria-label="Plan name"
                onBlur={(e) => void handleRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    ;(e.target as HTMLInputElement).blur()
                  } else if (e.key === "Escape") {
                    setEditingTitle(false)
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 font-serif text-xl font-semibold text-foreground focus:border-foreground focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                disabled={!plan}
                title="Rename plan"
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-left font-serif text-xl font-semibold text-foreground transition-colors hover:bg-secondary/60"
              >
                {plan?.title ?? "Plan"}
              </button>
            )}
            {plan && (
              <button
                onClick={() => void handleShare()}
                className="flex items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Share"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : !user ? (
          <p className="py-20 text-center text-muted-foreground">
            Please{" "}
            <Link href="/plans" className="underline">
              sign in
            </Link>{" "}
            to view this plan.
          </p>
        ) : !plan ? (
          <p className="py-20 text-center text-muted-foreground">
            This plan could not be found.
          </p>
        ) : (
          <>
            {shareUrl && (
              <p className="mb-6 truncate rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                Anyone with this link can view the plan:{" "}
                <span className="text-foreground">{shareUrl}</span>
              </p>
            )}

            {items.length === 0 ? (
              <div className="mb-8 rounded-3xl border border-dashed border-border py-16 text-center">
                <Clock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-muted-foreground">Add your first stop below.</p>
              </div>
            ) : (
              <div className="mb-8">
                {/* Timeline / map toggle. Map is only offered once at least one
                    stop can actually be placed. */}
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="inline-flex rounded-full border border-border/60 bg-card p-1">
                    <button
                      onClick={() => setView("timeline")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                        view === "timeline"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <List className="h-4 w-4" aria-hidden="true" />
                      Timeline
                    </button>
                    <button
                      onClick={() => setView("map")}
                      disabled={routeStops.length === 0}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                        view === "map"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <MapIcon className="h-4 w-4" aria-hidden="true" />
                      Map
                    </button>
                  </div>
                  {routeStops.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {routeStops.length} of {items.length} stops mapped
                    </p>
                  )}
                </div>

                {view === "map" ? (
                  <div className="space-y-3">
                    <PlanRouteMap stops={routeStops} />
                    <p className="px-1 text-xs text-muted-foreground">
                      Travel times are straight-line estimates, not live routing.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-0">
                    {items.map((item, index) => {
                      const leg = index < items.length - 1 ? legs[item.id] : null
                      const title = item.snapshot?.name ?? item.customTitle ?? "Stop"
                      const hasCoords =
                        typeof item.snapshot?.lat === "number" && typeof item.snapshot?.lng === "number"
                      const isCustom = !item.businessRef
                      return (
                        <li key={item.id}>
                          <div className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-4">
                            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums">
                              {index + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-medium text-foreground">{title}</h3>
                                {/* Clear signal of what kind of stop this is. */}
                                {hasCoords ? (
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                    <MapPin className="h-3 w-3" aria-hidden="true" />
                                    On map
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {isCustom ? "Custom activity" : "No map pin"}
                                  </span>
                                )}
                              </div>
                              {item.snapshot?.neighbourhood && (
                                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  {item.snapshot.neighbourhood}
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-sm text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span className="sr-only">Start time for {title}</span>
                                  <input
                                    type="time"
                                    value={item.startTime?.slice(0, 5) ?? ""}
                                    onChange={(e) => void handleTime(item.id, e.target.value)}
                                    className="bg-transparent text-foreground focus:outline-none"
                                  />
                                </label>
                                <label className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-sm text-muted-foreground">
                                  <span className="sr-only">Duration at {title}</span>
                                  <select
                                    value={item.durationMinutes ?? ""}
                                    onChange={(e) =>
                                      void handleDuration(
                                        item.id,
                                        e.target.value ? Number(e.target.value) : null,
                                      )
                                    }
                                    className="bg-transparent text-foreground focus:outline-none"
                                  >
                                    <option value="">Duration</option>
                                    {DURATION_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-1">
                              <button
                                onClick={() => void handleMove(index, -1)}
                                disabled={index === 0}
                                aria-label="Move earlier"
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowUp className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => void handleMove(index, 1)}
                                disabled={index === items.length - 1}
                                aria-label="Move later"
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowDown className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => void handleRemove(item.id)}
                                aria-label="Remove stop"
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          {/* Travel leg to the next stop. Only shown when both
                              stops are located, so it is never fabricated. */}
                          {index < items.length - 1 && (
                            <div className="flex items-center gap-2 py-2 pl-8 text-sm text-muted-foreground">
                              <span className="flex h-6 w-6 items-center justify-center">
                                {leg?.mode === "transit" ? (
                                  <Bus className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Footprints className="h-4 w-4" aria-hidden="true" />
                                )}
                              </span>
                              <span className="border-l border-dashed border-border pl-3">
                                {leg ? leg.label : "Add a location to estimate travel"}
                              </span>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-border/60 bg-card p-5">
              {/* Primary flow: live Google Places search. Always visible so a
                  typed place resolves to a real, mapped location - never saved
                  as raw text. Selecting a result stores its Place ID and
                  coordinates via handleAddPlace. */}
              <div className="space-y-5">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Add a place
                  </p>
                  <PlaceSearch
                    onSelect={(b) => void handleAddPlace(b)}
                    existingRefs={existingRefs}
                    placeholder="Search stations, restaurants, cafes, attractions…"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pick a result to add it to your map with a real location.
                  </p>
                </div>

                {candidates.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                      From your saved places
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {candidates.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => void handleAddSaved(s.businessRef)}
                          className={cn(
                            "rounded-full border border-border px-3 py-1.5 text-sm text-foreground",
                            "transition-colors hover:bg-secondary/80",
                          )}
                        >
                          {s.snapshot?.name ?? "Saved place"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary flow: free-text custom activity, explicitly separate
                  so it is never confused with a mapped place. No coordinates,
                  no map pin - for things like "Meet Sarah" or "Picnic". */}
              <div className="mt-5 border-t border-border/50 pt-5">
                {!customOpen ? (
                  <button
                    onClick={() => setCustomOpen(true)}
                    className="flex items-center gap-2 text-sm font-medium text-foreground"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add custom activity
                  </button>
                ) : (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      A free-text stop with no map pin, e.g. &ldquo;Meet Sarah&rdquo;, &ldquo;Picnic&rdquo;, &ldquo;Train home&rdquo;.
                    </p>
                    <form onSubmit={handleAddCustom} className="flex gap-2">
                      <input
                        autoFocus
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Custom activity"
                        aria-label="Custom activity title"
                        className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground/70 focus:border-foreground focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-foreground/90"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
