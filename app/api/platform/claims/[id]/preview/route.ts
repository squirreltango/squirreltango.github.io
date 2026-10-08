import { z } from 'zod'
import { administrator, body, checkOrigin, databaseError, failure, json, rateLimit, uuid } from '@/lib/business-portal/server'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  try {
    const { db, user } = await administrator(true); const id = uuid.parse((await params).id)
    const { data: claim, error: claimError } = await db.from('business_claims').select('id').eq('id',id).eq('status','approved').maybeSingle()
    databaseError(claimError)
    if (!claim) return json(null)
    const { data, error } = await db.from('merchant_plan_previews').select('tier,expires_at').eq('claim_id', id).eq('admin_user_id', user.id).gt('expires_at', new Date().toISOString()).maybeSingle()
    databaseError(error); return json(data)
  } catch (error) { return failure(error) }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request); const context = await administrator(true); const id = uuid.parse((await params).id)
    const input = await body(request, z.object({ tier: z.enum(['bronze','silver','gold_preview']) }).strict())
    await rateLimit(context, 'admin')
    const { data, error } = await context.db.rpc('phase2_set_preview', { p_actor: context.user.id, p_claim: id, p_tier: input.tier })
    databaseError(error); return json(data)
  } catch (error) { return failure(error) }
}
