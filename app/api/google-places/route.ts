import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    // Return mock data if no API key is configured
    console.log("[v0] No GOOGLE_PLACES_API_KEY found, returning mock data")
    return NextResponse.json({
      results: [
        {
          place_id: "mock-1",
          name: `${query} - Sample Restaurant`,
          rating: 4.5,
          user_ratings_total: 234,
          formatted_address: "123 Sample Street, London",
          vicinity: "Sample Area, London",
          types: ["restaurant", "food", "establishment"],
          price_level: 2,
          geometry: {
            location: { lat: 51.5074, lng: -0.1278 }
          }
        },
        {
          place_id: "mock-2", 
          name: `${query} - Sample Cafe`,
          rating: 4.2,
          user_ratings_total: 156,
          formatted_address: "456 Demo Road, London",
          vicinity: "Demo District, London",
          types: ["cafe", "food", "establishment"],
          price_level: 1,
          geometry: {
            location: { lat: 51.5094, lng: -0.1348 }
          }
        },
        {
          place_id: "mock-3",
          name: `${query} - Sample Bar`,
          rating: 4.7,
          user_ratings_total: 412,
          formatted_address: "789 Test Lane, London",
          vicinity: "Test Borough, London",
          types: ["bar", "night_club", "establishment"],
          price_level: 3,
          geometry: {
            location: { lat: 51.5124, lng: -0.1198 }
          }
        }
      ],
      status: "OK"
    })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=51.5074,-0.1278&radius=10000&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Google Places API error:", error)
    return NextResponse.json({ error: "Failed to fetch places", results: [] }, { status: 500 })
  }
}
