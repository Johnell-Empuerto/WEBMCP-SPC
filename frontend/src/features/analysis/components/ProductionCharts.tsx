import { useState, useEffect, useCallback, useRef } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/Pagination"
import { Button } from "@/components/ui/button"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  RefreshCw, Settings, Maximize2, Printer, ChevronLeft, ChevronRight, Cog, Layout,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MonthField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchMachineList, fetchMonthlyCharts } from "../api"
import type { MachineInfo, MonthlyMachineChart } from "../types"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const CHART_COLORS = {
  travelSheet: "#F79500",
  fg: "rgb(54, 162, 235)",
  production: "#02ad1b",
  ng: "rgb(255, 99, 132)",
}

function formatNum(n: number): string {
  return n.toLocaleString()
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-medium">Day {label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatNum(Number(entry.value))}
        </p>
      ))}
    </div>
  )
}

function buildChartPrintHtml(chart: MonthlyMachineChart): string {
  return `<!DOCTYPE html><html><head><title>${chart.machineName} - ${chart.monthYear}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;text-align:center}
      h2{color:#333;margin-bottom:20px}
      table{margin:0 auto;border-collapse:collapse;width:80%}
      th,td{border:1px solid #ddd;padding:8px;text-align:center;font-size:12px}
      th{background-color:#f5f5f5}
    </style></head><body>
    <h2>${chart.machineName} - ${chart.monthYear}</h2>
    <table><thead><tr>
      <th>Day</th><th>Travel Sheet</th><th>FG</th><th>Production</th><th>NG</th>
    </tr></thead><tbody>
    ${chart.dayno.map((day, i) => `
      <tr><td>${day}</td><td>${formatNum(chart.travelSheetCount[i])}</td>
      <td>${formatNum(chart.fg[i])}</td><td>${formatNum(chart.total[i])}</td>
      <td>${formatNum(chart.ng[i])}</td></tr>
    `).join("")}
    </tbody></table>
    <p style="margin-top:20px;color:#666;font-size:11px;">
      Total Travel Sheets: ${formatNum(chart.overallTravelSheetCount)} |
      Max: ${formatNum(chart.maxTravelSheet)} |
      Greatest Total: ${formatNum(chart.greatestTotal)}
    </p>
    <script>window.print();window.close();</script></body></html>`
}

function getDefaultDate() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

const PAGE_SIZES = [10, 25, 50, 100, 500]

export default function ProductionCharts() {
  usePageTitle("Production Analysis")

  const [machines, setMachines] = useState<MachineInfo[]>([])
  const [charts, setCharts] = useState<MonthlyMachineChart[]>([])
  const [loading, setLoading] = useState({ machines: true, charts: false })
  const [selmonth, setSelmonth] = useState(getDefaultDate().month)
  const [selyears, setSelyears] = useState(getDefaultDate().year)
  const [selmachine, setSelmachine] = useState("")
  const [chartType, setChartType] = useState<"simp" | "adv">("adv")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)
  const initialized = useRef(false)

  const filteredCharts = charts
  const totalItems = filteredCharts.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedCharts = filteredCharts.slice((page - 1) * pageSize, page * pageSize)
  const showingFrom = totalItems > 0 ? (page - 1) * pageSize + 1 : 0
  const showingTo = Math.min(page * pageSize, totalItems)
  const zoomedChart = zoomIndex !== null ? charts[zoomIndex] : null

  const loadCharts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, charts: true }))
    try {
      const data = await fetchMonthlyCharts(selmonth, selyears, selmachine || undefined)
      setCharts(data)
      setPage(1)
    } catch {
      setCharts([])
    } finally {
      setLoading((prev) => ({ ...prev, charts: false }))
    }
  }, [selmonth, selyears, selmachine])

  const loadMachines = useCallback(async () => {
    try {
      setMachines(await fetchMachineList())
    } catch {
      /* */
    } finally {
      setLoading((prev) => ({ ...prev, machines: false }))
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadMachines()
      loadCharts()
    }
  }, [loadMachines, loadCharts])

  useEffect(() => {
    if (initialized.current) {
      loadCharts()
    }
  }, [selmonth, selyears, selmachine])

  const handleShowData = () => loadCharts()

  const handlePrintSingle = (index: number) => {
    const chart = charts[index]
    if (!chart) return
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(buildChartPrintHtml(chart))
    w.document.close()
  }

  const handlePrintAll = () => {
    if (charts.length === 0) return
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>All Machine Charts</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px}
        h1{text-align:center;color:#333;margin-bottom:30px}
        .cp{page-break-after:always;margin-bottom:30px}
        h2{color:#555}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th,td{border:1px solid #ddd;padding:6px;text-align:center;font-size:11px}
        th{background-color:#f5f5f5}
      </style></head><body>
      <h1>Charts for All Machines</h1>
      ${charts.map((c) => `<div class="cp">${buildChartPrintHtml(c).replace(/<script>.*<\/script>/, "")}</div>`).join("")}
      <script>window.print();window.close();</script></body></html>`)
    w.document.close()
  }

  const handlePrintModal = () => {
    if (zoomedChart) handlePrintSingle(charts.indexOf(zoomedChart))
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 5 + i)

  return (
    <div className="space-y-6">
      {/* ── Header — legacy style ────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0099fc] to-[#4ab8ff] px-6 py-5 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20">
              <span className="text-3xl font-bold">⚙</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white/80">NPAX CEBU PHILS</div>
              <div className="text-xl font-bold tracking-tight">NXPERT EON</div>
              <div className="text-base font-medium text-white/90">Production Details</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
            <span>Analysis</span>
            <ChevronRight className="h-3 w-3" />
            <span>Production Details</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/90">Charts</span>
          </div>
        </div>
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: 50 + Math.random() * 30,
                height: 50 + Math.random() * 30,
                top: `${10 + Math.random() * 60}%`,
                left: `${10 + Math.random() * 70}%`,
                animation: `pulse 8s ease-in-out infinite`,
                animationDelay: `${i * 1.2}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
        <div className="absolute top-3 right-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadCharts()}
              disabled={loading.charts}
              className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
            >
            <RefreshCw className={cn("h-3.5 w-3.5", loading.charts && "animate-spin")} />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── Search Panel — legacy style ──────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Search Option</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Month</label>
              <div className="flex gap-2">
                <MonthField className="flex-1">
                  <select
                    value={selmonth}
                    onChange={(e) => setSelmonth(Number(e.target.value))}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </MonthField>
                <MonthField className="w-24">
                  <select
                    value={selyears}
                    onChange={(e) => setSelyears(Number(e.target.value))}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </MonthField>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select a Machine</label>
              <FilterField icon={Cog}>
                <select
                  value={selmachine}
                  onChange={(e) => setSelmachine(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Machines</option>
                  {machines.map((m) => (
                    <option key={m.machineCode} value={m.machineCode}>{m.machineDesc}</option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Display</label>
              <FilterField icon={Layout}>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as "simp" | "adv")}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="simp">Simple</option>
                  <option value="adv">Advance</option>
                </select>
              </FilterField>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="default" size="sm" onClick={handlePrintAll} disabled={charts.length === 0} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print Chart
            </Button>
            <Button variant="default" size="sm" onClick={handleShowData} className="gap-1.5">
              Show Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Pagination (top) ─────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}

      {/* ── Charts Grid ──────────────────────────────────────── */}
      {loading.charts ? (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[260px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : paginatedCharts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm font-medium">No chart data available</p>
            <p className="text-xs mt-1">Select a month and click "Show Data" to view charts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {paginatedCharts.map((chart, pi) => {
            const realIndex = (page - 1) * pageSize + pi
            const chartData = chart.dayno.map((day, i) => ({
              day: `${day}`,
              travelSheet: chart.travelSheetCount[i],
              fg: chart.fg[i],
              total: chart.total[i],
              ng: chart.ng[i],
            }))

            return (
              <Card key={chart.machineName} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                  <CardTitle className="text-sm font-semibold">{chart.machineName}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintSingle(realIndex)} title="Print/Save to PDF">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomIndex(realIndex)} title="Zoom in">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => v.toLocaleString()}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => v.toLocaleString()}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconSize={8} />
                        {chartType === "adv" ? (
                          <>
                            <Bar yAxisId="left" dataKey="fg" name="Finished Goods" fill={CHART_COLORS.fg} radius={[2, 2, 0, 0]} barSize={8} />
                            <Bar yAxisId="left" dataKey="total" name="Production Count" fill={CHART_COLORS.production} radius={[2, 2, 0, 0]} barSize={8} />
                            <Bar yAxisId="left" dataKey="ng" name="Non Goods" fill={CHART_COLORS.ng} radius={[2, 2, 0, 0]} barSize={8} />
                            <Line yAxisId="right" type="monotone" dataKey="travelSheet" name="Travel Sheet Count" stroke={CHART_COLORS.travelSheet} strokeWidth={2} dot={{ r: 2 }} />
                          </>
                        ) : (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="fg" name="Finished Goods" stroke={CHART_COLORS.fg} strokeWidth={2} dot={{ r: 2 }} />
                            <Line yAxisId="left" type="monotone" dataKey="total" name="Production Count" stroke={CHART_COLORS.production} strokeWidth={2} dot={{ r: 2 }} />
                            <Line yAxisId="left" type="monotone" dataKey="ng" name="Non Goods" stroke={CHART_COLORS.ng} strokeWidth={2} strokeDasharray="10 5" dot={{ r: 2 }} />
                            <Line yAxisId="right" type="monotone" dataKey="travelSheet" name="Travel Sheet Count" stroke={CHART_COLORS.travelSheet} strokeWidth={2} dot={{ r: 2 }} />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-[11px] text-muted-foreground mt-1">{chart.monthYear}</p>
                  <p className="text-center text-[10px] text-muted-foreground/60 mt-0.5">
                    {formatNum(chart.overallTravelSheetCount)} Overall Travel Sheet
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Pagination (bottom) ──────────────────────────────── */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {showingFrom} to {showingTo} of {totalItems} entries
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-muted-foreground">...</span>}
                    <Button
                      variant={p === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </span>
                ))}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Zoom Modal ───────────────────────────────────────── */}
      <Dialog open={zoomIndex !== null} onOpenChange={(open) => { if (!open) setZoomIndex(null) }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] bg-background/95 backdrop-blur-sm">
          {zoomedChart && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between">
                <DialogTitle>{zoomedChart.machineName} — {zoomedChart.monthYear}</DialogTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handlePrintModal} className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                </div>
              </DialogHeader>
              <div style={{ height: 500 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={zoomedChart.dayno.map((day, i) => ({
                      day: `${day}`,
                      travelSheet: zoomedChart.travelSheetCount[i],
                      fg: zoomedChart.fg[i],
                      total: zoomedChart.total[i],
                      ng: zoomedChart.ng[i],
                    }))}
                    margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconSize={10} />
                    {chartType === "adv" ? (
                      <>
                        <Bar yAxisId="left" dataKey="fg" name="Finished Goods" fill={CHART_COLORS.fg} radius={[4, 4, 0, 0]} barSize={14} />
                        <Bar yAxisId="left" dataKey="total" name="Production Count" fill={CHART_COLORS.production} radius={[4, 4, 0, 0]} barSize={14} />
                        <Bar yAxisId="left" dataKey="ng" name="Non Goods" fill={CHART_COLORS.ng} radius={[4, 4, 0, 0]} barSize={14} />
                        <Line yAxisId="right" type="monotone" dataKey="travelSheet" name="Travel Sheet Count" stroke={CHART_COLORS.travelSheet} strokeWidth={2} dot={{ r: 3 }} />
                      </>
                    ) : (
                      <>
                        <Line yAxisId="left" type="monotone" dataKey="fg" name="Finished Goods" stroke={CHART_COLORS.fg} strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="left" type="monotone" dataKey="total" name="Production Count" stroke={CHART_COLORS.production} strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="left" type="monotone" dataKey="ng" name="Non Goods" stroke={CHART_COLORS.ng} strokeWidth={2} strokeDasharray="10 5" dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="travelSheet" name="Travel Sheet Count" stroke={CHART_COLORS.travelSheet} strokeWidth={2} dot={{ r: 3 }} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                {formatNum(zoomedChart.overallTravelSheetCount)} Overall Travel Sheet
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Animation keyframes ──────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0) translateY(0) rotate(0deg); opacity: 0; }
          50% { opacity: 0.15; }
          100% { transform: scale(1.5) translateY(-80px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
