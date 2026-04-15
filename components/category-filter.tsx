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

interface CategoryFilterProps {
  categories: readonly Category[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export function CategoryFilter({ categories, activeCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
      {categories.map((category, index) => {
        const Icon = iconMap[category.icon]
        const isActive = activeCategory === category.id
        
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "relative flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-medium whitespace-nowrap",
              "transition-all duration-300 ease-out",
              "active:scale-95",
              isActive
                ? "bg-foreground text-background shadow-lg shadow-foreground/15 scale-[1.02]"
                : "bg-card text-foreground border border-border/60 hover:border-foreground/20 hover:shadow-md hover:scale-[1.02]"
            )}
            style={{ 
              animationDelay: `${index * 50}ms`,
              animation: 'fadeInUp 0.4s ease-out forwards',
              opacity: 0,
            }}
          >
            <Icon className={cn(
              "h-4 w-4 transition-all duration-300",
              isActive ? "text-background" : "text-muted-foreground group-hover:text-foreground"
            )} />
            <span className="relative">
              {category.name}
              {isActive && (
                <span 
                  className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-background/30 rounded-full"
                  style={{ animation: 'scaleX 0.3s ease-out forwards' }}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
