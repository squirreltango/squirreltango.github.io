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

    // If Google API returns an error (like referer restriction), fall back to mock data
    if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST" || !data.results?.length) {
      console.log("[v0] Google API error or no results, returning mock data. Status:", data.status, "Error:", data.error_message)
      const mockData = getMockResults(query)
      return NextResponse.json(mockData, {
        headers: { "Cache-Control": "no-store" }
      })
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" }
    })
  } catch (error) {
    console.error("[v0] Google Places API error:", error)
    return NextResponse.json(getMockResults(query))
  }
}

function getMockResults(query: string) {
  return {
    results: [
      {
        place_id: "mock-1",
        name: `The ${query} Kitchen`,
        rating: 4.5,
        user_ratings_total: 234,
        formatted_address: "123 Borough High Street, London SE1 1NP",
        vicinity: "Borough, London",
        types: ["restaurant", "food", "establishment"],
        price_level: 2,
        geometry: {
          location: { lat: 51.5045, lng: -0.0865 }
        }
      },
      {
        place_id: "mock-2", 
        name: `${query} & Co`,
        rating: 4.2,
        user_ratings_total: 156,
        formatted_address: "45 Brick Lane, London E1 6PU",
        vicinity: "Shoreditch, London",
        types: ["cafe", "food", "establishment"],
        price_level: 1,
        geometry: {
          location: { lat: 51.5214, lng: -0.0718 }
        }
      },
      {
        place_id: "mock-3",
        name: `The Golden ${query}`,
        rating: 4.7,
        user_ratings_total: 412,
        formatted_address: "78 Dean Street, London W1D 3SQ",
        vicinity: "Soho, London",
        types: ["bar", "restaurant", "establishment"],
        price_level: 3,
        geometry: {
          location: { lat: 51.5137, lng: -0.1318 }
        }
      },
      {
        place_id: "mock-4",
        name: `${query} House`,
        rating: 4.3,
        user_ratings_total: 289,
        formatted_address: "12 Camden High Street, London NW1 0JH",
        vicinity: "Camden, London",
        types: ["restaurant", "food", "establishment"],
        price_level: 2,
        geometry: {
          location: { lat: 51.5392, lng: -0.1426 }
        }
      },
      {
        place_id: "mock-5",
        name: `Little ${query}`,
        rating: 4.6,
        user_ratings_total: 178,
        formatted_address: "34 Exmouth Market, London EC1R 4QE",
        vicinity: "Clerkenwell, London",
        types: ["cafe", "bakery", "establishment"],
        price_level: 1,
        geometry: {
          location: { lat: 51.5267, lng: -0.1095 }
        }
      }
    ],
    status: "OK"
  }
}
