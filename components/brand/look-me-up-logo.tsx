"use client"

import { cn } from "@/lib/utils"
import { Eye } from "./eye"
import { usePupilTracking } from "./use-pupil-tracking"

interface LookMeUpLogoProps {
  /** Typography classes. The eyes scale from font-size, so size lives here. */
  className?: string
}

/**
 * The LookMeUp wordmark, with the two "o" letters of "Look" replaced by eyes.
 *
 * Reads as "LookMeUp" visually and to a screen reader, while carrying the
 * look -> discover -> find idea in the letterforms themselves.
 *
 * Accessibility: the eyes replace glyphs, so the visible string is literally
 * "L" + two shapes + "kMeUp". A screen reader would announce that as "L kMeUp".
 * To prevent it, the real word is provided once as `sr-only` text and the whole
 * visual treatment is `aria-hidden` - so the accessible name stays exactly
 * "LookMeUp" while the visual stays sharp and scalable.
 */
export function LookMeUpLogo({ className }: LookMeUpLogoProps) {
  const { containerRef, offset, animated } = usePupilTracking<HTMLSpanElement>()

  return (
    <span ref={containerRef} className={cn("relative", className)}>
      {/* The one and only accessible name for this mark. */}
      <span className="sr-only">LookMeUp</span>

      <span
        aria-hidden="true"
        // nowrap keeps the wordmark on a single line at every width, so the
        // eyes can never be orphaned onto a second row and the header height
        // stays fixed on the narrowest phones.
        className="whitespace-nowrap"
      >
        {"L"}
        <Eye offsetX={offset.x} offsetY={offset.y} animated={animated} />
        <Eye offsetX={offset.x} offsetY={offset.y} animated={animated} />
        {"kMeUp"}
      </span>
    </span>
  )
}
