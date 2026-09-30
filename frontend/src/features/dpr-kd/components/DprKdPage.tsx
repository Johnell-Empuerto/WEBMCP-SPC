import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import {
  ChevronDown, ChevronUp, Settings, Save, Search, Printer, Factory, CalendarDays,
  AlertTriangle, CheckCircle, XCircle, HelpCircle, Box, Clock, Table, Timer
} from "lucide-react"
import {
  fetchDistinctDieNo, fetchDieNo, fetchDPRData, fetchDPRDetails,
  insertDPRHeader, updateDPRHeader, insertDPRDetails, updateDPRDetails,
  fetchShifts, fetchTeamLeaders, fetchGroupLeaders, fetchLineCheckers
} from "../api"
import type { DprKdFilter, DprKdDetailRow, DprKdFooter, LeaderInfo, ShiftInfo } from "../types"
import { MODELS, KD_TABLES } from "../types"
import LeaderPicker from "../../dpr-c4/components/LeaderPicker"

const EMPTY_FOOTER = (): DprKdFooter => ({
  totalActual: 0,
  actualEfficiency: 0,
  actualEfficiencyDisplay: "0%",
  Dph_TotalPartWithChipsDefects: 0,
  Dph_TotalMachiningDefects: 0,
  Dph_TotalCastingDefects: 0,
  Dph_TeamLeader: "",
  Dph_GroupLeader: "",
  Dph_Inspector: "",
})

function safeNum(v: any): number {
  if (v === null || v === undefined || v === "" || v === "undefined" || v === "NaN") return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function formatCell(v: any): string {
  const n = safeNum(v)
  return n.toLocaleString()
}

const DEFAULT_KD_HOURS = [
  "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
  "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00",
]

const EMPTY_DETAIL = (): DprKdDetailRow[] =>
  DEFAULT_KD_HOURS.map((hr, i) => ({
    Dpd_DPRCode: "", Dpd_SplitSeq: i + 1, Dpd_HrName: hr,
    Dpd_ResultCount: 0, Dpd_ActualDenominator: 0, Dpd_ShotsResultsDenominator: 0,
    Dpd_TargetNumeratorWBackup: 0, Dpd_TargetDenominatorWBackup: 0,
    Dpd_TargetNumeratorWOBackup: 0, Dpd_TargetDenominatorWOBackup: 0,
    Dpd_Judgement: "", Dpd_NumberOfManpower: 0,
    Dpd_PartsWithChipsQty: 0, Dpd_MachiningDefectQty: 0, Dpd_CastingDefectQty: 0,
    Dpd_KanbanNo: "", Dpd_KanbanNo2: "", Dpd_Downtime: 0,
    Dpd_ProblemDetected: "", Dpd_CounterMeasures: "", Dpd_PIC: "",
  }))

// Legacy: Dpd_ActualDenominator / Dpd_TargetDenominator* are running totals
// (cumulative) of the numerators, exactly like loadExistingDPR/loadDPRDetails.
const recalcCumulative = (rows: DprKdDetailRow[]): DprKdDetailRow[] => {
  let cumActual = 0, cumWBackup = 0, cumWOBackup = 0
  return rows.map(d => {
    cumActual += safeNum(d.Dpd_ResultCount)
    cumWBackup += safeNum(d.Dpd_TargetNumeratorWBackup)
    cumWOBackup += safeNum(d.Dpd_TargetNumeratorWOBackup)
    return {
      ...d,
      Dpd_ActualDenominator: cumActual,
      Dpd_ShotsResultsDenominator: cumActual,
      Dpd_TargetDenominatorWBackup: cumWBackup,
      Dpd_TargetDenominatorWOBackup: cumWOBackup,
    }
  })
}

// Legacy: totalActual = last cumulative actual; efficiency = round(total/247*100)
const computeFooter = (details: DprKdDetailRow[], foot: DprKdFooter): DprKdFooter => {
  let chips = 0, machining = 0, casting = 0
  details.forEach(d => {
    chips += safeNum(d.Dpd_PartsWithChipsQty)
    machining += safeNum(d.Dpd_MachiningDefectQty)
    casting += safeNum(d.Dpd_CastingDefectQty)
  })
  const last = details[details.length - 1]
  const totalActual = last ? safeNum(last.Dpd_ActualDenominator) : 0
  const eff = totalActual > 0 ? Math.round(totalActual / 247 * 100) : 0
  return {
    ...foot,
    totalActual,
    actualEfficiency: eff,
    actualEfficiencyDisplay: `${eff}%`,
    Dph_TotalPartWithChipsDefects: chips,
    Dph_TotalMachiningDefects: machining,
    Dph_TotalCastingDefects: casting,
  }
}

export default function DprKdPage() {
  usePageTitle("DPR Entry (KD)")

  const [filter, setFilter] = useState<DprKdFilter>({
    line: "5", partName: "Crank Case", shift: "", date: new Date().toISOString().slice(0, 10),
    model: "8-98247-187-2", table: "KD Table 1", dieNo: "", std: "",
  })
  const [shifts, setShifts] = useState<ShiftInfo[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [shiftsError, setShiftsError] = useState(false)
  const [teamLeaders, setTeamLeaders] = useState<LeaderInfo[]>([])
  const [groupLeaders, setGroupLeaders] = useState<LeaderInfo[]>([])
  const [lineCheckers, setLineCheckers] = useState<LeaderInfo[]>([])
  const [dprDetails, setDprDetails] = useState<DprKdDetailRow[]>(() => EMPTY_DETAIL())
  const [isLoaded, setIsLoaded] = useState(false)
  const [footerObj, setFooterObj] = useState<DprKdFooter>(EMPTY_FOOTER())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [collapse, setCollapse] = useState(false)
  const [isExisting, setIsExisting] = useState(false)
  const [dprCode, setDprCode] = useState("")
  const [modalMsg, setModalMsg] = useState<{ type: "success" | "warning" | "error"; msg: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [filterOrig, setFilterOrig] = useState<any>(null)
  const [zoom, setZoom] = useState(0.8)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShiftsLoading(true)
    setShiftsError(false)
    fetchShifts()
      .then(data => { setShifts(data); setShiftsLoading(false) })
      .catch(() => { setShiftsError(true); setShiftsLoading(false) })
    fetchTeamLeaders().then(setTeamLeaders).catch(() => {})
    fetchGroupLeaders().then(setGroupLeaders).catch(() => {})
    fetchLineCheckers().then(setLineCheckers).catch(() => {})
  }, [])

  const validate = useCallback((): string | null => {
    if (!filter.std || filter.std === "undefined") return "Please enter STD CT"
    if (!filter.partName) return "Please select a part name"
    if (!filter.shift) return "Please select a shift"
    if (!filter.date) return "Please select a date"
    if (!filter.table) return "Please select a table"
    if (!filter.model) return "Please select a model"
    return null
  }, [filter])

  const loadNewDetails = useCallback(async (f: DprKdFilter) => {
    const details: DprKdDetailRow[] = []
    for (let i = 0; i < 8; i++) {
      try {
        const result = await fetchDPRDetails({ ...f, i })
        if (result.length > 0) {
          details.push({ ...result[0], Dpd_SplitSeq: i + 1 })
        } else {
          // Legacy: even when the SP returns nothing for an hour, a default row is
          // pushed so the table always shows exactly 8 rows with aligned split seq.
          details.push({ ...EMPTY_DETAIL()[i], Dpd_SplitSeq: i + 1 })
        }
      } catch {
        details.push({ ...EMPTY_DETAIL()[i], Dpd_SplitSeq: i + 1 })
      }
    }
    const rows = recalcCumulative(details)
    setDprDetails(rows)
    setFooterObj(prev => computeFooter(rows, prev))
  }, [])

  const handleLoad = useCallback(async () => {
    const err = validate()
    if (err) { setModalMsg({ type: "warning", msg: err }); return }
    setLoading(true)
    try {
      const distinct = await fetchDistinctDieNo(filter)
      let currentFilter = { ...filter }
      // Legacy: if the die number is distinct (count==1), resolve it automatically.
      if (distinct.CODE === 200) {
        const dieResult = await fetchDieNo(filter)
        if (dieResult.DATA) currentFilter.dieNo = dieResult.DATA
        setFilter(currentFilter)
      }
      setFilterOrig(JSON.parse(JSON.stringify(currentFilter)))
      const existing = await fetchDPRData(currentFilter)
      if (existing.code === 200 && existing.header.length > 0) {
        setIsExisting(true)
        setDprCode(existing.header[0].Dph_DPRCode || "")
        const fetched = existing.detail || []
        const rows = recalcCumulative(fetched.map((d, i) => ({
          ...d, Dpd_SplitSeq: safeNum(d.Dpd_SplitSeq) || i + 1,
        })))
        setDprDetails(rows)
        const hdr = existing.header[0]
        setFooterObj(prev => computeFooter(rows, {
          ...prev,
          Dph_TeamLeader: hdr.Dph_TeamLeader || "",
          Dph_GroupLeader: hdr.Dph_GroupLeader || "",
          Dph_Inspector: hdr.Dph_Inspector || "",
        }))
      } else {
        setIsExisting(false)
        setDprCode("")
        await loadNewDetails(currentFilter)
      }
      setIsLoaded(true)
      setModalMsg({ type: "success", msg: "DPR data loaded successfully" })
    } catch (e: any) {
      setModalMsg({ type: "error", msg: e.message || "Failed to load data" })
    } finally {
      setLoading(false)
    }
  }, [filter, validate, loadNewDetails])

  const handleDetailChange = useCallback((index: number, field: keyof DprKdDetailRow, value: any) => {
    setDprDetails(prev => {
      let newValue = value
      if (field === "Dpd_Judgement") {
        const up = String(value ?? "").toUpperCase()
        newValue = up === "X" || up === "O" ? up : ""
      }
      const updated = prev.map((d, i) => i === index ? { ...d, [field]: newValue } : d)
      const recalculated = recalcCumulative(updated)
      setFooterObj(prevF => computeFooter(recalculated, prevF))
      return recalculated
    })
  }, [])

  // Legacy limitJudjementInputToXO: JUDGEMENT accepts ONLY X or O.
  const handleJudgementKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const controlKeys = [
      "Backspace", "Delete", "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End",
    ]
    if (controlKeys.includes(e.key)) return
    const key = e.key.toUpperCase()
    if (key !== "X" && key !== "O") {
      e.preventDefault()
    }
  }, [])

  const handleFooterChange = useCallback((field: keyof DprKdFooter, value: any) => {
    setFooterObj(prev => ({ ...prev, [field]: value }))
  }, [])

  const areFiltersEqual = (a: any, b: any): boolean => {
    if (!a || !b) return false
    const keysA = Object.keys(a).filter(k => k !== "i" && k !== "x")
    const keysB = Object.keys(b).filter(k => k !== "i" && k !== "x")
    if (keysA.length !== keysB.length) return false
    return keysA.every(k => String(a[k]) === String(b[k]))
  }

  const handleSave = useCallback(async () => {
    const err = validate()
    if (err) { setModalMsg({ type: "warning", msg: err }); return }
    const newFilter = { ...filter }
    if (!areFiltersEqual(newFilter, filterOrig)) {
      setModalMsg({ type: "warning", msg: "There have been changes in the search parameters, please press the load button again" })
      return
    }
    setConfirmOpen(true)
  }, [filter, filterOrig, validate])

  const doSave = useCallback(async () => {
    setConfirmOpen(false)
    setSaving(true)
    const newFilter = { ...filter }
    const rows = dprDetails
    try {
      let code = dprCode
      if (isExisting) {
        await updateDPRHeader(code, newFilter, footerObj)
        await updateDPRDetails(rows.map(d => ({ ...d, Dpd_DPRCode: code })))
      } else {
        const result = await insertDPRHeader(newFilter, footerObj)
        code = result.code
        setDprCode(code)
        await insertDPRDetails(rows.map(d => ({ ...d, Dpd_DPRCode: code })))
        setIsExisting(true)
      }
      setModalMsg({ type: "success", msg: `KD DPR successfully ${isExisting ? "updated" : "saved"}` })
    } catch (e: any) {
      setModalMsg({ type: "error", msg: e.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }, [filter, isExisting, footerObj, dprDetails, dprCode])

  const buildPrintHtml = (f: DprKdFilter, details: DprKdDetailRow[], foot: DprKdFooter): string => {
    const p = (v: any) => v ?? ""
    const sf = (v: any) => (safeNum(v) > 0 ? String(safeNum(v)) : "")

    let rows = ""
    details.forEach(d => {
      const pic = (d.Ptm_ManpowerCode || d.Dpd_PIC || "").split(",")[0]
      rows += `<tr style="height:22px">
        <td class="bg-white fw-bold">${p(d.Dpd_HrName)}</td>
        <td class="diagonal"><span class="numerator">${sf(d.Dpd_TargetNumeratorWBackup)}</span><span class="denominator">${sf(d.Dpd_TargetDenominatorWBackup)}</span></td>
        <td class="diagonal"><span class="numerator">${sf(d.Dpd_TargetNumeratorWOBackup)}</span><span class="denominator">${sf(d.Dpd_TargetDenominatorWOBackup)}</span></td>
        <td class="diagonal-yellow"><span class="numerator">${sf(d.Dpd_ResultCount)}</span><span class="denominator">${sf(d.Dpd_ActualDenominator)}</span></td>
        <td class="bg-yellow">${p(d.Dpd_Judgement)}</td>
        <td class="bg-yellow">${p(d.Dpd_NumberOfManpower)}</td>
        <td class="bg-yellow">${p(d.Dpd_PartsWithChipsQty)}</td>
        <td class="bg-yellow">${p(d.Dpd_MachiningDefectQty)}</td>
        <td class="bg-yellow">${p(d.Dpd_CastingDefectQty)}</td>
        <td class="bg-yellow">${p(d.Dpd_KanbanNo)}<div class="dashed-top"></div>${p(d.Dpd_KanbanNo2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Downtime)}</td>
        <td class="bg-yellow">${p(d.Dpd_ProblemDetected)}</td>
        <td class="bg-yellow">${p(d.Dpd_CounterMeasures)}</td>
        <td class="bg-yellow">${pic}</td>
      </tr>`
    })

    const totalRow = `<tr style="height:22px" class="fw-bold">
      <td class="bg-white">TOTAL CHECKED</td>
      <td class="bg-white">247</td>
      <td class="bg-white">203</td>
      <td class="bg-yellow">${sf(foot.totalActual)}</td>
      <td class="bg-white"></td>
      <td class="bg-white"></td>
      <td class="bg-yellow">${sf(foot.Dph_TotalPartWithChipsDefects)}</td>
      <td class="bg-yellow">${sf(foot.Dph_TotalMachiningDefects)}</td>
      <td class="bg-yellow">${sf(foot.Dph_TotalCastingDefects)}</td>
      <td colspan="5" class="bg-white"></td>
    </tr>`

    const footerRows = `
      <tr style="height:18px">
        <td class="bg-white"></td>
        <td class="bg-white fw-bold">with back-up<br>EFFICIENCY</td>
        <td class="bg-white fw-bold">w/o back-up<br>EFFICIENCY</td>
        <td class="bg-white fw-bold">Actual<br>EFFICIENCY</td>
        <td colspan="7" class="bg-white"></td>
        <td class="bg-white fw-bold">TEAM LEADER</td>
        <td class="bg-white fw-bold">LEADMAN</td>
        <td class="bg-white fw-bold">INSPECTOR</td>
      </tr>
      <tr style="height:18px">
        <td class="bg-white"></td>
        <td class="bg-white fw-bold">100%</td>
        <td class="bg-white fw-bold">81%</td>
        <td class="bg-yellow fw-bold">${p(foot.actualEfficiencyDisplay)}</td>
        <td colspan="7" class="bg-white"></td>
        <td class="bg-yellow">${p(foot.Dph_TeamLeader)}</td>
        <td class="bg-yellow">${p(foot.Dph_GroupLeader)}</td>
        <td class="bg-yellow">${p(foot.Dph_Inspector)}</td>
      </tr>`

    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo_npax.png` : "/logo_npax.png"

    return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
        <tr>
          <td style="width:70px;vertical-align:middle;text-align:left;border:none;padding:0">
            <img src="${logoUrl}" style="height:34px;width:auto" />
          </td>
          <td style="border:none;padding:0;text-align:center;vertical-align:middle">
            <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#003d6b">N-PAX CORPORATION PHILIPPINES</div>
            <div style="font-size:10px;color:#444;margin-top:2px;letter-spacing:0.5px">Case Visual Inspection &mdash; KD Line Daily Production Record</div>
          </td>
        </tr>
      </table>
      <div style="height:2px;background:#006ba6;margin-bottom:6px;border-radius:2px"></div>
      <table class="det-table">
        <tr>
          <td class="det-label">LINE</td>
          <td class="det-val">${p(f.line === "5" ? "KD" : f.line)}</td>
          <td class="det-label">DATE</td>
          <td class="det-val">${p(f.date)}</td>
        </tr>
        <tr>
          <td class="det-label">PART NAME</td>
          <td class="det-val">${p(f.partName)}</td>
          <td class="det-label">SHIFT</td>
          <td class="det-val">${p(f.shift)}</td>
        </tr>
        <tr>
          <td class="det-label">MODEL / RATIO</td>
          <td class="det-val">${p(f.model)}</td>
          <td class="det-label">TABLE</td>
          <td class="det-val">${p(f.table)}</td>
        </tr>
        <tr>
          <td class="det-label">STD CYCLE TIME</td>
          <td class="det-val">${p(f.std)} mins</td>
          <td class="det-label"></td>
          <td class="det-val"></td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:9px">
        <colgroup>
          <col style="width:8%"><col style="width:6%"><col style="width:6%">
          <col style="width:6%"><col style="width:4%"><col style="width:4%">
          <col style="width:6%"><col style="width:3%"><col style="width:6%">
          <col style="width:6%"><col style="width:6%"><col style="width:15%">
          <col style="width:15%"><col style="width:6%">
        </colgroup>
        <thead>
          <tr style="height:18px">
            <th rowspan="2" class="bg-blue">TIME</th>
            <th rowspan="2" class="bg-blue">100% TARGET<br>(with backup)</th>
            <th rowspan="2" class="bg-blue">100% TARGET<br>(w/o backup)</th>
            <th rowspan="2" class="bg-blue">Actual<br>Result</th>
            <th rowspan="2" class="bg-blue">JUDG.</th>
            <th rowspan="2" class="bg-blue">No. of<br>Manpower</th>
            <th rowspan="2" class="bg-blue">Parts with<br>Chips</th>
            <th rowspan="2" class="bg-blue">Machining<br>(ex. Dent)</th>
            <th rowspan="2" class="bg-blue">Casting<br>(ex. Blowhole)</th>
            <th rowspan="2" class="bg-blue">KANBAN<br>NUMBER</th>
            <th rowspan="2" class="bg-blue">DOWNTIME<br>(mins.)</th>
            <th rowspan="2" class="bg-blue">PROBLEM<br>DETECTED</th>
            <th rowspan="2" class="bg-blue">ACTION TAKEN/<br>COUNTERMEASURE</th>
            <th rowspan="2" class="bg-blue">PIC</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:0">
        ${totalRow}
        ${footerRows}
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:2px">
        <tr>
          <td colspan="2" style="padding:2px;text-align:left">O - ACHIEVE HOURLY TARGET</td>
          <td colspan="2" style="padding:2px;text-align:left">QP - QUALITY PROBLEM</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:2px;text-align:left">X - NOT ACHIEVE HOURLY TARGET</td>
          <td colspan="2" style="padding:2px;text-align:left">NO VISUAL AND PACKING</td>
        </tr>
      </table>
    `
  }

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    const w = window.open("", "_blank", "width=1200,height=700,scrollbars=yes")
    if (!w) return
    w.document.write(`
      <html><head>
        <style>
          @page { size: landscape; margin: 8mm; }
          body { font-family: Arial, sans-serif; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { border-collapse: collapse; width: 100%; font-size: 9px; }
          td, th { border: 1px solid black; padding: 2px 3px; text-align: center; }
          .bg-yellow { background: #F5F591; }
          .bg-blue { background: #006ba6; color: white; }
          .bg-white { background: white; }
          .diagonal { background: linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%); }
          .diagonal-yellow { background: linear-gradient(to right bottom, #F5F591 0%, #F5F591 49.9%, #000 50%, #000 51%, #F5F591 51.1%, #F5F591 100%); }
          .numerator { float: left; }
          .denominator { float: right; }
          .det-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9.5px; }
          .det-table td { border: 1px solid #ccc; padding: 2px 6px; }
          .det-label { background: #eaf2f8; font-weight: bold; letter-spacing: 0.5px; font-size: 8.5px; color: #005b96; width: 18%; text-align: right; white-space: nowrap; }
          .det-val { font-weight: 600; text-align: left; }
          .fw-bold { font-weight: bold; }
          .dashed-top { border-top: 1px dashed black; }
        </style>
      </head><body onload="window.print()">
        ${buildPrintHtml(filter, dprDetails, footerObj)}
      </body></html>
    `)
    w.document.close()
  }, [filter, dprDetails, footerObj])

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dpr-kd-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dpr-kd-grid)" />
            <line x1="0" y1="0" x2="100%" y2="100%" stroke="white" strokeWidth="0.3" />
            <line x1="100%" y1="0" x2="0" y2="100%" stroke="white" strokeWidth="0.3" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img src="/plan.png" alt="Production Planning" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              DPR Entry (KD)
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Daily Production Recording &amp; Monitoring for KD Line
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <CalendarDays className="h-3 w-3" />
                {filter.date
                  ? new Date(filter.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "— Select date —"}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Parameter Panel ───────────────────────────── */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-4 px-5 pt-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </div>
            <span>Parameter</span>
            <button
              onClick={() => setCollapse(!collapse)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 hover:bg-accent"
            >
              {collapse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardTitle>
        </CardHeader>

        {collapse && (
          <CardContent className="space-y-5 px-5 pb-5">
            {/* ── Production Context ─────────────────────── */}
            <div className="flex items-start gap-3 pb-4 border-b border-border/40">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/5 text-primary shrink-0 mt-0.5">
                <Factory className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground leading-tight">
                  N-PAX CORPORATION PHILIPPINES
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Aluminium Die Casting Section — KD Line Daily Production Record
                </div>
              </div>
            </div>

            {/* ── Production Selection ──────────────────── */}
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase mb-3">
                Production Selection
              </div>
              <div className="grid gap-x-4 gap-y-3.5 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Line</label>
                  <FilterField icon={Factory}>
                    <select value={filter.line} onChange={e => setFilter(f => ({ ...f, line: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600">
                      <option value="5">KD</option>
                    </select>
                  </FilterField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Part Name</label>
                  <FilterField icon={Box}>
                    <select value={filter.partName} onChange={e => setFilter(f => ({ ...f, partName: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600">
                      <option value="Crank Case">Crank Case</option>
                    </select>
                  </FilterField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Shift</label>
                  <FilterField icon={Clock}>
                    <select value={filter.shift} onChange={e => setFilter(f => ({ ...f, shift: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                      disabled={shiftsLoading}>
                      {shiftsLoading ? (
                        <option value="">Loading shifts...</option>
                      ) : shiftsError ? (
                        <option value="">Unable to load shifts</option>
                      ) : shifts.length === 0 ? (
                        <option value="">No shifts available</option>
                      ) : (
                        <>
                          <option value="">-- Select Shift --</option>
                          {shifts.map(s => (
                            <option key={s.Scm_ShiftCode} value={s.Scm_ShiftCode}>{s.Scm_ShiftDesc}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </FilterField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date</label>
                  <DateField>
                    <input type="date" value={filter.date} onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-colors hover:border-slate-300 dark:hover:border-slate-600" />
                  </DateField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Model/Ratio</label>
                  <FilterField icon={Box}>
                    <select value={filter.model} onChange={e => setFilter(f => ({ ...f, model: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600">
                      {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </FilterField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Table</label>
                  <FilterField icon={Table}>
                    <select value={filter.table} onChange={e => setFilter(f => ({ ...f, table: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600">
                      {KD_TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </FilterField>
                </div>
              </div>
            </div>

            {/* ── Production Parameters ────────────────── */}
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase mb-3">
                Production Parameters
              </div>
              <div className="grid gap-x-4 gap-y-3.5 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">STD CT (mins.)</label>
                  <FilterField icon={Timer}>
                    <input value={filter.std} onChange={e => setFilter(f => ({ ...f, std: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                      placeholder="Enter a number" maxLength={5} />
                  </FilterField>
                </div>
              </div>
            </div>

            {/* ── Divider + Actions ─────────────────────── */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!isLoaded}
                className="h-10 rounded-xl gap-1.5 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 text-xs font-medium">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !isLoaded}
                className="h-10 rounded-xl gap-1.5 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 text-xs font-medium">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : isExisting ? "Update" : "Save"}
              </Button>
              <Button size="sm" onClick={handleLoad} disabled={loading}
                className="h-10 rounded-xl gap-1.5 bg-[#005B96] hover:bg-[#005B96]/90 text-white shadow-sm text-xs font-medium">
                <Search className="h-3.5 w-3.5" /> {loading ? "Loading..." : "Load"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Loading State ─────────────────────────────── */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Zoom Controls ──────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between mb-2">
          <div />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom(z => +(Math.max(0.4, z - 0.1)).toFixed(1))}
              className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-slate-50 transition-colors">−</button>
            <span className="text-xs font-semibold min-w-[3rem] text-center select-none">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(z => +(Math.min(2, z + 0.1)).toFixed(1))}
              className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-slate-50 transition-colors">+</button>
            <button type="button" onClick={() => setZoom(1)}
              className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-slate-50 transition-colors">Reset</button>
          </div>
        </div>
      )}

      {/* ── Data Entry Table (exact legacy layout) ────── */}
      {!loading && (
        <div className="rounded-lg border shadow-sm">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: zoom < 1 ? `${100 / zoom}%` : undefined }}>
            <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '8%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} />
                <col style={{ width: '6%' }} /><col style={{ width: '3%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} /><col style={{ width: '6%' }} /><col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} /><col style={{ width: '6%' }} />
              </colgroup>
              <thead>
                <tr style={{ height: 32 }}>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">TIME</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">100% TARGET<br />(with backup)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">100% TARGET<br />(w/o backup)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Actual<br />Result</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">JUDG.</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">No. of<br />Manpower</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Parts with<br />Chips</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Machining<br />(ex. Dent)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Casting<br />(ex. Blowhole)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">KANBAN<br />NUMBER</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">DOWNTIME<br />(mins.)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">PROBLEM<br />DETECTED</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">ACTION TAKEN/<br />COUNTERMEASURE</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">PIC</th>
                </tr>
              </thead>
              <tbody>
                {dprDetails.map((data, idx) => (
                  <tr key={idx} style={{ height: 44 }}>
                    <td className="border border-black text-center font-medium text-[11px] px-0.5 bg-white">{data.Dpd_HrName}</td>
                    {/* TARGET WITH BACKUP */}
                    <td className="border border-black p-0" style={{ background: 'linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%)' }}>
                      <div className="flex justify-between items-start" style={{ minHeight: 42 }}>
                        <span className="pl-1 pt-0.5 text-[10px] font-bold">{formatCell(data.Dpd_TargetNumeratorWBackup)}</span>
                        <span className="pr-1.5 pb-0.5 text-[10px] font-bold self-end">{formatCell(data.Dpd_TargetDenominatorWBackup)}</span>
                      </div>
                    </td>
                    {/* TARGET NO BACKUP */}
                    <td className="border border-black p-0" style={{ background: 'linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%)' }}>
                      <div className="flex justify-between items-start" style={{ minHeight: 42 }}>
                        <span className="pl-1 pt-0.5 text-[10px] font-bold">{formatCell(data.Dpd_TargetNumeratorWOBackup)}</span>
                        <span className="pr-1.5 pb-0.5 text-[10px] font-bold self-end">{formatCell(data.Dpd_TargetDenominatorWOBackup)}</span>
                      </div>
                    </td>
                    {/* ACTUAL RESULT */}
                    <td className="border border-black p-0" style={{ background: 'linear-gradient(to right bottom, #F5F591 0%, #F5F591 49.9%, #000 50%, #000 51%, #F5F591 51.1%, #F5F591 100%)' }}>
                      <div className="flex items-start" style={{ minHeight: 42 }}>
                        <input value={data.Dpd_ResultCount ?? ""}
                          onChange={e => handleDetailChange(idx, "Dpd_ResultCount", safeNum(e.target.value))}
                          className="bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none self-start mt-0.5 ml-0.5"
                          style={{ width: `${Math.min(Math.max(String(data.Dpd_ResultCount ?? "").length, 1) * 8 + 4, 36)}px`, boxSizing: 'border-box', padding: 0 }}
                          maxLength={4} />
                        <span className="flex-1 min-w-0 text-right pr-1.5 pb-0.5 text-[10px] font-bold self-end truncate">{formatCell(data.Dpd_ActualDenominator)}</span>
                      </div>
                    </td>
                    {/* JUDGEMENT */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_Judgement ?? ""} onChange={e => handleDetailChange(idx, "Dpd_Judgement", e.target.value)}
                        onKeyDown={handleJudgementKeyDown}
                        onFocus={e => e.target.select()}
                        placeholder="X/O"
                        title="X or O only"
                        className="w-full bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none placeholder:text-black/25" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={1} />
                    </td>
                    {/* NUMBER OF MANPOWER */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_NumberOfManpower ?? ""} onChange={e => handleDetailChange(idx, "Dpd_NumberOfManpower", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    {/* PARTS WITH CHIPS */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_PartsWithChipsQty ?? ""} onChange={e => handleDetailChange(idx, "Dpd_PartsWithChipsQty", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    {/* MACHINING (DENT) */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_MachiningDefectQty ?? ""} onChange={e => handleDetailChange(idx, "Dpd_MachiningDefectQty", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    {/* CASTING (BLOWHOLE) */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_CastingDefectQty ?? ""} onChange={e => handleDetailChange(idx, "Dpd_CastingDefectQty", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    {/* KANBAN NUMBER */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <input value={data.Dpd_KanbanNo} onChange={e => handleDetailChange(idx, "Dpd_KanbanNo", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <input value={data.Dpd_KanbanNo2} onChange={e => handleDetailChange(idx, "Dpd_KanbanNo2", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                      </div>
                    </td>
                    {/* DOWN TIME */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_Downtime ?? ""} onChange={e => handleDetailChange(idx, "Dpd_Downtime", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    {/* PROBLEM DETECTED */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_ProblemDetected} onChange={e => handleDetailChange(idx, "Dpd_ProblemDetected", e.target.value)}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} />
                    </td>
                    {/* ACTION TAKEN */}
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_CounterMeasures} onChange={e => handleDetailChange(idx, "Dpd_CounterMeasures", e.target.value)}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} />
                    </td>
                    {/* PIC */}
                    <td className="border border-black bg-[#F5F591] p-0 text-center text-[10px] font-medium" style={{ height: 44 }}>
                      {(data.Ptm_ManpowerCode || data.Dpd_PIC || "").split(",")[0]}
                    </td>
                  </tr>
                ))}

                {/* ── Spacer ──────────────────────────────── */}
                <tr><td colSpan={14} className="border border-black" style={{ height: 5 }} /></tr>

                {/* ── TOTAL ROW ────────────────────────────── */}
                <tr style={{ height: 36 }} className="font-semibold">
                  <td className="border border-black text-center text-[11px] font-bold px-0.5 bg-white">TOTAL CHECKED</td>
                  <td className="border border-black text-center font-bold text-xs bg-white">247</td>
                  <td className="border border-black text-center font-bold text-xs bg-white">203</td>
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.totalActual)}</td>
                  <td colSpan={2} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotalPartWithChipsDefects)}</td>
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotalMachiningDefects)}</td>
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotalCastingDefects)}</td>
                  <td colSpan={5} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                </tr>

                {/* ── Spacer ──────────────────────────────── */}
                <tr><td colSpan={14} className="border border-black" style={{ height: 5 }} /></tr>

                {/* ── EFFICIENCY HEADER ROW ───────────────── */}
                <tr style={{ height: 28 }}>
                  <td className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">with back-up<br />EFFICIENCY</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">w/o back-up<br />EFFICIENCY</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">Actual<br />EFFICIENCY</td>
                  <td colSpan={7} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">TEAM LEADER</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">LEADMAN</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">INSPECTOR</td>
                </tr>

                {/* ── EFFICIENCY VALUE ROW ────────────────── */}
                <tr style={{ height: 36 }}>
                  <td className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black text-center font-bold text-xs bg-white">100%</td>
                  <td className="border border-black text-center font-bold text-xs bg-white">81%</td>
                  <td className="border border-black bg-[#F5F591] text-center font-bold text-xs">{footerObj.actualEfficiencyDisplay}</td>
                  <td colSpan={7} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_TeamLeader} options={teamLeaders}
                      onChange={v => handleFooterChange("Dph_TeamLeader", v)} />
                  </td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_GroupLeader} options={groupLeaders}
                      onChange={v => handleFooterChange("Dph_GroupLeader", v)} />
                  </td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_Inspector} options={lineCheckers}
                      onChange={v => handleFooterChange("Dph_Inspector", v)} />
                  </td>
                </tr>

                {/* ── LEGEND ──────────────────────────────── */}
                <tr style={{ height: 20 }}>
                  <td colSpan={2} className="text-left text-[9px] px-2 bg-white">O - ACHIEVE HOURLY TARGET</td>
                  <td colSpan={2} className="text-left text-[9px] px-2 bg-white">QP - QUALITY PROBLEM</td>
                  <td colSpan={10} />
                </tr>
                <tr style={{ height: 20 }}>
                  <td colSpan={2} className="text-left text-[9px] px-2 bg-white">X - NOT ACHIEVE HOURLY TARGET</td>
                  <td colSpan={2} className="text-left text-[9px] px-2 bg-white">NO VISUAL AND PACKING</td>
                  <td colSpan={10} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div ref={printRef} className="hidden" />

      {/* ── Confirm save modal ─────────────────────────── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <HelpCircle className="h-10 w-10 text-sky-500" />
              <p className="text-sm font-medium">Are you sure you want to {isExisting ? "update" : "save"} DPR?</p>
              <div className="flex gap-3 mt-1">
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={doSave}>Yes</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────── */}
      {modalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalMsg(null)}>
          <div className="bg-background rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 text-center">
              {modalMsg.type === "success" ? (
                <CheckCircle className="h-10 w-10 text-green-500" />
              ) : modalMsg.type === "warning" ? (
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              ) : (
                <XCircle className="h-10 w-10 text-red-500" />
              )}
              <p className="text-sm font-medium">{modalMsg.msg}</p>
              <Button size="sm" onClick={() => setModalMsg(null)}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
