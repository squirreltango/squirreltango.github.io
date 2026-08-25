import type { FoodHygieneRating } from "@/lib/types/business"

/**
 * Pure, client-safe formatting for official FSA hygiene ratings.
 *
 * Deliberately separate from `fsa-hygiene.ts` (which performs server-side
 * fetching and reads env vars) so client components can import display logic
 * without pulling the API client into the browser bundle.
 *
 * The central problem this solves: the UK runs TWO different hygiene schemes
 * and neither is safely representable as a bare "X/5" number.
 *
 *   FHRS (England, Wales, Northern Ireland) -> "0".."5"
 *   FHIS (Scotland)                          -> "Pass" / "Improvement Required"
 *
 * Both schemes can additionally return "AwaitingInspection", "Awaiting
 * Publication", or "Exempt". Rendering "Pass" as a score, or "Exempt" as 0/5,
 * would actively misinform the user - so every non-numeric value gets its own
 * presentation instead of being coerced.
 */

export type HygieneDisplay =
  | {
      kind: "numeric"
      /** Parsed 0-5 score. Only ever set for the FHRS scheme. */
      value: number
      max: 5
      /** e.g. "5" */
      label: string
      /** FSA's official wording for that score, e.g. "Very good". */
      descriptor: string
      /** Overall sentiment, for colour choices only - never invents meaning. */
      tone: "good" | "mixed" | "poor"
    }
  | {
      kind: "status"
      /** e.g. "Pass" - Scotland's FHIS scheme has no numeric score. */
      label: string
      descriptor: string
      tone: "good" | "mixed" | "poor"
    }
  | {
      kind: "pending"
      label: string
      descriptor: string
    }
  | {
      kind: "exempt"
      label: string
      descriptor: string
    }

/** FSA's own published wording for each FHRS score. Not paraphrased. */
const FHRS_DESCRIPTORS: Record<number, { descriptor: string; tone: "good" | "mixed" | "poor" }> = {
  5: { descriptor: "Very good", tone: "good" },
  4: { descriptor: "Good", tone: "good" },
  3: { descriptor: "Generally satisfactory", tone: "mixed" },
  2: { descriptor: "Improvement necessary", tone: "poor" },
  1: { descriptor: "Major improvement necessary", tone: "poor" },
  0: { descriptor: "Urgent improvement necessary", tone: "poor" },
}

/** Normalise for comparison: FSA is inconsistent about spaces and casing. */
function canonical(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

/**
 * Convert a raw FSA rating value into something safe to render.
 *
 * Returns null when the value is empty or unrecognised. Callers MUST treat
 * null as "render nothing" rather than substituting a default, so an
 * unfamiliar future scheme value can never be shown as a misleading score.
 */
export function describeHygieneRating(rating: FoodHygieneRating | undefined | null): HygieneDisplay | null {
  const raw = rating?.ratingValue?.trim()
  if (!raw) return null

  const key = canonical(raw)

  // Awaiting inspection / publication - a real FSA state, not a bad score.
  if (key === "awaitinginspection" || key === "awaitingpublication" || key === "awaitinginspectionandpublication") {
    return {
      kind: "pending",
      label: "Awaiting inspection",
      descriptor: "This venue has not been given a hygiene rating yet",
    }
  }

  // Exempt - e.g. low-risk premises. Explicitly NOT a zero score.
  if (key === "exempt") {
    return {
      kind: "exempt",
      label: "Exempt",
      descriptor: "This venue is exempt from hygiene rating inspection",
    }
  }

  // FHIS (Scotland) - pass/improvement, no numeric equivalent exists.
  if (key === "pass") {
    return {
      kind: "status",
      label: "Pass",
      descriptor: "Met hygiene standards at the last inspection",
      tone: "good",
    }
  }
  if (key === "passandeatsafe" || key === "passeatsafe") {
    return {
      kind: "status",
      label: "Pass and Eat Safe",
      descriptor: "Exceeded hygiene standards at the last inspection",
      tone: "good",
    }
  }
  if (key === "improvementrequired") {
    return {
      kind: "status",
      label: "Improvement required",
      descriptor: "Did not meet hygiene standards at the last inspection",
      tone: "poor",
    }
  }

  // FHRS (England/Wales/NI) - the only genuinely numeric scheme.
  if (/^[0-5]$/.test(key)) {
    const value = Number(key)
    const meta = FHRS_DESCRIPTORS[value]
    return {
      kind: "numeric",
      value,
      max: 5,
      label: key,
      descriptor: meta.descriptor,
      tone: meta.tone,
    }
  }

  // Unrecognised - return null rather than guessing at a meaning.
  return null
}

/** True when the value is a numeric FHRS score, i.e. "X out of 5" is valid. */
export function isNumericScheme(rating: FoodHygieneRating | undefined | null): boolean {
  return describeHygieneRating(rating)?.kind === "numeric"
}

/**
 * Short attribution line. Always names the FSA so the rating is never mistaken
 * for a LookMeUp or Google score.
 */
export function hygieneAttribution(rating: FoodHygieneRating): string {
  const authority = rating.localAuthority?.trim()
  return authority ? `Food Standards Agency - ${authority}` : "Food Standards Agency"
}

/** Human-readable inspection date, or null when FSA gave none. */
export function formatInspectionDate(rating: FoodHygieneRating): string | null {
  const raw = rating.ratingDate?.trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * The canonical public FSA page for an establishment, so users can verify the
 * rating at source. Uses only the documented public URL shape.
 */
export function fsaEstablishmentUrl(rating: FoodHygieneRating): string {
  return `https://ratings.food.gov.uk/business/${rating.fhrsId}`
}
