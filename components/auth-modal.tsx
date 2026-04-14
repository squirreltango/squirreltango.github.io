"use client"

import { useState, useEffect } from "react"
import { X, Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [showPassword, setShowPassword] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={cn(
          "absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-500",
          isAnimating ? "opacity-100" : "opacity-0"
        )} 
        onClick={onClose} 
      />
      <div 
        className={cn(
          "relative bg-card rounded-3xl shadow-2xl w-full max-w-md p-8 sm:p-10 border border-border/40",
          "transition-all duration-500 ease-out",
          isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        )}
      >
        <button
          onClick={onClose}
          className={cn(
            "absolute top-5 right-5 p-2.5 rounded-full",
            "transition-all duration-300",
            "hover:bg-secondary/80 hover:rotate-90 active:scale-90"
          )}
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-8">
          <div 
            className={cn(
              "w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto mb-5",
              "shadow-lg shadow-foreground/10 transition-all duration-500",
              "hover:shadow-xl hover:shadow-foreground/15 hover:scale-105 hover:rotate-[-5deg]"
            )}
            style={{ animation: 'bounceIn 0.6s ease-out' }}
          >
            <span className="text-background font-serif font-semibold text-2xl">L</span>
          </div>
          <h2 
            className="text-2xl sm:text-3xl font-serif font-semibold text-foreground mb-2"
            style={{ animation: 'fadeInUp 0.5s ease-out 0.1s forwards', opacity: 0 }}
          >
            {mode === "login" ? "Welcome back" : "Join LookMeUp"}
          </h2>
          <p 
            className="text-muted-foreground"
            style={{ animation: 'fadeInUp 0.5s ease-out 0.2s forwards', opacity: 0 }}
          >
            {mode === "login"
              ? "Sign in to access your saved places"
              : "Create an account to discover local gems"}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {mode === "signup" && (
            <div 
              className="relative group"
              style={{ animation: 'fadeInUp 0.4s ease-out forwards' }}
            >
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
              <input
                type="text"
                placeholder="Full name"
                className={cn(
                  "w-full pl-12 pr-4 py-4 rounded-2xl",
                  "bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground/70",
                  "transition-all duration-300",
                  "focus:outline-none focus:border-foreground/30 focus:bg-secondary/80 focus:shadow-lg focus:shadow-foreground/5"
                )}
              />
            </div>
          )}
          <div 
            className="relative group"
            style={{ animation: 'fadeInUp 0.4s ease-out 0.05s forwards', opacity: 0 }}
          >
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
            <input
              type="email"
              placeholder="Email address"
              className={cn(
                "w-full pl-12 pr-4 py-4 rounded-2xl",
                "bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground/70",
                "transition-all duration-300",
                "focus:outline-none focus:border-foreground/30 focus:bg-secondary/80 focus:shadow-lg focus:shadow-foreground/5"
              )}
            />
          </div>
          <div 
            className="relative group"
            style={{ animation: 'fadeInUp 0.4s ease-out 0.1s forwards', opacity: 0 }}
          >
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className={cn(
                "w-full pl-12 pr-12 py-4 rounded-2xl",
                "bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground/70",
                "transition-all duration-300",
                "focus:outline-none focus:border-foreground/30 focus:bg-secondary/80 focus:shadow-lg focus:shadow-foreground/5"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-300 hover:scale-110 active:scale-90"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            className={cn(
              "w-full py-4 rounded-2xl bg-foreground text-background font-semibold",
              "shadow-lg shadow-foreground/10",
              "transition-all duration-300 ease-out",
              "hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15 hover:scale-[1.02]",
              "active:scale-[0.98]"
            )}
            style={{ animation: 'fadeInUp 0.4s ease-out 0.15s forwards', opacity: 0 }}
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div 
          className="relative my-8"
          style={{ animation: 'fadeIn 0.5s ease-out 0.2s forwards', opacity: 0 }}
        >
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-card text-muted-foreground">or continue with</span>
          </div>
        </div>

        <div 
          className="grid grid-cols-2 gap-4"
          style={{ animation: 'fadeInUp 0.4s ease-out 0.25s forwards', opacity: 0 }}
        >
          <button className={cn(
            "flex items-center justify-center gap-2.5 py-3.5 rounded-2xl",
            "border border-border/60",
            "transition-all duration-300",
            "hover:bg-secondary/50 hover:border-border hover:scale-[1.02] hover:shadow-md",
            "active:scale-[0.98]"
          )}>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-medium text-foreground">Google</span>
          </button>
          <button className={cn(
            "flex items-center justify-center gap-2.5 py-3.5 rounded-2xl",
            "border border-border/60",
            "transition-all duration-300",
            "hover:bg-secondary/50 hover:border-border hover:scale-[1.02] hover:shadow-md",
            "active:scale-[0.98]"
          )}>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span className="text-sm font-medium text-foreground">Apple</span>
          </button>
        </div>

        <p 
          className="text-center text-sm text-muted-foreground mt-8"
          style={{ animation: 'fadeIn 0.5s ease-out 0.3s forwards', opacity: 0 }}
        >
          {mode === "login" ? "New to LookMeUp? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className={cn(
              "text-foreground font-semibold underline-offset-2",
              "transition-all duration-300",
              "hover:underline"
            )}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  )
}
