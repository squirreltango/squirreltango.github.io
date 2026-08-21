import type { NextRequest } from "next/server"
import { verifyAdminRequest } from "@/lib/admin-auth"
import { fetchLiveBusinesses } from "@/lib/business/places-search"
import { fetchPlaceDetails, getFieldMask } from "@/lib/business/place-details"
import { readCachedDetails, writeCachedDetails, isFresh } from "@/lib/business/google-details-cache"
import type { Business } from "@/lib/types/business"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 60

// The Atmosphere SKU applies to the fields we request; surfaced in the report.
const SKU = "Place Details Enterprise + Atmosphere"
const SKU_PRICE_PER_1000_USD = 25

interface EnrichBody {
  limit?: number
  force?: boolean
  dryRun?: boolean
}

/**
 * Pick up to `limit` businesses spread across categories so the test batch
 * covers different kinds of venue rather than 25 restaurants.
 */
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
  // Protected by the admin secret. In non-production we allow a clearly-logged
  // bypass so the enrichment test batch can be run in the preview; a WRONG
  // secret is always rejected.
  const auth = verifyAdminRequest(request)
  if (!auth.ok) {
    const isProd = process.env.NODE_ENV === "production"
    if (auth.status === 401 || isProd) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }
    console.warn("[v0] enrich-google-details: running with dev bypass (no ADMIN_INGEST_SECRET set)")
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return Response.json({ error: "GOOGLE_PLACES_API_KEY is not configured." }, { status: 503 })
  }

  let body: EnrichBody = {}
  try {
    body = (await request.json()) as EnrichBody
  } catch {
    // empty body is fine; use defaults
  }

  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const force = body.force === true
  const dryRun = body.dryRun === true

  // Live businesses come from Text Search (already in-process cached, so this
  // adds no Place Details cost). Each carries a Google place id.
  const live = await fetchLiveBusinesses()
  const candidates = selectAcrossCategories(live, limit)

  const placeIds = candidates
    .map((b) => b.externalIds?.googlePlaceId ?? b.id)
    .filter((id): id is string => Boolean(id))

  // Skip anything already fresh (<7 days) unless force is set.
  const existing = await readCachedDetails(placeIds)

  const report = {
    sku: SKU,
    skuPricePer1000Usd: SKU_PRICE_PER_1000_USD,
    fieldMask: getFieldMask(),
    dryRun,
    force,
    checked: candidates.length,
    skippedFresh: 0,
    placeDetailsApiCalls: 0,
    enriched: 0,
    withAmenities: 0,
    withEditorialSummary: 0,
    noAdditionalData: 0,
    durableWrites: 0,
    memoryOnlyWrites: 0,
    errors: [] as { name: string; placeId: string; error: string }[],
    samples: [] as {
      name: string
      category: string
      amenities?: string[]
      editorialSummary?: string
    }[],
  }

  for (const business of candidates) {
    const placeId = business.externalIds?.googlePlaceId ?? business.id
    if (!placeId) continue

    if (!force && isFresh(existing.get(placeId))) {
      report.skippedFresh += 1
      continue
    }

    const result = await fetchPlaceDetails(placeId, apiKey)
    report.placeDetailsApiCalls += 1

    if (!result.ok || !result.googleDetails) {
      report.errors.push({ name: business.name, placeId, error: result.error ?? `HTTP ${result.status}` })
      continue
    }

    report.enriched += 1
    if (result.hasAmenities) report.withAmenities += 1
    if (result.hasEditorialSummary) report.withEditorialSummary += 1
    if (!result.hasAmenities && !result.hasEditorialSummary) report.noAdditionalData += 1

    // Collect a small sample for the report (first 8 enriched).
    if (report.samples.length < 8) {
      report.samples.push({
        name: business.name,
        category: business.category,
        amenities: result.googleDetails.amenities
          ? Object.entries(result.googleDetails.amenities)
              .filter(([, v]) => v === true)
              .map(([k]) => k)
          : undefined,
        editorialSummary: result.googleDetails.editorialSummary,
      })
    }

    if (!dryRun) {
      const write = await writeCachedDetails(placeId, result.googleDetails)
      if (write.durable) report.durableWrites += 1
      else report.memoryOnlyWrites += 1
      if (!write.ok || !write.durable) {
        // Not an error per se (memory write still succeeded), but surface the
        // reason once so the operator knows the migration/keys state.
        if (write.reason && !report.errors.some((e) => e.error === write.reason)) {
          report.errors.push({ name: business.name, placeId, error: write.reason })
        }
      }
    }
  }

  // Estimated cost of this batch and of scaling to 100 businesses.
  const estimate = {
    thisBatchUsd: Number(((report.placeDetailsApiCalls / 1000) * SKU_PRICE_PER_1000_USD).toFixed(4)),
    per100BusinessesUsd: Number(((100 / 1000) * SKU_PRICE_PER_1000_USD).toFixed(4)),
    note: "One Place Details call per business per 7-day window. Cached results serve for free until they expire.",
  }

  return Response.json({ report, estimate })
}
