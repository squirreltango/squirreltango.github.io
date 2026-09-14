"use client"

import { Sparkles, UtensilsCrossed, Dumbbell, Coffee, Wine, Heart } from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap = {
  Sparkles,
  UtensilsCrossed,
  Dumbbell,
  Coffee,
  Wine,
  Heart,
}

interface Category {
  id: string
  name: string
  icon: keyof typeof iconMap
}

interface CategoryTilesProps {
  categories: readonly Category[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

/**
 * Premium rounded category tiles shown in the hero, mirroring the reference
 * layout. Driven entirely by the app's real `categories` data and the existing
 * `onCategoryChange` filtering flow — no hard-coded categories. The "All" entry
 * is excluded here since the tiles are for jumping into a specific category.
 */
export function CategoryTiles({ categories, activeCategory, onCategoryChange }: CategoryTilesProps) {
  const tiles = categories.filter((c) => c.id !== "all")

  const handleClick = (id: string) => {
    // Toggle back to "all" when tapping the already-active tile.
    onCategoryChange(activeCategory === id ? "all" : id)
    if (typeof document !== "undefined") {
      document.getElementById("discover")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
      {tiles.map((category, index) => {
        const Icon = iconMap[category.icon]
        const isActive = activeCategory === category.id

        return (
          <button
            key={category.id}
            onClick={() => handleClick(category.id)}
            aria-pressed={isActive}
            className={cn(
              "group flex flex-col items-center justify-center gap-2.5 rounded-3xl px-3 py-5",
              "backdrop-blur-md ring-1 transition-all duration-300 ease-out",
              "hover:-translate-y-1 active:scale-95",
              isActive
                ? "bg-foreground text-background ring-foreground shadow-xl shadow-black/30"
                : "bg-card/95 text-foreground ring-white/15 shadow-lg shadow-black/25 hover:bg-card"
            )}
            style={{
              animationDelay: `${index * 60}ms`,
              animation: "fadeInUp 0.5s ease-out forwards",
              opacity: 0,
            }}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-300",
                isActive ? "bg-background/15 text-background" : "bg-secondary text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-medium leading-tight text-center text-balance">
              {category.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
