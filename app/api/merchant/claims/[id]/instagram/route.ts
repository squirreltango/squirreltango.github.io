import { checkOrigin, failure, json } from '@/lib/business-portal/server'
import { beginInstagram, disconnectInstagram, instagramStatus } from '@/lib/business-portal/instagram-server'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  try { return json(await instagramStatus((await params).id)) } catch(error) { return failure(error) }
}
export async function POST(request: Request, { params }: Context) {
  try { checkOrigin(request); return json({ url: await beginInstagram((await params).id) }) } catch(error) { return failure(error) }
}
export async function DELETE(request: Request, { params }: Context) {
  try { checkOrigin(request); await disconnectInstagram((await params).id); return json({ disconnected: true }) } catch(error) { return failure(error) }
}
