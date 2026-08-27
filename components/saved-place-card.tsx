"use client"

import Link from "next/link"
import { Star, MapPin, Trash2, FolderInput } from "lucide-react"
import { useState } from "react"
import { getCategoryLabel } from "@/lib/business/category-mapping"
import { formatPriceLevel } from "@/lib/business/category-mapping"
import { useSavedPlaces, type SavedPlace } from "@/components/saved-places-provider"
import type { CategoryId } from "@/lib/types/business"
import { cn } from "@/lib/utils"

/**
 * Renders a saved place from its stored snapshot rather than from live data.
 *
 * Saves must survive the underlying Google Place ID being retired, so this
 * card never assumes the venue can still be fetched. When a snapshot predates
 * a field we show nothing for it instead of inventing a value.
 */
export function SavedPlaceCard({ place }: { place: SavedPlace }) {
  const { remove, collections, moveToCollection } = useSavedPlaces()
  const [moveOpen, setMoveOpen] = useState(false)
  const snap = place.snapshot

  const title = snap?.name ?? "Saved place"
  const price = formatPriceLevel(snap?.priceLevel)

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl",
        "border border-border/60 bg-card",
        "transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5",
      )}
    >
      <Link href={`/business/${place.businessRef}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary/60">
          {snap?.image ? (
            <img
              src={snap.image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/business/${place.businessRef}`} className="min-w-0">
            <h3 className="truncate font-serif text-lg font-semibold text-foreground">{title}</h3>
          </Link>
          {snap?.rating !== undefined && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {snap.rating.toFixed(1)}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {snap?.category ? getCategoryLabel(snap.category as CategoryId) : "Saved"}
          {price ? ` · ${price}` : ""}
          {snap?.neighbourhood ? ` · ${snap.neighbourhood}` : ""}
        </p>

        {snap?.address && (
          <p className="truncate text-xs text-muted-foreground/80">{snap.address}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            onClick={() => setMoveOpen((v) => !v)}
            aria-expanded={moveOpen}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <FolderInput className="h-3.5 w-3.5" aria-hidden="true" />
            {place.collection === "general" ? "Add to list" : place.collection}
          </button>
          <button
            onClick={() => void remove(place.businessRef)}
            aria-label={`Remove ${title} from saved`}
            className="ml-auto rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {moveOpen && (
          <div className="mt-1 flex flex-wrap gap-1.5 rounded-2xl bg-secondary/50 p-2">
            {["general", "favourites", "want to try", "date night"]
              .concat(collections.filter((c) => !["general", "favourites", "want to try", "date night"].includes(c)))
              .map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    void moveToCollection(place.businessRef, c)
                    setMoveOpen(false)
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs capitalize transition-colors",
                    c === place.collection
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
          </div>
        )}
      </div>
    </article>
  )
}
