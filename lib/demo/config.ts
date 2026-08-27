/**
 * Preview/Development-only demo mode.
 *
 * Everything in this module must be inert in Production. The single gate is
 * `isDemoEnabled()` - if that returns false, no demo account, no tier override
 * and no sample Instagram/analytics content may be produced anywhere.
 *
 * Deliberately there are NO passwords in this file. The demo sign-in is
 * performed server-side by `/api/demo/session`, which reads the password from
 * a server-only env var. Client code only ever asks for "the individual demo"
 * or "the business demo" by key.
 */

export type DemoPersona = "individual" | "business"

/** Tier a business demo can be previewed as. Never affects real subscriptions. */
export type DemoTier = "bronze" | "silver"

export const DEMO_EMAILS: Record<DemoPersona, string> = {
  individual: "demo-individual@lookmeup.test",
  business: "demo-business@lookmeup.test",
}

/**
 * True only outside Production.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` is "production" on production deployments and
 * "preview" on preview deployments; it is undefined locally, where
 * NODE_ENV !== "production" keeps demo mode on.
 */
export function isDemoEnabled(): boolean {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  if (vercelEnv === "production") return false
  if (vercelEnv === "preview") return true
  return process.env.NODE_ENV !== "production"
}

/** Marks any demo-sourced payload so UI can label it and never persist it. */
export const DEMO_BADGE = "Sample data" as const
