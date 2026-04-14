"use client"

import { use, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Star, MapPin, Heart, Share2, Clock, Phone, Globe, ChevronRight, Instagram, ShieldCheck, Building2, TrendingUp, ExternalLink } from "lucide-react"
import { businesses } from "@/lib/data"
import { PhotoGallery } from "@/components/photo-gallery"
import { cn } from "@/lib/utils"
import { notFound } from "next/navigation"

interface Review {
  id: string
  author: string
  avatar: string
  rating: number
  date: string
  content: string
}

const mockReviews: Review[] = [
  {
    id: "1",
    author: "Sarah Mitchell",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    rating: 5,
    date: "2 weeks ago",
    content: "Absolutely loved this place! The atmosphere was perfect and the service was exceptional. Will definitely be coming back.",
  },
  {
    id: "2",
    author: "James Thompson",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    rating: 4,
    date: "1 month ago",
    content: "Great experience overall. The location is wonderful and staff were very friendly. Only minor issue was the wait time.",
  },
  {
    id: "3",
    author: "Emily Roberts",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    rating: 5,
    date: "2 months ago",
    content: "One of the best places I have been to in London. Highly recommend for anyone looking for a premium experience.",
  },
]

export default function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const business = businesses.find((b) => b.id === id)
  const [isSaved, setIsSaved] = useState(false)

  if (!business) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Image */}
      <div className="relative h-72 sm:h-96 md:h-[28rem] overflow-hidden">
        <Image
          src={business.image}
          alt={business.name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />

        {/* Navigation */}
        <div 
          className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between"
          style={{ animation: 'fadeInUp 0.5s ease-out' }}
        >
          <Link
            href="/"
            className={cn(
              "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95"
            )}
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSaved(!isSaved)}
              className={cn(
                "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
                "transition-all duration-300",
                "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95",
                isSaved && "animate-pulse-once"
              )}
            >
              <Heart className={cn(
                "h-5 w-5 transition-all duration-300", 
                isSaved ? "fill-red-500 text-red-500 scale-110" : "text-foreground"
              )} />
            </button>
            <button className={cn(
              "p-3 rounded-2xl bg-card/90 backdrop-blur-md shadow-lg",
              "transition-all duration-300",
              "hover:bg-card hover:scale-110 hover:shadow-xl active:scale-95"
            )}>
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 -mt-20 relative z-10 pb-10">
        <div 
          className="bg-card rounded-3xl shadow-xl border border-border/40 overflow-hidden"
          style={{ animation: 'slideInUp 0.6s ease-out' }}
        >
          {/* Main Info */}
          <div className="p-6 sm:p-8">
            {/* Price Badge */}
            <span 
              className="inline-block px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-semibold mb-5"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.1s forwards', opacity: 0 }}
            >
              {business.priceLevel}
            </span>
            
            <div className="mb-6">
              <h1 
                className="text-3xl sm:text-4xl font-serif font-semibold text-foreground mb-4"
                style={{ animation: 'fadeInUp 0.4s ease-out 0.15s forwards', opacity: 0 }}
              >
                {business.name}
              </h1>
              <div 
                className="flex flex-wrap items-center gap-4"
                style={{ animation: 'fadeInUp 0.4s ease-out 0.2s forwards', opacity: 0 }}
              >
                <div className="flex items-center gap-2 bg-secondary/80 px-3.5 py-2 rounded-full transition-all duration-300 hover:bg-amber-100">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-foreground">{business.rating}</span>
                  <span className="text-muted-foreground text-sm">({business.reviewCount.toLocaleString()} reviews)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{business.location}</span>
                </div>
              </div>
            </div>

            <p 
              className="text-muted-foreground leading-relaxed text-lg mb-8"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.25s forwards', opacity: 0 }}
            >
              {business.description}
            </p>

            {/* Tags */}
            <div 
              className="flex items-center gap-2 flex-wrap mb-8"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.3s forwards', opacity: 0 }}
            >
              {business.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={cn(
                    "px-4 py-2 rounded-full bg-secondary/60 text-sm font-medium text-secondary-foreground",
                    "transition-all duration-300 hover:bg-secondary hover:scale-105"
                  )}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Ratings Breakdown Section */}
            <div 
              className="mb-8"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.32s forwards', opacity: 0 }}
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Ratings Breakdown</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Instagram */}
                {business.ratings.instagram && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl bg-secondary/40 border border-border/30",
                    "transition-all duration-300 hover:bg-secondary/60 hover:border-border/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center">
                          <Instagram className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Instagram</span>
                      </div>
                      {business.ratings.instagram.trending && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs font-semibold">Trending</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-foreground">
                        {(business.ratings.instagram.followers / 1000).toFixed(0)}K
                        <span className="text-sm font-normal text-muted-foreground ml-1">followers</span>
                      </span>
                      <button className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/5 text-xs font-medium text-muted-foreground",
                        "transition-all duration-300 hover:bg-foreground/10 hover:text-foreground"
                      )}>
                        <ExternalLink className="h-3 w-3" />
                        View
                      </button>
                    </div>
                  </div>
                )}

                {/* Google */}
                <div className={cn(
                  "flex flex-col gap-2 p-4 rounded-2xl bg-secondary/40 border border-border/30",
                  "transition-all duration-300 hover:bg-secondary/60 hover:border-border/50"
                )}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-border/50 flex items-center justify-center">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-foreground">Google</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                      <span className="text-lg font-semibold text-foreground">{business.ratings.google.rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({business.ratings.google.reviews.toLocaleString()} reviews)
                    </span>
                  </div>
                </div>

                {/* Food Hygiene Rating */}
                {business.ratings.foodHygiene !== undefined && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl border",
                    business.ratings.foodHygiene >= 4 
                      ? "bg-emerald-50/50 border-emerald-200/50" 
                      : business.ratings.foodHygiene >= 3 
                        ? "bg-amber-50/50 border-amber-200/50"
                        : "bg-red-50/50 border-red-200/50",
                    "transition-all duration-300 hover:shadow-sm"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center",
                        business.ratings.foodHygiene >= 4 
                          ? "bg-emerald-100" 
                          : business.ratings.foodHygiene >= 3 
                            ? "bg-amber-100"
                            : "bg-red-100"
                      )}>
                        <ShieldCheck className={cn(
                          "h-4 w-4",
                          business.ratings.foodHygiene >= 4 
                            ? "text-emerald-600" 
                            : business.ratings.foodHygiene >= 3 
                              ? "text-amber-600"
                              : "text-red-600"
                        )} />
                      </div>
                      <span className="text-sm font-medium text-foreground">Food Hygiene</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-lg font-bold",
                          business.ratings.foodHygiene >= 4 
                            ? "text-emerald-700" 
                            : business.ratings.foodHygiene >= 3 
                              ? "text-amber-700"
                              : "text-red-700"
                        )}>
                          {business.ratings.foodHygiene}/5
                        </span>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          business.ratings.foodHygiene === 5 
                            ? "bg-emerald-100 text-emerald-700" 
                            : business.ratings.foodHygiene === 4
                              ? "bg-emerald-100 text-emerald-700"
                              : business.ratings.foodHygiene === 3
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                        )}>
                          {business.ratings.foodHygiene === 5 
                            ? "Very Good" 
                            : business.ratings.foodHygiene === 4
                              ? "Good"
                              : business.ratings.foodHygiene === 3
                                ? "Satisfactory"
                                : "Needs Improvement"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Booking.com Rating - Only for hotels */}
                {business.ratings.bookingCom !== undefined && (
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl bg-blue-50/50 border border-blue-200/50",
                    "transition-all duration-300 hover:shadow-sm"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Booking.com</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-blue-700">{business.ratings.bookingCom}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {business.ratings.bookingCom >= 9 
                            ? "Excellent" 
                            : business.ratings.bookingCom >= 8
                              ? "Very Good"
                              : business.ratings.bookingCom >= 7
                                ? "Good"
                                : "Pleasant"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div 
              className="grid grid-cols-2 gap-4"
              style={{ animation: 'fadeInUp 0.4s ease-out 0.35s forwards', opacity: 0 }}
            >
              <button
                onClick={() => setIsSaved(!isSaved)}
                className={cn(
                  "flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold",
                  "transition-all duration-300 active:scale-[0.98]",
                  isSaved
                    ? "bg-red-50 text-red-600 border-2 border-red-200"
                    : "bg-secondary/60 text-secondary-foreground border-2 border-transparent hover:border-border hover:bg-secondary"
                )}
              >
                <Heart className={cn("h-5 w-5 transition-transform duration-300", isSaved && "fill-current scale-110")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <button className={cn(
                "flex items-center justify-center gap-2.5 py-4 rounded-2xl",
                "bg-foreground text-background font-semibold",
                "shadow-lg shadow-foreground/10",
                "transition-all duration-300",
                "hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15 hover:scale-[1.02]",
                "active:scale-[0.98]"
              )}>
                <MapPin className="h-5 w-5" />
                Get Directions
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="border-t border-border/60">
            <div className="divide-y divide-border/60">
              {[
                { icon: Clock, label: "Opening Hours", value: "Open now - Closes 10:00 PM" },
                { icon: Phone, label: "Contact", value: "+44 20 1234 5678" },
                { icon: Globe, label: "Website", value: "www.example.com" },
              ].map((item, index) => (
                <div 
                  key={item.label}
                  className={cn(
                    "flex items-center gap-5 p-5 sm:p-6 cursor-pointer group",
                    "transition-all duration-300 hover:bg-secondary/30"
                  )}
                  style={{ animation: `fadeInUp 0.4s ease-out ${0.4 + index * 0.05}s forwards`, opacity: 0 }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center",
                    "transition-all duration-300 group-hover:bg-secondary group-hover:scale-105"
                  )}>
                    <item.icon className="h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Photo Gallery Section */}
        {business.gallery && business.gallery.length > 0 && (
          <PhotoGallery images={business.gallery} businessName={business.name} />
        )}

        {/* Reviews Section */}
        <div 
          className="mt-8 bg-card rounded-3xl shadow-lg border border-border/40 overflow-hidden"
          style={{ animation: 'fadeInUp 0.5s ease-out 0.65s forwards', opacity: 0 }}
        >
          <div className="p-6 sm:p-8 border-b border-border/60">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-semibold text-foreground">Reviews</h2>
              <button className={cn(
                "text-sm font-semibold text-muted-foreground",
                "transition-all duration-300 hover:text-foreground hover:underline underline-offset-2"
              )}>
                See all
              </button>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {mockReviews.map((review, index) => (
              <div 
                key={review.id} 
                className="p-6 sm:p-8 transition-colors duration-300 hover:bg-secondary/20"
                style={{ animation: `fadeInUp 0.4s ease-out ${0.7 + index * 0.1}s forwards`, opacity: 0 }}
              >
                <div className="flex items-start gap-4">
                  <Image
                    src={review.avatar}
                    alt={review.author}
                    width={52}
                    height={52}
                    className="rounded-2xl object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{review.author}</h3>
                      <span className="text-sm text-muted-foreground shrink-0">{review.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4 transition-all duration-300",
                            i < review.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground/30"
                          )}
                          style={{ transitionDelay: `${i * 50}ms` }}
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{review.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
