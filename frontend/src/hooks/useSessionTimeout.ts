import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/auth/AuthProvider"
import { clearTokens } from "@/lib/tokenStorage"
import { fetchSessionTimeout } from "@/features/settings/api"

const DEFAULT_TIMEOUT_MINUTES = 30
const WARNING_LEAD_MS = 60_000 // warn ~1 minute before expiry
const CHECK_INTERVAL_MS = 15_000

/**
 * Idle session timeout monitor.
 *
 * UX layer only — server-side security is unchanged (JWT exp is still enforced
 * by the backend and the axios interceptor still refreshes/clears tokens).
 *
 * - Activity (mousemove throttled, mousedown, keydown, scroll, touchstart)
 *   resets a timestamp REF (no re-renders on activity).
 * - A single interval checks elapsed idle time; when the configured timeout is
 *   reached the session is cleared and the user is redirected to /login with a
 *   clear message. A warning surfaces ~1 minute before expiry.
 */
export function useSessionTimeout() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES)
  const [showWarning, setShowWarning] = useState(false)

  const lastActivityRef = useRef(Date.now())
  const warnedRef = useRef(false)
  const expiredRef = useRef(false)

  // Load the configured (system-wide) timeout once.
  useEffect(() => {
    let cancelled = false
    fetchSessionTimeout()
      .then((r) => {
        if (!cancelled) setTimeoutMinutes(r.minutes)
      })
      .catch(() => {
        /* keep default */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Throttled activity listeners — writes to a ref only, so no re-renders.
  useEffect(() => {
    const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const
    let moveLock = false

    const reset = () => {
      lastActivityRef.current = Date.now()
      warnedRef.current = false
      setShowWarning(false)
    }

    const onMouseMove = () => {
      if (moveLock) return
      moveLock = true
      window.setTimeout(() => {
        moveLock = false
        reset()
      }, 500)
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset))
    window.addEventListener("mousemove", onMouseMove)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
      window.removeEventListener("mousemove", onMouseMove)
    }
  }, [])

  // Single interval that checks idle time.
  useEffect(() => {
    const timeoutMs = timeoutMinutes * 60_000
    if (timeoutMs <= 0) return

    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current

      if (idleMs >= timeoutMs) {
        // Expire: clear client auth, redirect with a clear message.
        if (expiredRef.current) return
        expiredRef.current = true
        window.clearInterval(interval)

        clearTokens()
        sessionStorage.setItem(
          "nxpert_session_message",
          "Your session expired due to inactivity. Please sign in again."
        )
        // Navigate only after logout settles so auth state is already cleared
        // (avoids a PublicRoute bounce back to the app root).
        void logout()
          .catch(() => {})
          .finally(() => navigate("/login", { replace: true }))
        return
      }

      // Warn ~1 minute before expiry.
      if (!warnedRef.current && idleMs >= timeoutMs - WARNING_LEAD_MS) {
        warnedRef.current = true
        setShowWarning(true)
      }
    }, CHECK_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [timeoutMinutes, logout, navigate])

  const continueSession = useCallback(() => {
    lastActivityRef.current = Date.now()
    warnedRef.current = false
    setShowWarning(false)
  }, [])

  return { showWarning, continueSession }
}
