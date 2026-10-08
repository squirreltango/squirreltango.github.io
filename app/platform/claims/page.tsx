import { notFound } from 'next/navigation'
import { administrator } from '@/lib/business-portal/server'
import { ClaimReview } from '@/components/business/claim-review'
export const metadata = { title: 'Claim review | SpotMeOut', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
export default async function ClaimReviewPage() {
  try { await administrator() } catch { notFound() }
  return <main className="min-h-screen bg-background px-6 py-16"><div className="mx-auto flex max-w-5xl flex-col gap-8"><header><p className="text-sm text-muted-foreground">SpotMeOut / Private administration</p><h1 className="font-serif text-4xl">Business claims</h1><p className="mt-3 text-muted-foreground">Manual ownership verification. Every decision requires a reason and is recorded.</p></header><ClaimReview /></div></main>
}
