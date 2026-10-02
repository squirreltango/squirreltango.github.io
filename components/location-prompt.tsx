"use client"

import { useState } from "react"
import { LocateFixed, X } from "lucide-react"

export function LocationPrompt() {
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || status === "granted") return null

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("denied")
      return
    }

    setStatus("requesting")
    navigator.geolocation.getCurrentPosition(
      () => setStatus("granted"),
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  return (
    <section className="mb-8 rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6" aria-labelledby="location-prompt-title">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="location-prompt-title" className="font-semibold tracking-tight">Discover what&apos;s around you</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Use your location to improve nearby discovery. Your browser will ask for permission before sharing it.
          </p>
          {status === "denied" && (
            <p className="mt-2 text-xs text-muted-foreground">Location permission was not granted. You can enable it in your browser settings.</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex shrink-0 items-center gap-2 sm:mt-0">
        <button
          type="button"
          onClick={requestLocation}
          disabled={status === "requesting" || status === "denied"}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "requesting" ? "Requesting…" : "Use my location"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss location prompt">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

export default LocationPrompt
