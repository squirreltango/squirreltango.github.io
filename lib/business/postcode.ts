/**
 * UK postcode extraction and normalisation.
 *
 * Google frequently omits a `postal_code` address component for UK places
 * while still including the postcode inside the formatted address string
 * (e.g. "24 Great Windmill St, London W1D 7LG, UK"). Without this utility the
 * FSA matcher sees `postcode: unknown` and has to fall back to coordinates
 * alone, which is weaker evidence for branch-level disambiguation.
 *
 * Principles, mirroring the rest of the location layer:
 *   * NEVER invent a postcode. If the text contains no valid pattern we return
 *     null and callers keep whatever they had (usually nothing).
 *   * ALWAYS prefer Google's STRUCTURED `postal_code` component. Parsing a
 *     formatted string is strictly a fallback.
 *   * Extraction is not the same as verification: a parsed postcode is real
 *     text from Google, but it still has to agree with the FSA record before
 *     it strengthens a match. This file only supplies the value.
 */

/**
 * UK postcode shape: outward code (area + district) then inward code
 * (sector + unit). The inward code is always exactly one digit followed by two
 * letters, which is what makes the pattern reliably greppable out of prose.
 *
 * The separating space is optional in source text; we normalise it back in.
 *
 * Letter-position constraints from the official specification are applied so we
 * don't lift lookalike tokens (e.g. a building reference) out of an address:
 *   - the first letter is never Q, V or X
 *   - the second letter is never I, J or Z
 *   - the final two letters never use C, I, K, M, O or V
 */
const UK_POSTCODE_PATTERN =
  /\b([A-PR-UWYZ][A-HK-Y]?\d[A-HJKPS-UW\d]?)\s*(\d[ABD-HJLNP-UW-Z]{2})\b/gi

/**
 * Normalise a postcode to canonical form: uppercase, trimmed, with exactly one
 * space before the three-character inward code ("w1d7lg" -> "W1D 7LG").
 *
 * Returns null when the input is absent or not a valid UK postcode, so an
 * unparseable value can never masquerade as a real one.
 */
export function normaliseUkPostcode(value: string | undefined | null): string | null {
  if (!value) return null
  const compact = value.toUpperCase().replace(/\s+/g, "")
  // Anchored: the WHOLE string must be a postcode. Use extractUkPostcode when
  // the postcode is embedded in a longer address.
  const anchored = new RegExp(`^${UK_POSTCODE_PATTERN.source}$`, "i")
  const m = anchored.exec(compact)
  if (!m) return null
  return `${m[1]} ${m[2]}`.toUpperCase()
}

/**
 * Pull a UK postcode out of a longer string such as a Google formatted address.
 *
 * Takes the LAST valid occurrence: UK addresses place the postcode at the end
 * (before an optional country), so a token appearing earlier is more likely to
 * be part of a street or building name.
 *
 * Returns null when the text contains no valid postcode - never a guess.
 */
export function extractUkPostcode(text: string | undefined | null): string | null {
  if (!text) return null
  // Fresh regex instance: the shared pattern is /g and therefore stateful.
  const pattern = new RegExp(UK_POSTCODE_PATTERN.source, "gi")
  let last: RegExpExecArray | null = null
  let current: RegExpExecArray | null
  while ((current = pattern.exec(text)) !== null) last = current
  if (!last) return null
  return `${last[1]} ${last[2]}`.toUpperCase()
}

/**
 * Resolve the best available postcode for a place, in strict precedence order:
 *
 *   1. Google's structured `postal_code` component (authoritative)
 *   2. A postcode parsed out of the formatted address strings (fallback)
 *
 * Each candidate is validated, so a malformed structured value falls through to
 * parsing rather than being trusted blindly. Returns null when no source
 * yields a valid postcode.
 */
export function resolvePostcode(sources: {
  /** Google's structured postal_code component, when present. */
  structured?: string | null
  /** Formatted address strings to fall back to, in order of preference. */
  addressStrings?: (string | undefined | null)[]
}): string | null {
  const structured = normaliseUkPostcode(sources.structured)
  if (structured) return structured

  for (const candidate of sources.addressStrings ?? []) {
    const parsed = extractUkPostcode(candidate)
    if (parsed) return parsed
  }
  return null
}
