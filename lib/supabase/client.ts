import { createBrowserClient } from '@supabase/ssr'

// Keep one browser client per tab. Creating a client for every data request
// makes Supabase Auth compete for the same navigator lock and can release an
// in-flight session request when another client steals it.
type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

type SupabaseBrowserGlobal = typeof globalThis & {
  __lookMeUpSupabaseClient?: BrowserSupabaseClient
}

export function createClient(): BrowserSupabaseClient {
  const globalScope = globalThis as SupabaseBrowserGlobal

  if (!globalScope.__lookMeUpSupabaseClient) {
    globalScope.__lookMeUpSupabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return globalScope.__lookMeUpSupabaseClient
}
