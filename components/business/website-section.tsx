"use client"

import { useEffect, useState } from "react"
import { Globe, Loader2, Check, ExternalLink, Eye } from "lucide-react"
import { type BusinessClaim } from "@/lib/business-portal/client"
import { usePortalData } from "@/lib/business-portal/data-context"
import { cn } from "@/lib/utils"

const TEMPLATES: { value: "classic" | "bold" | "minimal"; label: string; blurb: string }[] = [
  { value: "classic", label: "Classic", blurb: "Warm, editorial, image-led" },
  { value: "bold", label: "Bold", blurb: "High-contrast, statement type" },
  { value: "minimal", label: "Minimal", blurb: "Quiet, generous whitespace" },
]

/**
 * Silver website builder. A merchant composes a simple one-page microsite from
 * their existing listing content. The right pane is a live, honest preview of
 * exactly what publishing produces - no invented traffic or vanity metrics.
 */
export function WebsiteSection({ claim }: { claim: BusinessClaim }) {
  const data = usePortalData()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [template, setTemplate] = useState<"classic" | "bold" | "minimal">("classic")
  const [headline, setHeadline] = useState("")
  const [about, setAbout] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [customDomain, setCustomDomain] = useState("")
  const [published, setPublished] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const site = await data.getWebsite(claim.id)
        if (!active) return
        if (site) {
          setTemplate(site.template)
          setHeadline(site.headline ?? "")
          setAbout(site.about ?? "")
          setCtaLabel(site.cta_label ?? "")
          setCtaUrl(site.cta_url ?? "")
          setCustomDomain(site.custom_domain ?? "")
          setPublished(site.published)
        }
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [claim.id, data])

  async function save(nextPublished?: boolean) {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const shouldPublish = nextPublished ?? published
      await data.saveWebsite(claim, {
        template,
        headline: headline.trim() || null,
        about: about.trim() || null,
        cta_label: ctaLabel.trim() || null,
        cta_url: ctaUrl.trim() || null,
        custom_domain: customDomain.trim() || null,
        published: shouldPublish,
      })
      setPublished(shouldPublish)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading website builder…
        </div>
      </section>
    )
  }

  const slug = claim.business_ref.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
  const lookmeupUrl = `lookmeup.app/v/${slug || "your-venue"}`

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
          <Globe className="h-5 w-5 text-foreground" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-foreground">Your website</h2>
          <p className="text-sm text-muted-foreground">
            A one-page microsite built from your listing. Included with Silver.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">Template</span>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTemplate(t.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    template === t.value
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/40",
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Headline</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={80}
              placeholder="Modern Lebanese cooking in Soho"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">About</span>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Tell visitors what makes your place worth the trip."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Button label</span>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                maxLength={30}
                placeholder="Book a table"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Button link</span>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Custom domain <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="www.yourvenue.co.uk"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Point your domain at LookMeUp, or use your free {lookmeupUrl} address.
            </span>
          </label>
        </div>

        {/* Live preview */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Live preview
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="ml-2 truncate text-xs text-muted-foreground">{customDomain.trim() || lookmeupUrl}</span>
            </div>
            <WebsitePreview
              template={template}
              headline={headline || claim.business_ref}
              about={about}
              ctaLabel={ctaLabel}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Save draft
        </button>
        <button
          onClick={() => void save(!published)}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {published ? "Unpublish" : "Publish site"}
        </button>
        {published && (
          <a
            href={`https://${customDomain.trim() || lookmeupUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Visit <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" aria-hidden="true" /> Saved
          </span>
        )}
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            published ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary text-muted-foreground",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", published ? "bg-emerald-500" : "bg-muted-foreground/50")} />
          {published ? "Published" : "Draft"}
        </span>
      </div>
    </section>
  )
}

function WebsitePreview({
  template,
  headline,
  about,
  ctaLabel,
}: {
  template: "classic" | "bold" | "minimal"
  headline: string
  about: string
  ctaLabel: string
}) {
  const styles = {
    classic: {
      wrap: "bg-[#f6f1e7] text-[#2b2419]",
      h: "font-serif text-lg leading-tight",
      cta: "bg-[#2b2419] text-[#f6f1e7]",
    },
    bold: {
      wrap: "bg-[#111] text-[#f5f5f5]",
      h: "font-sans text-xl font-bold uppercase tracking-tight leading-tight",
      cta: "bg-[#f5f5f5] text-[#111]",
    },
    minimal: {
      wrap: "bg-white text-neutral-900",
      h: "font-sans text-lg font-light leading-tight",
      cta: "border border-neutral-900 text-neutral-900",
    },
  }[template]

  return (
    <div className={cn("min-h-[280px] px-6 py-8", styles.wrap)}>
      <h3 className={cn("text-balance", styles.h)}>{headline || "Your headline here"}</h3>
      <p className="mt-3 text-xs leading-relaxed opacity-80">
        {about || "Your description will appear here. Tell visitors what makes your place special."}
      </p>
      {ctaLabel.trim() && (
        <span className={cn("mt-5 inline-block rounded-full px-4 py-1.5 text-xs font-medium", styles.cta)}>
          {ctaLabel}
        </span>
      )}
    </div>
  )
}
