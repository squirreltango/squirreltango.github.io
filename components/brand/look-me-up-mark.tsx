import { EyeGlyph } from "./eye"

interface LookMeUpMarkProps {
  /** Size the mark with width/height utilities, e.g. "h-10 w-10". */
  className?: string
  /**
   * Draws the rounded brand tile behind the eyes. On for icon contexts
   * (favicon, home screen, social avatar); off when overlaying existing
   * artwork such as a map surface.
   */
  withTile?: boolean
  /**
   * Colour of the eyes. Against a tile this must contrast with the tile, so it
   * defaults to the app background token, matching the header's L tile.
   */
  counterColor?: string
  /** Accessible label. Omit for decorative use, where the mark is hidden. */
  title?: string
}

/**
 * The standalone LookMeUp brand mark: the two-eye motif, optionally set in the
 * brand tile. Intended for favicon, mobile home-screen icon, loading states,
 * map branding and social profile images.
 *
 * Two deliberate constraints make it genuinely reusable:
 *
 * - It shares its geometry with the wordmark's eyes (see EyeGlyph), so the
 *   icon and the logo can never drift apart.
 * - It is pure geometry with no <text> and no font dependency, so it can be
 *   exported to a flat .svg or rasterised to .png later and look identical.
 *   A monogram variant would have needed Playfair embedded to survive export.
 *
 * Intentionally has no hooks or "use client": it stays renderable from a server
 * component and safe to inline anywhere. The cursor interaction belongs to the
 * wordmark, not to a 32px icon.
 */
export function LookMeUpMark({
  className,
  withTile = true,
  counterColor = "var(--background)",
  title,
}: LookMeUpMarkProps) {
  // With the tile the eyes are inset; without it they use the full canvas.
  const scale = withTile ? 0.32 : 0.46
  const eyeY = withTile ? 34 : 27
  const leftX = withTile ? 16 : 2
  const rightX = withTile ? 52 : 52

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {withTile && <rect width={100} height={100} rx={24} fill="currentColor" />}
      <g transform={`translate(${leftX} ${eyeY}) scale(${scale})`}>
        <EyeGlyph fill={withTile ? counterColor : "currentColor"} animated={false} />
      </g>
      <g transform={`translate(${rightX} ${eyeY}) scale(${scale})`}>
        <EyeGlyph fill={withTile ? counterColor : "currentColor"} animated={false} />
      </g>
    </svg>
  )
}
