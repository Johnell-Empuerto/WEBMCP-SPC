// ════════════════════════════════════════════════════════════════════════════
// USER MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the fields exposed by the modern /user-master endpoints. Role is
// stored as two bit flags on T_UserMaster (Umt_usermnt = Super Admin,
// Umt_usersupv = Admin) and is surfaced to the UI as one of U | A | SA.

// Filter used by the list endpoint.
export interface UserMasterFilter {
  size: number
  pageno: number
  search?: string
  status?: string
}

// One row from the list endpoint (T_UserMaster).
export interface UserMasterRow {
  usercode: string
  fname: string
  mi: string
  lname: string
  name: string
  email: string
  position: string
  costcenter: string
  usernumber: string
  status: string
  usersupv: boolean
  usermnt: boolean
  isLocked: boolean
  isSystemAccount: boolean
  passwordExpired: boolean
  loginAttempts: number
  lastLogin: string
  updatedAt: string | null
}

// The payload the add call sends.
export interface AddUserPayload {
  usercode: string
  fname: string
  mi: string
  lname: string
  email: string
  position: string
  costcenter: string
  usernumber: string
  password: string
  role: string
  status: string
  userlogin?: string
}

// The payload the update call sends (User Code is the immutable key; password
// is optional and resets the password only when provided).
export interface UpdateUserPayload {
  usercode: string
  fname: string
  mi: string
  lname: string
  email: string
  position: string
  costcenter: string
  usernumber: string
  role: string
  status: string
  password?: string
  userlogin?: string
}