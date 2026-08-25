import type { NextRequest } from "next/server"
import { verifyAdminRequest } from "@/lib/admin-auth"
import { fetchLiveBusinesses } from "@/lib/business/places-search"
import { matchFsaHygiene, refreshFsaHygiene } from "@/lib/business/fsa-hygiene"
import {
  readCachedHygiene,
  writeCachedHygiene,
  isFsaRatingFresh,
} from "@/lib/business/fsa-hygiene-cache"
import { describeHygieneRating } from "@/lib/business/hygiene-display"
import type { Business, CategoryId } from "@/lib/types/business"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 60

/**
 * FSA hygiene enrichment job.
 *
 * The FSA API is free and unauthenticated, so unlike the Google Places job
 * there is no cost model to report. The valuable output here is the MATCH
 * REPORT: for every business we record whether a confident match was found
 * and, when it was not, exactly why. That makes the "when in doubt return
 * nothing" policy auditable rather than a silent gap.
 */

/**
 * Only food-serving categories are attempted.
 *
 * The FSA rates food businesses, so a gym or salon has no FSA record. Querying
 * them would burn requests and - worse - create the opportunity for a
 * coincidental name match against a nearby unrelated food business. Skipping
 * them by category removes that risk entirely.
 */
const FOOD_CATEGORIES = new Set<CategoryId>(["food", "cafes", "nightlife"] as CategoryId[])

interface EnrichBody {
  limit?: number
  force?: boolean
  dryRun?: boolean
  /**
   * Optional case-insensitive substring filter on business name, for targeted
   * verification of specific venues (e.g. auditing that a multi-branch chain
   * resolves to the right physical location). Narrows the candidate pool
   * before `limit` is applied; it does not bypass the freshness or
   * food-category rules.
   */
  names?: string[]
}

/** Spread the batch across categories rather than taking 10 restaurants. */
function selectAcrossCategories(businesses: Business[], limit: number): Business[] {
  const byCategory = new Map<string, Business[]>()
  for (const b of businesses) {
    const list = byCategory.get(b.category) ?? []
    list.push(b)
    byCategory.set(b.category, list)
  }

  const queues = [...byCategory.values()]
  const selected: Business[] = []
  let added = true
  while (selected.length < limit && added) {
    added = false
    for (const queue of queues) {
      if (queue.length === 0) continue
      const next = queue.shift()
      if (next) {
        selected.push(next)
        added = true
        if (selected.length >= limit) break
      }
    }
  }
  return selected
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) {
    const isProd = process.env.NODE_ENV === "production"
    if (auth.status === 401 || isProd) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }
    console.warn("[v0] enrich-fsa-hygiene: running with dev bypass (no ADMIN_INGEST_SECRET set)")
  }

  let body: EnrichBody = {}
  try {
    body = (await request.json()) as EnrichBody
  } catch {
    // empty body is fine
  }

  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const force = body.force === true
  const dryRun = body.dryRun === true

  const live = await fetchLiveBusinesses()

  const foodBusinesses = live.filter((b) => FOOD_CATEGORIES.has(b.category))
  const skippedNonFood = live.length - foodBusinesses.length

  // Read the cache for the whole food dataset up front so already-fresh rows
  // are excluded BEFORE `limit` is applied - otherwise repeated runs would
  // keep re-picking the same leading businesses and never advance.
  const allPlaceIds = foodBusinesses
    .map((b) => b.externalIds?.googlePlaceId ?? b.id)
    .filter((id): id is string => Boolean(id))
  const existing = await readCachedHygiene(allPlaceIds)

  const eligible = force
    ? foodBusinesses
    : foodBusinesses.filter(
        (b) => !isFsaRatingFresh(existing.get(b.externalIds?.googlePlaceId ?? b.id)),
      )
  const alreadyFresh = foodBusinesses.length - eligible.length

  // Targeted verification: when `names` is supplied, take those businesses in
  // dataset order rather than spreading across categories, so the audit
  // examines exactly the venues asked for.
  const nameFilters = (body.names ?? []).map((n) => n.toLowerCase()).filter(Boolean)
  const candidates =
    nameFilters.length > 0
      ? eligible
          .filter((b) => nameFilters.some((n) => b.name.toLowerCase().includes(n)))
          .slice(0, limit)
      : selectAcrossCategories(eligible, limit)

  const report = {
    source: "Food Standards Agency (api.ratings.food.gov.uk, x-api-version: 2)",
    cost: "Free - the FSA API is public and unauthenticated. No API key, no per-call charge.",
    dryRun,
    force,
    totalInDataset: live.length,
    foodBusinesses: foodBusinesses.length,
    skippedNonFood,
    checked: candidates.length,
    skippedFresh: alreadyFresh,
    remainingAfterThisRun: Math.max(eligible.length - candidates.length, 0),

    fsaApiCalls: 0,
    refreshedByFhrsId: 0,

    // Outcomes. `matched` is the only one that results in a stored rating.
    matched: 0,
    matchedExact: 0,
    matchedHigh: 0,
    rejectedAmbiguous: 0,
    rejectedBelowThreshold: 0,
    noCandidates: 0,
    errors: 0,

    durableWrites: 0,
    memoryOnlyWrites: 0,

    // How the matched ratings break down by scheme, proving Scotland's FHIS
    // values are preserved rather than coerced into a score.
    schemeBreakdown: {} as Record<string, number>,
    ratingValueBreakdown: {} as Record<string, number>,

    matches: [] as {
      business: string
      businessAddress?: string
      postcode?: string
      fsaName: string
      fsaAddress?: string
      fsaPostcode?: string
      fhrsId: number
      scheme: string
      rawRatingValue: string
      displayKind: string
      displayLabel: string
      confidence: string
      distanceMeters?: number
      localAuthority?: string
      /**
       * The concrete evidence behind this match, so a reviewer can audit the
       * branch-level decision rather than trusting the confidence label.
       */
      signals?: {
        nameScore?: number
        postcodeAgreement?: string
        distanceMeters?: number
        candidatesConsidered: number
        runnerUpName?: string
        runnerUpRank?: number
      }
      /** True only when the row reached Postgres, not just the memory cache. */
      persisted: boolean
    }[],

    // Every rejection with its reason - the audit trail for coverage gaps.
    rejections: [] as {
      business: string
      postcode?: string
      status: string
      reason?: string
      diagnostics?: unknown
    }[],
  }

  for (const business of candidates) {
    const placeId = business.externalIds?.googlePlaceId ?? business.id
    if (!placeId) continue

    const cached = existing.get(placeId)

    // Already matched: refresh by stable FSA id and skip matching entirely.
    // Re-running fuzzy matching on a known establishment could only introduce
    // error, so the original identification is preserved.
    if (cached && (force || !isFsaRatingFresh(cached))) {
      const refreshed = await refreshFsaHygiene(cached)
      report.fsaApiCalls += 1
      if (refreshed) {
        report.refreshedByFhrsId += 1
        if (!dryRun) {
          const write = await writeCachedHygiene(placeId, refreshed, business.id)
          if (write.durable) report.durableWrites += 1
          else report.memoryOnlyWrites += 1
        }
      }
      continue
    }

    const result = await matchFsaHygiene(business)
    report.fsaApiCalls += 1

    if (result.status !== "match" || !result.rating) {
      if (result.status === "ambiguous") report.rejectedAmbiguous += 1
      else if (result.status === "below-threshold") report.rejectedBelowThreshold += 1
      else if (result.status === "no-candidates") report.noCandidates += 1
      else report.errors += 1

      if (report.rejections.length < 40) {
        report.rejections.push({
          business: business.name,
          postcode: business.location?.postcode,
          status: result.status,
          reason: result.reason,
          diagnostics: result.diagnostics,
        })
      }
      continue
    }

    const rating = result.rating
    const display = describeHygieneRating(rating)

    report.matched += 1
    if (rating.matchConfidence === "exact") report.matchedExact += 1
    else report.matchedHigh += 1

    const scheme = rating.schemeType ?? "unknown"
    report.schemeBreakdown[scheme] = (report.schemeBreakdown[scheme] ?? 0) + 1
    report.ratingValueBreakdown[rating.ratingValue] =
      (report.ratingValueBreakdown[rating.ratingValue] ?? 0) + 1

    // Persist BEFORE recording the row so the report can state, per business,
    // whether the rating actually reached Postgres rather than only memory.
    let persisted = false
    if (!dryRun) {
      const write = await writeCachedHygiene(placeId, rating, business.id)
      if (write.durable) report.durableWrites += 1
      else report.memoryOnlyWrites += 1
      persisted = write.durable === true
      if (!write.ok || !write.durable) {
        if (write.reason && report.rejections.length < 40) {
          report.rejections.push({
            business: business.name,
            status: "write-warning",
            reason: write.reason,
          })
        }
      }
    }

    if (report.matches.length < 40) {
      const d = result.diagnostics
      report.matches.push({
        business: business.name,
        businessAddress: business.location?.address,
        postcode: business.location?.postcode,
        fsaName: rating.businessName,
        fsaAddress: rating.address,
        fsaPostcode: rating.postcode,
        fhrsId: rating.fhrsId,
        scheme: rating.schemeType ?? "unknown",
        rawRatingValue: rating.ratingValue,
        displayKind: display?.kind ?? "unrenderable",
        displayLabel: display?.label ?? "(nothing rendered)",
        confidence: rating.matchConfidence,
        distanceMeters:
          rating.distanceMeters === undefined ? undefined : Math.round(rating.distanceMeters),
        localAuthority: rating.localAuthority,
        signals: d
          ? {
              nameScore: d.bestNameScore,
              postcodeAgreement: d.bestPostcode,
              distanceMeters: d.bestDistanceMeters,
              candidatesConsidered: d.candidatesConsidered,
              runnerUpName: d.runnerUpName,
              runnerUpRank: d.runnerUpRank,
            }
          : undefined,
        persisted,
      })
    }
  }

  const matchRate =
    report.checked > 0 ? Number(((report.matched / report.checked) * 100).toFixed(1)) : 0

  return Response.json({
    report,
    summary: {
      matchRatePercent: matchRate,
      // Flat tallies, in the exact terms used to request this run.
      attempted: report.checked,
      matched: report.matched,
      unmatched:
        report.rejectedAmbiguous +
        report.rejectedBelowThreshold +
        report.noCandidates +
        report.errors,
      ambiguous: report.rejectedAmbiguous,
      durableWrites: report.durableWrites,
      memoryOnlyWrites: report.memoryOnlyWrites,
      errors: report.errors,
      note:
        "Unmatched businesses intentionally show no hygiene rating. A missing rating is always " +
        "preferable to one that might belong to a different branch of the same chain.",
    },
  })
}
