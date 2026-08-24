"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { 
  ChevronDown, 
  Star, 
  ShieldCheck, 
  TrendingUp, 
  Building2, 
  X, 
  SlidersHorizontal,
  Check
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export type SortOption = "relevance" | "google_rating" | "instagram_followers"
export type FilterOptions = {
  trendingOnly: boolean
  minFoodHygiene: number | null
  hasBookingRating: boolean
}

interface FilterBarProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  activeFilterCount: number
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "relevance", label: "Relevance", icon: null },
  { value: "google_rating", label: "Highest Google Rating", icon: <Star className="h-3.5 w-3.5 text-amber-500" /> },
  { value: "instagram_followers", label: "Most Popular", icon: <TrendingUp className="h-3.5 w-3.5 text-pink-500" /> },
]

export function FilterBar({ 
  sortBy, 
  onSortChange, 
  filters, 
  onFiltersChange,
  activeFilterCount 
}: FilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const currentSort = sortOptions.find(s => s.value === sortBy) || sortOptions[0]

  const toggleFilter = (key: keyof FilterOptions, value: boolean | number | null) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      trendingOnly: false,
      minFoodHygiene: null,
      hasBookingRating: false,
    })
    onSortChange("relevance")
  }

  const FilterPill = ({ 
    active, 
    onClick, 
    children,
    icon
  }: { 
    active: boolean
    onClick: () => void
    children: React.ReactNode
    icon?: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap",
        "border transition-all duration-300",
        active 
          ? "bg-foreground text-background border-foreground shadow-md" 
          : "bg-card text-foreground border-border hover:border-foreground/30 hover:bg-secondary/50"
      )}
    >
      {icon}
      {children}
      {active && (
        <X className="h-3.5 w-3.5 ml-0.5" />
      )}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Desktop Filter Bar */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 h-auto rounded-full text-sm font-medium",
                "border border-border bg-card hover:bg-secondary/50 hover:border-foreground/30",
                "transition-all duration-300"
              )}
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Sort: {currentSort.label}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl p-2">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1.5">
              Sort by
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 cursor-pointer",
                  "transition-colors duration-200",
                  sortBy === option.value && "bg-secondary"
                )}
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
                {sortBy === option.value && (
                  <Check className="h-4 w-4 text-foreground" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border" />

        {/* Filter Pills */}
        <FilterPill
          active={filters.trendingOnly}
          onClick={() => toggleFilter("trendingOnly", !filters.trendingOnly)}
          icon={<TrendingUp className={cn("h-3.5 w-3.5", filters.trendingOnly ? "text-background" : "text-pink-500")} />}
        >
          Trending
        </FilterPill>

        <FilterPill
          active={filters.minFoodHygiene !== null}
          onClick={() => toggleFilter("minFoodHygiene", filters.minFoodHygiene === null ? 4 : null)}
          icon={<ShieldCheck className={cn("h-3.5 w-3.5", filters.minFoodHygiene !== null ? "text-background" : "text-emerald-500")} />}
        >
          Top Hygiene (4+)
        </FilterPill>

        <FilterPill
          active={filters.hasBookingRating}
          onClick={() => toggleFilter("hasBookingRating", !filters.hasBookingRating)}
          icon={<Building2 className={cn("h-3.5 w-3.5", filters.hasBookingRating ? "text-background" : "text-blue-500")} />}
        >
          Hotels
        </FilterPill>

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium",
              "text-muted-foreground hover:text-foreground transition-colors duration-200"
            )}
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Mobile Filter Bar */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium flex-1",
              "border transition-all duration-300",
              activeFilterCount > 0
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters & Sort
            {activeFilterCount > 0 && (
              <span className={cn(
                "ml-auto flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold",
                "bg-background text-foreground"
              )}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-300",
              mobileFiltersOpen && "rotate-180"
            )} />
          </button>
        </div>

        {/* Mobile Filters Expanded */}
        {mobileFiltersOpen && (
          <div className="mt-4 p-5 rounded-3xl bg-card border border-border space-y-5">
            {/* Sort Options */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sort by</p>
              <div className="space-y-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium",
                      "transition-all duration-200",
                      sortBy === option.value
                        ? "bg-foreground text-background"
                        : "bg-secondary/50 text-foreground hover:bg-secondary"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                    {sortBy === option.value && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Options */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Filters</p>
              <div className="space-y-2">
                <button
                  onClick={() => toggleFilter("trendingOnly", !filters.trendingOnly)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium",
                    "transition-all duration-200",
                    filters.trendingOnly
                      ? "bg-foreground text-background"
                      : "bg-secondary/50 text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className={cn("h-4 w-4", filters.trendingOnly ? "text-background" : "text-pink-500")} />
                    {/* Not attributed to Instagram: the underlying flag is not
                        sourced from Instagram. Filter behaviour is unchanged. */}
                    Trending now
                  </span>
                  {filters.trendingOnly && <Check className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => toggleFilter("minFoodHygiene", filters.minFoodHygiene === null ? 4 : null)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium",
                    "transition-all duration-200",
                    filters.minFoodHygiene !== null
                      ? "bg-foreground text-background"
                      : "bg-secondary/50 text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className={cn("h-4 w-4", filters.minFoodHygiene !== null ? "text-background" : "text-emerald-500")} />
                    Top Food Hygiene (4+)
                  </span>
                  {filters.minFoodHygiene !== null && <Check className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => toggleFilter("hasBookingRating", !filters.hasBookingRating)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium",
                    "transition-all duration-200",
                    filters.hasBookingRating
                      ? "bg-foreground text-background"
                      : "bg-secondary/50 text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className={cn("h-4 w-4", filters.hasBookingRating ? "text-background" : "text-blue-500")} />
                    Hotels with Booking.com Rating
                  </span>
                  {filters.hasBookingRating && <Check className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Clear & Apply */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Filters Summary (Mobile) */}
      {activeFilterCount > 0 && !mobileFiltersOpen && (
        <div className="sm:hidden flex items-center gap-2 flex-wrap">
          {filters.trendingOnly && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-100 text-pink-700 text-xs font-medium">
              <TrendingUp className="h-3 w-3" />
              Trending
              <button onClick={() => toggleFilter("trendingOnly", false)} className="ml-1 hover:text-pink-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.minFoodHygiene !== null && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <ShieldCheck className="h-3 w-3" />
              Hygiene 4+
              <button onClick={() => toggleFilter("minFoodHygiene", null)} className="ml-1 hover:text-emerald-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.hasBookingRating && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              <Building2 className="h-3 w-3" />
              Hotels
              <button onClick={() => toggleFilter("hasBookingRating", false)} className="ml-1 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
