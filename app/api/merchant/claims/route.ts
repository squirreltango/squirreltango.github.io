import { z } from 'zod'
import { actor, body, checkOrigin, claimColumns, databaseError, failure, json, PortalError, rateLimit, uuid } from '@/lib/business-portal/server'

const submission = z.object({
  businessRef: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9_-]+$/),
  contactEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  evidenceNotes: z.string().trim().min(10).max(2000),
}).strict()

export async function GET() {
  try {
    const { session, user } = await actor()
    const { data, error } = await session.from('business_claims').select(claimColumns).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
    databaseError(error)
    return json(data ?? [])
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request)
    const context = await actor()
    const input = await body(request, submission)
    await rateLimit(context, 'submit')
    let ref = input.businessRef; let name: string
    if (uuid.safeParse(ref).success) {
      const { data, error } = await context.db.from('businesses').select('id,name').eq('id', ref.toLowerCase()).maybeSingle()
      databaseError(error)
      if (!data) throw new PortalError(404, 'Choose an existing business from SpotMeOut.')
      ref = data.id; name = data.name
    } else {
      const key = process.env.GOOGLE_PLACES_API_KEY
      if (!key) throw new PortalError(503, 'Google business validation is unavailable.')
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(ref)}`, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,businessStatus' },
        cache: 'no-store', signal: AbortSignal.timeout(10000),
      })
      if (response.status === 404 || response.status === 400) throw new PortalError(404, 'Choose an existing Google Places business.')
      if (!response.ok) throw new PortalError(503, 'Google business validation is unavailable.')
      const place = await response.json()
      if (place.id !== ref || typeof place.displayName?.text !== 'string' || place.businessStatus === 'CLOSED_PERMANENTLY') throw new PortalError(400, 'This business is not eligible for a claim.')
      name = place.displayName.text
    }
    const { data, error } = await context.db.rpc('phase2_submit_claim', {
      p_actor: context.user.id, p_ref: ref, p_name: name,
      p_email: input.contactEmail || null, p_phone: input.contactPhone || null, p_evidence: input.evidenceNotes,
    })
    databaseError(error)
    return json(data)
  } catch (error) { return failure(error) }
}
