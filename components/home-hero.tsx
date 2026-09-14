"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { CategoryTiles } from "@/components/category-tiles"

interface Category {
  id: string
  name: string
  icon: "Sparkles" | "UtensilsCrossed" | "Dumbbell" | "Coffee" | "Wine" | "Heart"
}

interface HomeHeroProps {
  categories: readonly Category[]
  activeCategory: string
  onCategoryChange: (category: string) => void
  /** The live search field (AISearch, hero variant) is passed in so the hero
      stays a pure presentational shell and the existing search flow is reused. */
  children: ReactNode
}

/**
 * Immersive, image-led hero matching the premium city-guide reference: a full
 * width dusk-city photograph under a dark gradient, the LookMeUp wordmark and
 * discovery tagline centred on top, a large rounded search field, and a row of
 * floating category tiles. Purely visual — all behaviour comes from props.
 */
export function HomeHero({ categories, activeCategory, onCategoryChange, children }: HomeHeroProps) {
  return (
    <section className="relative w-full overflow-hidden bg-neutral-950">
      {/* Immersive background image */}
      <div className="absolute inset-0">
        <Image
          src="/hero/city-dusk.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Dark gradient so the wordmark, tagline and search stay readable,
            and the bottom blends into the page background. */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/92 via-neutral-950/55 to-neutral-950/92" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-14 pb-9 text-center sm:px-8 sm:pt-20 sm:pb-12">
        {/* Wordmark — keeps the existing LookMeUp brand identity */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-serif text-2xl font-semibold text-neutral-950 shadow-lg shadow-black/30">
            L
          </span>
          <span className="font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            LookMeUp
          </span>
        </div>

        <h1 className="mx-auto mb-8 max-w-xl text-balance font-sans text-3xl font-light leading-tight text-white sm:text-5xl">
          Discover what&apos;s around you
        </h1>

        {/* Live search field passed in from the page */}
        <div className="mx-auto max-w-2xl text-left">{children}</div>
      </div>

      {/* Floating category tiles */}
      <div className="relative z-10 mx-auto max-w-4xl px-5 pb-12 sm:px-8 sm:pb-16">
        <CategoryTiles
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
        />
      </div>
    </section>
  )
}
