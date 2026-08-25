import type { CSSProperties } from "react"

/**
 * Shared geometry for the LookMeUp eye motif, expressed in a 0-100 viewBox so
 * every consumer (wordmark, app mark, favicon) stays pixel-identical.
 *
 * The ring is a single even-odd path: a true circle outside, a slightly
 * TALLER-than-wide ellipse inside. That mismatch is deliberate - it makes the
 * ring thick at the sides (46 - 28 = 18) and thin at the top and bottom
 * (46 - 36 = 10), which reproduces the high stroke contrast of Playfair
 * Display's lowercase "o" so the eye still reads as the letter it replaces.
 */
const RING_PATH =
  "M4,50a46,46 0 1,0 92,0a46,46 0 1,0 -92,0 " +
  "M22,50a28,36 0 1,0 56,0a28,36 0 1,0 -56,0"

/** Pupil radius. ~46% of the counter's width: present, but never a blob. */
const PUPIL_RADIUS = 13

/**
 * Maximum pupil travel in viewBox units. The counter allows far more room
 * (15 horizontal, 23 vertical) but the brief calls for extreme restraint, so
 * we use roughly a third of the available space and never let the pupil
 * approach the ring.
 */
export const PUPIL_MAX_X = 6
export const PUPIL_MAX_Y = 5

interface EyeGlyphProps {
  /** Pupil offset in viewBox units. Defaults to dead centre (the no-JS state). */
  offsetX?: number
  offsetY?: number
  /** Colour of the ring and pupil. Defaults to the inherited text colour. */
  fill?: string
  /** Disables the easing transition, used when reduced motion is requested. */
  animated?: boolean
}

/**
 * The eye shapes WITHOUT an <svg> wrapper, so they can be composed into a
 * larger icon canvas (see LookMeUpMark) as well as used standalone.
 */
export function EyeGlyph({
  offsetX = 0,
  offsetY = 0,
  fill = "currentColor",
  animated = true,
}: EyeGlyphProps) {
  return (
    <>
      <path d={RING_PATH} fillRule="evenodd" clipRule="evenodd" fill={fill} />
      <circle
        cx={50}
        cy={50}
        r={PUPIL_RADIUS}
        fill={fill}
        // Transform rather than cx/cy so the browser can composite it cheaply.
        transform={`translate(${offsetX} ${offsetY})`}
        style={
          animated
            ? { transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" }
            : undefined
        }
      />
    </>
  )
}

interface EyeProps extends EyeGlyphProps {
  className?: string
  style?: CSSProperties
}

/**
 * A single eye sized to sit inline in running text as a substitute for "o".
 *
 * Sizing is in `em` so the eye tracks whatever font-size it is dropped into -
 * that is what keeps the desktop and mobile wordmarks identical in proportion
 * without a second set of styles.
 *
 * `verticalAlign: baseline` on an inline-block puts its BOTTOM edge on the text
 * baseline, which is exactly where a lowercase "o" sits, so the eyes align to
 * the wordmark without magic offsets that would drift if the font swapped.
 */
export function Eye({ className, style, ...glyph }: EyeProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      // Decorative: the accessible name is supplied as real text by the parent.
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{
        width: "0.52em",
        height: "0.52em",
        display: "inline-block",
        verticalAlign: "baseline",
        // Optical letter-spacing so "L o o k" breathes like the real glyphs.
        marginInline: "0.012em",
        // Never let the eye be a flex item that can be squeezed or stretched.
        flex: "none",
        ...style,
      }}
    >
      <EyeGlyph {...glyph} />
    </svg>
  )
}
