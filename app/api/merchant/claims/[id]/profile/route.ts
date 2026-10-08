import { z } from 'zod'
import { approvedClaim, body, checkOrigin, databaseError, failure, json, rateLimit } from '@/lib/business-portal/server'
const link = z.union([z.literal(''), z.string().trim().url().max(2000).refine(v => ['https:', 'http:'].includes(new URL(v).protocol))]).nullable().optional()
const draft = z.object({
  tagline: z.string().trim().max(200).nullable().optional(), description: z.string().trim().max(5000).nullable().optional(),
  booking_url: link, menu_url: link, order_url: link, website_url: link, instagram_url: link, facebook_url: link, x_url: link, tiktok_url: link,
  contact_phone: z.string().trim().max(40).nullable().optional(), contact_email: z.union([z.literal(''),z.string().trim().email().max(254)]).nullable().optional(),
}).strict()
const columns = 'id,claim_id,user_id,business_ref,tagline,description,booking_url,menu_url,order_url,website_url,contact_phone,contact_email,instagram_url,facebook_url,x_url,tiktok_url'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  try {
    const { session, claim } = await approvedClaim((await params).id)
    const { data, error } = await session.from('business_profiles').select(columns).eq('claim_id', claim.id).maybeSingle()
    databaseError(error); return json(data)
  } catch (error) { return failure(error) }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    checkOrigin(request); const context = await approvedClaim((await params).id)
    const input = await body(request, draft); await rateLimit(context, 'profile')
    const payload = Object.fromEntries(Object.entries(input).map(([key,value]) => [key, value || null]))
    const { data: existing, error: readError } = await context.session.from('business_profiles').select('id').eq('claim_id',context.claim.id).maybeSingle()
    databaseError(readError)
    const query = existing
      ? context.session.from('business_profiles').update(payload).eq('id',existing.id).eq('user_id',context.user.id)
      : context.session.from('business_profiles').insert({ ...payload, claim_id: context.claim.id, user_id: context.user.id, business_ref: context.claim.business_ref })
    const { data, error } = await query.select(columns).single()
    databaseError(error); return json(data)
  } catch (error) { return failure(error) }
}
