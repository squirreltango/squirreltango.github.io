"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarDays, Plus, Trash2, MapPin } from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/components/auth-provider"
import { createItinerary, deleteItinerary, listItineraries, type Itinerary } from "@/lib/itineraries/client"

function formatPlanDate(date: string | null) {
  if (!date) return "No date set"
  // Parse as local date parts to avoid a UTC shift moving the day backwards.
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })
}

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [plans, setPlans] = useState<Itinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [planDate, setPlanDate] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setPlans(await listItineraries())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPlans([])
      setLoading(false)
      return
    }
    void refresh()
  }, [user, authLoading, refresh])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || creating) return
    setCreating(true)
    const created = await createItinerary({ userId: user.id, title, planDate: planDate || null })
    setCreating(false)
    if (created) {
      setPlans((prev) => [created, ...prev])
      setTitle("")
      setPlanDate("")
    }
  }

  async function handleDelete(id: string) {
    const previous = plans
    setPlans((prev) => prev.filter((p) => p.id !== id))
    const ok = await deleteItinerary(id)
    if (!ok) setPlans(previous)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="flex h-18 items-center">
            <Link href="/" className="-ml-2 rounded-xl p-2.5 transition-colors hover:bg-secondary/80">
              <ArrowLeft className="h-5 w-5 text-foreground" />
              <span className="sr-only">Back to explore</span>
            </Link>
            <h1 className="ml-3 font-serif text-xl font-semibold text-foreground">My Plans</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {authLoading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-secondary/50" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/80 shadow-lg">
              <CalendarDays className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="mb-4 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              Plan your day out
            </h2>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
              Build an itinerary from your saved places, add your own stops, and share it with
              whoever is coming along.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="rounded-2xl bg-foreground px-8 py-4 font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:bg-foreground/90"
            >
              Sign in to continue
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleCreate}
              className="mb-10 flex flex-col gap-3 rounded-3xl border border-border/60 bg-card p-5 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="plan-title" className="mb-1.5 block text-sm font-medium text-foreground">
                  New plan
                </label>
                <input
                  id="plan-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Saturday in Soho"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground/70 focus:border-foreground focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="plan-date" className="mb-1.5 block text-sm font-medium text-foreground">
                  Date
                </label>
                <input
                  id="plan-date"
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground focus:border-foreground focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 font-medium text-background transition-all hover:bg-foreground/90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {creating ? "Creating…" : "Create"}
              </button>
            </form>

            {loading ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-3xl bg-secondary/50" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
                <MapPin className="mb-4 h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
                <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground">
                  No plans yet
                </h2>
                <p className="text-muted-foreground">Create your first plan above.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {plans.map((plan) => (
                  <li
                    key={plan.id}
                    className="group flex items-center gap-4 rounded-3xl border border-border/60 bg-card p-5 transition-all hover:shadow-lg"
                  >
                    <Link href={`/plans/${plan.id}`} className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-lg font-semibold text-foreground">
                        {plan.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatPlanDate(plan.planDate)}
                        {plan.isPublic ? " · Shared" : ""}
                      </p>
                    </Link>
                    <button
                      onClick={() => void handleDelete(plan.id)}
                      aria-label={`Delete ${plan.title}`}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}
