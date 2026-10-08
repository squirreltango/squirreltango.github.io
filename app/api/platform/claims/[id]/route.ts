import { z } from 'zod'
import { administrator, body, checkOrigin, databaseError, failure, json, rateLimit, uuid } from '@/lib/business-portal/server'
const decision = z.object({ status: z.enum(['approved','rejected','revoked','disputed']), expectedStatus: z.enum(['pending','approved','rejected','revoked','disputed']), reason: z.string().trim().min(10).max(2000) }).strict()
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  try {
    const { db } = await administrator(); const id = uuid.parse((await params).id)
    const { data, error } = await db.from('merchant_claim_audit').select('id,action,reason,actor_id,created_at').eq('claim_id', id).order('created_at', { ascending: false }).limit(200)
    databaseError(error); return json(data ?? [])
  } catch (error) { return failure(error) }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request)
    const context = await administrator(); const id = uuid.parse((await params).id)
    const input = await body(request, decision); await rateLimit(context, 'admin')
    const { data, error } = await context.db.rpc('phase2_transition_claim', { p_actor: context.user.id, p_claim: id, p_expected: input.expectedStatus, p_status: input.status, p_reason: input.reason })
    databaseError(error); return json(data)
  } catch (error) { return failure(error) }
}
