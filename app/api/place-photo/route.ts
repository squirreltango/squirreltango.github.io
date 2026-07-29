import { type NextRequest, NextResponse } from "next/server"

/**
 * Proxies Google Places photos so the API key stays server-side.
 *
 * Stored image URLs look like `/api/place-photo?ref=<photo_reference>`, which
 * keeps the key out of the database and out of the browser.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")
  const maxWidth = request.nextUrl.searchParams.get("w") || "800"

  if (!ref) {
    return NextResponse.json({ error: "ref parameter is required" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.redirect(new URL("/placeholder.svg", request.nextUrl.origin))
  }

  // Only allow a sane width to avoid being used as an arbitrary image resizer.
  const width = Math.min(Math.max(Number(maxWidth) || 800, 100), 1600)

  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${width}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`

  try {
    const upstream = await fetch(url, { redirect: "follow" })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.redirect(new URL("/placeholder.svg", request.nextUrl.origin))
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        // Photos are immutable for a given reference; cache aggressively.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch (error) {
    console.error("[v0] place-photo proxy error:", error)
    return NextResponse.redirect(new URL("/placeholder.svg", request.nextUrl.origin))
  }
}
