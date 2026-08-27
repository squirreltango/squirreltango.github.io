"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, Sparkles } from "lucide-react"
import { Header } from "@/components/header"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/components/auth-provider"
import {
  getSubscription,
  joinGoldWaitlist,
  isOnGoldWaitlist,
  type Subscription,
  type Tier,
} from "@/lib/business-portal/client"
import { cn } from "@/lib/utils"

interface Plan {
  tier: Tier
  name: string
  price: string
  cadence: string
  /** Optional annual alternative, shown beneath the monthly price. */
  annualPrice?: string
  annualCadence?: string
  summary: string
  features: string[]
  /** Gold is not purchasable yet - it collects a waitlist instead. */
  waitlist?: boolean
  featured?: boolean
}

const PLANS: Plan[] = [
  {
    tier: "bronze",
    name: "Bronze",
    price: "Free",
    cadence: "always",
    summary: "Get discovered and take control of your LookMeUp presence.",
    features: [
      "Claim and verify your business",
      "Keep name, address and hours correct",
      "Food hygiene rating displayed",
      "Description, tagline and contact details",
      "Booking, menu and social links",
    ],
  },
  {
    tier: "silver",
    name: "Silver",
    price: "£39",
    cadence: "per month",
    /** £390/yr is two months free versus paying monthly. */
    annualPrice: "£390",
    annualCadence: "per year",
    summary: "Turn discovery into customers.",
    features: [
      "Everything in Bronze",
      "Enhanced profile with richer content",
      "Take bookings inside LookMeUp",
      "Profile views, saves and click analytics",
      "Priority visibility in relevant searches",
    ],
    featured: true,
  },
  {
    tier: "gold",
    name: "Gold",
    price: "Coming soon",
    cadence: "",
    summary: "Grow your business with LookMeUp.",
    features: [
      "Everything in Silver",
      "Website, domain and trademark support",
      "Social media and campaign support",
      "Enhanced analytics and reporting",
      "Dedicated account support",
    ],
    waitlist: true,
  },
]

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [onWaitlist, setOnWaitlist] = useState(false)
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    let active = true
    ;(async () => {
      try {
        const [sub, waiting] = await Promise.all([getSubscription(), isOnGoldWaitlist()])
        if (!active) return
        setSubscription(sub)
        setOnWaitlist(waiting)
      } catch {
        // Non-critical: pricing is still fully readable without this.
      }
    })()
    return () => {
      active = false
    }
  }, [authLoading, user])

  async function handleGold() {
    if (!user) {
      setAuthOpen(true)
      return
    }
    setJoining(true)
    setError(null)
    try {
      await joinGoldWaitlist({ contactEmail: user.email ?? undefined })
      setOnWaitlist(true)
      setMessage("You're on the Gold waitlist - we'll be in touch when analytics launch.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the waitlist.")
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header onOpenAuth={() => setAuthOpen(true)} />

      <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-28 pb-24">
        <header className="flex flex-col items-center text-center gap-4 mb-14">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">For businesses</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-foreground text-balance max-w-2xl">
            Be found by people looking for you
          </h1>
          <p className="text-muted-foreground max-w-xl leading-relaxed text-pretty">
            Claiming your business is free. Upgrade when you want richer presentation and, soon, insight into how
            people discover you.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.tier === plan.tier && subscription?.status === "active"
            return (
              <section
                key={plan.tier}
                className={cn(
                  "flex flex-col gap-6 p-8 rounded-3xl border bg-card transition-all duration-300",
                  plan.featured
                    ? "border-foreground/30 shadow-xl lg:-mt-4 lg:pb-12"
                    : "border-border/60 hover:shadow-lg",
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-serif text-2xl text-foreground">{plan.name}</h2>
                    {plan.featured && (
                      <span className="px-3 py-1 rounded-full bg-foreground text-background text-xs font-medium">
                        Most popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-4xl text-foreground">{plan.price}</span>
                    {plan.cadence && <span className="text-sm text-muted-foreground">{plan.cadence}</span>}
                  </div>
                  {/* Annual alternative kept to one quiet line so the card
                      stays uncluttered. */}
                  <div className={cn("mb-4", !plan.annualPrice && "hidden")}>
                    <span className="text-xs text-muted-foreground">
                      {plan.annualPrice} {plan.annualCadence} &middot; two months free
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{plan.summary}</p>
                </div>

                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {plan.waitlist ? (
                    <button
                      onClick={handleGold}
                      disabled={joining || onWaitlist}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium",
                        "border border-border text-foreground transition-all",
                        "hover:bg-secondary/80 active:scale-95 disabled:opacity-60",
                      )}
                    >
                      {joining && <Loader2 className="h-4 w-4 animate-spin" />}
                      {!joining && !onWaitlist && <Sparkles className="h-4 w-4" />}
                      {onWaitlist ? "On the waitlist" : "Join the waitlist"}
                    </button>
                  ) : (
                    <Link
                      href="/business/portal"
                      className={cn(
                        "w-full flex items-center justify-center py-3.5 rounded-full text-sm font-medium transition-all active:scale-95",
                        plan.featured
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "border border-border text-foreground hover:bg-secondary/80",
                      )}
                    >
                      {isCurrent ? "Manage business" : plan.tier === "bronze" ? "Claim your business" : "Choose Silver"}
                    </Link>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {(message || error) && (
          <p
            role="status"
            className={cn(
              "mt-8 text-center text-sm",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error ?? message}
          </p>
        )}

        <p className="mt-14 text-center text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Silver is billed monthly and can be cancelled at any time. Gold pricing will be confirmed before
          launch — joining the waitlist does not commit you to anything.
        </p>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultAccountType="business"
        returnTo="/pricing"
      />
    </main>
  )
}
