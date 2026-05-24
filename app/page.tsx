"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { Header } from "@/components/header"
import { CategoryFilter } from "@/components/category-filter"
import { BusinessCard } from "@/components/business-card"
import { MapView } from "@/components/map-view"
import { AuthModal } from "@/components/auth-modal"
import { businesses as mockBusinesses, categories, type Business } from "@/lib/data"
import { FilterBar, type SortOption, type FilterOptions } from "@/components/filter-bar"
import { AIPicks } from "@/components/ai-picks"
import { AISearch } from "@/components/ai-search"
import { Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>("relevance")
  const [filters, setFilters] = useState<FilterOptions>({
    trendingOnly: false,
    minFoodHygiene: null,
    hasBookingRating: false,
  })
  const [isAISearching, setIsAISearching] = useState(false)
  const [aiSearchQuery, setAISearchQuery] = useState<string | null>(null)
  const [aiSearchResults, setAISearchResults] = useState<Business[] | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)

  // Fetch businesses from Supabase
  const { data: supabaseBusinesses, error, isLoading, mutate } = useSWR<Business[]>(
    "/api/businesses",
    fetcher,
    {
      revalidateOnFocus: false,
      fallbackData: [], // Start empty, will fallback to mock if needed
    }
  )

  // Use Supabase data if available, otherwise fallback to mock data
  const baseBusinesses = useMemo(() => {
    if (supabaseBusinesses && supabaseBusinesses.length > 0) {
      return supabaseBusinesses
    }
    // Fallback to mock data if Supabase returns empty or errors
    if (error || (supabaseBusinesses && supabaseBusinesses.length === 0)) {
      return mockBusinesses
    }
    return mockBusinesses
  }, [supabaseBusinesses, error])

  // Use AI search results if available, otherwise use base businesses
  const businesses = aiSearchResults || baseBusinesses

  const isUsingMockData = !supabaseBusinesses || supabaseBusinesses.length === 0 || error

  // Setup database if needed
  const handleSetupDatabase = async () => {
    setIsSettingUp(true)
    try {
      const res = await fetch("/api/setup", { method: "POST" })
      const data = await res.json()
      if (data.error) {
        console.error("Setup error:", data.error)
      } else {
        // Refetch businesses after setup
        mutate()
      }
    } catch (err) {
      console.error("Setup failed:", err)
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleAISearch = async (query: string) => {
    setIsAISearching(true)

    try {
      // Use the new AI-powered search endpoint
      const res = await fetch(`/api/ai-search?query=${encodeURIComponent(query)}`, {
        cache: "no-store"
      })
      const data = await res.json()

      const mappedBusinesses = (data.results || []).map((place: any) => ({
        id: place.place_id,
        name: place.name,
        category: data.aiContext?.aiPowered ? "AI Recommended" : "Google Result",
        rating: place.rating || 0,
        reviewCount: place.user_ratings_total || 0,
        location: place.formatted_address || place.vicinity || "London",
        description: place.types?.join(", ") || "Recommended by AI",
        image: "/placeholder.svg",
        images: ["/placeholder.svg"],
        gallery: [],
        coordinates: {
          lat: place.geometry?.location?.lat || 51.5074,
          lng: place.geometry?.location?.lng || -0.1278,
        },
        priceLevel: place.price_level ? "£".repeat(place.price_level) : "££",
        tags: place.types || [],
        ratings: {
          google: {
            rating: place.rating || 0,
            reviews: place.user_ratings_total || 0,
          },
        },
      }))

      setAISearchResults(mappedBusinesses as Business[])
      setSearchQuery(data.aiContext?.optimizedQuery || query)
      setAISearchQuery(query)
    } catch (error) {
      console.error("AI search failed:", error)
    } finally {
      setIsAISearching(false)
    }
  }
  const handleClearAISearch = () => {
    setSearchQuery("")
    setAISearchQuery(null)
    setAISearchResults(null)
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (sortBy !== "relevance") count++
    if (filters.trendingOnly) count++
    if (filters.minFoodHygiene !== null) count++
    if (filters.hasBookingRating) count++
    return count
  }, [sortBy, filters])

  const filteredBusinesses = useMemo(() => {
    let result = businesses.filter((business) => {
      // Skip text search filter when AI search results are active (Google already filtered them)
      const matchesSearch = aiSearchResults !== null || 
        business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (business.tags || []).some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        )

      const matchesCategory = activeCategory === "all" || business.category === activeCategory

      const matchesTrending = !filters.trendingOnly || business.ratings.instagram?.trending === true
      const matchesFoodHygiene = filters.minFoodHygiene === null ||
        (business.ratings.foodHygiene !== undefined && business.ratings.foodHygiene >= filters.minFoodHygiene)
      const matchesBooking = !filters.hasBookingRating || business.ratings?.bookingCom !== undefined

      return matchesSearch && matchesCategory && matchesTrending && matchesFoodHygiene && matchesBooking
    })

    if (sortBy === "google_rating") {
      result = [...result].sort((a, b) => b.ratings.google.rating - a.ratings.google.rating)
    } else if (sortBy === "instagram_followers") {
      result = [...result].sort((a, b) => (b.ratings.instagram?.followers || 0) - (a.ratings.instagram?.followers || 0)
      )
    }

    return result
  }, [businesses, searchQuery, activeCategory, sortBy, filters, aiSearchResults])

  return (
    <div className="min-h-screen bg-background">
      <Header
        onOpenAuth={() => setAuthModalOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        {/* Database Status Banner */}
        {isUsingMockData && !isLoading && (
          <div className="mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-amber-800">Using demo data</p>
              <p className="text-xs text-amber-600">Connect to Supabase to use real data</p>
            </div>
            <button
              onClick={handleSetupDatabase}
              disabled={isSettingUp}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSettingUp && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSettingUp ? "Setting up..." : "Setup Database"}
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">Discover London</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold text-foreground mb-5 leading-[1.1] text-balance">
            Find extraordinary places near you
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Curated restaurants, wellness spots, and hidden gems handpicked for curious locals.
          </p>
        </div>

        {/* AI Search */}
        <div className="mb-12">
          <AISearch
            onSearch={handleAISearch}
            isSearching={isAISearching}
            activeQuery={aiSearchQuery}
            onClearSearch={handleClearAISearch}
          />
        </div>

        {/* AI Picks Section - Only show when not searching */}
        {!aiSearchQuery && !isAISearching && (
          <AIPicks businesses={businesses} />
        )}

        {/* Categories */}
        <div className="mb-8">
          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        {/* Filters & Sort */}
        <div className="mb-8">
          <FilterBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            filters={filters}
            onFiltersChange={setFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/60">
          <div>
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredBusinesses.length}</span>{" "}
              {filteredBusinesses.length === 1 ? "place" : "places"}
              {activeFilterCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active)
                </span>
              )}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {sortBy === "relevance" && "Sorted by relevance"}
            {sortBy === "google_rating" && "Sorted by Google rating"}
            {sortBy === "instagram_followers" && "Sorted by popularity"}
          </div>
        </div>

        {/* Content */}
        {isLoading || isAISearching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-secondary/60 mb-4" />
                <div className="h-5 bg-secondary/60 rounded-lg w-3/4 mb-3" />
                <div className="h-4 bg-secondary/40 rounded-lg w-1/2 mb-3" />
                <div className="h-4 bg-secondary/40 rounded-lg w-full mb-2" />
                <div className="h-4 bg-secondary/40 rounded-lg w-2/3" />
              </div>
            ))}
          </div>
        ) : viewMode === "list" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBusinesses.map((business) => (
              <BusinessCard key={business.id} business={business} searchQuery={aiSearchQuery} />
            ))}
          </div>
        ) : (
          <MapView businesses={filteredBusinesses} />
        )}

        {filteredBusinesses.length === 0 && !isLoading && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-muted-foreground">?</span>
            </div>
            <h3 className="text-xl font-serif font-semibold text-foreground mb-2">No places found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery("")
                setActiveCategory("all")
                setSortBy("relevance")
                setFilters({
                  trendingOnly: false,
                  minFoodHygiene: null,
                  hasBookingRating: false,
                })
                setAISearchQuery(null)
                setAISearchResults(null)
              }}
              className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}
