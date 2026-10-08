'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { portalRequest } from '@/lib/business-portal/request'
import { InstagramSection } from './instagram-section'
export function InstagramConnection({ claimId, instagramUrl }: { claimId: string; instagramUrl?: string | null }) {
  const url = `/api/merchant/claims/${claimId}/instagram`
  const { data, error, mutate } = useSWR<{ status: string; username: string | null; expiresAt: string | null }>(url,portalRequest,{refreshInterval:60000})
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('')
  async function change(disconnect: boolean) {
    setBusy(true); setMessage('')
    try {
      const result = await portalRequest<{url?:string}>(url,{method:disconnect ? 'DELETE':'POST'})
      if (result.url) {
        const target = new URL(result.url)
        if (target.protocol !== 'https:' || !['www.instagram.com','www.facebook.com'].includes(target.hostname)) throw new Error('Invalid authorization destination.')
        window.location.assign(target.href)
      } else await mutate()
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Instagram request failed.') } finally { setBusy(false) }
  }
  return <section className="flex flex-col gap-3"><InstagramSection instagramUrl={instagramUrl} connection={data?.status === 'connected' ? {status:'connected',username:data.username,followers_count:null,media_count:null,last_synced_at:null} : null} />
    {data?.status === 'setup_required' && <p className="text-sm text-muted-foreground">Not connected / setup required. Official Meta authorization is not configured.</p>}
    {data?.status === 'expired' && <p>Instagram authorization expired. Reconnect to continue.</p>}
    {data && data.status !== 'setup_required' && <div className="flex gap-3"><button type="button" disabled={busy} className="rounded-full border px-4 py-2 text-sm" onClick={() => change(false)}>{data.status === 'disconnected' ? 'Connect Instagram' : 'Reconnect Instagram'}</button>{data.status !== 'disconnected' && <button type="button" disabled={busy} className="rounded-full border px-4 py-2 text-sm" onClick={() => change(true)}>Disconnect</button>}</div>}
    {(error || message) && <p role="alert" className="text-sm text-destructive">{message || error?.message}</p>}
  </section>
}
