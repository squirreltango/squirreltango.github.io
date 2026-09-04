import { createClient } from "@/lib/supabase/client"
import type { SavedSnapshot } from "@/components/saved-places-provider"

/**
 * Read-only view of a shared plan.
 *
 * Fetched through the get_shared_itinerary(token) RPC rather than a table
 * select. RLS on itineraries is owner-only precisely so that shared plans
 * cannot be enumerated: possession of the high-entropy share token is the
 * capability. The function also strips participant emails, returning first
 * names only.
 */
export interface SharedItinerary {
  id: string
  title: string
  planDate: string | null
  notes: string | null
  items: SharedItineraryItem[]
  participants: { name: string }[]
}

export interface SharedItineraryItem {
  id: string
  businessRef: string | null
  customTitle: string | null
  startTime: string | null
  durationMinutes: number | null
  position: number
  notes: string | null
  businessSnapshot: SavedSnapshot | null
}

interface RawSharedItinerary {
  id: string
  title: string
  plan_date: string | null
  notes: string | null
  items: {
    id: string
    business_ref: string | null
    custom_title: string | null
    start_time: string | null
    duration_minutes: number | null
    position: number
    notes: string | null
    business_snapshot: SharedItineraryItem["businessSnapshot"]
  }[]
  participants: { name: string | null }[]
}

/** Returns null for an unknown, revoked or un-shared token. */
export async function getSharedItinerary(token: string): Promise<SharedItinerary | null> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc("get_shared_itinerary", {
    p_share_token: token,
  })

  if (error || !data) return null

  const raw = data as RawSharedItinerary

  return {
    id: raw.id,
    title: raw.title,
    planDate: raw.plan_date,
    notes: raw.notes,
    items: (raw.items ?? []).map((item) => ({
      id: item.id,
      businessRef: item.business_ref,
      customTitle: item.custom_title,
      startTime: item.start_time,
      durationMinutes: item.duration_minutes,
      position: item.position,
      notes: item.notes,
      businessSnapshot: item.business_snapshot,
    })),
    // Defensive: drop any participant without a usable name.
    participants: (raw.participants ?? [])
      .filter((p): p is { name: string } => Boolean(p.name))
      .map((p) => ({ name: p.name })),
  }
}
