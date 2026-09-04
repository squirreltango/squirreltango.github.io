import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Exchanges the `?code=` Supabase sends on email confirmation / password
 * recovery for a real session, then forwards the user on.
 *
 * Required for the email-link flows to work at all: without this route the
 * confirmation link lands on a page with no session and the user appears to
 * still be logged out.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  // `next` lets us send the user back where they started (e.g. the venue they
  // were trying to save). Restricted to relative paths so the parameter cannot
  // be used as an open redirect to another origin.
  const rawNext = searchParams.get("next") ?? "/"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`,
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
