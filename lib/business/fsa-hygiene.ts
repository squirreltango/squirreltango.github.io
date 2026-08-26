import type { Business, FoodHygieneRating, FsaMatchConfidence } from "@/lib/types/business"
import { resolvePostcode } from "@/lib/business/postcode"

/**
 * Food Standards Agency (FSA) hygiene rating client.
 *
 * Source: the official, public, documented FSA API at
 * https://api.ratings.food.gov.uk (requires the `x-api-version: 2` header).
 * It needs no API key and no registration, so there is no credential to
 * configure or leak. We never scrape ratings.food.gov.uk web pages.
 *
 * ---------------------------------------------------------------------------
 * WHY MATCHING IS THE HARD PART
 * ---------------------------------------------------------------------------
 * The FSA has no concept of a Google Place ID, so a business must be matched
 * by name + location. Chains make this genuinely dangerous: a live probe of
 * the FSA API for "Dishoom" returns both
 *
 *     "Dishoom"             E1 4UT   rating 5
 *     "Dishoom Bombay Cafe" E2 7JE   rating 5
 *
 * Attaching the wrong branch's rating to a venue would be a factual claim
 * about food safety that we cannot support - the exact failure mode that has
 * to be impossible here. So this module is built around one rule:
 *
 *     WHEN IN DOUBT, RETURN NOTHING.
 *
 * Only "exact" and "high" confidence matches are returned. Anything ambiguous
 * (two plausible branches, weak name overlap, contradictory postcode) is
 * discarded and the business simply shows no hygiene rating. Showing nothing
 * is always preferable to showing a rating that might belong elsewhere.
 */

const FSA_API_BASE = "https://api.ratings.food.gov.uk"
const FSA_HEADERS = {
  "x-api-version": "2",
  accept: "application/json",
} as const

/**
 * The FSA API is public and unauthenticated, so unlike Google Places or
 * Trustpilot there is nothing to gate on. Kept as a function so callers read
 * uniformly across enrichment sources.
 */
export function isFsaEnabled(): boolean {
  return true
}

// --- Matching thresholds ----------------------------------------------------
// These are deliberately strict. Loosening them trades correctness for
// coverage, which is the wrong trade for a food-safety claim.

/** Name similarity required when the full postcode already agrees. */
const NAME_THRESHOLD_WITH_POSTCODE = 0.6
/** Name similarity required when relying on coordinates instead of postcode. */
const NAME_THRESHOLD_WITH_DISTANCE = 0.85
/** Name similarity required to call a match "exact". */
const NAME_THRESHOLD_EXACT = 0.9
/** Max metres between Google and FSA coordinates for a distance-based match. */
const MAX_DISTANCE_METERS = 150
/** Max metres allowed when only the outward postcode agrees. */
const MAX_DISTANCE_OUTWARD_METERS = 300
/**
 * If the runner-up candidate scores within this margin of the winner, the two
 * are treated as indistinguishable and the match is rejected as ambiguous.
 * This is the branch-confusion guard.
 */
const AMBIGUITY_MARGIN = 0.08

// --- Name normalisation -----------------------------------------------------

/** Legal/company suffixes that carry no identifying value. */
const LEGAL_SUFFIXES = new Set([
  "ltd",
  "limited",
  "plc",
  "llp",
  "llc",
  "inc",
  "co",
  "company",
  "holdings",
  "group",
  "uk",
])

/**
 * Words so common in venue names that matching on them alone is meaningless.
 * Removing them stops "The Coffee Room" matching "The Coffee House" purely on
 * "the", "coffee" being shared - the distinguishing token must carry the match.
 */
const WEAK_TOKENS = new Set(["the", "and", "at", "of", "on", "in", "a", "an"])

/**
 * Normalise a venue name for comparison: strip diacritics, punctuation, legal
 * suffixes and filler words, then return the meaningful tokens.
 */
export function nameTokens(name: string | undefined | null): string[] {
  if (!name) return []
  const cleaned = name
    .normalize("NFD")
    // Strip combining diacritical marks (café -> cafe).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !LEGAL_SUFFIXES.has(t))
    .filter((t) => !WEAK_TOKENS.has(t))
}

/**
 * Similarity between two venue names, 0-1, using the Sørensen-Dice coefficient
 * over token sets with a containment allowance.
 *
 * The containment case matters for the chain problem: "Dishoom" is a strict
 * subset of "Dishoom Bombay Cafe", so pure Dice scores it only ~0.5. We raise
 * containment to 0.8 - high enough to be a candidate, but deliberately BELOW
 * `NAME_THRESHOLD_EXACT`, so a subset name can never reach "exact" on its own
 * and must be confirmed by postcode or distance.
 */
export function nameSimilarity(a: string | undefined | null, b: string | undefined | null): number {
  const ta = new Set(nameTokens(a))
  const tb = new Set(nameTokens(b))
  if (ta.size === 0 || tb.size === 0) return 0

  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  if (shared === 0) return 0

  // Identical token sets.
  if (shared === ta.size && shared === tb.size) return 1

  const dice = (2 * shared) / (ta.size + tb.size)

  // One name's tokens are entirely contained in the other's.
  const contained = shared === ta.size || shared === tb.size
  if (contained) return Math.max(dice, 0.8)

  return dice
}

// --- Postcode handling ------------------------------------------------------

/** Uppercase, strip all whitespace. "e1 4ut" -> "E14UT". */
/**
 * The postcode used for FSA matching, from the strongest source available.
 *
 * Structured Google data wins; otherwise we recover the postcode already
 * present inside the formatted address. Google routinely omits the
 * `postal_code` component for UK places, which previously left every match
 * running at the weaker `postcode: "unknown"` tier despite the postcode being
 * right there in the address string.
 *
 * This only ADDS evidence - scoring, thresholds and ambiguity rules are
 * untouched. A postcode still has to AGREE with the FSA record to help, a
 * contradictory one remains a hard veto, and a postcode alone can never carry
 * a match without name similarity plus distance.
 *
 * Exported so the enrichment job can report the same value the matcher used,
 * rather than re-deriving it and risking drift.
 */
export function resolveBusinessPostcode(business: Business): string | null {
  return resolvePostcode({
    structured: business.location?.postcode,
    addressStrings: [
      business.googleDetails?.location?.formattedAddress,
      business.googleDetails?.location?.shortFormattedAddress,
      business.location?.address,
    ],
  })
}

export function normalisePostcode(postcode: string | undefined | null): string | null {
  // Note: this is the COMPARISON helper (strips spaces for equality checks).
  // For extracting/formatting a postcode use lib/business/postcode.ts.
  if (!postcode) return null
  const value = postcode.toUpperCase().replace(/\s+/g, "")
  return value || null
}

/**
 * The outward code - the part before the space ("E1 4UT" -> "E1"). Two venues
 * sharing an outward code are in roughly the same district, which is weak
 * corroboration but far from proof.
 */
export function outwardCode(postcode: string | undefined | null): string | null {
  const normalised = normalisePostcode(postcode)
  if (!normalised || normalised.length < 4) return null
  // A UK postcode's inward part is always exactly 3 characters.
  return normalised.slice(0, normalised.length - 3)
}

type PostcodeAgreement = "full" | "outward" | "conflict" | "unknown"

function comparePostcodes(a: string | undefined | null, b: string | undefined | null): PostcodeAgreement {
  const na = normalisePostcode(a)
  const nb = normalisePostcode(b)
  if (!na || !nb) return "unknown"
  if (na === nb) return "full"
  const oa = outwardCode(a)
  const ob = outwardCode(b)
  if (oa && ob && oa === ob) return "outward"
  return "conflict"
}

// --- Distance ---------------------------------------------------------------

/** Great-circle distance in metres. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// --- FSA API shapes ---------------------------------------------------------

/**
 * Defensive view of an FSA establishment. Every field is optional because the
 * API omits fields for some records, and `geocode` values arrive as STRINGS
 * (confirmed by live probe), not numbers.
 */
interface FsaEstablishment {
  FHRSID?: number
  BusinessName?: string
  BusinessType?: string
  AddressLine1?: string
  AddressLine2?: string
  AddressLine3?: string
  AddressLine4?: string
  PostCode?: string
  RatingValue?: string
  RatingDate?: string
  LocalAuthorityName?: string
  SchemeType?: string
  NewRatingPending?: boolean
  geocode?: { latitude?: string | number | null; longitude?: string | number | null } | null
}

function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function formatAddress(e: FsaEstablishment): string | undefined {
  const parts = [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
  return parts.length ? parts.join(", ") : undefined
}

async function fsaFetch(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(FSA_API_BASE + path)
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)

  const response = await fetch(url, { headers: FSA_HEADERS, cache: "no-store" })
  if (!response.ok) {
    throw new Error(`FSA request failed with status ${response.status}`)
  }
  return response.json()
}

/** Search FSA establishments by name, optionally constrained by coordinates. */
async function searchEstablishments(
  name: string,
  latitude?: number,
  longitude?: number,
): Promise<FsaEstablishment[]> {
  const params: Record<string, string> = { name, pageSize: "30" }
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = String(latitude)
    params.longitude = String(longitude)
    // Miles - the FSA API's unit for this parameter.
    params.maxDistanceLimit = "1"
  }
  const json = (await fsaFetch("/Establishments", params)) as {
    establishments?: FsaEstablishment[]
  } | null
  return json?.establishments ?? []
}

/** Fetch one establishment by its stable FSA id (used for cheap refreshes). */
async function getEstablishmentById(fhrsId: number): Promise<FsaEstablishment | null> {
  try {
    const json = (await fsaFetch(`/Establishments/${fhrsId}`)) as FsaEstablishment | null
    return json && json.FHRSID ? json : null
  } catch {
    return null
  }
}

// --- Candidate scoring ------------------------------------------------------

interface ScoredCandidate {
  establishment: FsaEstablishment
  nameScore: number
  postcode: PostcodeAgreement
  distanceMeters?: number
  /** Tier this candidate qualifies for on its own merits, if any. */
  tier: FsaMatchConfidence | null
  /** Combined score used only to rank and to detect ties. */
  rank: number
}

function scoreCandidate(
  business: { name: string; postcode?: string | null; lat?: number; lng?: number },
  establishment: FsaEstablishment,
): ScoredCandidate {
  const nameScore = nameSimilarity(business.name, establishment.BusinessName)
  const postcode = comparePostcodes(business.postcode, establishment.PostCode)

  const fsaLat = toNumber(establishment.geocode?.latitude)
  const fsaLng = toNumber(establishment.geocode?.longitude)
  const distanceMeters =
    business.lat !== undefined && business.lng !== undefined && fsaLat !== undefined && fsaLng !== undefined
      ? haversineMeters(business.lat, business.lng, fsaLat, fsaLng)
      : undefined

  let tier: FsaMatchConfidence | null = null

  // A contradictory postcode is a hard veto. This is the primary defence
  // against the Dishoom E1/E2 branch problem: even a perfect name match is
  // rejected when the postcodes place the venues in different districts.
  const postcodeConflict = postcode === "conflict"

  if (!postcodeConflict) {
    if (postcode === "full" && nameScore >= NAME_THRESHOLD_EXACT) {
      tier = "exact"
    } else if (postcode === "full" && nameScore >= NAME_THRESHOLD_WITH_POSTCODE) {
      tier = "high"
    } else if (
      postcode === "outward" &&
      nameScore >= NAME_THRESHOLD_EXACT &&
      distanceMeters !== undefined &&
      distanceMeters <= MAX_DISTANCE_OUTWARD_METERS
    ) {
      tier = "high"
    } else if (
      postcode === "unknown" &&
      nameScore >= NAME_THRESHOLD_WITH_DISTANCE &&
      distanceMeters !== undefined &&
      distanceMeters <= MAX_DISTANCE_METERS
    ) {
      // No postcode to corroborate with, so require a strong name AND very
      // tight physical proximity.
      tier = "high"
    }
  }

  // Ranking blends name similarity with corroborating evidence. Used only for
  // ordering and tie detection, never to grant a tier on its own.
  const postcodeBonus = postcode === "full" ? 0.3 : postcode === "outward" ? 0.1 : 0
  const distanceBonus =
    distanceMeters === undefined ? 0 : Math.max(0, 0.2 * (1 - Math.min(distanceMeters, 500) / 500))
  const rank = nameScore + postcodeBonus + distanceBonus

  return { establishment, nameScore, postcode, distanceMeters, tier, rank }
}

// --- Public matching API ----------------------------------------------------

export type FsaMatchStatus =
  | "match"
  | "no-name"
  | "no-candidates"
  | "ambiguous"
  | "below-threshold"
  | "error"

export interface FsaMatchResult {
  status: FsaMatchStatus
  rating?: FoodHygieneRating
  /** Populated for every non-match outcome so the operator can see WHY. */
  reason?: string
  /** Diagnostics for the match report - never rendered to end users. */
  diagnostics?: {
    candidatesConsidered: number
    bestName?: string
    bestNameScore?: number
    bestPostcode?: PostcodeAgreement
    bestDistanceMeters?: number
    runnerUpName?: string
    runnerUpRank?: number
  }
}

function toRating(candidate: ScoredCandidate, confidence: FsaMatchConfidence): FoodHygieneRating {
  const e = candidate.establishment
  return {
    fhrsId: e.FHRSID as number,
    businessName: e.BusinessName ?? "",
    businessType: e.BusinessType ?? undefined,
    address: formatAddress(e),
    postcode: e.PostCode ?? undefined,
    // RAW value, never coerced to a number - see hygiene-display.ts.
    ratingValue: e.RatingValue ?? "",
    ratingDate: e.RatingDate ?? undefined,
    localAuthority: e.LocalAuthorityName ?? undefined,
    schemeType: e.SchemeType ?? undefined,
    newRatingPending: e.NewRatingPending ?? false,
    latitude: toNumber(e.geocode?.latitude),
    longitude: toNumber(e.geocode?.longitude),
    matchConfidence: confidence,
    distanceMeters: candidate.distanceMeters,
    lastSyncedAt: new Date().toISOString(),
  }
}

/**
 * Match a business to an FSA establishment and build its hygiene rating.
 *
 * Returns `status: "match"` only when a single candidate is confidently the
 * right establishment. Every other outcome yields no rating, with a reason.
 */
export async function matchFsaHygiene(business: Business): Promise<FsaMatchResult> {
  const name = business.name?.trim()
  if (!name) return { status: "no-name", reason: "Business has no name to match on" }

  const postcode = resolveBusinessPostcode(business)
  const lat = business.location?.coordinates?.lat
  const lng = business.location?.coordinates?.lng

  let establishments: FsaEstablishment[]
  try {
    // Gather candidates from BOTH a coordinate-constrained search and a
    // name-only search, then de-duplicate by FSA id.
    //
    // Doing only the coordinate search is actively unsafe: a live probe showed
    // that searching "Dishoom" near Shoreditch returned ONLY the E2 "Dishoom
    // Bombay Cafe" branch and omitted the E1 "Dishoom" establishment. With a
    // single-source candidate list the correct branch is never even considered,
    // so the matcher can only either reject (losing real coverage) or, worse,
    // settle on the one wrong branch it was shown. Merging both searches means
    // postcode and distance get to arbitrate over the full candidate pool.
    const searches = [searchEstablishments(name)]
    if (lat !== undefined && lng !== undefined) {
      searches.push(searchEstablishments(name, lat, lng))
    }
    const results = await Promise.all(searches)

    const byId = new Map<number, FsaEstablishment>()
    for (const list of results) {
      for (const e of list) {
        if (e.FHRSID !== undefined && !byId.has(e.FHRSID)) byId.set(e.FHRSID, e)
      }
    }
    establishments = [...byId.values()]
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : "Unknown FSA error" }
  }

  const usable = establishments.filter((e) => e.FHRSID !== undefined && e.RatingValue)
  if (usable.length === 0) {
    return {
      status: "no-candidates",
      reason: `FSA returned no rated establishments for "${name}"`,
      diagnostics: { candidatesConsidered: 0 },
    }
  }

  const scored = usable
    .map((e) => scoreCandidate({ name, postcode, lat, lng }, e))
    .sort((a, b) => b.rank - a.rank)

  const best = scored[0]
  const diagnostics = {
    candidatesConsidered: scored.length,
    bestName: best.establishment.BusinessName,
    bestNameScore: Number(best.nameScore.toFixed(3)),
    bestPostcode: best.postcode,
    bestDistanceMeters:
      best.distanceMeters === undefined ? undefined : Math.round(best.distanceMeters),
    runnerUpName: scored[1]?.establishment.BusinessName,
    runnerUpRank: scored[1] ? Number(scored[1].rank.toFixed(3)) : undefined,
  }

  if (!best.tier) {
    return {
      status: "below-threshold",
      reason:
        `Best candidate "${best.establishment.BusinessName}" scored ${best.nameScore.toFixed(2)} ` +
        `with postcode agreement "${best.postcode}" - below the confidence threshold`,
      diagnostics,
    }
  }

  // Branch-confusion guard: if another candidate ALSO qualifies and ranks
  // within the ambiguity margin, we cannot tell the branches apart. Reject.
  const rival = scored[1]
  if (rival?.tier && best.rank - rival.rank < AMBIGUITY_MARGIN) {
    return {
      status: "ambiguous",
      reason:
        `Cannot distinguish "${best.establishment.BusinessName}" (${best.establishment.PostCode}) ` +
        `from "${rival.establishment.BusinessName}" (${rival.establishment.PostCode}) - ` +
        `both qualify and rank within ${AMBIGUITY_MARGIN}`,
      diagnostics,
    }
  }

  return { status: "match", rating: toRating(best, best.tier), diagnostics }
}

/**
 * Refresh an already-matched establishment by its FSA id.
 *
 * This deliberately skips matching entirely - the establishment was already
 * confidently identified, so re-running fuzzy matching could only introduce
 * error. The stored confidence and distance are preserved.
 */
export async function refreshFsaHygiene(
  existing: FoodHygieneRating,
): Promise<FoodHygieneRating | null> {
  const e = await getEstablishmentById(existing.fhrsId)
  if (!e || !e.RatingValue) return null

  return {
    ...existing,
    businessName: e.BusinessName ?? existing.businessName,
    businessType: e.BusinessType ?? existing.businessType,
    address: formatAddress(e) ?? existing.address,
    postcode: e.PostCode ?? existing.postcode,
    ratingValue: e.RatingValue,
    ratingDate: e.RatingDate ?? existing.ratingDate,
    localAuthority: e.LocalAuthorityName ?? existing.localAuthority,
    schemeType: e.SchemeType ?? existing.schemeType,
    newRatingPending: e.NewRatingPending ?? false,
    latitude: toNumber(e.geocode?.latitude) ?? existing.latitude,
    longitude: toNumber(e.geocode?.longitude) ?? existing.longitude,
    lastSyncedAt: new Date().toISOString(),
  }
}
