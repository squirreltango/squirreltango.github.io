"use client"

import Link from "next/link"
import { User, Heart, Map, Menu, X, LogOut, Store, CalendarDays } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { useSavedPlaces } from "@/components/saved-places-provider"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onOpenAuth?: () => void
  viewMode?: "list" | "map"
  onViewModeChange?: (mode: "list" | "map") => void
}

export function Header({ onOpenAuth, viewMode = "list", onViewModeChange }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const { user, profile, loading, isBusiness, signOut } = useAuth()
  const { saved } = useSavedPlaces()

  const initial = (profile?.display_name?.trim() || user?.email || "?")
    .charAt(0)
    .toUpperCase()

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-18">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={cn(
              "w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center",
              "shadow-lg shadow-foreground/10 transition-all duration-300",
              "group-hover:shadow-xl group-hover:shadow-foreground/15 group-hover:scale-105 group-hover:rotate-[-3deg]"
            )}>
              <span className="text-background font-serif font-semibold text-xl transition-transform duration-300 group-hover:scale-110">L</span>
            </div>
            <span className={cn(
              "font-serif font-semibold text-2xl tracking-tight text-foreground",
              "transition-all duration-300 group-hover:tracking-normal"
            )}>
              LookMeUp
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {onViewModeChange && (
              <button
                onClick={() => onViewModeChange(viewMode === "list" ? "map" : "list")}
                className={cn(
                  "relative flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-full",
                  "text-muted-foreground hover:text-foreground",
                  "transition-all duration-300 ease-out",
                  "hover:bg-secondary/80 active:scale-95",
                  "overflow-hidden"
                )}
              >
                <Map className="h-4 w-4 transition-transform duration-300 hover:rotate-12" />
                <span className="relative">
                  {viewMode === "list" ? "Map View" : "List View"}
                </span>
              </button>
            )}
            <Link
              href="/saved"
              className={cn(
                "flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-full",
                "text-muted-foreground hover:text-foreground",
                "transition-all duration-300 ease-out",
                "hover:bg-secondary/80 active:scale-95",
                "group/saved"
              )}
            >
              <Heart className="h-4 w-4 transition-all duration-300 group-hover/saved:scale-110 group-hover/saved:text-red-500" />
              Saved
            </Link>
            <button
              onClick={onOpenAuth}
              className={cn(
                "flex items-center gap-2.5 ml-2 px-6 py-2.5 rounded-full",
                "bg-foreground text-background text-sm font-medium",
                "shadow-lg shadow-foreground/10",
                "transition-all duration-300 ease-out",
                "hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15 hover:scale-[1.02]",
                "active:scale-95"
              )}
            >
              <User className="h-4 w-4 transition-transform duration-300 hover:rotate-6" />
              Sign in
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={cn(
              "md:hidden p-2.5 rounded-xl hover:bg-secondary/80",
              "transition-all duration-300 active:scale-90"
            )}
          >
            <div className="relative w-5 h-5">
              <Menu className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300",
                mobileMenuOpen ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
              )} />
              <X className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300",
                mobileMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
              )} />
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-500 ease-out",
            mobileMenuOpen ? "max-h-64 pb-6 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <nav className="flex flex-col gap-1 pt-2">
            {onViewModeChange && (
              <button
                onClick={() => {
                  onViewModeChange(viewMode === "list" ? "map" : "list")
                  setMobileMenuOpen(false)
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-foreground",
                  "transition-all duration-300 hover:bg-secondary/80 active:scale-[0.98]"
                )}
                style={{ animation: mobileMenuOpen ? 'slideInLeft 0.3s ease-out 0.1s forwards' : 'none', opacity: mobileMenuOpen ? 0 : 1 }}
              >
                <Map className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{viewMode === "list" ? "Map View" : "List View"}</span>
              </button>
            )}
            <Link
              href="/saved"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-foreground",
                "transition-all duration-300 hover:bg-secondary/80 active:scale-[0.98]"
              )}
              style={{ animation: mobileMenuOpen ? 'slideInLeft 0.3s ease-out 0.15s forwards' : 'none', opacity: mobileMenuOpen ? 0 : 1 }}
            >
              <Heart className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Saved</span>
            </Link>
            <button
              onClick={() => {
                onOpenAuth?.()
                setMobileMenuOpen(false)
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-foreground",
                "transition-all duration-300 hover:bg-secondary/80 active:scale-[0.98]"
              )}
              style={{ animation: mobileMenuOpen ? 'slideInLeft 0.3s ease-out 0.2s forwards' : 'none', opacity: mobileMenuOpen ? 0 : 1 }}
            >
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Sign in</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}
