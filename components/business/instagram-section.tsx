"use client"

import { Instagram, ExternalLink } from "lucide-react"

/**
 * Instagram connection state for the business portal.
 *
 * There is NO Instagram integration configured yet, so this component never
 * invents followers, posts or engagement. It shows one of exactly two honest
 * states:
 *
 *   1. Not connected  - explains what connecting will do once Meta OAuth is set
 *                       up, and offers the merchant's own Instagram link.
 *   2. Connected      - renders only values genuinely returned by the
 *                       Instagram Graph API for that authorised account.
 *
 * The architecture (business_instagram_connections in migration 006) is in
 * place so wiring real OAuth later does not require a redesign.
 */
export function InstagramSection({
  instagramUrl,
  connection,
}: {
  /** The merchant's self-declared profile URL from their business profile. */
  instagramUrl?: string | null
  /** Populated only after a genuine authorised Meta connection. */
  connection?: {
    status: string
    username: string | null
    followers_count: number | null
    media_count: number | null
    last_synced_at: string | null
  } | null
}) {
  const isConnected = connection?.status === "connected"

  if (isConnected && connection) {
    return (
      <div className="flex flex-col gap-4 p-6 rounded-3xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Instagram className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <h3 className="font-medium text-foreground truncate">
                {connection.username ? `@${connection.username}` : "Instagram connected"}
              </h3>
              {connection.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Synced {new Date(connection.last_synced_at).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 rounded-full bg-foreground text-background text-xs font-medium">
            Connected
          </span>
        </div>

        {/* Only render a figure when Meta actually returned it. */}
        <dl className="flex items-center gap-8">
          {connection.followers_count !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Followers</dt>
              <dd className="text-lg text-foreground tabular-nums">
                {connection.followers_count.toLocaleString("en-GB")}
              </dd>
            </div>
          )}
          {connection.media_count !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Posts</dt>
              <dd className="text-lg text-foreground tabular-nums">
                {connection.media_count.toLocaleString("en-GB")}
              </dd>
            </div>
          )}
        </dl>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 rounded-3xl border border-border/60 bg-card">
      <div className="flex items-center gap-2.5">
        <Instagram className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <h3 className="font-medium text-foreground">Instagram</h3>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
        Instagram is not connected. Connecting an Instagram business account will show your latest
        posts and follower count on your listing, pulled directly from Instagram so it stays current.
      </p>

      {instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-foreground hover:text-muted-foreground transition-colors w-fit"
        >
          {instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add your Instagram link in the Social section above to show it on your listing.
        </p>
      )}

      <p className="text-xs text-muted-foreground/80">
        Account connection is coming soon. Until then no Instagram data is shown on your listing.
      </p>
    </div>
  )
}
