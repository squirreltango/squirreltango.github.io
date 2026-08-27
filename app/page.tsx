"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { Header } from "@/components/header"
import { CategoryFilter } from "@/components/category-filter"
import { BusinessCard } from "@/components/business-card"
import { MapView } from "@/components/map-view"
import { AuthModal } from "@/components/auth-modal"
import { categories } from "@/lib/data"
import type { Business } from "@/lib/types/business"
import { getHeadlineRating, getLocationLabel } from "@/lib/business/normalise-business"
import { FilterBar, type SortOption, type FilterOptions } from "@/components/filter-bar"
import { AIPicks } from "@/components/ai-picks"
import { AISearch } from "@/components/ai-search"
import { Loader2, LayoutGrid, Map } from "lucide-react"
import { cn } from "@/lib/utils"
import { isTrending, getVerifiedHygieneRating } from "@/lib/business/provenance"
import { isStrongHygiene } from "@/lib/business/hygiene-display"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>("relevance")
  const [filters, setFilters] = useState<FilterOptions>({
    trendingOnly: false,
    strongHygieneOnly: false,
    hasBookingRating: false,
  })
  const [isAISearching, setIsAISearching] = useState(false)
  const [aiSearchQuery, setAISearchQuery] = useState<string | null>(null)
  const [aiSearchResults, setAISearchResults] = useState<Business[] | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)
  // Business to open the map on, set by "Get Directions" on a detail page.
  const [focusBusinessId, setFocusBusinessId] = useState<string | null>(null)

  // Read the deep-link params once on mount. Using `window.location` rather
  // than useSearchParams keeps this page free of a Suspense requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const focus = params.get("focus")
    if (params.get("view") === "map") setViewMode("map")
    if (focus) setFocusBusinessId(focus)
  }, [])

  // Fetch businesses from Supabase
  const { data: supabaseBusinesses, error, isLoading, mutate } = useSWR<Business[]>(
    "/api/businesses",
    fetcher,
    {
      revalidateOnFocus: false,
      fallbackData: [], // Start empty, will fallback to mock if needed
    }
  )

  // Live provider data only. There is deliberately NO curated/seed fallback:
  // showing hardcoded example businesses (Dishoom et al) alongside genuine
  // Google Places results presents fabricated ratings, reviews and Instagram
  // figures as if they were real. An empty result is shown as an empty state.
  const baseBusinesses = useMemo(() => supabaseBusinesses ?? [], [supabaseBusinesses])

  // Use AI search results if available, otherwise use base businesses
  const businesses = aiSearchResults || baseBusinesses

  // True when the live pipeline returned nothing, so the UI can offer setup
  // instead of silently rendering fake businesses.
  const hasNoLiveData = !isLoading && baseBusinesses.length === 0

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

      // The API returns a normalised `businesses` array in the shared Business
      // shape, so no client-side mapping is required.
      const results: Business[] = data.businesses || []

      setAISearchResults(results)
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

  // The hygiene filter is only offered when at least one loaded business
  // actually carries a verified FSA rating. Before ingestion runs this is
  // false, so the control stays hidden instead of returning zero results; it
  // appears on its own once real ratings exist.
  const hygieneFilterAvailable = useMemo(
    () => businesses.some((b) => getVerifiedHygieneRating(b) !== null),
    [businesses],
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (sortBy !== "relevance") count++
    if (filters.trendingOnly) count++
    if (filters.strongHygieneOnly) count++
    if (filters.hasBookingRating) count++
    return count
  }, [sortBy, filters])

  const filteredBusinesses = useMemo(() => {
    const q = searchQuery.toLowerCase()
    let result = businesses.filter((business) => {
      // Skip text search filter when AI search results are active (Google already filtered them)
      const matchesSearch = aiSearchResults !== null ||
        business.name.toLowerCase().includes(q) ||
        (business.description ?? "").toLowerCase().includes(q) ||
        getLocationLabel(business).toLowerCase().includes(q) ||
        (business.tags || []).some((tag) => tag.toLowerCase().includes(q))

      const matchesCategory = activeCategory === "all" || business.category === activeCategory

      // Provider-neutral: reads LookMeUp's own `flags.trending`, never the
      // Instagram-shaped field. Same results, no implied Instagram source.
      const matchesTrending = !filters.trendingOnly || isTrending(business)
      // Scheme-aware and real-data-only: matches FHRS 4-5 or an FHIS pass,
      // never the fabricated seed number.
      const matchesFoodHygiene = !filters.strongHygieneOnly ||
        isStrongHygiene(getVerifiedHygieneRating(business))
      const matchesBooking = !filters.hasBookingRating || business.providerRatings.bookingCom !== undefined

      return matchesSearch && matchesCategory && matchesTrending && matchesFoodHygiene && matchesBooking
    })

    if (sortBy === "google_rating") {
      result = [...result].sort(
        (a, b) => (getHeadlineRating(b) ?? 0) - (getHeadlineRating(a) ?? 0)
      )
    } else if (sortBy === "instagram_followers") {
      result = [...result].sort(
        (a, b) => (b.providerRatings.instagram?.followers || 0) - (a.providerRatings.instagram?.followers || 0)
      )
    }

    return result
  }, [businesses, searchQuery, activeCategory, sortBy, filters, aiSearchResults])

  // The map also needs the deep-linked venue, which active filters or a search
  // term might otherwise exclude - without it there would be no marker to open.
  const mapBusinesses = useMemo(() => {
    if (!focusBusinessId) return filteredBusinesses
    if (filteredBusinesses.some((b) => b.id === focusBusinessId)) return filteredBusinesses
    const focused = businesses.find((b) => b.id === focusBusinessId)
    return focused ? [focused, ...filteredBusinesses] : filteredBusinesses
  }, [filteredBusinesses, businesses, focusBusinessId])

  return (
    <div className="min-h-screen bg-background">
      <Header
        onOpenAuth={() => setAuthModalOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        {/* Database Status Banner */}
        {hasNoLiveData && (
          <div className="mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-amber-800">No live businesses found</p>
              <p className="text-xs text-amber-600">
                Run setup to ingest genuine Google Places data for your area
              </p>
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
            hygieneFilterAvailable={hygieneFilterAvailable}
          />
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between gap-3 mb-8 pb-6 border-b border-border/60">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">
              Showing <span className="font-semibold text-foreground">{filteredBusinesses.length}</span>{" "}
              {filteredBusinesses.length === 1 ? "place" : "places"}
              {activeFilterCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active)
                </span>
              )}
            </p>
          </div>

          {/* Mobile: primary List | Map switch. Sits in the space the sort
              caption uses on desktop, so it costs no extra vertical height.
              Drives the same `viewMode` state as the header - no duplicate
              state and the ?view=map deep link keeps working. */}
          <div
            role="group"
            aria-label="Choose results view"
            className="md:hidden flex shrink-0 items-center gap-1 p-1 rounded-full bg-secondary/70 border border-border/60"
          >
            {([
              { mode: "list" as const, label: "List", Icon: LayoutGrid },
              { mode: "map" as const, label: "Map", Icon: Map },
            ]).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-medium",
                  "transition-all duration-300",
                  viewMode === mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:block text-sm text-muted-foreground">
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
          <MapView businesses={mapBusinesses} focusBusinessId={focusBusinessId} />
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
                  strongHygieneOnly: false,
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
