import { administrator, claimColumns, databaseError, failure, json } from '@/lib/business-portal/server'

export async function GET(request: Request) {
  try {
    const { db, entitlement } = await administrator()
    const page = Math.max(0, Math.min(10000, Number(new URL(request.url).searchParams.get('page')) || 0))
    const { data, error } = await db.from('business_claims').select(claimColumns).order('created_at', { ascending: false }).order('id').range(Math.floor(page) * 25, Math.floor(page) * 25 + 24)
    databaseError(error)
    return json({ claims: data ?? [], canPreview: entitlement.subscription_test_mode })
  } catch (error) { return failure(error) }
}
