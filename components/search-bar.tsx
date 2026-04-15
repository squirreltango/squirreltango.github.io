"use client"

import { Search, MapPin } from "lucide-react"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = "Search restaurants, gyms, salons..." }: SearchBarProps) {
  return (
    <div className="relative group">
      <div className="flex items-center gap-4 bg-card rounded-2xl border border-border/60 px-5 py-4 shadow-sm hover:shadow-md hover:border-border transition-all duration-300">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none text-base"
        />
        <div className="hidden sm:flex items-center gap-2 text-muted-foreground border-l border-border/60 pl-4">
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-medium">London, UK</span>
        </div>
      </div>
    </div>
  )
}
