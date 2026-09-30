import { formatNumber } from "@/lib/formatters"

export { formatNumber }

export const CHART_COLORS = {
  plan: "#52525b",
  actual: "#d97706",
  wip: "#005B96",
  ng: "#dc2626",
  fg: "#16a34a",
  grid: "#e2e8f0",
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const v = n / 1_000_000
    const s = v % 1 === 0 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, "")
    return `${s}M`
  }
  if (abs >= 1_000) {
    const v = n / 1_000
    const s = v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.?0+$/, "")
    return `${s}K`
  }
  return formatNumber(n)
}

export function formatPercent(n: number): string {
  return `${formatNumber(n)}%`
}

export function achievementTextColor(achievement: number): string {
  if (achievement >= 100) return "text-emerald-600 dark:text-emerald-400"
  if (achievement >= 80) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export function achievementBarColor(achievement: number): string {
  if (achievement >= 100) return "bg-emerald-500"
  if (achievement >= 80) return "bg-amber-500"
  return "bg-red-500"
}
