"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  Heart,
  Plus,
  Share2,
  Trash2,
  Check,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useSavedPlaces } from "@/components/saved-places-provider"
import {
  addItem,
  deleteItem,
  getItinerary,
  listItems,
  persistOrder,
  updateItem,
  updateItinerary,
  type Itinerary,
  type ItineraryItem,
} from "@/lib/itineraries/client"
import { cn } from "@/lib/utils"

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const planId = params.id
  const { user, loading: authLoading } = useAuth()
  const { saved } = useSavedPlaces()

  const [plan, setPlan] = useState<Itinerary | null>(null)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, i] = await Promise.all([getItinerary(planId), listItems(planId)])
    setPlan(p)
    setItems(i)
    setLoading(false)
  }, [planId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, authLoading, load])

  // Saved places not already on the plan are the candidates worth offering.
  const candidates = useMemo(() => {
    const used = new Set(items.map((i) => i.businessRef).filter(Boolean))
    return saved.filter((s) => !used.has(s.businessRef))
  }, [saved, items])

  async function handleAddSaved(ref: string) {
    const source = saved.find((s) => s.businessRef === ref)
    if (!source) return
    const created = await addItem({
      itineraryId: planId,
      businessRef: ref,
      snapshot: source.snapshot,
      position: items.length,
    })
    if (created) {
      setItems((prev) => [...prev, created])
      setAddOpen(false)
    }
  }

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault()
    const label = customTitle.trim()
    if (!label) return
    const created = await addItem({
      itineraryId: planId,
      customTitle: label,
      position: items.length,
    })
    if (created) {
      setItems((prev) => [...prev, created])
      setCustomTitle("")
    }
  }

  async function handleRemove(id: string) {
    const previous = items
    const next = items.filter((i) => i.id !== id)
    setItems(next)
    const ok = await deleteItem(id)
    if (!ok) {
      setItems(previous)
      return
    }
    await persistOrder(next)
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await persistOrder(next)
  }

  async function handleTime(id: string, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, startTime: value || null } : i)))
    await updateItem(id, { startTime: value || null })
  }

  async function handleShare() {
    if (!plan) return
    if (!plan.isPublic) {
      const ok = await updateItinerary(plan.id, { isPublic: true })
      if (!ok) return
      setPlan({ ...plan, isPublic: true })
    }
    const token = plan.shareToken
    if (!token) return
    const url = `${window.location.origin}/plans/shared/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the plan is still shared and the link is shown below.
      setCopied(false)
    }
  }

  const shareUrl =
    plan?.isPublic && plan.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/plans/shared/${plan.shareToken}`
      : null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="flex h-18 items-center gap-3">
            <Link href="/plans" className="-ml-2 rounded-xl p-2.5 transition-colors hover:bg-secondary/80">
              <ArrowLeft className="h-5 w-5 text-foreground" />
              <span className="sr-only">Back to plans</span>
            </Link>
            <h1 className="min-w-0 flex-1 truncate font-serif text-xl font-semibold text-foreground">
              {plan?.title ?? "Plan"}
            </h1>
            {plan && (
              <button
                onClick={() => void handleShare()}
                className="flex items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Share"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : !user ? (
          <p className="py-20 text-center text-muted-foreground">
            Please{" "}
            <Link href="/plans" className="underline">
              sign in
            </Link>{" "}
            to view this plan.
          </p>
        ) : !plan ? (
          <p className="py-20 text-center text-muted-foreground">
            This plan could not be found.
          </p>
        ) : (
          <>
            {shareUrl && (
              <p className="mb-6 truncate rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                Anyone with this link can view the plan:{" "}
                <span className="text-foreground">{shareUrl}</span>
              </p>
            )}

            {items.length === 0 ? (
              <div className="mb-8 rounded-3xl border border-dashed border-border py-16 text-center">
                <Clock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-muted-foreground">Add your first stop below.</p>
              </div>
            ) : (
              <ol className="mb-8 space-y-3">
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">
                        {item.snapshot?.name ?? item.customTitle ?? "Stop"}
                      </h3>
                      {item.snapshot?.neighbourhood && (
                        <p className="text-sm text-muted-foreground">
                          {item.snapshot.neighbourhood}
                        </p>
                      )}
                      <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Start time for {item.snapshot?.name ?? item.customTitle}</span>
                        <input
                          type="time"
                          value={item.startTime?.slice(0, 5) ?? ""}
                          onChange={(e) => void handleTime(item.id, e.target.value)}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-foreground focus:border-foreground focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => void handleMove(index, -1)}
                        disabled={index === 0}
                        aria-label="Move earlier"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => void handleMove(index, 1)}
                        disabled={index === items.length - 1}
                        aria-label="Move later"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => void handleRemove(item.id)}
                        aria-label="Remove stop"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="rounded-3xl border border-border/60 bg-card p-5">
              <button
                onClick={() => setAddOpen((v) => !v)}
                aria-expanded={addOpen}
                className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a stop
              </button>

              {addOpen && (
                <div className="mb-5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                    From your saved places
                  </p>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No saved places left to add.{" "}
                      <Link href="/" className="underline">
                        Find some
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {candidates.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => void handleAddSaved(s.businessRef)}
                          className={cn(
                            "rounded-full border border-border px-3 py-1.5 text-sm text-foreground",
                            "transition-colors hover:bg-secondary/80",
                          )}
                        >
                          {s.snapshot?.name ?? "Saved place"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleAddCustom} className="flex gap-2">
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Or add your own stop, e.g. Train to Brighton"
                  aria-label="Custom stop title"
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground/70 focus:border-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  Add
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
