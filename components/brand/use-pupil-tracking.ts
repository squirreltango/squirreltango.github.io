"use client"

import { useEffect, useRef, useState } from "react"
import { PUPIL_MAX_X, PUPIL_MAX_Y } from "./eye"

/**
 * Distance (px) at which the pupils reach full deflection. Movement scales up
 * with distance, so a pointer resting near the logo barely moves them - this is
 * what keeps the effect "restrained" rather than darting.
 */
const FULL_DEFLECTION_DISTANCE = 420

/**
 * Makes the pupils track the pointer, with three deliberate guarantees:
 *
 * 1. No-JS / pre-hydration: initial state is dead centre, and the SVG renders
 *    from that state on the server, so the logo is complete without JS.
 * 2. prefers-reduced-motion: no listener is attached at all (and it is
 *    re-evaluated if the user changes the setting mid-session).
 * 3. Cheap: one passive window listener, coalesced into a single rAF per frame,
 *    and the state is only committed when the rounded value actually changes -
 *    so a slow pointer drift does not re-render on every frame.
 *
 * `pointermove` covers mouse, pen and touch-drag with one listener, so touch
 * gets the same subtle response without any device or camera access.
 */
export function usePupilTracking<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [animated, setAnimated] = useState(true)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    // Tracked in a ref-like local so the rAF callback can compare without
    // adding `offset` to the effect's dependencies (which would re-subscribe).
    let current = { x: 0, y: 0 }

    const handleMove = (event: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const element = containerRef.current
        if (!element) return

        const rect = element.getBoundingClientRect()
        // A hidden logo (mobile menu closed, off-screen) has no box; skip it
        // rather than dividing by zero and pinning the pupils to a corner.
        if (rect.width === 0 || rect.height === 0) return

        const dx = event.clientX - (rect.left + rect.width / 2)
        const dy = event.clientY - (rect.top + rect.height / 2)
        const distance = Math.hypot(dx, dy)
        if (distance < 1) return

        const reach = Math.min(1, distance / FULL_DEFLECTION_DISTANCE)
        // Round to whole viewBox units: sub-pixel jitter is invisible at logo
        // size but would cause a render on every single frame.
        const next = {
          x: Math.round((dx / distance) * PUPIL_MAX_X * reach),
          y: Math.round((dy / distance) * PUPIL_MAX_Y * reach),
        }
        if (next.x === current.x && next.y === current.y) return
        current = next
        setOffset(next)
      })
    }

    const applyMotionPreference = () => {
      if (reducedMotion.matches) {
        window.removeEventListener("pointermove", handleMove)
        setAnimated(false)
        // Return the pupils to centre so the logo settles in its resting state.
        current = { x: 0, y: 0 }
        setOffset(current)
      } else {
        setAnimated(true)
        window.addEventListener("pointermove", handleMove, { passive: true })
      }
    }

    applyMotionPreference()
    reducedMotion.addEventListener("change", applyMotionPreference)

    return () => {
      window.removeEventListener("pointermove", handleMove)
      reducedMotion.removeEventListener("change", applyMotionPreference)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return { containerRef, offset, animated }
}
