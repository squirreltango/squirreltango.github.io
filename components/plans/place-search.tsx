"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Loader2, MapPin } from "lucide-react"
import type { Business } from "@/lib/types/business"
import { cn } from "@/lib/utils"

interface PlaceSearchProps {
  /** Called when the user picks a place. Receives the full normalised Business. */
  onSelect: (business: Business) => void
  /** Refs already on the plan, so we can mark/disable duplicates. */
  existingRefs?: Set<string>
  placeholder?: string
}

/**
 * Live Google Places search for adding a stop to a plan.
 *
 * Queries the shared `/api/google-places` endpoint, which returns the
 * normalised `Business` model - crucially including real coordinates - so any
 * stop added this way can appear on the map and take part in travel estimates.
 * The search is debounced and the latest-request guard prevents an earlier slow
 * response from overwriting a newer one.
 */
export function PlaceSearch({ onSelect, existingRefs, placeholder }: PlaceSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Business[]>([])
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/google-places?query=${encodeURIComponent(q)}`)
        const data = await res.json()
        // Ignore stale responses that resolve after a newer keystroke.
        if (id !== requestId.current) return
        setResults(Array.isArray(data.businesses) ? data.businesses.slice(0, 8) : [])
      } catch (err) {
        console.error("[v0] place search failed:", err)
        if (id === requestId.current) setResults([])
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setTouched(true)
          }}
          placeholder={placeholder ?? "Search for a place, e.g. Dishoom Covent Garden"}
          aria-label="Search for a place to add"
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/70 focus:border-foreground focus:outline-none"
        />
        {loading && (
          <Loader2
            className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {touched && query.trim().length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border/60">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No places found for “{query.trim()}”.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((business) => {
                const already = existingRefs?.has(business.id)
                const hasCoords =
                  typeof business.location?.coordinates?.lat === "number" &&
                  typeof business.location?.coordinates?.lng === "number"
                return (
                  <li key={business.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        onSelect(business)
                        setQuery("")
                        setResults([])
                        setTouched(false)
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                        already ? "cursor-not-allowed opacity-50" : "hover:bg-secondary/70",
                      )}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{business.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {business.location?.neighbourhood ?? business.location?.address ?? "Location unavailable"}
                        </span>
                      </span>
                      {already ? (
                        <span className="shrink-0 text-xs text-muted-foreground">Added</span>
                      ) : (
                        !hasCoords && (
                          <span
                            className="shrink-0 text-xs text-muted-foreground"
                            title="This place has no coordinates, so it won't appear on the map."
                          >
                            No map pin
                          </span>
                        )
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
