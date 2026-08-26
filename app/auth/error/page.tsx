import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full bg-card border border-border/40 rounded-3xl p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="h-7 w-7 text-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">
          We couldn&apos;t complete that
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {reason === "missing_code"
            ? "That link looks incomplete. It may have been truncated by your email client - try opening it again from the original message."
            : "That sign-in link has expired or has already been used. Request a fresh one and it should work."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-foreground text-background font-semibold transition-all duration-300 hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          Back to LookMeUp
        </Link>
      </div>
    </main>
  )
}
