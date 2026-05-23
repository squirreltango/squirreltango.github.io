import { createBrowserClient } from "@supabase/ssr"

// Hardcoded Supabase credentials (for debugging)
const supabaseUrl = "https://cytwncsewgetuwmhevdv.supabase.co"
const supabaseKey = "sb_publishable_3MF6gKUpsNs_iHzjNS2_4A_yjVFs4Nc"

export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey)
}
