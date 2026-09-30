import axios from "axios"
import { getTokens, setTokens, clearTokens } from "@/lib/tokenStorage"

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use((config) => {
  const { token } = getTokens()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const AUTH_ENDPOINTS = ["/auth/login", "/auth/me", "/auth/logout"]

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { status, data } = error.response
      const requestUrl = error.config.url ?? ""

      if (status === 401 && !requestUrl.includes("/auth/refresh")) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint))

        if (!isAuthEndpoint) {
          const { refreshToken, persistent } = getTokens()
          if (refreshToken) {
            try {
              const res = await axios.post("/api/auth/refresh", { refreshToken })
              const newToken = res.data.data.token
              const newRefreshToken = res.data.data.refreshToken
              // keep the same persistence the original session used (Remember Me)
              setTokens(newToken, newRefreshToken, persistent)
              error.config.headers.Authorization = `Bearer ${newToken}`
              return apiClient(error.config)
            } catch {
              clearTokens()
              sessionStorage.setItem(
                "nxpert_session_message",
                "Your session expired. Please sign in again."
              )
              window.location.href = "/login"
            }
          } else {
            clearTokens()
            sessionStorage.setItem(
              "nxpert_session_message",
              "Your session expired. Please sign in again."
            )
            window.location.href = "/login"
          }
        }
      }
      const message = data?.message || `Request failed with status ${status}`
      return Promise.reject(new Error(message))
    }
    if (error.request) {
      return Promise.reject(new Error("No response from server. Please check your connection."))
    }
    return Promise.reject(error)
  }
)

export default apiClient
