import { NextResponse } from 'next/server'
import { finishInstagram } from '@/lib/business-portal/instagram-server'
import { failure } from '@/lib/business-portal/server'
export async function GET(request: Request) {
  try {
    await finishInstagram(new URL(request.url))
    return NextResponse.redirect(new URL('/business/portal',request.url), { headers:{ 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' } })
  } catch(error) { return failure(error) }
}
