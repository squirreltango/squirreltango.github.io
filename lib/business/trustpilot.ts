import type { Business, TrustpilotRating } from "@/lib/types/business"

/**
 * Trustpilot enrichment client.
 *
 * Uses only the authorised Trustpilot public Business Unit API
 * (https://api.trustpilot.com/v1/business-units/...). We never scrape
 * Trustpilot web pages. The API key is read from a server-side environment
 * variable and is never exposed to the client or logged.
 *
 * When `TRUSTPILOT_API_KEY` is not configured, `isTrustpilotEnabled()` returns
 * false and enrichment is skipped gracefully - the rest of the app is
 * unaffected.
 */

const TRUSTPILOT_API_BASE = "https://api.trustpilot.com/v1"

// A confident match requires the Trustpilot profile's own domain to line up
// with the business domain. Anything below this is treated as ambiguous and
// discarded so we never guess.
export const CONFIDENT_MATCH_THRESHOLD = 0.8

export function isTrustpilotEnabled(): boolean {
  return Boolean(process.env.TRUSTPILOT_API_KEY)
}

/**
 * Extract the base registrable domain from a website URL or bare host.
 * Returns null when nothing usable can be derived. Strips protocol, path,
 * query and a leading `www.`.
 */
export function extractDomain(website: string | undefined | null): string | null {
  if (!website) return null
  let value = website.trim().toLowerCase()
  if (!value) return null

  // Ensure the URL parser has a protocol to work with.
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    value = `https://${value}`
  }

  try {
    const host = new URL(value).hostname
    return host.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

/** Compare two domains and return a 0-1 confidence score. */
function domainMatchConfidence(businessDomain: string, trustpilotDomain: string): number {
  const a = businessDomain.replace(/^www\./, "").toLowerCase()
  const b = trustpilotDomain.replace(/^www\./, "").toLowerCase()
  if (!a || !b) return 0
  if (a === b) return 0.95
  // One is a subdomain of the other (e.g. shop.example.com vs example.com).
  if (a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return 0.85
  return 0.2
}

// Minimal, defensive view of the Trustpilot Business Unit payload. The public
// API has varied field shapes across versions, so every field is optional and
// parsed tolerantly.
interface TrustpilotBusinessUnit {
  id?: string
  displayName?: string
  name?: { identifying?: string; referring?: string[] } | string
  websiteUrl?: string
  numberOfReviews?: number | { total?: number }
  score?: { trustScore?: number; stars?: number }
  trustScore?: number
  stars?: number
  profileUrl?: string
}

function readReviewCount(unit: TrustpilotBusinessUnit): number | undefined {
  const n = unit.numberOfReviews
  if (typeof n === "number") return n
  if (n && typeof n === "object" && typeof n.total === "number") return n.total
  return undefined
}

function readIdentifyingDomain(unit: TrustpilotBusinessUnit): string | undefined {
  if (typeof unit.name === "string") return unit.name
  if (unit.name && typeof unit.name === "object") {
    if (typeof unit.name.identifying === "string") return unit.name.identifying
    if (Array.isArray(unit.name.referring) && unit.name.referring[0]) return unit.name.referring[0]
  }
  return extractDomain(unit.websiteUrl) ?? undefined
}

/**
 * Look up a Trustpilot Business Unit by domain. Returns the raw unit, or null
 * when Trustpilot has no profile for the domain (404) or on error.
 */
async function findBusinessUnitByDomain(domain: string): Promise<TrustpilotBusinessUnit | null> {
  const apiKey = process.env.TRUSTPILOT_API_KEY
  if (!apiKey) return null

  const url = `${TRUSTPILOT_API_BASE}/business-units/find?name=${encodeURIComponent(domain)}`
  const response = await fetch(url, {
    headers: { apikey: apiKey },
    cache: "no-store",
  })

  // 404 simply means Trustpilot has no profile for this domain.
  if (response.status === 404) return null
  if (!response.ok) {
    // Do not log the key or the full URL with credentials.
    throw new Error(`Trustpilot find failed with status ${response.status}`)
  }

  return (await response.json()) as TrustpilotBusinessUnit
}

export type TrustpilotMatchStatus = "match" | "no-domain" | "no-profile" | "ambiguous" | "error"

export interface TrustpilotMatchResult {
  status: TrustpilotMatchStatus
  domain?: string
  enrichment?: TrustpilotRating
  confidence?: number
  reason?: string
}

/**
 * Attempt to match a business to a Trustpilot profile and build enrichment.
 *
 * Matching priority (per requirements): the business website/domain is the
 * primary, strongest signal. We confirm the Trustpilot profile's own domain
 * matches the business domain before accepting. Name-only matches are never
 * accepted, and uncertain matches are discarded.
 */
export async function matchTrustpilot(business: Business): Promise<TrustpilotMatchResult> {
  const domain = extractDomain(business.contact?.website)
  if (!domain) return { status: "no-domain" }

  let unit: TrustpilotBusinessUnit | null
  try {
    unit = await findBusinessUnitByDomain(domain)
  } catch (err) {
    return { status: "error", domain, reason: err instanceof Error ? err.message : "Unknown error" }
  }

  if (!unit || !unit.id) return { status: "no-profile", domain }

  const trustpilotDomain = readIdentifyingDomain(unit)
  const confidence = trustpilotDomain ? domainMatchConfidence(domain, trustpilotDomain) : 0

  if (confidence < CONFIDENT_MATCH_THRESHOLD) {
    return {
      status: "ambiguous",
      domain,
      confidence,
      reason: `Trustpilot domain "${trustpilotDomain ?? "unknown"}" does not confidently match "${domain}"`,
    }
  }

  const trustScore = unit.score?.trustScore ?? unit.trustScore
  const stars = unit.score?.stars ?? unit.stars
  const reviewCount = readReviewCount(unit)

  const enrichment: TrustpilotRating = {
    businessUnitId: unit.id,
    trustScore: typeof trustScore === "number" ? trustScore : undefined,
    stars: typeof stars === "number" ? stars : undefined,
    reviewCount,
    // Canonical public profile URL. Uses the identifying domain and no
    // Trustpilot-owned assets or branding.
    profileUrl:
      unit.profileUrl ??
      (trustpilotDomain ? `https://www.trustpilot.com/review/${trustpilotDomain}` : undefined),
    lastSyncedAt: new Date().toISOString(),
    matchConfidence: confidence,
  }

  return { status: "match", domain, enrichment, confidence }
}
