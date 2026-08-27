"use client"

import { useState, useEffect } from "react"
import { X, Mail, Lock, User, Eye, EyeOff, Store, Heart, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { AccountType } from "@/components/auth-provider"

type Mode = "login" | "signup" | "reset"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  /** Where to return after an email-link round trip. Defaults to current path. */
  returnTo?: string
  /**
   * Pre-selects the account type on the sign-up tab. The business portal opens
   * the modal with "business" so a merchant doesn't have to spot the toggle.
   */
  defaultAccountType?: AccountType
}

const inputClass = cn(
  "w-full pl-12 pr-4 py-4 rounded-2xl",
  "bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground/70",
  "transition-all duration-300",
  "focus:outline-none focus:border-foreground/30 focus:bg-secondary/80 focus:shadow-lg focus:shadow-foreground/5",
)

/**
 * Turns a Supabase auth error into copy that is safe but still actionable.
 *
 * Credential/existence signals are genericised to avoid account enumeration,
 * but anything the user must actually DO about it (confirm their email, pick a
 * stronger password, wait out a rate limit) is passed through - collapsing
 * everything into "invalid credentials" makes an unconfirmed email look
 * identical to a wrong password.
 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Invalid email or password."
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "That email can't be used to create a new account. Try signing in instead."
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address first - check your inbox for the link."
  }
  if (m.includes("password should be") || m.includes("weak password")) {
    return "Please choose a longer password (at least 6 characters)."
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again."
  }
  if (m.includes("email address") && m.includes("invalid")) {
    return "Please enter a valid email address."
  }
  return "Something went wrong. Please try again."
}

export function AuthModal({
  isOpen,
  onClose,
  returnTo,
  defaultAccountType = "personal",
}: AuthModalProps) {
  const { refreshProfile } = useAuth()
  const [mode, setMode] = useState<Mode>("login")
  const [showPassword, setShowPassword] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accountType, setAccountType] = useState<AccountType>(defaultAccountType)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIsAnimating(true)
    // Opening from the business portal should land on sign-up with "business"
    // already chosen, rather than the default login tab.
    if (defaultAccountType === "business") {
      setAccountType("business")
      setMode("signup")
    }
  }, [isOpen, defaultAccountType])

  // Clear transient state whenever the user switches mode, so a stale error
  // from sign-in doesn't linger over the sign-up form.
  useEffect(() => {
    setError(null)
    setNotice(null)
  }, [mode])

  if (!isOpen) return null

  const redirectUrl = () => {
    const next = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/")
    return (
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl(),
        })
        if (error) throw error
        // Always the same message, whether or not the account exists.
        setNotice("If that email has an account, a reset link is on its way.")
        return
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl(),
            // Consumed by the handle_new_user trigger to seed the profile row.
            data: {
              account_type: accountType,
              display_name: displayName.trim(),
            },
          },
        })
        if (error) throw error

        // When confirmation is required there is no session yet, so tell the
        // user to check their email rather than silently doing nothing.
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.")
          return
        }
        await refreshProfile()
        onClose()
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await refreshProfile()
      onClose()
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""))
    } finally {
      setSubmitting(false)
    }
  }

  const heading =
    mode === "login" ? "Welcome back" : mode === "signup" ? "Join LookMeUp" : "Reset your password"
  const subheading =
    mode === "login"
      ? "Sign in to access your saved places"
      : mode === "signup"
        ? "Create an account to discover local gems"
        : "We'll email you a link to set a new password"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-500",
          isAnimating ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-card rounded-3xl shadow-2xl w-full max-w-md p-8 sm:p-10 border border-border/40",
          "max-h-[90vh] overflow-y-auto",
          "transition-all duration-500 ease-out",
          isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4",
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className={cn(
            "absolute top-5 right-5 p-2.5 rounded-full",
            "transition-all duration-300",
            "hover:bg-secondary/80 hover:rotate-90 active:scale-90",
          )}
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-8">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto mb-5",
              "shadow-lg shadow-foreground/10 transition-all duration-500",
              "hover:shadow-xl hover:shadow-foreground/15 hover:scale-105 hover:rotate-[-5deg]",
            )}
          >
            <span className="text-background font-serif font-semibold text-2xl">L</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground mb-2">
            {heading}
          </h2>
          <p className="text-muted-foreground">{subheading}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground mb-2">
                  How will you use LookMeUp?
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "personal", label: "Personal", hint: "Save & plan", icon: Heart },
                      { value: "business", label: "Business", hint: "Claim a venue", icon: Store },
                    ] as const
                  ).map(({ value, label, hint, icon: Icon }) => {
                    const active = accountType === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAccountType(value)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-2xl border text-left",
                          "transition-all duration-300",
                          active
                            ? "border-foreground/40 bg-secondary/80 shadow-md"
                            : "border-border/60 hover:bg-secondary/40 hover:border-border",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 mb-1",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        />
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <span className="text-xs text-muted-foreground">{hint}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {mode !== "reset" && (
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors duration-300 group-focus-within:text-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputClass, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-300 hover:scale-110 active:scale-90"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive px-1">
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-start gap-2 text-sm text-foreground bg-secondary/60 rounded-xl p-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{notice}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full py-4 rounded-2xl bg-foreground text-background font-semibold",
              "shadow-lg shadow-foreground/10 flex items-center justify-center gap-2",
              "transition-all duration-300 ease-out",
              "hover:bg-foreground/90 hover:shadow-xl hover:shadow-foreground/15 hover:scale-[1.02]",
              "active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed",
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <div className="mt-8 space-y-3 text-center text-sm">
          {mode === "login" && (
            <button
              onClick={() => setMode("reset")}
              className="text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Forgot your password?
            </button>
          )}
          <p className="text-muted-foreground">
            {mode === "login" ? "New to LookMeUp? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-foreground font-semibold underline-offset-2 transition-all duration-300 hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
