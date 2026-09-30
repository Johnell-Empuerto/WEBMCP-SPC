export const ROLES = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  USER: 3,
  OPERATOR_1: 4,
  OPERATOR_2: 5,
  OPERATOR_3: 6,
  OPERATOR_4: 7,
  OPERATOR_5: 8,
  OPERATOR_6: 9,
  OPERATOR_7: 10,
} as const

export type RoleId = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_LABELS: Record<RoleId, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN]: "Admin",
  [ROLES.USER]: "User",
  [ROLES.OPERATOR_1]: "Operator 1",
  [ROLES.OPERATOR_2]: "Operator 2",
  [ROLES.OPERATOR_3]: "Operator 3",
  [ROLES.OPERATOR_4]: "Operator 4",
  [ROLES.OPERATOR_5]: "Operator 5",
  [ROLES.OPERATOR_6]: "Operator 6",
  [ROLES.OPERATOR_7]: "Operator 7",
}

export function getRoleLabel(role: number): string {
  return ROLE_LABELS[role as RoleId] ?? `Unknown (${role})`
}

export function isAdminRole(role: number): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
}

export function canManageUsers(role: number): boolean {
  return isAdminRole(role)
}

export function canAccessSettings(role: number): boolean {
  return isAdminRole(role)
}

export function canViewCharts(_role: number): boolean {
  return true
}

export function canExportExcel(_role: number): boolean {
  return true
}
