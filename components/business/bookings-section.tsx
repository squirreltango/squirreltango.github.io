"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Clock, Eye, Loader2, Plus, Trash2, X } from "lucide-react"
import {
  type BookingSettings,
  type BookingRequest,
  type BusinessService,
  type BusinessClaim,
} from "@/lib/business-portal/client"
import { usePortalData } from "@/lib/business-portal/data-context"
import { cn } from "@/lib/utils"

/**
 * Silver: native in-app bookings. Merchants choose whether they take table
 * reservations or service appointments, configure the slot cadence, define
 * their bookable services, preview the customer experience, and confirm or
 * decline genuine requests. All data is real (from the DB, or the in-memory
 * preview client) — there are no fabricated bookings on the live path.
 */
export function BookingsSection({ claim }: { claim: BusinessClaim }) {
  const data = usePortalData()
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [services, setServices] = useState<BusinessService[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, svc, r] = await Promise.all([
        data.getBookingSettings(claim.id),
        data.listServices(claim.id),
        data.listBookingRequests(claim.business_ref),
      ])
      setSettings(s)
      setServices(svc)
      setRequests(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings.")
    } finally {
      setLoading(false)
    }
  }, [claim.id, claim.business_ref, data])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(next: Partial<BookingSettings>) {
    setSaving(true)
    setError(null)
    try {
      const updated = await data.saveBookingSettings(claim, {
        accepts_bookings: settings?.accepts_bookings ?? false,
        booking_type: settings?.booking_type ?? "table",
        slot_interval_minutes: settings?.slot_interval_minutes ?? 30,
        default_duration_minutes: settings?.default_duration_minutes ?? 90,
        capacity: settings?.capacity ?? null,
        confirmation_mode: settings?.confirmation_mode ?? "manual",
        ...next,
      })
      setSettings(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save booking settings.")
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(id: string, status: BookingRequest["status"]) {
    const prev = requests
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await data.updateBookingStatus(id, status)
    } catch (e) {
      setRequests(prev)
      setError(e instanceof Error ? e.message : "Could not update the booking.")
    }
  }

  async function addService(draft: ServiceFormValue) {
    setError(null)
    try {
      const created = await data.upsertService(claim, {
        kind: settings?.booking_type === "table" ? "table" : "service",
        name: draft.name.trim(),
        notes: draft.notes.trim() || null,
        duration_minutes: draft.duration ? Number(draft.duration) : null,
        price_pennies: draft.price ? Math.round(Number(draft.price) * 100) : null,
        staff_name: draft.staff.trim() || null,
        active: true,
      })
      setServices((s) => [...s, created])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the service.")
    }
  }

  async function removeService(id: string) {
    const prev = services
    setServices((s) => s.filter((x) => x.id !== id))
    try {
      await data.deleteService(id)
    } catch (e) {
      setServices(prev)
      setError(e instanceof Error ? e.message : "Could not delete the service.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const accepts = settings?.accepts_bookings ?? false
  const bookingType = settings?.booking_type ?? "table"
  const pending = requests.filter((r) => r.status === "pending")

  return (
    <fieldset className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-background/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bookings</legend>
          <p className="text-sm text-muted-foreground mt-1">Accept requests directly on your listing.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepts}
          aria-label="Accept bookings"
          disabled={saving}
          onClick={() => patch({ accepts_bookings: !accepts })}
          className={cn("relative h-7 w-12 rounded-full transition-colors shrink-0", accepts ? "bg-foreground" : "bg-muted")}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-background transition-transform",
              accepts ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {accepts && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="What you take"
              value={bookingType}
              onChange={(v) => patch({ booking_type: v as BookingSettings["booking_type"] })}
              options={[
                { value: "table", label: "Table reservations" },
                { value: "service", label: "Service appointments" },
                { value: "class", label: "Classes / events" },
              ]}
            />
            <SelectField
              label="Confirmation"
              value={settings?.confirmation_mode ?? "manual"}
              onChange={(v) => patch({ confirmation_mode: v as BookingSettings["confirmation_mode"] })}
              options={[
                { value: "manual", label: "I confirm each one" },
                { value: "auto", label: "Auto-confirm" },
              ]}
            />
            <SelectField
              label="Slot interval"
              value={String(settings?.slot_interval_minutes ?? 30)}
              onChange={(v) => patch({ slot_interval_minutes: Number(v) })}
              options={[
                { value: "15", label: "Every 15 min" },
                { value: "30", label: "Every 30 min" },
                { value: "60", label: "Every hour" },
              ]}
            />
            <NumberField
              label={bookingType === "table" ? "Covers / capacity" : "Default duration (min)"}
              value={
                bookingType === "table"
                  ? settings?.capacity ?? ""
                  : settings?.default_duration_minutes ?? ""
              }
              onCommit={(n) =>
                bookingType === "table"
                  ? patch({ capacity: n })
                  : patch({ default_duration_minutes: n ?? 60 })
              }
            />
          </div>

          {/* Service / table type definitions */}
          <ServicesManager
            bookingType={bookingType}
            services={services}
            onAdd={addService}
            onRemove={removeService}
          />

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 active:scale-95 self-start"
          >
            <Eye className="h-4 w-4" />
            Preview customer booking
          </button>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Requests</h4>
          {pending.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-foreground text-background text-xs font-medium">
              {pending.length} pending
            </span>
          )}
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No booking requests yet. They&apos;ll appear here as customers request slots.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.customer_name}
                    {r.party_size ? <span className="text-muted-foreground"> · {r.party_size} guests</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(r.requested_at).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(r.id, "confirmed")}
                        aria-label={`Confirm booking for ${r.customer_name}`}
                        className="p-2 rounded-lg bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(r.id, "declined")}
                        aria-label={`Decline booking for ${r.customer_name}`}
                        className="p-2 rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <StatusTag status={r.status} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewOpen && (
        <CustomerBookingPreview
          businessName={claim.business_name}
          bookingType={bookingType}
          intervalMinutes={settings?.slot_interval_minutes ?? 30}
          services={services}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </fieldset>
  )
}

interface ServiceFormValue {
  name: string
  notes: string
  duration: string
  price: string
  staff: string
}

function ServicesManager({
  bookingType,
  services,
  onAdd,
  onRemove,
}: {
  bookingType: BookingSettings["booking_type"]
  services: BusinessService[]
  onAdd: (v: ServiceFormValue) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ServiceFormValue>({ name: "", notes: "", duration: "", price: "", staff: "" })
  const isService = bookingType !== "table"
  const heading = isService ? "Services you offer" : "Table types"

  const inputCls =
    "px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/40"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">{heading}</h4>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {services.length === 0 && !open ? (
        <p className="text-xs text-muted-foreground">
          {isService
            ? "Add the services customers can book — name, duration, price and who provides it."
            : "Add your table types, e.g. two-person, four-person, bar seating."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    s.duration_minutes ? `${s.duration_minutes} min` : null,
                    s.price_pennies != null ? `£${(s.price_pennies / 100).toFixed(2)}` : null,
                    s.staff_name ? `with ${s.staff_name}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No extra detail"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                aria-label={`Remove ${s.name}`}
                className="p-2 rounded-lg text-muted-foreground transition-colors hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={isService ? "e.g. Cut & finish" : "e.g. Table for two"}
            className={inputCls}
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Description (optional)"
            className={cn(inputCls, "resize-none")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              inputMode="numeric"
              placeholder="Duration (min)"
              className={inputCls}
            />
            <input
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              inputMode="decimal"
              placeholder="Price (£)"
              className={inputCls}
            />
            {isService && (
              <input
                value={form.staff}
                onChange={(e) => setForm((f) => ({ ...f, staff: e.target.value }))}
                placeholder="Provider (optional)"
                className={inputCls}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!form.name.trim()}
              onClick={() => {
                onAdd(form)
                setForm({ name: "", notes: "", duration: "", price: "", staff: "" })
                setOpen(false)
              }}
              className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-50 active:scale-95"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Read-only mock of the customer-facing booking widget. Clearly a preview. */
function CustomerBookingPreview({
  businessName,
  bookingType,
  intervalMinutes,
  services,
  onClose,
}: {
  businessName: string
  bookingType: BookingSettings["booking_type"]
  intervalMinutes: number
  services: BusinessService[]
  onClose: () => void
}) {
  const slots = useMemo(() => {
    const out: string[] = []
    for (let mins = 12 * 60; mins <= 21 * 60; mins += intervalMinutes) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
    return out.slice(0, 8)
  }, [intervalMinutes])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Customer booking preview">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Customer preview</span>
          <button type="button" onClick={onClose} aria-label="Close preview" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-serif text-2xl text-foreground">{businessName}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {bookingType === "table" ? "Reserve a table" : "Book an appointment"}
        </p>

        {bookingType !== "table" && services.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Choose a service</span>
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                <span className="text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.price_pennies != null ? `£${(s.price_pennies / 100).toFixed(2)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {bookingType === "table" && (
          <div className="mt-4">
            <span className="text-xs font-medium text-foreground">Party size</span>
            <div className="flex gap-2 mt-1.5">
              {[2, 3, 4, 5, 6].map((n) => (
                <span key={n} className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-sm text-foreground">
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <span className="text-xs font-medium text-foreground">Pick a time</span>
          <div className="grid grid-cols-4 gap-2 mt-1.5">
            {slots.map((s) => (
              <span key={s} className="rounded-xl border border-border/60 py-2 text-center text-sm text-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-5 w-full py-3 rounded-full bg-foreground text-background text-sm font-medium opacity-90 cursor-default"
        >
          Request booking
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          This is a preview of what customers see. It does not submit a real request.
        </p>
      </div>
    </div>
  )
}

function StatusTag({ status }: { status: BookingRequest["status"] }) {
  const map = {
    confirmed: { label: "Confirmed", cls: "bg-foreground/10 text-foreground" },
    declined: { label: "Declined", cls: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  } as const
  const { label, cls } = map[status]
  return (
    <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", cls)}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number | string
  onCommit: (n: number | null) => void
}) {
  const [local, setLocal] = useState(String(value ?? ""))
  useEffect(() => {
    setLocal(String(value ?? ""))
  }, [value])
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        value={local}
        inputMode="numeric"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = local.trim() === "" ? null : Number(local)
          onCommit(n != null && Number.isFinite(n) ? n : null)
        }}
        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
      />
    </div>
  )
}
