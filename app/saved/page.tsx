"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Heart, Bookmark } from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { SavedPlaceCard } from "@/components/saved-place-card"
import { useAuth } from "@/components/auth-provider"
import { useSavedPlaces } from "@/components/saved-places-provider"
import { getSavedGroup, groupsPresent, type SavedGroupId } from "@/lib/business/saved-categories"
import { cn } from "@/lib/utils"

export default function SavedPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<SavedGroupId | "all">("all")
  const { user, loading: authLoading } = useAuth()
  const { saved, loading } = useSavedPlaces()

  // Automatic, real category groups derived from each place's genuine Google
  // category/type data - never from its name. Only groups with saves appear.
  const groups = useMemo(
    () =>
      groupsPresent(
        saved.map((s) => ({ category: s.snapshot?.category, tags: s.snapshot?.tags })),
      ),
    [saved],
  )

  const filtered = useMemo(
    () =>
      activeGroup === "all"
        ? saved
        : saved.filter((s) => getSavedGroup(s.snapshot?.category, s.snapshot?.tags) === activeGroup),
    [saved, activeGroup],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex h-18 items-center">
            <Link href="/" className="-ml-2 rounded-xl p-2.5 transition-colors hover:bg-secondary/80">
              <ArrowLeft className="h-5 w-5 text-foreground" />
              <span className="sr-only">Back to explore</span>
            </Link>
            <h1 className="ml-3 font-serif text-xl font-semibold text-foreground">Saved Places</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {authLoading || (user && loading) ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-3xl bg-secondary/50" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/80 shadow-lg">
              <Bookmark className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="mb-4 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              Save your favourite spots
            </h2>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
              Sign in to save places and access them from any device. Your lists stay with your
              account.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="rounded-2xl bg-foreground px-8 py-4 font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15"
            >
              Sign in to continue
            </button>
          </div>
        ) : saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary/80">
              <Heart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-foreground">
              No saved places yet
            </h2>
            <p className="mb-8 text-muted-foreground">
              Tap the heart on any place to keep it here.
            </p>
            <Link
              href="/"
              className="rounded-2xl bg-foreground px-8 py-4 font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:bg-foreground/90"
            >
              Explore places
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border/60 pb-6">
              <button
                onClick={() => setActiveGroup("all")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  activeGroup === "all"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                )}
              >
                All
                <span className="ml-1.5 tabular-nums opacity-70">{saved.length}</span>
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    activeGroup === g.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {g.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{g.count}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((place) => (
                <SavedPlaceCard key={place.id} place={place} />
              ))}
            </div>
          </>
        )}
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}
