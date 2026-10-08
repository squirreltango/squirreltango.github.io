import 'server-only'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { actor, approvedClaim, databaseError, PortalError, rateLimit } from './server'
import { getInstagramProvider } from './instagram-provider'
const cookieName = 'spotmeout_instagram_oauth'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function seal(token: string, key: Buffer, binding: string) {
  if (key.length !== 32) throw new PortalError(503, 'Instagram token storage is not configured.')
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',key,iv)
  cipher.setAAD(Buffer.from(binding))
  return Buffer.concat([iv,cipher.update(token,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64')
}
function unseal(value: string, key: Buffer, binding: string) {
  const bytes = Buffer.from(value,'base64'); const cipher = createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12))
  cipher.setAAD(Buffer.from(binding)); cipher.setAuthTag(bytes.subarray(-16))
  return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString('utf8')
}
export async function instagramStatus(id: string) {
  const context = await approvedClaim(id)
  if (!getInstagramProvider()) return { status: 'setup_required', username: null, expiresAt: null }
  const { data, error } = await context.db.from('merchant_instagram_tokens').select('username,expires_at').eq('claim_id',id).eq('actor_id',context.user.id).maybeSingle()
  databaseError(error)
  return { status: !data ? 'disconnected' : new Date(data.expires_at).getTime() <= Date.now() ? 'expired' : 'connected', username: data?.username ?? null, expiresAt: data?.expires_at ?? null }
}
export async function beginInstagram(id: string) {
  const context = await approvedClaim(id); const provider = getInstagramProvider()
  if (!provider) throw new PortalError(503,'Instagram is not connected / setup required.')
  await rateLimit(context,'instagram')
  const state = randomBytes(32).toString('base64url'); const browser = randomBytes(32).toString('base64url')
  const url = provider.authorizationUrl(state)
  if (url.protocol !== 'https:' || !['www.instagram.com','www.facebook.com'].includes(url.hostname)) throw new PortalError(503,'Official Instagram authorization is unavailable.')
  const { error } = await context.db.from('merchant_instagram_states').upsert({ state_hash:hash(state), actor_id:context.user.id,claim_id:id,browser_hash:hash(browser),consumed_at:null,expires_at:new Date(Date.now()+600000).toISOString() },{onConflict:'actor_id,claim_id'})
  databaseError(error)
  ;(await cookies()).set(cookieName,browser,{ httpOnly:true,secure:true,sameSite:'lax',path:'/api/merchant/instagram',maxAge:600 })
  return url.toString()
}
export async function finishInstagram(url: URL) {
  const context = await actor(); const provider = getInstagramProvider()
  if (!provider) throw new PortalError(503,'Instagram is not connected / setup required.')
  const state = url.searchParams.get('state'); const code = url.searchParams.get('code'); const jar = await cookies(); const browser = jar.get(cookieName)?.value
  if (!state || state.length > 256 || !browser) throw new PortalError(400,'Instagram authorization has expired. Reconnect from the business portal.')
  // Atomic consumption rejects replays; the row survives until commit so a
  // disconnect or newer authorization can invalidate an in-flight exchange.
  const { data, error } = await context.db.rpc('phase2_consume_instagram_state', { p_actor: context.user.id, p_state: hash(state), p_browser: hash(browser) })
  databaseError(error); jar.delete(cookieName)
  if (!data || !code || code.length > 4096 || url.searchParams.has('error')) throw new PortalError(400,'Instagram authorization was not completed. Please reconnect.')
  await approvedClaim(data)
  const token = await provider.exchangeCode(code)
  if (!token.token || !token.accountId || !token.username || !Number.isFinite(token.expiresAt.getTime()) || token.expiresAt.getTime() <= Date.now()) throw new PortalError(502,'Instagram returned an invalid authorization.')
  const result = await context.db.rpc('phase2_store_instagram',{p_actor:context.user.id,p_claim:data,p_account:token.accountId,p_username:token.username,p_token:seal(token.token,provider.encryptionKey,`${context.user.id}:${data}`),p_expires:token.expiresAt.toISOString(),p_state:hash(state)})
  databaseError(result.error)
}
export async function disconnectInstagram(id: string) {
  const context = await approvedClaim(id); await rateLimit(context,'instagram')
  const { data, error } = await context.db.from('merchant_instagram_tokens').select('encrypted_token').eq('claim_id',id).eq('actor_id',context.user.id).maybeSingle()
  databaseError(error)
  if (data) {
    const provider = getInstagramProvider()
    if (!provider) throw new PortalError(503,'Provider setup is required to revoke Instagram authorization.')
    await provider.revoke(unseal(data.encrypted_token,provider.encryptionKey,`${context.user.id}:${id}`))
  }
  const { error: disconnectError } = await context.db.rpc('phase2_disconnect_instagram', { p_actor: context.user.id, p_claim: id })
  databaseError(disconnectError)
}
