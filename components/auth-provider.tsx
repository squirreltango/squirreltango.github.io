"use client"

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export type AccountType = "personal" | "business"

interface Profile {
  id: string
  account_type: AccountType
  display_name: string | null
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** True until the initial session check completes, to avoid UI flicker. */
  loading: boolean
  isBusiness: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        setProfile(null)
        return
      }
      // Select explicit columns - never `select *` on user rows.
      const { data } = await supabase
        .from("profiles")
        .select("id, account_type, display_name")
        .eq("id", userId)
        .maybeSingle()
      setProfile((data as Profile | null) ?? null)
    },
    [supabase],
  )

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      void loadProfile(data.session?.user?.id).finally(() => {
        if (active) setLoading(false)
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession?.user?.id)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [supabase])

  const refreshProfile = useCallback(
    () => loadProfile(session?.user?.id),
    [loadProfile, session],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      isBusiness: profile?.account_type === "business",
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
