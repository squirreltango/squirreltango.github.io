"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { Business } from "@/lib/types/business"

/**
 * Denormalised copy of the parts of a business needed to render a saved card.
 *
 * Saves point at a Google Place ID that Google can retire at any time, so we
 * keep a snapshot rather than relying on being able to re-fetch the venue.
 * A saved place must never disappear from a user's list because an upstream
 * ID went away.
 */
export interface SavedSnapshot {
  name: string
  category: string
  address?: string
  neighbourhood?: string
  image?: string
  rating?: number
  reviewCount?: number
  priceLevel?: number
}

export interface SavedPlace {
  id: string
  businessRef: string
  collection: string
  notes: string | null
  snapshot: SavedSnapshot | null
  createdAt: string
}

export const DEFAULT_COLLECTION = "general"

interface SavedPlacesContextValue {
  saved: SavedPlace[]
  savedRefs: Set<string>
  collections: string[]
  loading: boolean
  isSaved: (ref: string) => boolean
  /** Returns true if the place ended up saved, false if it was removed. */
  toggleSave: (business: Business, collection?: string) => Promise<boolean>
  remove: (ref: string) => Promise<void>
  moveToCollection: (ref: string, collection: string) => Promise<void>
  /** True when a save was attempted while signed out. */
  needsAuth: boolean
  clearNeedsAuth: () => void
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null)

function snapshotOf(business: Business): SavedSnapshot {
  return {
    name: business.name,
    category: business.category,
    address: business.location?.address,
    neighbourhood: business.location?.neighbourhood,
    image: business.media?.hero ?? business.media?.images?.[0],
    rating: business.rating?.overall,
    reviewCount: business.rating?.reviewCount,
    priceLevel: business.priceLevel,
  }
}

export function SavedPlacesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [saved, setSaved] = useState<SavedPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Signed out: no saves to show. We deliberately do NOT fall back to
      // localStorage - saves are account data and must round-trip the server.
      setSaved([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from("saved_businesses")
      .select("id, business_ref, collection, notes, business_snapshot, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.log("[v0] saved fetch failed:", error.message)
          setSaved([])
        } else {
          setSaved(
            (data ?? []).map((row) => ({
              id: row.id as string,
              businessRef: row.business_ref as string,
              collection: (row.collection as string) ?? DEFAULT_COLLECTION,
              notes: (row.notes as string | null) ?? null,
              snapshot: (row.business_snapshot as SavedSnapshot | null) ?? null,
              createdAt: row.created_at as string,
            })),
          )
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, authLoading, supabase])

  const savedRefs = useMemo(() => new Set(saved.map((s) => s.businessRef)), [saved])

  const collections = useMemo(() => {
    const set = new Set<string>()
    for (const s of saved) set.add(s.collection)
    return [...set].sort((a, b) =>
      a === DEFAULT_COLLECTION ? -1 : b === DEFAULT_COLLECTION ? 1 : a.localeCompare(b),
    )
  }, [saved])

  const isSaved = useCallback((ref: string) => savedRefs.has(ref), [savedRefs])

  const toggleSave = useCallback(
    async (business: Business, collection = DEFAULT_COLLECTION) => {
      if (!user) {
        setNeedsAuth(true)
        return false
      }

      const ref = business.externalIds?.googlePlaceId ?? business.id
      const existing = saved.find((s) => s.businessRef === ref)

      if (existing) {
        // Optimistic remove, rolled back if the delete fails.
        setSaved((prev) => prev.filter((s) => s.businessRef !== ref))
        const { error } = await supabase.from("saved_businesses").delete().eq("id", existing.id)
        if (error) {
          console.log("[v0] unsave failed:", error.message)
          setSaved((prev) => [existing, ...prev])
          return true
        }
        return false
      }

      const snapshot = snapshotOf(business)
      const optimistic: SavedPlace = {
        id: `pending-${ref}`,
        businessRef: ref,
        collection,
        notes: null,
        snapshot,
        createdAt: new Date().toISOString(),
      }
      setSaved((prev) => [optimistic, ...prev])

      const { data, error } = await supabase
        .from("saved_businesses")
        .insert({
          user_id: user.id,
          business_ref: ref,
          collection,
          business_snapshot: snapshot,
        })
        .select("id, created_at")
        .single()

      if (error) {
        console.log("[v0] save failed:", error.message)
        setSaved((prev) => prev.filter((s) => s.id !== optimistic.id))
        return false
      }

      // Swap the placeholder for the real row so later edits target a real id.
      setSaved((prev) =>
        prev.map((s) =>
          s.id === optimistic.id
            ? { ...s, id: data.id as string, createdAt: data.created_at as string }
            : s,
        ),
      )
      return true
    },
    [user, saved, supabase],
  )

  const remove = useCallback(
    async (ref: string) => {
      const existing = saved.find((s) => s.businessRef === ref)
      if (!existing) return
      setSaved((prev) => prev.filter((s) => s.businessRef !== ref))
      const { error } = await supabase.from("saved_businesses").delete().eq("id", existing.id)
      if (error) {
        console.log("[v0] remove failed:", error.message)
        setSaved((prev) => [existing, ...prev])
      }
    },
    [saved, supabase],
  )

  const moveToCollection = useCallback(
    async (ref: string, collection: string) => {
      const existing = saved.find((s) => s.businessRef === ref)
      if (!existing) return
      const previous = existing.collection
      setSaved((prev) =>
        prev.map((s) => (s.businessRef === ref ? { ...s, collection } : s)),
      )
      const { error } = await supabase
        .from("saved_businesses")
        .update({ collection })
        .eq("id", existing.id)
      if (error) {
        console.log("[v0] move failed:", error.message)
        setSaved((prev) =>
          prev.map((s) => (s.businessRef === ref ? { ...s, collection: previous } : s)),
        )
      }
    },
    [saved, supabase],
  )

  const value = useMemo<SavedPlacesContextValue>(
    () => ({
      saved,
      savedRefs,
      collections,
      loading,
      isSaved,
      toggleSave,
      remove,
      moveToCollection,
      needsAuth,
      clearNeedsAuth: () => setNeedsAuth(false),
    }),
    [saved, savedRefs, collections, loading, isSaved, toggleSave, remove, moveToCollection, needsAuth],
  )

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext)
  if (!ctx) throw new Error("useSavedPlaces must be used inside <SavedPlacesProvider>")
  return ctx
}
