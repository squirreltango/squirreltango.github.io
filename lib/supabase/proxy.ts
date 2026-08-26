import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase session on every request and writes the rotated
 * cookies onto the outgoing response.
 *
 * Without this, an expired access token is never refreshed and the user
 * silently appears logged out on the next server render.
 *
 * Deliberately does NOT redirect unauthenticated users. LookMeUp is a
 * discovery product: browsing, search and business pages must stay open to
 * anonymous visitors. Individual pages that need a user (Saved, My Plans, the
 * business portal) do their own check and prompt for sign-in in place.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Touching getUser() is what triggers the refresh. Do not remove.
  await supabase.auth.getUser()

  return supabaseResponse
}
