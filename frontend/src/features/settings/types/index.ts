export interface ApiHealth {
  status: string
  responseTimeMs: number | null
  uptime: string
  uptimeSeconds: number
  version: string
  environment: string
}

export interface DatabaseHealth {
  status: string
  responseTimeMs: number | null
  sizeMb: number | null
  tables: number | null
  connections: number | null
  version: string | null
}

export interface NodeRedHealth {
  status: string
  responseTimeMs: number | null
  endpoint: string | null
}

export interface HealthStatus {
  api: ApiHealth
  database: DatabaseHealth
  nodeRed: NodeRedHealth
  overall: "healthy" | "warning" | "unhealthy" | string
  checkedAt: string
}

export interface SessionTimeoutSetting {
  minutes: number
}
