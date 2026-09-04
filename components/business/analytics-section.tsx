"use client"

import { useEffect, useState } from "react"
import { Eye, Heart, Loader2, MousePointerClick, Navigation, CalendarCheck } from "lucide-react"
import { getBusinessAnalytics, type BusinessClaim } from "@/lib/business-portal/client"
import { cn } from "@/lib/utils"

/**
 * Silver: profile analytics. Reads aggregated counts from the
 * get_business_analytics() RPC, which is authorised to the owning merchant and
 * returns totals only — never individual visitor identities. When a business
 * has had no interactions the numbers are genuinely zero; nothing is invented.
 */

const METRICS: {
  key: string
  label: string
  icon: typeof Eye
}[] = [
  { key: "profile_view", label: "Profile views", icon: Eye },
  { key: "save", label: "Saves", icon: Heart },
  { key: "website_click", label: "Website clicks", icon: MousePointerClick },
  { key: "directions_click", label: "Directions", icon: Navigation },
  { key: "booking_click", label: "Booking clicks", icon: CalendarCheck },
]

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
]

export function AnalyticsSection({ claim }: { claim: BusinessClaim }) {
  const [days, setDays] = useState(30)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const data = await getBusinessAnalytics(claim.business_ref, days)
        if (active) {
          setCounts(data)
          setError(null)
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load analytics.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [claim.business_ref, days])

  const hasAny = Object.values(counts).some((n) => n > 0)

  return (
    <fieldset className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-background/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Analytics</legend>
          <p className="text-sm text-muted-foreground mt-1">How people find and engage with your listing.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                days === r.days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {METRICS.map((m) => {
              const Icon = m.icon
              return (
                <div key={m.key} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-4">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-serif text-3xl text-foreground tabular-nums">{counts[m.key] ?? 0}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              )
            })}
          </div>
          {!hasAny && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              No activity recorded in this period yet. These counts update as real people view, save and click
              through from your listing.
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}
