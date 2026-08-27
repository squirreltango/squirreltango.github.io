"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Clock, MapPin, Users, Link2Off } from "lucide-react"
import { Header } from "@/components/header"
import { AuthModal } from "@/components/auth-modal"
import { getSharedItinerary, type SharedItinerary } from "@/lib/itineraries/shared"

/**
 * Read-only view of a plan shared by link.
 *
 * The token is the capability: it is exchanged via the get_shared_itinerary
 * RPC, which returns one plan or nothing. No signed-in session is required,
 * and no editing affordance is offered.
 */
export default function SharedPlanPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ""

  const [authOpen, setAuthOpen] = useState(false)
  const [plan, setPlan] = useState<SharedItinerary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      const result = await getSharedItinerary(token)
      if (!active) return
      setPlan(result)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [token])

  return (
    <main className="min-h-screen bg-background">
      <Header onOpenAuth={() => setAuthOpen(true)} />

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 lg:px-8">
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-secondary/50" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : !plan ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <Link2Off className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
            <h1 className="font-serif text-3xl text-foreground">This link is no longer available</h1>
            <p className="max-w-md leading-relaxed text-muted-foreground">
              The plan may have been unshared, deleted, or the link may be incorrect. Ask the person who
              shared it for an up-to-date link.
            </p>
            <Link
              href="/"
              className="mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 active:scale-95"
            >
              Explore LookMeUp
            </Link>
          </div>
        ) : (
          <>
            <header className="mb-10 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Shared plan</p>
              <h1 className="text-balance font-serif text-4xl text-foreground sm:text-5xl">{plan.title}</h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {plan.planDate && (
                  <span>
                    {new Date(plan.planDate).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                )}
                <span>
                  {plan.items.length} {plan.items.length === 1 ? "stop" : "stops"}
                </span>
                {plan.participants.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {/* First names only - emails are never exposed by the RPC. */}
                    {plan.participants.map((p) => p.name).join(", ")}
                  </span>
                )}
              </div>

              {plan.notes && (
                <p className="max-w-prose leading-relaxed text-muted-foreground">{plan.notes}</p>
              )}
            </header>

            {plan.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border py-16 text-center">
                <p className="text-muted-foreground">This plan does not have any stops yet.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {plan.items.map((item, index) => {
                  const name = item.businessSnapshot?.name ?? item.customTitle ?? "Stop"
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-4"
                    >
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold tabular-nums text-background">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-medium text-foreground">{name}</h2>

                        {(item.businessSnapshot?.neighbourhood ?? item.businessSnapshot?.address) && (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {item.businessSnapshot?.neighbourhood ?? item.businessSnapshot?.address}
                          </p>
                        )}

                        {item.startTime && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {item.startTime.slice(0, 5)}
                          </p>
                        )}

                        {item.notes && (
                          <p className="mt-2 leading-relaxed text-sm text-muted-foreground">{item.notes}</p>
                        )}
                      </div>

                      {item.businessRef && (
                        <Link
                          href={`/business/${encodeURIComponent(item.businessRef)}`}
                          className="shrink-0 self-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          View
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card p-8 text-center">
              <h2 className="font-serif text-2xl text-foreground">Make your own plans</h2>
              <p className="max-w-md leading-relaxed text-sm text-muted-foreground">
                Save places you like and build them into a plan you can share with anyone.
              </p>
              <button
                onClick={() => setAuthOpen(true)}
                className="mt-1 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-95"
              >
                Get started
              </button>
            </div>
          </>
        )}
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  )
}
