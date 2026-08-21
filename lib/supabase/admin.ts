import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client using the service-role key.
 *
 * The `businesses` table has row-level security enabled, which blocks writes
 * made with the public anon key. Ingestion therefore requires the service-role
 * key. This client must NEVER be imported into client components.
 *
 * Returns `null` when the key is not configured so callers can degrade
 * gracefully with a clear message instead of throwing at import time.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // This project exposes the service role as `service_role_secret`; keep the
  // standard `SUPABASE_SERVICE_ROLE_KEY` name as a fallback for portability.
  const serviceRoleKey = process.env.service_role_secret || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
