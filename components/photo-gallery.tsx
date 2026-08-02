"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Instagram, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GalleryImage } from "@/lib/types/business"

interface PhotoGalleryProps {
  images: GalleryImage[]
  businessName: string
}

export function PhotoGallery({ images, businessName }: PhotoGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const displayedImages = showAll ? images : images.slice(0, 6)
  const hasMore = images.length > 6

  const openModal = (index: number) => {
    setCurrentIndex(index)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
      if (e.key === "ArrowLeft") goToPrevious()
      if (e.key === "ArrowRight") goToNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isModalOpen, goToPrevious, goToNext])

  // Touch swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext()
      } else {
        goToPrevious()
      }
    }

    setTouchStart(null)
  }

  if (!images || images.length === 0) return null

  return (
    <>
      {/* Gallery Section */}
      <div 
        className="mt-8 bg-card rounded-3xl shadow-lg border border-border/40 overflow-hidden"
        style={{ animation: 'fadeInUp 0.5s ease-out 0.55s forwards', opacity: 0 }}
      >
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-serif font-semibold text-foreground">Photos</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {images.length} photos from Instagram and Google
              </p>
            </div>
            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium",
                  "bg-secondary/60 text-secondary-foreground",
                  "transition-all duration-300 hover:bg-secondary hover:scale-105"
                )}
              >
                View all photos
              </button>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayedImages.map((image, index) => {
              const isFeatured = image.featured && index < 2
              
              return (
                <div
                  key={index}
                  onClick={() => openModal(index)}
                  className={cn(
                    "relative cursor-pointer group overflow-hidden rounded-2xl",
                    "transition-all duration-300 hover:shadow-lg",
                    isFeatured ? "col-span-2 row-span-2 aspect-square sm:aspect-[4/3]" : "aspect-square"
                  )}
                >
                  {/* Image */}
                  <div className="absolute inset-0">
                    <Image
                      src={image.url}
                      alt={`${businessName} photo ${index + 1}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>

                  {/* Overlay on hover */}
                  <div className={cn(
                    "absolute inset-0 bg-foreground/0 transition-all duration-300",
                    "group-hover:bg-foreground/20"
                  )} />

                  {/* Source Badge */}
                  <div className={cn(
                    "absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
                    "backdrop-blur-md transition-all duration-300",
                    image.source === "instagram" 
                      ? "bg-gradient-to-r from-pink-500/90 to-orange-500/90 text-white"
                      : "bg-white/90 text-foreground shadow-sm"
                  )}>
                    {image.source === "instagram" ? (
                      <Instagram className="h-3 w-3" />
                    ) : (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    <span className="text-xs font-medium">
                      {image.source === "instagram" ? "Instagram" : "Google"}
                    </span>
                  </div>

                  {/* Caption Badge (bottom) */}
                  {image.caption && (
                    <div className={cn(
                      "absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl",
                      "bg-foreground/70 backdrop-blur-md",
                      "opacity-0 translate-y-2 transition-all duration-300",
                      "group-hover:opacity-100 group-hover:translate-y-0"
                    )}>
                      <p className="text-xs text-white font-medium truncate">
                        {image.caption}
                      </p>
                    </div>
                  )}

                  {/* View indicator on hover */}
                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    "opacity-0 transition-all duration-300",
                    "group-hover:opacity-100"
                  )}>
                    <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-lg">
                      <ImageIcon className="h-5 w-5 text-foreground" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Show less button */}
          {showAll && hasMore && (
            <button
              onClick={() => setShowAll(false)}
              className={cn(
                "w-full mt-4 py-3 rounded-2xl text-sm font-medium",
                "bg-secondary/40 text-secondary-foreground",
                "transition-all duration-300 hover:bg-secondary"
              )}
            >
              Show less
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-foreground/95 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          />

          {/* Content */}
          <div 
            className="relative z-10 w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6">
              <div className="flex items-center gap-3">
                {/* Source badge */}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                  images[currentIndex].source === "instagram"
                    ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white"
                    : "bg-white text-foreground"
                )}>
                  {images[currentIndex].source === "instagram" ? (
                    <Instagram className="h-4 w-4" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span className="text-sm font-medium">
                    {images[currentIndex].source === "instagram" ? "From Instagram" : "From Google"}
                  </span>
                </div>
                <span className="text-white/60 text-sm">
                  {currentIndex + 1} of {images.length}
                </span>
              </div>

              <button
                onClick={closeModal}
                className={cn(
                  "p-3 rounded-full bg-white/10 text-white",
                  "transition-all duration-300 hover:bg-white/20 hover:scale-110"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center px-4 sm:px-16 py-4">
              <div 
                className="relative w-full max-w-4xl aspect-[4/3] rounded-2xl overflow-hidden"
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              >
                <Image
                  src={images[currentIndex].url}
                  alt={`${businessName} photo ${currentIndex + 1}`}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Caption */}
            {images[currentIndex].caption && (
              <div className="text-center pb-2">
                <p className="text-white/80 text-sm font-medium">
                  {images[currentIndex].caption}
                </p>
              </div>
            )}

            {/* Navigation Arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious() }}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full",
                "bg-white/10 text-white backdrop-blur-md",
                "transition-all duration-300 hover:bg-white/20 hover:scale-110",
                "hidden sm:flex"
              )}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext() }}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full",
                "bg-white/10 text-white backdrop-blur-md",
                "transition-all duration-300 hover:bg-white/20 hover:scale-110",
                "hidden sm:flex"
              )}
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Thumbnail Navigation */}
            <div className="flex justify-center gap-2 p-4 sm:p-6 overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0",
                    "transition-all duration-300",
                    index === currentIndex 
                      ? "ring-2 ring-white scale-110" 
                      : "opacity-50 hover:opacity-80"
                  )}
                >
                  <Image
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
