import type { NextRequest } from "next/server"

/**
 * Shared guard for protected admin/ingestion routes.
 *
 * The secret is read from the server-side `ADMIN_INGEST_SECRET` environment
 * variable and is never exposed to the client. Callers may present it either as
 * an `Authorization: Bearer <secret>` header or an `x-admin-secret` header.
 *
 * Defaults to DENY: if no secret is configured on the server, the route is
 * locked rather than left open.
 */
export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function verifyAdminRequest(request: NextRequest): AdminAuthResult {
  const secret = process.env.ADMIN_INGEST_SECRET
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error:
        "ADMIN_INGEST_SECRET is not configured. Set it as a server-side environment " +
        "variable to enable protected admin routes.",
    }
  }

  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined
  const provided = bearer ?? request.headers.get("x-admin-secret") ?? undefined

  if (!provided || !timingSafeEqual(provided, secret)) {
    return { ok: false, status: 401, error: "Unauthorized: missing or invalid admin secret." }
  }

  return { ok: true }
}
