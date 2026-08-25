import { ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Business, FoodHygieneRating } from "@/lib/types/business"
import { getVerifiedHygieneRating } from "@/lib/business/provenance"
import {
  describeHygieneRating,
  hygieneAttribution,
  formatInspectionDate,
  fsaEstablishmentUrl,
  type HygieneDisplay,
} from "@/lib/business/hygiene-display"

/**
 * Scheme-aware presentation of an official FSA hygiene rating.
 *
 * Every hygiene rating in the app renders through this component so the
 * scheme-handling rules live in exactly one place. The critical rule: only the
 * FHRS scheme is numeric, so "/5" is appended ONLY for `kind === "numeric"`.
 * Scotland's FHIS returns "Pass", and both schemes can return
 * "AwaitingInspection" or "Exempt" - rendering any of those as a score would
 * fabricate a food-safety claim.
 */

/** Tone -> colour mapping. Pending/exempt are deliberately neutral, not "bad". */
const TONE = {
  good: {
    iconWrap: "bg-emerald-100",
    icon: "text-emerald-600",
    value: "text-emerald-700",
    panel: "bg-emerald-50/50 border-emerald-200/50",
    pill: "bg-emerald-100 text-emerald-700",
  },
  mixed: {
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
    value: "text-amber-700",
    panel: "bg-amber-50/50 border-amber-200/50",
    pill: "bg-amber-100 text-amber-700",
  },
  poor: {
    iconWrap: "bg-red-100",
    icon: "text-red-600",
    value: "text-red-700",
    panel: "bg-red-50/50 border-red-200/50",
    pill: "bg-red-100 text-red-700",
  },
  neutral: {
    iconWrap: "bg-secondary",
    icon: "text-muted-foreground",
    value: "text-foreground",
    panel: "bg-secondary/30 border-border/50",
    pill: "bg-secondary text-muted-foreground",
  },
} as const

function toneFor(display: HygieneDisplay): keyof typeof TONE {
  if (display.kind === "pending" || display.kind === "exempt") return "neutral"
  return display.tone
}

function IconFor({ display, className }: { display: HygieneDisplay; className?: string }) {
  if (display.kind === "pending" || display.kind === "exempt") {
    return <ShieldQuestion className={className} aria-hidden="true" />
  }
  const tone = toneFor(display)
  return tone === "poor" ? (
    <ShieldAlert className={className} aria-hidden="true" />
  ) : (
    <ShieldCheck className={className} aria-hidden="true" />
  )
}

/**
 * Accessible sentence describing the rating. Screen readers get the scheme
 * spelled out rather than a bare number, which on its own is meaningless.
 */
function screenReaderLabel(display: HygieneDisplay, rating: FoodHygieneRating): string {
  const source = hygieneAttribution(rating)
  switch (display.kind) {
    case "numeric":
      return `Food hygiene rating ${display.value} out of ${display.max} - ${display.descriptor}. Source: ${source}.`
    case "status":
      return `Food hygiene inspection result: ${display.label} - ${display.descriptor}. Source: ${source}.`
    default:
      return `Food hygiene: ${display.label}. ${display.descriptor}. Source: ${source}.`
  }
}

/**
 * Compact form for the business card grid and map popups. Deliberately terse -
 * the label reads "Hygiene / FSA" so it is never mistaken for a Google score.
 */
export function HygieneBadgeCompact({ business, className }: { business: Business; className?: string }) {
  const rating = getVerifiedHygieneRating(business)
  if (!rating) return null

  const display = describeHygieneRating(rating)
  if (!display) return null

  const tone = TONE[toneFor(display)]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shadow-sm shrink-0", tone.iconWrap)}>
        <IconFor display={display} className={cn("h-3.5 w-3.5", tone.icon)} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn("text-sm font-semibold truncate", tone.value)}>
          {/* "/5" ONLY for the numeric FHRS scheme. Short form elsewhere, since
              the card column is narrow enough to clip the full wording. */}
          {display.kind === "numeric" ? `${display.label}/${display.max}` : display.shortLabel}
        </span>
        <span className="text-xs text-muted-foreground truncate">Hygiene &middot; FSA</span>
      </div>
      <span className="sr-only">{screenReaderLabel(display, rating)}</span>
    </div>
  )
}

/**
 * Pill form for map popups, matching the surrounding provider pills there.
 * Same scheme-aware rules as the other variants.
 */
export function HygieneBadgePill({ business, className }: { business: Business; className?: string }) {
  const rating = getVerifiedHygieneRating(business)
  if (!rating) return null

  const display = describeHygieneRating(rating)
  if (!display) return null

  const tone = toneFor(display)
  const pillBg =
    tone === "good" ? "bg-emerald-50" : tone === "mixed" ? "bg-amber-50" : tone === "poor" ? "bg-red-50" : "bg-secondary/40"

  return (
    <div className={cn("flex items-center gap-2 p-2 rounded-xl", pillBg, className)}>
      <IconFor display={display} className={cn("h-4 w-4 shrink-0", TONE[tone].icon)} />
      <span className={cn("text-sm font-semibold truncate", TONE[tone].value)}>
        {/* Whole-word short forms in the narrow pill - never a mid-word clip. */}
        {display.kind === "numeric" ? `${display.label}/${display.max}` : display.shortLabel}
      </span>
      <span className="sr-only">{screenReaderLabel(display, rating)}</span>
    </div>
  )
}

/**
 * Full panel for the business detail page. Carries the things that make a
 * food-safety claim verifiable: the FSA attribution, the inspection date, and
 * a link to the source record.
 */
export function HygieneBadgeDetail({ business, className }: { business: Business; className?: string }) {
  const rating = getVerifiedHygieneRating(business)
  if (!rating) return null

  const display = describeHygieneRating(rating)
  if (!display) return null

  const tone = TONE[toneFor(display)]
  // An inspection date is meaningless - and actively contradictory - for a
  // venue that is awaiting inspection or exempt. The FSA can still return a
  // date on those records, so suppress it rather than print "Awaiting
  // inspection - Inspected 11 June 2024".
  const inspected =
    display.kind === "numeric" || display.kind === "status" ? formatInspectionDate(rating) : null

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-2xl border transition-all duration-300 hover:shadow-sm",
        tone.panel,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", tone.iconWrap)}>
          <IconFor display={display} className={cn("h-4 w-4", tone.icon)} />
        </div>
        <span className="text-sm font-medium text-foreground">Food Hygiene</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-lg font-bold", tone.value)}>
          {display.kind === "numeric" ? `${display.label}/${display.max}` : display.label}
        </span>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", tone.pill)}>{display.descriptor}</span>
      </div>

      {/* A re-inspection has happened but the new rating is not yet published. */}
      {rating.newRatingPending && (
        <p className="text-xs text-muted-foreground">A new rating is awaiting publication.</p>
      )}

      {/* Attribution and verifiable source. Named explicitly so the rating is
          never read as a LookMeUp or Google score. */}
      <div className="flex flex-col gap-1 pt-1">
        <span className="text-xs text-muted-foreground">
          {hygieneAttribution(rating)}
          {inspected ? ` \u00b7 Inspected ${inspected}` : ""}
        </span>
        <a
          href={fsaEstablishmentUrl(rating)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline w-fit"
        >
          View on the FSA register
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>

      {/* Transparency for non-exact matches: show which FSA establishment this
          rating actually came from, so a user can spot a wrong-branch match. */}
      {rating.matchConfidence === "high" && rating.businessName && (
        <p className="text-xs text-muted-foreground pt-1 border-t border-border/40 mt-1">
          Matched to &ldquo;{rating.businessName}&rdquo;
          {rating.postcode ? `, ${rating.postcode}` : ""}
        </p>
      )}

      <span className="sr-only">{screenReaderLabel(display, rating)}</span>
    </div>
  )
}
