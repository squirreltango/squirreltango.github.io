import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEMO_EMAILS, isDemoEnabled, type DemoPersona } from "@/lib/demo/config"

/**
 * Preview/Development-only demo sign-in.
 *
 * The client posts only a persona ("individual" | "business"). The password is
 * never sent from, or stored in, client code: it is derived server-side.
 *
 * In Production this route returns 404 so the demo surface does not exist at
 * all - not merely hidden in the UI.
 */

export const dynamic = "force-dynamic"

/**
 * Server-only demo password.
 *
 * Preference order:
 *  1. DEMO_ACCOUNT_PASSWORD, if the operator sets one.
 *  2. A value derived from the service-role secret, which never leaves the
 *     server. This keeps Preview zero-config while avoiding a weak literal.
 */
function demoPassword(): string | null {
  const explicit = process.env.DEMO_ACCOUNT_PASSWORD
  if (explicit && explicit.length >= 12) return explicit

  const seed = process.env.service_role_secret || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!seed) return null
  // Deterministic so the account can be recreated and signed into repeatedly.
  return `demo!${seed.slice(-24)}`
}

export async function POST(request: Request) {
  if (!isDemoEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const password = demoPassword()
  if (!password) {
    return NextResponse.json(
      { error: "Demo accounts unavailable: no server secret configured." },
      { status: 503 },
    )
  }

  let persona: DemoPersona
  try {
    const body = (await request.json()) as { persona?: string }
    persona = body.persona === "business" ? "business" : "individual"
  } catch {
    persona = "individual"
  }

  const email = DEMO_EMAILS[persona]
  const supabase = await createClient()

  // Try to sign in first - the usual path once the demo user exists.
  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error) {
    return NextResponse.json({ ok: true, persona, created: false })
  }

  // First run in this environment: provision the demo user with the service
  // role so it is email-confirmed and immediately usable.
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Demo accounts need the service role secret to be provisioned." },
      { status: 503 },
    )
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: persona === "business" ? "Demo Business" : "Demo Individual",
      account_type: persona === "business" ? "business" : "personal",
      is_demo: true,
    },
  })

  // "already registered" means the password drifted (e.g. the secret rotated).
  // Reset it so Preview keeps working rather than dead-ending.
  if (created.error && !/already/i.test(created.error.message)) {
    return NextResponse.json({ error: created.error.message }, { status: 500 })
  }

  let userId = created.data?.user?.id

  if (created.error) {
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users.find((u) => u.email === email)
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, { password })
      // Reuse the existing id so the profile upsert below still runs.
      userId = existing.id
    }
  }

  // Ensure the profile row carries the right account type for the portal.
  if (userId) {
    await admin.from("profiles").upsert(
      {
        id: userId,
        account_type: persona === "business" ? "business" : "personal",
        full_name: persona === "business" ? "Demo Business" : "Demo Individual",
      },
      { onConflict: "id" },
    )
  }

  const retry = await supabase.auth.signInWithPassword({ email, password })
  if (retry.error) {
    return NextResponse.json({ error: retry.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persona, created: true })
}
