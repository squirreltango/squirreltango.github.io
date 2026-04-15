"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Search, Sparkles, ArrowRight, X, Loader2, TrendingUp, Utensils, Scissors, Heart, Dumbbell, Coffee, Wine, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface AISearchProps {
  onSearch: (query: string) => void
  isSearching: boolean
  activeQuery: string | null
  onClearSearch: () => void
}

const SUGGESTION_CHIPS = [
  "Best brunch spots in London",
  "Wedding makeup artists near me",
  "Aesthetic cafes with outdoor seating",
  "Sri Lankan makeup artists",
  "High-rated gyms with pools",
  "Romantic dinner spots",
]

// Category suggestions with icons
const CATEGORY_SUGGESTIONS = [
  { label: "Hair & Beauty", icon: Scissors, keywords: ["hair", "beauty", "salon", "makeup", "nails", "brows"] },
  { label: "Wedding Services", icon: Heart, keywords: ["wedding", "bridal", "marriage", "ceremony"] },
  { label: "Restaurants & Dining", icon: Utensils, keywords: ["restaurant", "food", "dining", "dinner", "lunch", "brunch"] },
  { label: "Fitness & Gyms", icon: Dumbbell, keywords: ["gym", "fitness", "workout", "training", "exercise"] },
  { label: "Cafes & Coffee", icon: Coffee, keywords: ["cafe", "coffee", "espresso", "latte"] },
  { label: "Bars & Nightlife", icon: Wine, keywords: ["bar", "nightlife", "cocktail", "drinks", "club"] },
]

// Similar query suggestions based on input
const SIMILAR_QUERIES = [
  { trigger: ["wedding"], suggestions: ["Wedding makeup artists", "Bridal hair stylists", "Wedding venues in London"] },
  { trigger: ["sri lankan", "indian", "asian"], suggestions: ["Sri Lankan makeup artists", "South Asian bridal services", "Indian restaurants nearby"] },
  { trigger: ["brunch", "breakfast"], suggestions: ["Best brunch spots", "Aesthetic cafes for brunch", "Bottomless brunch deals"] },
  { trigger: ["hair", "haircut"], suggestions: ["Hair salons near me", "Best colorists in London", "Curly hair specialists"] },
  { trigger: ["gym", "fitness"], suggestions: ["Gyms with pools", "Personal trainers near me", "Boutique fitness studios"] },
  { trigger: ["romantic", "date"], suggestions: ["Romantic dinner spots", "Date night restaurants", "Rooftop bars for couples"] },
  { trigger: ["coffee", "cafe"], suggestions: ["Specialty coffee shops", "Aesthetic cafes", "Quiet cafes to work from"] },
]

export function AISearch({ onSearch, isSearching, activeQuery, onClearSearch }: AISearchProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Get matching suggestions based on query
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return { categories: [], queries: [] }
    
    const lowerQuery = query.toLowerCase()
    
    // Find matching categories
    const matchingCategories = CATEGORY_SUGGESTIONS.filter(cat => 
      cat.keywords.some(kw => lowerQuery.includes(kw)) || 
      cat.label.toLowerCase().includes(lowerQuery)
    ).slice(0, 3)
    
    // Find similar queries
    const matchingQueries: string[] = []
    SIMILAR_QUERIES.forEach(item => {
      if (item.trigger.some(t => lowerQuery.includes(t))) {
        matchingQueries.push(...item.suggestions)
      }
    })
    
    // Also add general matches
    SUGGESTION_CHIPS.forEach(chip => {
      if (chip.toLowerCase().includes(lowerQuery) && !matchingQueries.includes(chip)) {
        matchingQueries.push(chip)
      }
    })
    
    return { 
      categories: matchingCategories, 
      queries: [...new Set(matchingQueries)].slice(0, 4) 
    }
  }, [query])

  const hasDropdownContent = suggestions.categories.length > 0 || suggestions.queries.length > 0

  const handleSubmit = () => {
    if (query.trim() && !isSearching) {
      onSearch(query.trim())
      setShowDropdown(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion)
    onSearch(suggestion)
    setShowDropdown(false)
  }

  const handleInputChange = (value: string) => {
    setQuery(value)
    setShowDropdown(value.length >= 2)
  }

  return (
    <div className="w-full">
      {/* Search Container */}
      <div className="relative" ref={dropdownRef}>
        {/* AI Label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">AI-powered search</span>
          </div>
        </div>

        {/* Main Search Input */}
        <div 
          className={cn(
            "relative bg-card rounded-3xl border-2 transition-all duration-300",
            isFocused 
              ? "border-foreground/20 shadow-lg shadow-foreground/5" 
              : "border-border/60 shadow-sm hover:shadow-md hover:border-border",
            isSearching && "border-amber-300/50",
            showDropdown && hasDropdownContent && "rounded-b-none border-b-0"
          )}
        >
          {/* Glow effect when focused */}
          {isFocused && !showDropdown && (
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-200/20 via-orange-200/20 to-amber-200/20 rounded-[28px] blur-xl opacity-60 -z-10" />
          )}
          
          <div className="flex items-start gap-4 p-5">
            <div className={cn(
              "shrink-0 mt-1 transition-colors duration-300",
              isFocused ? "text-foreground" : "text-muted-foreground"
            )}>
              {isSearching ? (
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              ) : (
                <Search className="h-6 w-6" />
              )}
            </div>
            
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                setIsFocused(true)
                if (query.length >= 2) setShowDropdown(true)
              }}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Search anything... e.g. Sri Lankan wedding hair & makeup artists in London"
              disabled={isSearching}
              rows={1}
              className={cn(
                "flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none text-lg leading-relaxed resize-none min-h-[28px] max-h-[120px]",
                isSearching && "opacity-60"
              )}
            />
            
            <button
              onClick={handleSubmit}
              disabled={!query.trim() || isSearching}
              className={cn(
                "shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                query.trim() && !isSearching
                  ? "bg-foreground text-background hover:bg-foreground/90 active:scale-95"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Auto-suggestions Dropdown */}
        {showDropdown && hasDropdownContent && !isSearching && (
          <div className={cn(
            "absolute left-0 right-0 bg-card border-2 border-t-0 border-foreground/20 rounded-b-3xl shadow-lg z-50 overflow-hidden",
            "animate-in fade-in slide-in-from-top-2 duration-200"
          )}>
            <div className="p-4 space-y-4">
              {/* Category Suggestions */}
              {suggestions.categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.categories.map((cat) => {
                      const Icon = cat.icon
                      return (
                        <button
                          key={cat.label}
                          onClick={() => handleChipClick(cat.label)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
                            "bg-secondary/60 text-secondary-foreground border border-border/40",
                            "hover:bg-secondary hover:border-border transition-all duration-200",
                            "active:scale-[0.98]"
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* Similar Queries */}
              {suggestions.queries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">Suggestions</p>
                  <div className="space-y-1">
                    {suggestions.queries.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleChipClick(suggestion)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left",
                          "hover:bg-secondary/60 transition-colors duration-200"
                        )}
                      >
                        <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Search Query Display */}
        {activeQuery && !isSearching && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Showing results for:</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-border/60">
              <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
                {activeQuery}
              </span>
              <button
                onClick={() => {
                  setQuery("")
                  onClearSearch()
                }}
                className="shrink-0 p-1 rounded-full hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Chips */}
      {!activeQuery && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-3">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleChipClick(suggestion)}
                disabled={isSearching}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                  "bg-secondary/60 text-secondary-foreground border border-border/40",
                  "hover:bg-secondary hover:border-border hover:shadow-sm",
                  "active:scale-[0.98]",
                  isSearching && "opacity-50 cursor-not-allowed"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
