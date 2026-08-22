import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyAdminRequest } from "@/lib/admin-auth"
import { isTrustpilotEnabled, matchTrustpilot } from "@/lib/business/trustpilot"
import { mapSupabaseRowToBusiness, type BusinessRow } from "@/lib/supabase/businesses"
import type { TrustpilotRating } from "@/lib/types/business"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Default test batch size. Requirement: start small (~20) and review matches
// before enriching everything.
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 200

// Trustpilot data is cached in Supabase; only refresh when older than this.
const DEFAULT_REFRESH_HOURS = 24

interface EnrichBody {
  limit?: number
  dryRun?: boolean
  force?: boolean
  refreshHours?: number
}

function isFresh(existing: TrustpilotRating | undefined, refreshHours: number): boolean {
  if (!existing?.lastSyncedAt) return false
  const syncedAt = new Date(existing.lastSyncedAt).getTime()
  if (Number.isNaN(syncedAt)) return false
  return Date.now() - syncedAt < refreshHours * 60 * 60 * 1000
}

export async function POST(request: NextRequest) {
  // 1. Protect the endpoint with the admin ingestion secret.
  const auth = verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // 2. Degrade gracefully when Trustpilot is not configured.
  if (!isTrustpilotEnabled()) {
    return NextResponse.json({
      enabled: false,
      message:
        "Trustpilot enrichment is disabled because TRUSTPILOT_API_KEY is not configured. " +
        "The rest of the app is unaffected.",
    })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Row-level security blocks writes " +
          "with the public anon key, so enrichment needs the service-role key.",
      },
      { status: 500 },
    )
  }

  let body: EnrichBody = {}
  try {
    body = (await request.json()) as EnrichBody
  } catch {
    // No body - use defaults.
  }

  const { searchParams } = new URL(request.url)
  const dryRun = body.dryRun ?? searchParams.get("dryRun") === "true"
  const force = body.force ?? searchParams.get("force") === "true"
  const limitParam = body.limit ?? (Number(searchParams.get("limit")) || DEFAULT_LIMIT)
  const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT)
  const refreshHours = body.refreshHours ?? DEFAULT_REFRESH_HOURS

  // 3. Read the test batch of businesses. We keep the batch small and only
  // touch the columns we need. Existing curated data is never read for
  // deletion or overwrite - we only merge into `provider_ratings`.
  const { data: rows, error: readError } = await supabase
    .from("businesses")
    .select("id, name, contact, provider_ratings")
    .limit(limit)

  if (readError) {
    return NextResponse.json(
      { error: `Could not read businesses: ${readError.message}` },
      { status: 500 },
    )
  }

  const report = {
    checked: 0,
    domainsAvailable: 0,
    profilesFound: 0,
    confidentMatches: 0,
    noMatches: 0,
    ambiguousMatches: 0,
    recordsUpdated: 0,
    skippedFresh: 0,
    apiFailures: 0,
  }

  const matches: Array<Record<string, unknown>> = []
  const ambiguous: Array<Record<string, unknown>> = []
  const failures: Array<Record<string, unknown>> = []

  for (const row of (rows ?? []) as BusinessRow[]) {
    report.checked++

    const business = mapSupabaseRowToBusiness(row)
    const existingProviderRatings =
      (row.provider_ratings && typeof row.provider_ratings === "object"
        ? (row.provider_ratings as Record<string, unknown>)
        : {}) ?? {}
    const existingTrustpilot = existingProviderRatings.trustpilot as TrustpilotRating | undefined

    const result = await matchTrustpilot(business)

    if (result.status === "no-domain") {
      continue
    }

    report.domainsAvailable++

    if (result.status === "error") {
      report.apiFailures++
      failures.push({ id: business.id, name: business.name, domain: result.domain, reason: result.reason })
      continue
    }

    if (result.status === "no-profile") {
      report.noMatches++
      continue
    }

    if (result.status === "ambiguous") {
      report.profilesFound++
      report.ambiguousMatches++
      ambiguous.push({
        id: business.id,
        name: business.name,
        domain: result.domain,
        confidence: result.confidence,
        reason: result.reason,
      })
      continue
    }

    // status === "match"
    report.profilesFound++
    report.confidentMatches++

    const enrichment = result.enrichment as TrustpilotRating
    matches.push({
      id: business.id,
      name: business.name,
      domain: result.domain,
      businessUnitId: enrichment.businessUnitId,
      trustScore: enrichment.trustScore,
      stars: enrichment.stars,
      reviewCount: enrichment.reviewCount,
      profileUrl: enrichment.profileUrl,
      confidence: enrichment.matchConfidence,
    })

    // Respect the refresh window unless forced.
    if (!force && isFresh(existingTrustpilot, refreshHours)) {
      report.skippedFresh++
      continue
    }

    if (dryRun) {
      continue
    }

    // 4. Merge Trustpilot into provider_ratings, preserving every existing key
    // (Google data lives in separate flat columns and is never touched).
    const nextProviderRatings = { ...existingProviderRatings, trustpilot: enrichment }

    const { error: updateError } = await supabase
      .from("businesses")
      .update({ provider_ratings: nextProviderRatings, updated_at: new Date().toISOString() })
      .eq("id", business.id)

    if (updateError) {
      report.apiFailures++
      failures.push({ id: business.id, name: business.name, reason: `Update failed: ${updateError.message}` })
      continue
    }

    report.recordsUpdated++
  }

  return NextResponse.json({
    enabled: true,
    dryRun,
    limit,
    refreshHours,
    report,
    matches,
    ambiguous,
    failures,
  })
}
