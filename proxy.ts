import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This keeps the Supabase
 * session fresh across navigations.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image files. Auth routes are
     * intentionally INCLUDED so the callback can set session cookies.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
}
