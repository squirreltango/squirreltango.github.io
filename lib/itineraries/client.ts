import { createClient } from "@/lib/supabase/client"
import type { SavedSnapshot } from "@/components/saved-places-provider"

export interface Itinerary {
  id: string
  title: string
  planDate: string | null
  notes: string | null
  shareToken: string | null
  isPublic: boolean
  createdAt: string
}

export interface ItineraryItem {
  id: string
  itineraryId: string
  businessRef: string | null
  customTitle: string | null
  startTime: string | null
  durationMinutes: number | null
  position: number
  notes: string | null
  snapshot: SavedSnapshot | null
}

const ITINERARY_COLUMNS =
  "id, title, plan_date, notes, share_token, is_public, created_at"
const ITEM_COLUMNS =
  "id, itinerary_id, business_ref, custom_title, start_time, duration_minutes, position, notes, business_snapshot"

/* eslint-disable @typescript-eslint/no-explicit-any */
function toItinerary(row: any): Itinerary {
  return {
    id: row.id,
    title: row.title,
    planDate: row.plan_date ?? null,
    notes: row.notes ?? null,
    shareToken: row.share_token ?? null,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
  }
}

function toItem(row: any): ItineraryItem {
  return {
    id: row.id,
    itineraryId: row.itinerary_id,
    businessRef: row.business_ref ?? null,
    customTitle: row.custom_title ?? null,
    startTime: row.start_time ?? null,
    durationMinutes: row.duration_minutes ?? null,
    position: row.position ?? 0,
    notes: row.notes ?? null,
    snapshot: row.business_snapshot ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listItineraries(): Promise<Itinerary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("itineraries")
    .select(ITINERARY_COLUMNS)
    .order("plan_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.log("[v0] listItineraries failed:", error.message)
    return []
  }
  return (data ?? []).map(toItinerary)
}

export async function createItinerary(input: {
  userId: string
  title: string
  planDate?: string | null
}): Promise<Itinerary | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("itineraries")
    .insert({
      user_id: input.userId,
      title: input.title.trim() || "Untitled plan",
      plan_date: input.planDate || null,
    })
    .select(ITINERARY_COLUMNS)
    .single()

  if (error) {
    console.log("[v0] createItinerary failed:", error.message)
    return null
  }
  return toItinerary(data)
}

export async function updateItinerary(
  id: string,
  patch: Partial<{ title: string; planDate: string | null; notes: string | null; isPublic: boolean }>,
): Promise<boolean> {
  const supabase = createClient()
  const payload: Record<string, unknown> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.planDate !== undefined) payload.plan_date = patch.planDate
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.isPublic !== undefined) payload.is_public = patch.isPublic

  const { error } = await supabase.from("itineraries").update(payload).eq("id", id)
  if (error) {
    console.log("[v0] updateItinerary failed:", error.message)
    return false
  }
  return true
}

export async function deleteItinerary(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("itineraries").delete().eq("id", id)
  if (error) {
    console.log("[v0] deleteItinerary failed:", error.message)
    return false
  }
  return true
}

export async function getItinerary(id: string): Promise<Itinerary | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("itineraries")
    .select(ITINERARY_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null
  return toItinerary(data)
}

export async function listItems(itineraryId: string): Promise<ItineraryItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(ITEM_COLUMNS)
    .eq("itinerary_id", itineraryId)
    .order("position", { ascending: true })

  if (error) {
    console.log("[v0] listItems failed:", error.message)
    return []
  }
  return (data ?? []).map(toItem)
}

export async function addItem(input: {
  itineraryId: string
  businessRef?: string | null
  customTitle?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  notes?: string | null
  snapshot?: SavedSnapshot | null
  position: number
}): Promise<ItineraryItem | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("itinerary_items")
    .insert({
      itinerary_id: input.itineraryId,
      business_ref: input.businessRef ?? null,
      custom_title: input.customTitle ?? null,
      start_time: input.startTime || null,
      duration_minutes: input.durationMinutes ?? null,
      notes: input.notes ?? null,
      business_snapshot: input.snapshot ?? null,
      position: input.position,
    })
    .select(ITEM_COLUMNS)
    .single()

  if (error) {
    console.log("[v0] addItem failed:", error.message)
    return null
  }
  return toItem(data)
}

export async function updateItem(
  id: string,
  patch: Partial<{
    startTime: string | null
    durationMinutes: number | null
    notes: string | null
    customTitle: string | null
    position: number
  }>,
): Promise<boolean> {
  const supabase = createClient()
  const payload: Record<string, unknown> = {}
  if (patch.startTime !== undefined) payload.start_time = patch.startTime || null
  if (patch.durationMinutes !== undefined) payload.duration_minutes = patch.durationMinutes
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.customTitle !== undefined) payload.custom_title = patch.customTitle
  if (patch.position !== undefined) payload.position = patch.position

  const { error } = await supabase.from("itinerary_items").update(payload).eq("id", id)
  if (error) {
    console.log("[v0] updateItem failed:", error.message)
    return false
  }
  return true
}

export async function deleteItem(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("itinerary_items").delete().eq("id", id)
  if (error) {
    console.log("[v0] deleteItem failed:", error.message)
    return false
  }
  return true
}

/** Persist a whole reordering in one pass, so positions never collide. */
export async function persistOrder(items: ItineraryItem[]): Promise<void> {
  await Promise.all(items.map((item, index) => updateItem(item.id, { position: index })))
}
