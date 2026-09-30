export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  color?: string
  backgroundColor?: string
  borderColor?: string
  textColor?: string
  type?: string
  application?: string
  status?: string
  remarks?: string
  prodcode?: string
  pqty?: number
  actqty?: number
  wip_qty?: number
  ng_qty?: number
  fg_qty?: number
  file?: string
  [key: string]: unknown
}

export interface ProductDetail {
  remarks: string
  prodcode: string
  pqty: number
  actqty: number
  totplan?: number
  totact?: number
}

export interface DailyProductionDetail {
  shift: string
  prodcode: string
  remarks: string
  pqty: number
  wip_qty: number
  ng_qty: number
  fg_qty: number
}

export interface MonthlySummary {
  month: number
  planqty: number
  actqty: number
}

export interface ProductionFilters {
  line?: string
  machine?: string
  date?: string
}
