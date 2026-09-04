"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Tag, Trash2, Send } from "lucide-react"
import { type Promotion, type BusinessClaim } from "@/lib/business-portal/client"
import { usePortalData } from "@/lib/business-portal/data-context"
import { cn } from "@/lib/utils"

/**
 * Silver: promotions. Merchants create genuine offers shown on their listing.
 * Nothing is prefilled with sample offers — the list starts empty.
 *
 * "Push to LookMeUp users" is a real product capability, but no browser/mobile
 * push delivery infrastructure is wired up yet. The UI is explicit about this:
 * the delivery step is labelled as not yet activated rather than pretending a
 * notification was sent.
 */

type PromoStatus = Promotion["status"]

const STATUS_META: Record<PromoStatus | "expired", { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", cls: "bg-foreground/10 text-foreground" },
  active: { label: "Active", cls: "bg-foreground text-background" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", cls: "bg-destructive/10 text-destructive" },
}

/** Derive the badge shown to the merchant, treating a past end date as expired. */
function displayStatus(p: Promotion): PromoStatus | "expired" {
  if (p.ends_on && new Date(p.ends_on).getTime() < Date.now() && p.status !== "draft") {
    return "expired"
  }
  return p.status
}

export function PromotionsSection({ claim }: { claim: BusinessClaim }) {
  const data = usePortalData()
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await data.listPromotions(claim.id)
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
  }, [claim.id, data])

  async function handleCreate(draft: {
    title: string
    description: string
    code: string
    cta_url: string
    starts_on: string
    ends_on: string
    status: PromoStatus
  }) {
    setError(null)
    try {
      const created = await data.upsertPromotion(claim, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        // No dedicated offer-code column exists; cta_label carries the code so
        // no schema change is needed. Labelled as "Offer code" throughout.
        cta_label: draft.code.trim() || undefined,
        cta_url: draft.cta_url.trim() || undefined,
        starts_on: draft.starts_on || undefined,
        ends_on: draft.ends_on || undefined,
        audience: "all",
        status: draft.status,
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
      await data.deletePromotion(id)
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
          {promos.map((p) => {
            const st = displayStatus(p)
            const meta = STATUS_META[st]
            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card p-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", meta.cls)}>
                        {meta.label}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{p.description}</p>}
                    <div className="flex items-center gap-3 flex-wrap mt-1">
                      {p.cta_label && (
                        <span className="text-xs text-foreground font-mono px-2 py-0.5 rounded bg-muted">
                          Code: {p.cta_label}
                        </span>
                      )}
                      {(p.starts_on || p.ends_on) && (
                        <span className="text-xs text-muted-foreground">
                          {p.starts_on
                            ? new Date(p.starts_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "Now"}
                          {" – "}
                          {p.ends_on
                            ? new Date(p.ends_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "Open"}
                        </span>
                      )}
                    </div>
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
            )
          })}
        </ul>
      )}

      {/* Honest delivery status: push to LookMeUp users is a planned capability,
          not something we can pretend already happened. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border/60 bg-muted/30 p-3">
        <Send className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">Push to LookMeUp users</span> — active promotions appear on your
          listing now. Direct push notifications to nearby and saved-you users are on the roadmap and{" "}
          <span className="text-foreground">not yet activated</span>, so nothing is sent to devices yet.
        </p>
      </div>
    </fieldset>
  )
}

function PromotionForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (draft: {
    title: string
    description: string
    code: string
    cta_url: string
    starts_on: string
    ends_on: string
    status: PromoStatus
  }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [code, setCode] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [status, setStatus] = useState<PromoStatus>("draft")

  const inputCls =
    "px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/40"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 20% off Sunday lunch"
        className={inputCls}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Optional detail customers should know."
        className={cn(inputCls, "resize-none")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Offer code (optional)</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUNDAY20" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Link (optional)</span>
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Starts</span>
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Ends</span>
          <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as PromoStatus)} className={inputCls}>
            <option value="draft">Draft — not shown yet</option>
            <option value="scheduled">Scheduled — goes live on the start date</option>
            <option value="active">Active — show now</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onCreate({ title, description, code, cta_url: ctaUrl, starts_on: startsOn, ends_on: endsOn, status })}
          className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-50 active:scale-95"
        >
          Save promotion
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
