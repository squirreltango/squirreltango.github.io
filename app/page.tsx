"use client"

import { useState, useMemo } from "react"
import { Header } from "@/components/header"
import { CategoryFilter } from "@/components/category-filter"
import { BusinessCard } from "@/components/business-card"
import { MapView } from "@/components/map-view"
import { AuthModal } from "@/components/auth-modal"
import { businesses, categories } from "@/lib/data"
import { FilterBar, type SortOption, type FilterOptions } from "@/components/filter-bar"
import { AIPicks } from "@/components/ai-picks"
import { AISearch } from "@/components/ai-search"

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

  const handleAISearch = (query: string) => {
    setIsAISearching(true)
    // Simulate AI processing delay
    setTimeout(() => {
      setSearchQuery(query)
      setAISearchQuery(query)
      setIsAISearching(false)
    }, 1200)
  }

  const handleClearAISearch = () => {
    setSearchQuery("")
    setAISearchQuery(null)
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
      const matchesSearch =
        business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory = activeCategory === "all" || business.category === activeCategory

      // Apply filters
      const matchesTrending = !filters.trendingOnly || business.ratings.instagram?.trending === true
      const matchesFoodHygiene = filters.minFoodHygiene === null || 
        (business.ratings.foodHygiene !== undefined && business.ratings.foodHygiene >= filters.minFoodHygiene)
      const matchesBooking = !filters.hasBookingRating || business.ratings.bookingCom !== undefined

      return matchesSearch && matchesCategory && matchesTrending && matchesFoodHygiene && matchesBooking
    })

    // Apply sorting
    if (sortBy === "google_rating") {
      result = [...result].sort((a, b) => b.ratings.google.rating - a.ratings.google.rating)
    } else if (sortBy === "instagram_followers") {
      result = [...result].sort((a, b) => 
        (b.ratings.instagram?.followers || 0) - (a.ratings.instagram?.followers || 0)
      )
    }

    return result
  }, [searchQuery, activeCategory, sortBy, filters])

  return (
    <div className="min-h-screen bg-background">
      <Header
        onOpenAuth={() => setAuthModalOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        {/* Hero Section */}
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">Discover London</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold text-foreground mb-5 leading-[1.1] text-balance">
            Find extraordinary places near you
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Curated restaurants, wellness spots, and hidden gems handpicked for discerning locals.
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
        {isAISearching ? (
          /* Loading Skeleton */
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

        {filteredBusinesses.length === 0 && (
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
