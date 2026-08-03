import { type NextRequest, NextResponse } from "next/server"

/**
 * Proxies Google Places photos so the API key stays server-side.
 *
 * Stored image URLs look like `/api/place-photo?ref=<photo_reference>`, which
 * keeps the key out of the database and out of the browser.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")
  // Places API (New) identifies photos by resource name:
  // `places/{place_id}/photos/{photo_id}`.
  const name = request.nextUrl.searchParams.get("name")
  const maxWidth = request.nextUrl.searchParams.get("w") || "800"

  if (!ref && !name) {
    return NextResponse.json(
      { error: "either the ref or name parameter is required" },
      { status: 400 },
    )
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.redirect(new URL("/placeholder.svg", request.nextUrl.origin))
  }

  // Only allow a sane width to avoid being used as an arbitrary image resizer.
  const width = Math.min(Math.max(Number(maxWidth) || 800, 100), 1600)

  let url: string
  if (name) {
    // Reject anything that isn't a Places photo resource name so this cannot
    // be pointed at other Google endpoints.
    if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
      return NextResponse.json({ error: "invalid photo resource name" }, { status: 400 })
    }
    url =
      `https://places.googleapis.com/v1/${name}/media` +
      `?maxWidthPx=${width}&key=${apiKey}`
  } else {
    url =
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=${width}&photo_reference=${encodeURIComponent(ref as string)}&key=${apiKey}`
  }

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
