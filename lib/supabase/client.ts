import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Hardcoded Supabase credentials (for debugging)
const supabaseUrl = "https://cytwncsewgetuwmhevdv.supabase.co"
const supabaseAnonKey = "sb_publishable_3MF6gKUpsNs_iHzjNS2_4A_yjVFs4Nc"

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

export function createClient() {
  return supabase
}
