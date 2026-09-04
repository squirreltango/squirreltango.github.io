"use client"

import { AuthModal } from "@/components/auth-modal"
import { useSavedPlaces } from "@/components/saved-places-provider"

/**
 * Opens the sign-in modal whenever a save is attempted while signed out.
 *
 * Mounted once in the root layout so every save control in the app - result
 * cards, the venue page and the map pins - gets the same prompt without each
 * one having to own modal state.
 */
export function SaveAuthGate() {
  const { needsAuth, clearNeedsAuth } = useSavedPlaces()

  return <AuthModal isOpen={needsAuth} onClose={clearNeedsAuth} />
}
