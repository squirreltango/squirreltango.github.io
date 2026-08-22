"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { withPhotoWidth, type BusinessPhoto } from "@/lib/business/normalise-business"

interface BusinessPhotoCarouselProps {
  photos: BusinessPhoto[]
  businessName: string
}

// A swipe must be mostly horizontal and travel far enough to count, so that
// vertical page scrolling never flips the photo.
const SWIPE_THRESHOLD_PX = 48

/**
 * Hero photo carousel for the business detail page, backed exclusively by the
 * real Google Places photos already present on the business record.
 *
 * Cost/performance note: only the photos the user has actually reached are
 * mounted, so a page view costs one Place Photo request until they interact.
 */
export function BusinessPhotoCarousel({ photos, businessName }: BusinessPhotoCarouselProps) {
  const [index, setIndex] = useState(0)
  const [isLightboxOpen, setLightboxOpen] = useState(false)
  // Indices mounted so far - keeps us from downloading all 10 photos up front.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]))
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const total = photos.length
  const hasMultiple = total > 1

  const markMounted = useCallback((...indices: number[]) => {
    setMounted((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const i of indices) {
        if (i >= 0 && !next.has(i)) {
          next.add(i)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return
      const wrapped = (next + total) % total
      setIndex(wrapped)
      // Mount the target plus its neighbours so the next swipe feels instant.
      markMounted(wrapped, (wrapped + 1) % total, (wrapped - 1 + total) % total)
    },
    [total, markMounted],
  )

  const goPrevious = useCallback(() => goTo(index - 1), [goTo, index])
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])

  // Keyboard control: arrows always, Escape closes the lightbox.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrevious()
      if (event.key === "ArrowRight") goNext()
      if (event.key === "Escape" && isLightboxOpen) setLightboxOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goPrevious, goNext, isLightboxOpen])

  // Lock background scrolling while the immersive gallery is open.
  useEffect(() => {
    if (!isLightboxOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isLightboxOpen])

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !hasMultiple) return

    const touch = event.changedTouches[0]
    const deltaX = start.x - touch.clientX
    const deltaY = start.y - touch.clientY

    // Ignore gestures that are mostly vertical - that is a page scroll.
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return

    if (deltaX > 0) goNext()
    else goPrevious()
  }

  const current = photos[index]

  if (total === 0) return null

  return (
    <>
      {/* Slides. Only mounted indices are rendered so unseen photos are never
          downloaded (each download is a billable Place Photo request). */}
      {photos.map((photo, i) => {
        if (!mounted.has(i)) return null
        return (
          <div
            key={photo.url}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 ease-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== index}
          >
            <Image
              src={withPhotoWidth(photo.url, 1200)}
              alt={
                i === 0
                  ? businessName
                  : `${businessName} - photo ${i + 1} of ${total}`
              }
              fill
              sizes="100vw"
              className="object-cover"
              priority={i === 0}
              loading={i === 0 ? undefined : "lazy"}
            />
          </div>
        )
      })}

      {/* Readability scrim for the overlaid controls and the title below. */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent pointer-events-none" />

      {/* Swipe surface. Sits under the arrows/buttons so they stay tappable. */}
      <div
        className="absolute inset-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous photo"
            className={cn(
              "absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20",
              "h-12 w-12 rounded-2xl flex items-center justify-center",
              "bg-card/90 backdrop-blur-md shadow-lg text-foreground",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className={cn(
              "absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20",
              "h-12 w-12 rounded-2xl flex items-center justify-center",
              "bg-card/90 backdrop-blur-md shadow-lg text-foreground",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95",
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Counter + immersive gallery trigger */}
      <div className="absolute bottom-24 sm:bottom-28 left-0 right-0 z-20 px-5 sm:px-8 flex items-end justify-between gap-3 pointer-events-none">
        {hasMultiple ? (
          <span
            className="pointer-events-auto px-3 py-1.5 rounded-full bg-foreground/70 backdrop-blur-md text-background text-xs font-semibold tabular-nums"
            aria-live="polite"
          >
            {index + 1} / {total}
          </span>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => {
            markMounted(...photos.map((_, i) => i))
            setLightboxOpen(true)
          }}
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 px-4 h-11 rounded-2xl",
            "bg-card/90 backdrop-blur-md shadow-lg text-sm font-semibold text-foreground",
            "transition-all duration-300",
            "hover:bg-card hover:scale-105 hover:shadow-xl active:scale-95",
          )}
        >
          <Expand className="h-4 w-4" />
          {hasMultiple ? `View all ${total} photos` : "View photo"}
        </button>
      </div>

      {/* Google photo credit for the visible slide. */}
      {current?.attribution && (
        <span
          className={cn(
            // On mobile the content card overlaps the bottom of the hero, so the
            // credit sits below the header actions instead of behind the card.
            "absolute z-20 text-[11px] text-background/70 max-w-[55%] truncate text-right",
            "top-20 right-5 sm:top-auto sm:bottom-4 sm:right-8",
          )}
        >
          Photo: {current.attribution}
        </span>
      )}

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/95 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} photos`}
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          {/* Lightbox header */}
          <div className="flex items-center justify-between gap-4 p-4 sm:p-6 shrink-0">
            <div className="min-w-0">
              <p className="font-serif text-lg sm:text-xl font-semibold text-background truncate">
                {businessName}
              </p>
              <p className="text-background/60 text-sm tabular-nums">
                {index + 1} / {total} {total === 1 ? "photo" : "photos"} from Google
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close gallery"
              className={cn(
                "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center",
                "bg-background/10 text-background",
                "transition-all duration-300 hover:bg-background/20 hover:scale-110 active:scale-95",
              )}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image stage */}
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-20"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative w-full h-full">
              <Image
                key={current.url}
                src={withPhotoWidth(current.url, 1600)}
                alt={`${businessName} - photo ${index + 1} of ${total}`}
                fill
                sizes="100vw"
                className="object-contain"
                style={{ animation: "fadeIn 0.25s ease-out" }}
                priority
              />
            </div>

            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={goPrevious}
                  aria-label="Previous photo"
                  className={cn(
                    "absolute left-2 sm:left-5 top-1/2 -translate-y-1/2",
                    "h-12 w-12 rounded-2xl flex items-center justify-center",
                    "bg-background/10 text-background backdrop-blur-md",
                    "transition-all duration-300 hover:bg-background/20 hover:scale-110 active:scale-95",
                  )}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next photo"
                  className={cn(
                    "absolute right-2 sm:right-5 top-1/2 -translate-y-1/2",
                    "h-12 w-12 rounded-2xl flex items-center justify-center",
                    "bg-background/10 text-background backdrop-blur-md",
                    "transition-all duration-300 hover:bg-background/20 hover:scale-110 active:scale-95",
                  )}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Credit + thumbnail rail */}
          <div className="shrink-0 p-4 sm:p-6 flex flex-col gap-3">
            <p className="text-center text-xs text-background/60 min-h-4">
              {current.attribution ? `Photo: ${current.attribution}` : null}
            </p>
            {hasMultiple && (
              <div className="flex justify-start sm:justify-center gap-2 overflow-x-auto pb-1">
                {photos.map((photo, i) => (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`View photo ${i + 1}`}
                    aria-current={i === index}
                    className={cn(
                      "relative h-16 w-16 shrink-0 rounded-xl overflow-hidden",
                      "transition-all duration-300",
                      i === index
                        ? "ring-2 ring-background scale-105"
                        : "opacity-50 hover:opacity-90",
                    )}
                  >
                    <Image
                      src={withPhotoWidth(photo.url, 200)}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
