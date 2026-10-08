'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import type { BusinessClaim } from '@/lib/business-portal/client'
import { portalRequest } from '@/lib/business-portal/request'

type Audit = { id: string; action: string; reason: string; actor_id: string; created_at: string }
const control = 'rounded-xl border border-border bg-background px-4 py-2 text-sm disabled:opacity-50'
export function ClaimReview() {
  const [page, setPage] = useState(0)
  const { data, error, isLoading, mutate } = useSWR<{ claims: BusinessClaim[]; canPreview: boolean }>(`/api/platform/claims?page=${page}`, portalRequest, { revalidateOnFocus: true })
  if (error) return <p role="alert">{error.message}</p>
  if (isLoading) return <p role="status">Loading claims…</p>
  return <div className="flex flex-col gap-5">
    {!data?.claims.length && <p>No claims on this page.</p>}
    {data?.claims.map(claim => <ReviewCard key={claim.id} claim={claim} canPreview={data.canPreview} refresh={() => mutate()} />)}
    <nav aria-label="Claim pages" className="flex items-center gap-4"><button className={control} disabled={page === 0} onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page + 1}</span><button className={control} disabled={(data?.claims.length ?? 0) < 25} onClick={() => setPage(p => p+1)}>Next</button></nav>
  </div>
}
function ReviewCard({ claim, canPreview, refresh }: { claim: BusinessClaim; canPreview: boolean; refresh: () => Promise<unknown> }) {
  const [reason,setReason] = useState(''); const [busy,setBusy] = useState(false); const [message,setMessage] = useState(''); const [historyOpen,setHistoryOpen] = useState(false)
  const base = `/api/platform/claims/${claim.id}`
  const history = useSWR<Audit[]>(historyOpen ? base : null, portalRequest)
  const preview = useSWR<{ tier: string; expires_at: string } | null>(canPreview && claim.status === 'approved' ? `${base}/preview` : null, portalRequest, { refreshInterval: 30000 })
  async function decide(status: string) {
    setBusy(true); setMessage('')
    try { await portalRequest(base,{ method:'PATCH',body:JSON.stringify({ status,expectedStatus:claim.status,reason }) }); setReason(''); await refresh(); await history.mutate(); setMessage('Decision recorded.') }
    catch(e) { setMessage(e instanceof Error ? e.message : 'Decision failed.') } finally { setBusy(false) }
  }
  async function setTier(tier: string) {
    setBusy(true); setMessage('')
    try { await portalRequest(`${base}/preview`,{ method:'POST',body:JSON.stringify({tier}) }); await preview.mutate(); await history.mutate() }
    catch(e) { setMessage(e instanceof Error ? e.message : 'Preview failed.') } finally { setBusy(false) }
  }
  const actions: Record<string,string[]> = { pending:['approved','rejected','disputed'],approved:['revoked','disputed'],disputed:['approved','rejected','revoked'],rejected:['disputed'],revoked:['disputed'] }
  return <article className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><Link className="font-serif text-2xl underline-offset-4 hover:underline" href={`/business/${encodeURIComponent(claim.business_ref)}`}>{claim.business_name}</Link><p className="break-all text-xs text-muted-foreground">{claim.business_ref}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-sm capitalize">{claim.status}</span></header>
    <dl className="flex flex-col gap-2 text-sm"><div><dt className="font-medium">Claimant account ID</dt><dd className="break-all font-mono">{claim.user_id}</dd></div><div><dt className="font-medium">Submitted contact (unverified)</dt><dd>{claim.contact_email || 'No email supplied'} · {claim.contact_phone || 'No phone supplied'}</dd></div><div><dt className="font-medium">Manual verification evidence</dt><dd className="whitespace-pre-wrap break-words">{claim.evidence_notes || 'No evidence supplied'}</dd></div></dl>
    <p className="text-xs text-muted-foreground">Verify ownership independently before approval. Google Business Profile and domain verification are not configured. Existing claims may predate audit logging.</p>
    <label className="flex flex-col gap-2 text-sm">Decision reason (10–2,000 characters)<textarea className={control} maxLength={2000} minLength={10} value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>
    <div className="flex flex-wrap gap-2">{(actions[claim.status] ?? []).map(status => <button key={status} className={control} disabled={busy || reason.trim().length < 10} onClick={() => decide(status)}>{({approved:'Approve',rejected:'Reject',revoked:'Revoke',disputed:'Dispute'} as Record<string,string>)[status]}</button>)}</div>
    {canPreview && claim.status === 'approved' && <section className="flex flex-col gap-3 rounded-2xl bg-muted p-4"><h3 className="font-medium">Private plan preview</h3><p className="text-sm text-muted-foreground">One hour, this claim and your admin account only. No subscription or payment is created.</p><div className="flex flex-wrap gap-2">{['bronze','silver','gold_preview'].map(tier => <button key={tier} disabled={busy} className={control} onClick={() => setTier(tier)}>{tier.replace('_',' ').toUpperCase()}</button>)}</div>{preview.error && <p role="alert">{preview.error.message}</p>}{preview.data && <div role="status"><p>Preview: {preview.data.tier.replace('_',' ')} · expires {new Date(preview.data.expires_at).toLocaleTimeString()}</p><p className="mt-2 text-sm">{preview.data.tier === 'bronze' ? 'Bronze: approved business profile and external links.' : preview.data.tier === 'silver' ? 'Silver: Instagram setup surface, promotions and analytics. Website and native booking builders remain deferred.' : 'Gold Preview: Silver surfaces plus a preview-only Gold label. AI agent and managed services remain deferred.'}</p></div>}</section>}
    <button className={`${control} w-fit`} aria-expanded={historyOpen} onClick={() => setHistoryOpen(v => !v)}>Claim history</button>
    {historyOpen && <div>{history.error ? <p role="alert">{history.error.message}</p> : !history.data ? <p>Loading history…</p> : <ol className="flex flex-col gap-3">{history.data.map(event => <li key={event.id} className="text-sm"><strong>{event.action}</strong> · {new Date(event.created_at).toLocaleString()}<p className="whitespace-pre-wrap break-words">{event.reason}</p><p className="break-all text-xs text-muted-foreground">Actor: {event.actor_id}</p></li>)}{history.data.length === 0 && <li>No recorded history. This claim may predate Phase 2.</li>}</ol>}</div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </article>
}
