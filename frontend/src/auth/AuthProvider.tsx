import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { AuthState } from "./types"
import { loginApi, logoutApi, fetchMe } from "@/api/auth"

interface AuthContextType extends AuthState {
  login: (userCode: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  })

  useEffect(() => {
    fetchMe()
      .then((user) => {
        if (user) {
          setState({ isAuthenticated: true, user, isLoading: false })
        } else {
          setState({ isAuthenticated: false, user: null, isLoading: false })
        }
      })
      .catch(() => {
        setState({ isAuthenticated: false, user: null, isLoading: false })
      })
  }, [])

  const login = useCallback(
    async (userCode: string, password: string, rememberMe = false) => {
      const data = await loginApi(userCode, password, rememberMe)
      setState({ isAuthenticated: true, user: data.user, isLoading: false })
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } finally {
      setState({ isAuthenticated: false, user: null, isLoading: false })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
