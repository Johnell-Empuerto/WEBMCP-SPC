export interface AuthState {
  isAuthenticated: boolean
  user: {
    userCode: string
    userName: string
    email: string
    roleId: number
    roleName: string
  } | null
  isLoading: boolean
}
