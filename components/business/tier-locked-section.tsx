"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { TIER_LABEL, type Tier } from "@/lib/business-portal/tiers"

/**
 * Shows a merchant what a higher plan unlocks, without pretending the feature
 * is active. The preview content is rendered non-interactively behind a scrim
 * so it reads as "this is what you would get", never as live data.
 */
export function TierLockedSection({
  title,
  description,
  requiredTier,
  children,
}: {
  title: string
  description: string
  requiredTier: Tier
  children?: React.ReactNode
}) {
  return (
    <section
      className="relative rounded-3xl border border-border/60 bg-card overflow-hidden"
      aria-label={`${title} (requires ${TIER_LABEL[requiredTier]})`}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <h3 className="font-medium text-foreground">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">{description}</p>
          </div>
          <span className="shrink-0 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {TIER_LABEL[requiredTier]}
          </span>
        </div>

        {children && (
          <div className="relative">
            {/* Non-interactive: inert so preview controls cannot be operated or
                tabbed into, and hidden from screen readers to avoid announcing
                sample figures as if they were the merchant's real data. */}
            <div
              className="pointer-events-none select-none opacity-45 blur-[1px]"
              aria-hidden="true"
              inert
            >
              {children}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/80" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className={cn(
              "px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium",
              "transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-95",
            )}
          >
            Upgrade to {TIER_LABEL[requiredTier]}
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </section>
  )
}
