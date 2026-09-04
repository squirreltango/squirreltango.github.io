"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Tag, Trash2 } from "lucide-react"
import {
  listPromotions,
  upsertPromotion,
  deletePromotion,
  type Promotion,
  type BusinessClaim,
} from "@/lib/business-portal/client"
import { cn } from "@/lib/utils"

/**
 * Silver: promotions. Merchants create genuine offers shown on their listing.
 * Nothing is prefilled with sample offers — the list starts empty.
 */
export function PromotionsSection({ claim }: { claim: BusinessClaim }) {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await listPromotions(claim.id)
        if (active) setPromos(list)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load promotions.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [claim.id])

  async function handleCreate(draft: { title: string; description: string; cta_url: string; ends_on: string }) {
    setError(null)
    try {
      const created = await upsertPromotion(claim, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        cta_url: draft.cta_url.trim() || undefined,
        ends_on: draft.ends_on || undefined,
        audience: "all",
        status: "active",
      })
      setPromos((p) => [created, ...p])
      setCreating(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the promotion.")
    }
  }

  async function handleDelete(id: string) {
    const prev = promos
    setPromos((p) => p.filter((x) => x.id !== id))
    try {
      await deletePromotion(id)
    } catch (e) {
      setPromos(prev)
      setError(e instanceof Error ? e.message : "Could not delete the promotion.")
    }
  }

  return (
    <fieldset className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-background/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Promotions</legend>
          <p className="text-sm text-muted-foreground mt-1">Highlight an offer on your listing.</p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {creating && <PromotionForm onCancel={() => setCreating(false)} onCreate={handleCreate} />}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : promos.length === 0 && !creating ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No promotions yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card p-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  {p.description && <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>}
                  {p.ends_on && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ends {new Date(p.ends_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                aria-label={`Delete promotion ${p.title}`}
                className="p-2 rounded-lg text-muted-foreground transition-colors hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

function PromotionForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (draft: { title: string; description: string; cta_url: string; ends_on: string }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [endsOn, setEndsOn] = useState("")

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 20% off Sunday lunch"
        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Optional detail customers should know."
        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/40 resize-none"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={ctaUrl}
          onChange={(e) => setCtaUrl(e.target.value)}
          placeholder="Link (optional)"
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/40"
        />
        <input
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-foreground/40"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onCreate({ title, description, cta_url: ctaUrl, ends_on: endsOn })}
          className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-50 active:scale-95"
        >
          Add promotion
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
