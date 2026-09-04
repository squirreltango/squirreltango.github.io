"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clock, Loader2, X } from "lucide-react"
import {
  getBookingSettings,
  saveBookingSettings,
  listBookingRequests,
  updateBookingStatus,
  type BookingSettings,
  type BookingRequest,
  type BusinessClaim,
} from "@/lib/business-portal/client"
import { cn } from "@/lib/utils"

/**
 * Silver: native in-app bookings. Merchants toggle acceptance, set the slot
 * cadence, and confirm/decline genuine requests. Everything here is real data
 * from the DB — there are no sample bookings.
 */
export function BookingsSection({ claim }: { claim: BusinessClaim }) {
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        getBookingSettings(claim.id),
        listBookingRequests(claim.business_ref),
      ])
      setSettings(s)
      setRequests(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings.")
    } finally {
      setLoading(false)
    }
  }, [claim.id, claim.business_ref])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(next: Partial<BookingSettings>) {
    setSaving(true)
    setError(null)
    try {
      const updated = await saveBookingSettings(claim, {
        accepts_bookings: settings?.accepts_bookings ?? false,
        booking_type: settings?.booking_type ?? "table",
        slot_interval_minutes: settings?.slot_interval_minutes ?? 30,
        default_duration_minutes: settings?.default_duration_minutes ?? 90,
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
    // Optimistic: reflect immediately, roll back on error.
    const prev = requests
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await updateBookingStatus(id, status)
    } catch (e) {
      setRequests(prev)
      setError(e instanceof Error ? e.message : "Could not update the booking.")
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
  const pending = requests.filter((r) => r.status === "pending")

  return (
    <fieldset className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-background/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bookings</legend>
          <p className="text-sm text-muted-foreground mt-1">
            Accept requests directly on your listing.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepts}
          disabled={saving}
          onClick={() => patch({ accepts_bookings: !accepts })}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors shrink-0",
            accepts ? "bg-foreground" : "bg-muted",
          )}
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
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="What you take"
            value={settings?.booking_type ?? "table"}
            onChange={(v) => patch({ booking_type: v as BookingSettings["booking_type"] })}
            options={[
              { value: "table", label: "Table reservations" },
              { value: "service", label: "Service appointments" },
              { value: "class", label: "Classes / events" },
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
          <SelectField
            label="Confirmation"
            value={settings?.confirmation_mode ?? "manual"}
            onChange={(v) => patch({ confirmation_mode: v as BookingSettings["confirmation_mode"] })}
            options={[
              { value: "manual", label: "I confirm each one" },
              { value: "auto", label: "Auto-confirm" },
            ]}
          />
        </div>
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
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3"
              >
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
    </fieldset>
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
