import 'server-only'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const claimColumns = 'id,user_id,business_ref,business_name,status,contact_email,contact_phone,evidence_notes,created_at,reviewed_at'
export const uuid = z.string().uuid()
export class PortalError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function actor() {
  const session = await createClient()
  const { data: { user }, error } = await session.auth.getUser()
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) throw new PortalError(401, 'Sign in with a confirmed account to continue.')
  const db = createAdminClient()
  if (!db) throw new PortalError(503, 'Business management is not configured.')
  return { session, user, db }
}
export async function administrator(test = false) {
  const context = await actor()
  const { data, error } = await context.db.from('platform_admin_entitlements').select('platform_admin,subscription_test_mode').eq('user_id', context.user.id).maybeSingle()
  if (error || !data?.platform_admin || (test && !data.subscription_test_mode)) throw new PortalError(404, 'Not found.')
  return { ...context, entitlement: data }
}
export async function approvedClaim(id: string) {
  uuid.parse(id)
  const context = await actor()
  const { data, error } = await context.session.from('business_claims').select(claimColumns).eq('id', id).eq('user_id', context.user.id).eq('status', 'approved').maybeSingle()
  if (error || !data) throw new PortalError(403, 'An approved claim is required. Reload your businesses.')
  return { ...context, claim: data }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new PortalError(403, 'Request origin not allowed.')
}
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PortalError(415, 'JSON required.')
  const reader = request.body?.getReader()
  if (!reader) throw new PortalError(400, 'Request body required.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) { await reader.cancel(); throw new PortalError(413, 'Request too large.') }
      chunks.push(value)
    }
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch (error) {
    if (error instanceof SyntaxError) throw new PortalError(400, 'Invalid JSON.')
    throw error
  }
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return
  if (error.code === '23505' || error.code === '40001') throw new PortalError(409, 'This claim already exists or has changed. Reload before continuing.')
  if (error.code === '42501') throw new PortalError(403, 'This operation is not permitted.')
  if (error.code === '22023') throw new PortalError(400, 'Invalid claim transition or input.')
  if (error.code === 'P0002') throw new PortalError(404, 'Claim not found.')
  throw new PortalError(503, 'Business management is unavailable. Phase 2 database setup may still be awaiting approval.')
}
export async function rateLimit(context: Awaited<ReturnType<typeof actor>>, scope: 'submit' | 'admin' | 'profile' | 'instagram') {
  const { data, error } = await context.db.rpc('phase2_rate_limit', { p_actor: context.user.id, p_scope: scope })
  databaseError(error)
  if (data !== true) throw new PortalError(429, 'Too many attempts. Please try again in one hour.')
}
export function json(value: unknown) { return NextResponse.json(value, { headers: { 'Cache-Control': 'private, no-store' } }) }
export function failure(error: unknown) {
  const status = error instanceof PortalError ? error.status : error instanceof ZodError ? 400 : 503
  const message = error instanceof PortalError ? error.message : status === 400 ? 'Please check the submitted fields.' : 'Business management is temporarily unavailable.'
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store', ...(status === 429 ? { 'Retry-After': '3600' } : {}) } })
}
