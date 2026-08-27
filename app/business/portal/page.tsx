"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Store, Plus, Check, Clock, X, ExternalLink, Loader2, ShieldCheck } from "lucide-react"
import { Header } from "@/components/header"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/components/auth-provider"
import {
  listClaims,
  submitClaim,
  getProfileForClaim,
  saveProfile,
  getSubscription,
  type BusinessClaim,
  type BusinessProfile,
  type BusinessProfileDraft,
  type Subscription,
} from "@/lib/business-portal/client"
import { cn } from "@/lib/utils"

export default function BusinessPortalPage() {
  const { user, loading: authLoading, isBusiness } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [claims, setClaims] = useState<BusinessClaim[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<BusinessClaim | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setClaims([])
      setSubscription(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [c, s] = await Promise.all([listClaims(), getSubscription()])
      setClaims(c)
      setSubscription(s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your venues.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) void refresh()
  }, [authLoading, refresh])

  if (authLoading) {
    return (
      <Shell onOpenAuth={() => setAuthOpen(true)}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell onOpenAuth={() => setAuthOpen(true)}>
        <EmptyState
          icon={<Store className="h-7 w-7 text-muted-foreground" />}
          title="Manage your venue on LookMeUp"
          body="Sign in with a business account to claim your venue, keep its details accurate and add booking links."
          action={
            <button
              onClick={() => setAuthOpen(true)}
              className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-95"
            >
              Sign in
            </button>
          }
        />
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultAccountType="business" />
      </Shell>
    )
  }

  return (
    <Shell onOpenAuth={() => setAuthOpen(true)}>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Business portal</p>
            <h1 className="font-serif text-4xl sm:text-5xl text-foreground text-balance">Your venues</h1>
            <p className="text-muted-foreground max-w-xl leading-relaxed">
              Claim a venue to manage how it appears across LookMeUp, add booking links and keep your details current.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-full border border-border text-sm font-medium text-foreground transition-all hover:bg-secondary/80 active:scale-95"
            >
              {subscription ? `${titleCase(subscription.tier)} plan` : "View plans"}
            </Link>
            <button
              onClick={() => setShowClaimForm((v) => !v)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Claim a venue
            </button>
          </div>
        </header>

        {!isBusiness && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/60 border border-border/60">
            <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              This account is set up as a personal account. You can still submit a claim — approval is what grants
              access to editing a venue.
            </p>
          </div>
        )}

        {showClaimForm && (
          <ClaimForm
            onCancel={() => setShowClaimForm(false)}
            onSubmitted={async () => {
              setShowClaimForm(false)
              await refresh()
            }}
          />
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : claims.length === 0 ? (
          <EmptyState
            icon={<Store className="h-7 w-7 text-muted-foreground" />}
            title="No venues claimed yet"
            body="Claim your venue to manage its listing. We verify ownership before granting edit access."
            action={
              <button
                onClick={() => setShowClaimForm(true)}
                className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-95"
              >
                Claim a venue
              </button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {claims.map((claim) => (
              <li key={claim.id}>
                <ClaimRow
                  claim={claim}
                  expanded={selectedClaim?.id === claim.id}
                  onToggle={() => setSelectedClaim(selectedClaim?.id === claim.id ? null : claim)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultAccountType="business" />
    </Shell>
  )
}

function Shell({ children, onOpenAuth }: { children: React.ReactNode; onOpenAuth: () => void }) {
  return (
    <main className="min-h-screen bg-background">
      <Header onOpenAuth={onOpenAuth} />
      <div className="max-w-5xl mx-auto px-6 lg:px-8 pt-28 pb-24">{children}</div>
    </main>
  )
}

function ClaimRow({
  claim,
  expanded,
  onToggle,
}: {
  claim: BusinessClaim
  expanded: boolean
  onToggle: () => void
}) {
  const approved = claim.status === "approved"

  return (
    <div className="rounded-3xl border border-border/60 bg-card overflow-hidden transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="font-medium text-foreground truncate">{claim.business_name}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">{claim.business_ref}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusPill status={claim.status} />
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="px-4 py-2 rounded-full border border-border text-sm font-medium text-foreground transition-all hover:bg-secondary/80 active:scale-95"
          >
            {approved ? (expanded ? "Close" : "Manage") : expanded ? "Close" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 p-5 bg-muted/30">
          {approved ? (
            <ProfileEditor claim={claim} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground font-medium">
                {claim.status === "pending" ? "Verification in progress" : "Claim not approved"}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
                {claim.status === "pending"
                  ? "We are checking that you represent this venue. Editing unlocks once the claim is approved — this protects venues from being edited by someone who does not own them."
                  : "This claim was not approved. If you believe this is an error, submit a new claim with clearer evidence of ownership."}
              </p>
              {claim.evidence_notes && (
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="text-foreground">Your notes: </span>
                  {claim.evidence_notes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: BusinessClaim["status"] }) {
  const map = {
    approved: { label: "Approved", icon: Check, cls: "bg-foreground text-background" },
    pending: { label: "Pending", icon: Clock, cls: "bg-muted text-muted-foreground" },
    rejected: { label: "Rejected", icon: X, cls: "bg-destructive/10 text-destructive" },
  } as const
  const { label, icon: Icon, cls } = map[status]
  return (
    <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium", cls)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function ClaimForm({ onCancel, onSubmitted }: { onCancel: () => void; onSubmitted: () => void }) {
  const [businessName, setBusinessName] = useState("")
  const [businessRef, setBusinessRef] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [evidenceNotes, setEvidenceNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !businessRef.trim()) {
      setError("Venue name and reference are both required.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitClaim({ businessRef, businessName, contactEmail, contactPhone, evidenceNotes })
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the claim.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 rounded-3xl border border-border/60 bg-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl text-foreground">Claim a venue</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tell us which venue you represent. Claims start as pending and are reviewed before editing unlocks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue name" required value={businessName} onChange={setBusinessName} placeholder="Blacklock Soho" />
        <Field
          label="Google Place ID or venue ID"
          required
          value={businessRef}
          onChange={setBusinessRef}
          placeholder="ChIJ..."
          hint="Find this on your venue page URL."
        />
        <Field label="Contact email" type="email" value={contactEmail} onChange={setContactEmail} placeholder="you@venue.co.uk" />
        <Field label="Contact phone" value={contactPhone} onChange={setContactPhone} placeholder="020 1234 5678" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="evidence" className="text-sm font-medium text-foreground">
          Evidence of ownership
        </label>
        <textarea
          id="evidence"
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          rows={3}
          placeholder="Your role, company name, or anything that helps us verify you represent this venue."
          className="px-4 py-3 rounded-2xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-foreground/40 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-60 active:scale-95"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit claim
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-full border border-border text-sm font-medium text-foreground transition-all hover:bg-secondary/80 active:scale-95"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ProfileEditor({ claim }: { claim: BusinessClaim }) {
  const [draft, setDraft] = useState<BusinessProfileDraft>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const profile = await getProfileForClaim(claim.id)
        if (!active) return
        setDraft(toDraft(profile))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load venue details.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [claim.id])

  function set<K extends keyof BusinessProfileDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveProfile(claim, draft)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <Section title="How your venue reads">
        <Field label="Tagline" value={draft.tagline ?? ""} onChange={(v) => set("tagline", v)} placeholder="Chophouse in the heart of Soho" />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor={`desc-${claim.id}`} className="text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id={`desc-${claim.id}`}
            value={draft.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="px-4 py-3 rounded-2xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-foreground/40 resize-none"
            placeholder="What makes this venue worth a visit."
          />
        </div>
      </Section>

      <Section title="Bookings and ordering">
        <Field label="Booking link" value={draft.booking_url ?? ""} onChange={(v) => set("booking_url", v)} placeholder="https://" />
        <Field label="Menu link" value={draft.menu_url ?? ""} onChange={(v) => set("menu_url", v)} placeholder="https://" />
        <Field label="Order online" value={draft.order_url ?? ""} onChange={(v) => set("order_url", v)} placeholder="https://" />
        <Field label="Website" value={draft.website_url ?? ""} onChange={(v) => set("website_url", v)} placeholder="https://" />
      </Section>

      <Section title="Contact">
        <Field label="Phone" value={draft.contact_phone ?? ""} onChange={(v) => set("contact_phone", v)} placeholder="020 1234 5678" />
        <Field label="Email" type="email" value={draft.contact_email ?? ""} onChange={(v) => set("contact_email", v)} placeholder="hello@venue.co.uk" />
      </Section>

      <Section title="Social">
        <Field label="Instagram" value={draft.instagram_url ?? ""} onChange={(v) => set("instagram_url", v)} placeholder="https://instagram.com/" />
        <Field label="Facebook" value={draft.facebook_url ?? ""} onChange={(v) => set("facebook_url", v)} placeholder="https://facebook.com/" />
        <Field label="X" value={draft.x_url ?? ""} onChange={(v) => set("x_url", v)} placeholder="https://x.com/" />
        <Field label="TikTok" value={draft.tiktok_url ?? ""} onChange={(v) => set("tiktok_url", v)} placeholder="https://tiktok.com/@" />
      </Section>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-60 active:scale-95"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
        <Link
          href={`/business/${encodeURIComponent(claim.business_ref)}`}
          className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View public page
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  hint?: string
}) {
  const id = `f-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-muted-foreground"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-4 py-3 rounded-2xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-foreground/40"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-20">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">{icon}</div>
      <h2 className="font-serif text-3xl text-foreground text-balance">{title}</h2>
      <p className="text-muted-foreground max-w-md leading-relaxed text-pretty">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

function toDraft(profile: BusinessProfile | null): BusinessProfileDraft {
  if (!profile) return {}
  const { id: _id, claim_id: _c, user_id: _u, business_ref: _r, ...rest } = profile
  return rest
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
