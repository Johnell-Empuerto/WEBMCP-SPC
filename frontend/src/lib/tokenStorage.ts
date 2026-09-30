// ════════════════════════════════════════════════════════════════════════════
// Token storage — controls authentication persistence (Remember Me).
//
// The backend is stateless JWT (access token ~8h, refresh token ~7d). Token
// persistence is therefore a storage-layer concern:
//
//   Remember Me OFF  → tokens live in sessionStorage.
//                      Cleared when the browser tab/window is closed —
//                      the natural "session-only" behavior.
//
//   Remember Me ON   → tokens live in localStorage.
//                      Survive browser restarts until the token expires
//                      server-side (JWT exp) or the user logs out.
//
// NO plaintext passwords or credentials are ever stored — only the existing
// JWT token pair produced by the existing authentication API.
// ════════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = "nxpert_token"
const REFRESH_KEY = "nxpert_refresh"

export interface TokenPair {
  token: string | null
  refreshToken: string | null
  /** Which storage the tokens were read from / written to. */
  persistent: boolean
}

/** Read tokens. Prefers localStorage only if sessionStorage has none. */
export function getTokens(): TokenPair {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY)
  if (sessionToken) {
    return {
      token: sessionToken,
      refreshToken: sessionStorage.getItem(REFRESH_KEY),
      persistent: false,
    }
  }
  return {
    token: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
    persistent: true,
  }
}

/** Write the token pair to the correct storage, clearing the other. */
export function setTokens(token: string, refreshToken: string, persistent: boolean): void {
  const store = persistent ? localStorage : sessionStorage
  const other = persistent ? sessionStorage : localStorage

  store.setItem(TOKEN_KEY, token)
  store.setItem(REFRESH_KEY, refreshToken)
  other.removeItem(TOKEN_KEY)
  other.removeItem(REFRESH_KEY)
}

/** Clear tokens from BOTH storages (logout / expiry must always clear fully). */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}
