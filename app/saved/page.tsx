"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Heart, Bookmark } from "lucide-react"
import { BusinessCard } from "@/components/business-card"
import { AuthModal } from "@/components/auth-modal"
import { businesses } from "@/lib/data"

export default function SavedPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
  // In a real app, this would come from user state/database
  // For demo purposes, showing a few sample businesses as "saved"
  const savedBusinesses = businesses.slice(0, 3)
  const isLoggedIn = false // Demo state

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center h-18">
            <Link
              href="/"
              className="p-2.5 -ml-2 rounded-xl hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="ml-3 text-xl font-serif font-semibold text-foreground">Saved Places</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        {!isLoggedIn ? (
          // Not logged in state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-3xl bg-secondary/80 flex items-center justify-center mb-8 shadow-lg">
              <Bookmark className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-semibold text-foreground mb-4">Save your favourite spots</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md leading-relaxed">
              Sign in to save and access your favourite places from any device.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-8 py-4 rounded-2xl bg-foreground text-background font-semibold hover:bg-foreground/90 shadow-lg shadow-foreground/10 hover:shadow-xl hover:shadow-foreground/15 transition-all duration-300"
            >
              Sign in to continue
            </button>

            {/* Preview of what saved places look like */}
            <div className="mt-16 w-full">
              <p className="text-sm font-medium text-muted-foreground mb-6 tracking-wide uppercase">Preview of saved places</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 opacity-50 pointer-events-none">
                {savedBusinesses.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Logged in state with saved places
          <>
            <div className="mb-8 pb-6 border-b border-border/60">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{savedBusinesses.length}</span> saved{" "}
                {savedBusinesses.length === 1 ? "place" : "places"}
              </p>
            </div>
            
            {savedBusinesses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {savedBusinesses.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl bg-secondary/80 flex items-center justify-center mb-6">
                  <Heart className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-serif font-semibold text-foreground mb-3">No saved places yet</h2>
                <p className="text-muted-foreground mb-8">
                  Start exploring and save your favourite spots!
                </p>
                <Link
                  href="/"
                  className="px-8 py-4 rounded-2xl bg-foreground text-background font-semibold hover:bg-foreground/90 shadow-lg shadow-foreground/10 transition-all duration-300"
                >
                  Explore places
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}
