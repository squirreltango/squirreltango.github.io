"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, Heart, Instagram, ShieldCheck, Building2, TrendingUp, ChevronLeft, ChevronRight, BadgeCheck, Zap, Sparkles, Search } from "lucide-react"
import { useState, useCallback, useMemo } from "react"
import type { Business } from "@/lib/data"
import { cn } from "@/lib/utils"

interface BusinessCardProps {
  business: Business
  index?: number
  searchQuery?: string | null
}

// Helper function to highlight keywords in text
function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <>{text}</>
  
  const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi')
  const parts = text.split(regex)
  
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = keywords.some(k => part.toLowerCase() === k.toLowerCase())
        return isMatch ? (
          <mark key={i} className="bg-amber-200/60 text-foreground rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

// Extract keywords from search query
function extractKeywords(query: string | null | undefined): string[] {
  if (!query) return []
  // Common words to ignore
  const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'with', 'near', 'me', 'my', 'best', 'good', 'top']
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
}

// Determine smart tags based on business data and search query
function getSmartTags(business: Business, searchQuery: string | null | undefined): { label: string; variant: 'match' | 'popular' | 'rated' }[] {
  const tags: { label: string; variant: 'match' | 'popular' | 'rated' }[] = []
  const keywords = extractKeywords(searchQuery)
  
  // Check if matches search
  if (keywords.length > 0) {
    const businessText = `${business.name} ${business.description} ${business.tags.join(' ')} ${business.location}`.toLowerCase()
    const matchCount = keywords.filter(k => businessText.includes(k)).length
    if (matchCount > 0) {
      tags.push({ label: 'Matches your search', variant: 'match' })
    }
  }
  
  // Check for wedding-related
  if (searchQuery?.toLowerCase().includes('wedding')) {
    const weddingKeywords = ['bridal', 'wedding', 'luxury', 'elegant', 'styling', 'makeup', 'hair']
    const hasWeddingService = weddingKeywords.some(k => 
      business.description.toLowerCase().includes(k) || 
      business.tags.some(t => t.toLowerCase().includes(k))
    )
    if (hasWeddingService) {
      tags.push({ label: 'Popular for weddings', variant: 'popular' })
    }
  }
  
  // Check if highly rated
  if (business.ratings.google.rating >= 4.7 && business.ratings.google.reviews > 1000) {
    tags.push({ label: 'Highly rated', variant: 'rated' })
  } else if (business.ratings.instagram?.trending) {
    tags.push({ label: 'Trending now', variant: 'popular' })
  }
  
  return tags.slice(0, 2) // Max 2 tags
}

export function BusinessCard({ business, index = 0, searchQuery }: BusinessCardProps) {
  const [isSaved, setIsSaved] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  const images = business.images?.length > 0 ? business.images : [business.image]
  const keywords = useMemo(() => extractKeywords(searchQuery), [searchQuery])
  const smartTags = useMemo(() => getSmartTags(business, searchQuery), [business, searchQuery])
  
  const nextImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }, [images.length])
  
  const prevImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  return (
    <Link 
      href={`/business/${business.id}`} 
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        "bg-card rounded-3xl overflow-hidden border border-border/40 transition-all duration-500 ease-out",
        "shadow-sm hover:shadow-2xl hover:shadow-foreground/5 hover:border-border/60",
        "hover:-translate-y-2 active:scale-[0.98]"
      )}>
        {/* Image Carousel Section */}
        <div className="aspect-[4/3] overflow-hidden" style={{ position: 'relative' }}>
          {/* Main Image */}
          <Image
            src={images[currentImageIndex]}
            alt={business.name}
            fill
            className={cn(
              "object-cover transition-all duration-700 ease-out",
              isHovered ? "scale-105" : "scale-100"
            )}
          />
          
          {/* Gradient Overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/5 to-transparent transition-opacity duration-500",
            isHovered ? "opacity-100" : "opacity-60"
          )} />
          
          {/* Smart Tags */}
          {smartTags.length > 0 && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {smartTags.map((tag, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md shadow-lg",
                    "transition-all duration-300 text-xs font-medium",
                    tag.variant === 'match' && "bg-amber-500/90 text-white",
                    tag.variant === 'popular' && "bg-pink-500/90 text-white",
                    tag.variant === 'rated' && "bg-emerald-500/90 text-white"
                  )}
                >
                  {tag.variant === 'match' && <Search className="h-3 w-3" />}
                  {tag.variant === 'popular' && <TrendingUp className="h-3 w-3" />}
                  {tag.variant === 'rated' && <Star className="h-3 w-3" />}
                  {tag.label}
                </div>
              ))}
            </div>
          )}
          
          {/* Instagram Source Label - Show when no smart tags */}
          {smartTags.length === 0 && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/90 backdrop-blur-md shadow-lg",
                "transition-all duration-300",
                isHovered && "bg-card"
              )}>
                <Instagram className="h-3 w-3 text-pink-500" />
                <span className="text-xs font-medium text-foreground">Latest posts</span>
              </div>
            </div>
          )}
          
          {/* Save Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              setIsSaved(!isSaved)
            }}
            className={cn(
              "absolute top-4 right-4 p-2.5 rounded-full bg-card/90 backdrop-blur-md shadow-lg",
              "transition-all duration-300 ease-out",
              "hover:bg-card hover:scale-110 active:scale-95",
              isSaved && "animate-pulse-once"
            )}
          >
            <Heart className={cn(
              "h-4 w-4 transition-all duration-300",
              isSaved ? "fill-red-500 text-red-500 scale-110" : "text-foreground"
            )} />
          </button>
          
          {/* Carousel Navigation */}
          {images.length > 1 && (
            <>
              {/* Navigation Arrows */}
              <button
                onClick={prevImage}
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-lg",
                  "transition-all duration-300 opacity-0 group-hover:opacity-100",
                  "hover:bg-card hover:scale-110 active:scale-95"
                )}
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={nextImage}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-lg",
                  "transition-all duration-300 opacity-0 group-hover:opacity-100",
                  "hover:bg-card hover:scale-110 active:scale-95"
                )}
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
              
              {/* Dot Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCurrentImageIndex(idx)
                    }}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      idx === currentImageIndex 
                        ? "bg-card w-4" 
                        : "bg-card/60 hover:bg-card/80"
                    )}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Price Level Badge */}
          <div className={cn(
            "absolute bottom-4 left-4 transition-all duration-500",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-90"
          )}>
            <span className="px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md text-xs font-semibold text-foreground shadow-lg">
              {business.priceLevel}
            </span>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="p-5">
          {/* Title & Main Rating */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className={cn(
              "font-serif font-semibold text-lg text-foreground line-clamp-1",
              "transition-colors duration-300",
              isHovered && "text-accent"
            )}>
              <HighlightedText text={business.name} keywords={keywords} />
            </h3>
            <div className={cn(
              "flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full",
              "bg-secondary/80 transition-all duration-300",
              isHovered && "bg-amber-100 scale-105"
            )}>
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">{business.rating}</span>
            </div>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
            <MapPin className={cn(
              "h-3.5 w-3.5 transition-all duration-300",
              isHovered && "text-accent"
            )} />
            <span className="text-sm">
              <HighlightedText text={business.location} keywords={keywords} />
            </span>
          </div>
          
          {/* Ratings Data Section */}
          <div className={cn(
            "grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-secondary/30 border border-border/30",
            "transition-all duration-300",
            isHovered && "bg-secondary/50 border-border/50"
          )}>
            {/* Google Rating */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-card flex items-center justify-center shadow-sm">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{business.ratings.google.rating}</span>
                <span className="text-xs text-muted-foreground">{business.ratings.google.reviews.toLocaleString()} reviews</span>
              </div>
            </div>
            
            {/* Instagram */}
            {business.ratings.instagram && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center shadow-sm">
                  <Instagram className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex flex-col">
                  {business.ratings.instagram.trending ? (
                    <>
                      <span className="flex items-center gap-1 text-sm font-semibold text-pink-600">
                        <TrendingUp className="h-3 w-3" />
                        Trending
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(business.ratings.instagram.followers / 1000).toFixed(0)}k followers
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground">
                        {(business.ratings.instagram.followers / 1000).toFixed(0)}k
                      </span>
                      <span className="text-xs text-muted-foreground">followers</span>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Food Hygiene Rating */}
            {business.ratings.foodHygiene !== undefined && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm",
                  business.ratings.foodHygiene >= 4 ? "bg-emerald-100" : "bg-amber-100"
                )}>
                  <ShieldCheck className={cn(
                    "h-3.5 w-3.5",
                    business.ratings.foodHygiene >= 4 ? "text-emerald-600" : "text-amber-600"
                  )} />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-semibold",
                    business.ratings.foodHygiene >= 4 ? "text-emerald-700" : "text-amber-700"
                  )}>
                    {business.ratings.foodHygiene}/5
                  </span>
                  <span className="text-xs text-muted-foreground">Hygiene</span>
                </div>
              </div>
            )}
            
            {/* Booking.com Rating */}
            {business.ratings.bookingCom !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                  <Building2 className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-blue-700">{business.ratings.bookingCom}</span>
                  <span className="text-xs text-muted-foreground">
                    {business.ratings.bookingCom >= 9 ? "Excellent" : business.ratings.bookingCom >= 8 ? "Very Good" : "Good"}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Description with highlighting */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
            <HighlightedText text={business.description} keywords={keywords} />
          </p>
          
          {/* Tags with highlighting */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {business.tags.slice(0, 3).map((tag, i) => {
              const isHighlighted = keywords.some(k => tag.toLowerCase().includes(k))
              return (
                <span
                  key={tag}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium",
                    "transition-all duration-300",
                    isHighlighted 
                      ? "bg-amber-100 text-amber-800 border border-amber-200" 
                      : "bg-secondary/60 text-secondary-foreground",
                    isHovered && !isHighlighted && "bg-secondary"
                  )}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
          
          {/* Trust Indicators */}
          <div className={cn(
            "flex items-center gap-3 pt-3 border-t border-border/40",
            "transition-all duration-300",
            isHovered && "border-border/60"
          )}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs">Verified ratings</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs">Live data</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
