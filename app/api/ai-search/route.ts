import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { mapGooglePlaceToBusiness, type GooglePlaceResult } from "@/lib/business/google-places"

// Attach a normalised `businesses` array (shared Business model) alongside the
// raw Google `results`, so the client never has to map raw place data.
function withBusinesses(payload: {
  results?: GooglePlaceResult[]
  aiContext?: { aiPowered?: boolean }
  [key: string]: unknown
}) {
  const aiPowered = payload.aiContext?.aiPowered === true
  const businesses = (payload.results || []).map((place) =>
    mapGooglePlaceToBusiness(place, aiPowered ? "ai" : "google"),
  )
  return { ...payload, businesses }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!geminiApiKey) {
    console.log("[v0] No Gemini API key, falling back to direct Google Places search")
    return fetchGooglePlaces(query, placesApiKey)
  }

  try {
    // Step 1: Use Gemini to enhance the search query
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `You are a search query optimizer for a London business discovery app. 
The user wants to find places in London based on their query.

User query: "${query}"

Your task:
1. Extract the key intent (e.g., food type, ambiance, occasion, location preferences)
2. Generate an optimized Google Places search query that will return the best results
3. Return ONLY the optimized search query, nothing else. Keep it concise (under 10 words).
4. Always include "London" if not already mentioned.

Examples:
- "romantic dinner with a view" → "romantic rooftop restaurant London"
- "best coffee to work from" → "coffee shop laptop friendly London"
- "fun night out with friends" → "trendy bars nightlife London"
- "healthy lunch near me" → "healthy salad restaurant London"

Optimized query:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const optimizedQuery = response.text().trim()

    console.log("[v0] Original query:", query)
    console.log("[v0] Gemini optimized query:", optimizedQuery)

    // Step 2: Use the optimized query to search Google Places
    const placesResponse = await fetchGooglePlaces(optimizedQuery, placesApiKey)
    const placesData = await placesResponse.json()

    // Add the AI context to the response and attach normalised businesses.
    return NextResponse.json(withBusinesses({
      ...placesData,
      aiContext: {
        originalQuery: query,
        optimizedQuery: optimizedQuery,
        aiPowered: true
      }
    }), {
      headers: { "Cache-Control": "no-store" }
    })

  } catch (error) {
    console.error("[v0] Gemini AI error:", error)
    // Fallback to direct Google Places search
    return fetchGooglePlaces(query, placesApiKey)
  }
}

async function fetchGooglePlaces(query: string, apiKey: string | undefined): Promise<NextResponse> {
  if (!apiKey) {
    console.log("[v0] No Google Places API key, returning mock data")
    return NextResponse.json(withBusinesses(getMockResults(query)), {
      headers: { "Cache-Control": "no-store" }
    })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=51.5074,-0.1278&radius=10000&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()

    console.log("[v0] Google Places status:", data.status, "Results:", data.results?.length || 0)

    if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST" || !data.results?.length) {
      console.log("[v0] Google Places error, returning mock data. Status:", data.status)
      return NextResponse.json(withBusinesses(getMockResults(query)), {
        headers: { "Cache-Control": "no-store" }
      })
    }

    return NextResponse.json(withBusinesses(data), {
      headers: { "Cache-Control": "no-store" }
    })
  } catch (error) {
    console.error("[v0] Google Places fetch error:", error)
    return NextResponse.json(withBusinesses(getMockResults(query)), {
      headers: { "Cache-Control": "no-store" }
    })
  }
}

function getMockResults(query: string) {
  return {
    results: [
      {
        place_id: "mock-1",
        name: `The ${query.split(" ")[0]} Kitchen`,
        rating: 4.5,
        user_ratings_total: 234,
        formatted_address: "123 Borough High Street, London SE1 1NP",
        vicinity: "Borough, London",
        types: ["restaurant", "food", "establishment"],
        price_level: 2,
        geometry: { location: { lat: 51.5045, lng: -0.0865 } }
      },
      {
        place_id: "mock-2",
        name: `${query.split(" ")[0]} & Co`,
        rating: 4.2,
        user_ratings_total: 156,
        formatted_address: "45 Brick Lane, London E1 6PU",
        vicinity: "Shoreditch, London",
        types: ["cafe", "food", "establishment"],
        price_level: 1,
        geometry: { location: { lat: 51.5214, lng: -0.0718 } }
      },
      {
        place_id: "mock-3",
        name: `The Golden ${query.split(" ")[0]}`,
        rating: 4.7,
        user_ratings_total: 412,
        formatted_address: "78 Dean Street, London W1D 3SQ",
        vicinity: "Soho, London",
        types: ["bar", "restaurant", "establishment"],
        price_level: 3,
        geometry: { location: { lat: 51.5137, lng: -0.1318 } }
      },
      {
        place_id: "mock-4",
        name: `${query.split(" ")[0]} House`,
        rating: 4.3,
        user_ratings_total: 289,
        formatted_address: "12 Camden High Street, London NW1 0JH",
        vicinity: "Camden, London",
        types: ["restaurant", "food", "establishment"],
        price_level: 2,
        geometry: { location: { lat: 51.5392, lng: -0.1426 } }
      },
      {
        place_id: "mock-5",
        name: `Little ${query.split(" ")[0]}`,
        rating: 4.6,
        user_ratings_total: 178,
        formatted_address: "34 Exmouth Market, London EC1R 4QE",
        vicinity: "Clerkenwell, London",
        types: ["cafe", "bakery", "establishment"],
        price_level: 1,
        geometry: { location: { lat: 51.5267, lng: -0.1095 } }
      }
    ],
    status: "OK",
    aiContext: {
      originalQuery: query,
      optimizedQuery: query,
      aiPowered: false
    }
  }
}
