'use client'
import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useAuth } from '@/components/auth-provider'
import { portalRequest } from '@/lib/business-portal/request'
import type { BusinessClaim } from '@/lib/business-portal/client'

export function ClaimBusinessAction({ businessRef, businessName }: { businessRef: string; businessName: string }) {
  const { user } = useAuth()
  const { data, error, mutate } = useSWR<BusinessClaim[]>(user ? ['/api/merchant/claims', user.id] : null, ([url]: [string, string]) => portalRequest<BusinessClaim[]>(url))
  const [open,setOpen] = useState(false); const [evidence,setEvidence] = useState(''); const [email,setEmail] = useState(''); const [busy,setBusy] = useState(false); const [message,setMessage] = useState('')
  const claim = data?.find(c => c.business_ref === businessRef)
  const control = 'rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-50'
  if (claim) return <aside className="mt-6 flex flex-wrap items-center gap-4 text-sm"><span className="capitalize">Your claim: {claim.status}</span><Link className={control} href="/business/portal">{claim.status === 'approved' ? 'Manage this business' : 'View claim'}</Link></aside>
  return <aside className="mt-6 flex flex-col gap-3">
    {!user ? <Link href="/business/portal" className={`${control} w-fit`}>Claim this business</Link> : <button className={`${control} w-fit`} aria-expanded={open} onClick={() => setOpen(v => !v)}>Claim this business</button>}
    {open && <form className="flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-card p-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage('')
      try { await portalRequest('/api/merchant/claims',{ method:'POST',body:JSON.stringify({ businessRef,contactEmail:email,evidenceNotes:evidence }) }); await mutate(); setOpen(false) }
      catch(error) { setMessage(error instanceof Error ? error.message : 'Could not submit.') } finally { setBusy(false) }
    }}><h3 className="font-medium">Claim {businessName}</h3><p className="text-sm text-muted-foreground">Manual verification is required. A pending claim does not grant editing access.</p><label className="flex flex-col gap-2 text-sm">Business contact email<input className="rounded-xl border border-border bg-background p-3" type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label className="flex flex-col gap-2 text-sm">Evidence of ownership<textarea className="rounded-xl border border-border bg-background p-3" required minLength={10} maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)} rows={3} /></label><p className="text-xs text-muted-foreground">Describe your role and how we can verify it. Do not include passwords or identity documents.</p><button className={control} disabled={busy || !!error || !data}>{busy ? 'Submitting…' : 'Submit for review'}</button></form>}
    {(message || (open && error)) && <p className="text-sm text-destructive" role="alert">{message || error.message}</p>}
  </aside>
}
