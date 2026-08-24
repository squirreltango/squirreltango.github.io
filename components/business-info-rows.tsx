"use client"

import { useState } from "react"
import { Clock, Phone, Globe, ChevronRight, ChevronDown, ExternalLink } from "lucide-react"
import type { Business } from "@/lib/types/business"
import {
  DAY_NAMES,
  describeTodayHours,
  formatHoursRange,
  formatWebsiteLabel,
  getOpenState,
  getOpenStateLabel,
  getTodayIndex,
  getWeekOrderedHours,
  toTelHref,
  toWebsiteHref,
} from "@/lib/business/contact-hours"
import { cn } from "@/lib/utils"

interface BusinessInfoRowsProps {
  business: Business
}

// Shared row chrome so hours/contact/website stay visually identical.
const rowClasses = cn(
  "w-full flex items-center gap-5 p-5 sm:p-6 text-left group",
  "transition-colors duration-300 hover:bg-secondary/30 active:bg-secondary/50",
)

const iconTileClasses = cn(
  "w-12 h-12 shrink-0 rounded-2xl bg-secondary/80 flex items-center justify-center",
  "transition-all duration-300 group-hover:bg-secondary group-hover:scale-105",
)

const iconClasses =
  "h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-foreground"

/**
 * The Opening Hours / Contact / Website rows on the business detail page.
 *
 * Each row is a genuine control: hours expand to the full Google week, contact
 * exposes a real `tel:` action, and website opens the real Google URL in a new
 * tab. Rows with no Google data are not rendered at all.
 */
export function BusinessInfoRows({ business }: BusinessInfoRowsProps) {
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [contactExpanded, setContactExpanded] = useState(false)

  const hoursPreview = describeTodayHours(business)
  const week = getWeekOrderedHours(business)
  const openState = getOpenState(business)
  const today = getTodayIndex()

  const phone = business.contact?.phone?.trim() || undefined
  const telHref = toTelHref(phone)
  const website = business.contact?.website
  const websiteHref = toWebsiteHref(website)
  const websiteLabel = formatWebsiteLabel(website)

  // Nothing genuine to show at all - render no section rather than empty rows.
  if (!hoursPreview && !telHref && !websiteHref) return null

  return (
    <div className="border-t border-border/60">
      <div className="divide-y divide-border/60">
        {/* ---- Opening hours (expandable) ---- */}
        {hoursPreview && (
          <div>
            <button
              type="button"
              onClick={() => setHoursExpanded((value) => !value)}
              aria-expanded={hoursExpanded}
              aria-controls="opening-hours-panel"
              className={rowClasses}
            >
              <div className={iconTileClasses}>
                <Clock className={iconClasses} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">Opening Hours</p>
                  {openState && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        openState === "open" && "bg-emerald-100 text-emerald-700",
                        openState === "closing-soon" && "bg-amber-100 text-amber-700",
                        openState === "closed" && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {getOpenStateLabel(openState)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{hoursPreview}</p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300",
                  "group-hover:text-foreground",
                  hoursExpanded && "rotate-180",
                )}
              />
            </button>

            {/* Full Google week. Uses a grid-rows transition so the expand and
                collapse are both animated. */}
            <div
              id="opening-hours-panel"
              className={cn(
                "grid transition-all duration-300 ease-out",
                hoursExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                {week.length > 0 ? (
                  <ul className="px-5 sm:px-6 pb-5 sm:pb-6 pl-[4.25rem] sm:pl-[5.25rem] flex flex-col gap-1">
                    {week.map((entry) => {
                      const isToday = entry.day === today
                      return (
                        <li
                          key={entry.day}
                          className={cn(
                            "flex items-center justify-between gap-4 py-2 px-3 rounded-xl text-sm",
                            isToday
                              ? "bg-secondary/70 font-semibold text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {DAY_NAMES[entry.day]}
                            {isToday && (
                              <span className="text-xs font-medium text-muted-foreground">
                                Today
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums">
                            {formatHoursRange(entry) ?? "Hours not available"}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="px-5 sm:px-6 pb-5 sm:pb-6 pl-[4.25rem] sm:pl-[5.25rem] text-sm text-muted-foreground">
                    Google does not list a full weekly schedule for this business.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Contact (expands to a real call action) ---- */}
        {telHref && phone && (
          <div>
            <button
              type="button"
              onClick={() => setContactExpanded((value) => !value)}
              aria-expanded={contactExpanded}
              aria-controls="contact-panel"
              className={rowClasses}
            >
              <div className={iconTileClasses}>
                <Phone className={iconClasses} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Contact</p>
                <p className="text-sm text-muted-foreground truncate">{phone}</p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300",
                  "group-hover:text-foreground",
                  contactExpanded && "rotate-180",
                )}
              />
            </button>

            <div
              id="contact-panel"
              className={cn(
                "grid transition-all duration-300 ease-out",
                contactExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 pl-[4.25rem] sm:pl-[5.25rem] flex flex-col gap-3">
                  {/* The number itself stays selectable/copyable on desktop. */}
                  <a
                    href={telHref}
                    className="text-lg font-semibold text-foreground tabular-nums hover:underline underline-offset-4 w-fit"
                  >
                    {phone}
                  </a>
                  {/* Primary action - the OS decides how to place the call. */}
                  <a
                    href={telHref}
                    className={cn(
                      "inline-flex items-center justify-center gap-2.5 h-12 px-6 w-full sm:w-fit rounded-2xl",
                      "bg-foreground text-background font-semibold",
                      "shadow-lg shadow-foreground/10",
                      "transition-all duration-300",
                      "hover:bg-foreground/90 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                    )}
                  >
                    <Phone className="h-4 w-4" />
                    Call {business.name}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Website (whole row opens the real URL) ---- */}
        {websiteHref && (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            className={rowClasses}
          >
            <div className={iconTileClasses}>
              <Globe className={iconClasses} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Website</p>
              {/* Simplified label; the href keeps the complete Google URL. */}
              <p className="text-sm text-muted-foreground truncate">{websiteLabel}</p>
            </div>
            <span className="flex items-center gap-1 shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-foreground group-hover:translate-x-1">
              <ExternalLink className="h-4 w-4" />
              <ChevronRight className="h-5 w-5" />
            </span>
            <span className="sr-only">Opens in a new tab</span>
          </a>
        )}
      </div>
    </div>
  )
}
