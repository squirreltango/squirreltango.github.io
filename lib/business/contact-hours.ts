import type { Business, OpeningHours } from "@/lib/types/business"

/**
 * Presentation helpers for the detail page's Opening Hours, Contact and Website
 * rows. Every function is derived strictly from data Google actually returned -
 * a missing value always yields `undefined` so the caller can hide the row
 * rather than render a placeholder.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

/** Today's index in Google's 0=Sunday convention. */
export function getTodayIndex(): number {
  return new Date().getDay()
}

/** Opening hours ordered Monday-first, which is how UK users read a week. */
export function getWeekOrderedHours(business: Business): OpeningHours[] {
  const hours = business.openingHours ?? []
  if (hours.length === 0) return []
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order
    .map((day) => hours.find((entry) => entry.day === day))
    .filter((entry): entry is OpeningHours => Boolean(entry))
}

export function getTodayHours(business: Business): OpeningHours | undefined {
  return business.openingHours?.find((entry) => entry.day === getTodayIndex())
}

/** "6:00 AM - 12:00 AM", "Closed", or undefined when Google gave us nothing. */
export function formatHoursRange(entry: OpeningHours | undefined): string | undefined {
  if (!entry) return undefined
  if (entry.closed) return "Closed"
  if (entry.open === "00:00" && entry.close === "23:59") return "Open 24 hours"
  if (entry.open && entry.close) return `${entry.open} - ${entry.close}`
  if (entry.open) return `From ${entry.open}`
  return undefined
}

/**
 * Concise preview for the collapsed row, e.g. "Open today - 6:00 AM - 12:00 AM".
 * Returns undefined when the business has no opening hours at all.
 */
export function describeTodayHours(business: Business): string | undefined {
  const today = getTodayHours(business)
  const range = formatHoursRange(today)

  if (today?.closed) return `Closed today (${DAY_NAMES[today.day]})`
  if (range) return `Open today - ${range}`
  if ((business.openingHours ?? []).length > 0) return "See opening hours"
  return undefined
}

/** Convert "6:00 AM", "18:30" or "12:00 AM" into minutes past midnight. */
function parseTimeToMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!match) return undefined

  let hours = Number(match[1])
  const minutes = Number(match[2] ?? "0")
  const meridiem = match[3]?.toUpperCase()

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined

  if (meridiem === "AM") hours = hours === 12 ? 0 : hours
  if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12

  if (hours > 24 || minutes > 59) return undefined
  return hours * 60 + minutes
}

export type OpenState = "open" | "closing-soon" | "closed"

/**
 * Current open/closed status.
 *
 * Anchored on Google's own `open_now` flag - we never infer "open" ourselves.
 * "closing-soon" is only reported when Google says the venue is open AND its
 * genuine closing time is within the next hour. Returns undefined when Google
 * did not tell us whether the venue is open.
 */
export function getOpenState(business: Business): OpenState | undefined {
  if (typeof business.openNow !== "boolean") return undefined
  if (!business.openNow) return "closed"

  const today = getTodayHours(business)
  const close = parseTimeToMinutes(today?.close)
  if (close === undefined || today?.closed) return "open"

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  // Venues closing after midnight wrap past 24:00.
  const open = parseTimeToMinutes(today?.open)
  const normalisedClose = open !== undefined && close <= open ? close + 24 * 60 : close
  const minutesLeft = normalisedClose - nowMinutes

  if (minutesLeft > 0 && minutesLeft <= 60) return "closing-soon"
  return "open"
}

export function getOpenStateLabel(state: OpenState): string {
  if (state === "open") return "Open now"
  if (state === "closing-soon") return "Closing soon"
  return "Closed"
}

/**
 * A `tel:` href built from Google's real phone number. Keeps a leading "+" and
 * digits only so the OS dialler can handle it; returns undefined when there is
 * no number to call.
 */
export function toTelHref(phone: string | undefined): string | undefined {
  if (!phone) return undefined
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return undefined
  return `tel:${hasPlus ? "+" : ""}${digits}`
}

/**
 * A tidy display label for a website, e.g. "creativewellness.co.uk". The full
 * original URL is always what gets linked - this only affects what we show.
 */
export function formatWebsiteLabel(website: string | undefined): string | undefined {
  if (!website) return undefined
  const trimmed = website.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./i, "")
    const path = url.pathname.replace(/\/$/, "")
    return `${host}${path}`
  } catch {
    // Not a parseable absolute URL - strip the obvious noise instead.
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/$/, "")
  }
}

/**
 * An absolute, safe href for an external website. Only http(s) is allowed so a
 * hostile value can never produce a `javascript:` link.
 */
export function toWebsiteHref(website: string | undefined): string | undefined {
  if (!website) return undefined
  const trimmed = website.trim()
  if (!trimmed) return undefined

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}
