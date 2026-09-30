import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import {
  ChevronDown, ChevronUp, Settings, Save, Search, Printer, Factory, CalendarDays,
  AlertTriangle, CheckCircle, XCircle, HelpCircle, Box, Clock, Timer, Users
} from "lucide-react"
import {
  fetchDistinctDieNo, fetchDieNo, fetchDPRData, fetchDPRDetails,
  insertDPRHeader, updateDPRHeader, insertDPRDetails, updateDPRDetails,
  fetchShifts, fetchTeamLeaders, fetchGroupLeaders, fetchLineCheckers
} from "../api"
import type { DprC4Filter, DprC4DetailRow, DprC4Footer, LeaderInfo, ShiftInfo } from "../types"
import { MODELS, C4_LINE } from "../types"
import { cn } from "@/lib/utils"
import LeaderPicker from "./LeaderPicker"

const EMPTY_FOOTER = (): DprC4Footer => ({
  Dph_TotShots: 0, Dph_TotDef: 0, OkProducts: 0, rawTotalShots: 0,
  Dph_PlanProductionTime: 0, Dph_ActualPlanProductionTime: 0,
  Dph_StdToolChange: 0, Dph_ActualStdToolChange: 0, Dph_StdDieChange: 0,
  Dph_MachineTrouble: 0, Dph_ActualStdDieChange: 0,
  Dph_ActualMachineTrouble: 0,
  Dph_Operator: "", Dph_LineChecker: "", Dph_TeamLeader: "", Dph_GroupLeader: "",
  grandTotalLossTime: 0, efficiency: 0,
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

// Legacy displays efficiency as "85.33%" (2 decimals) or "0%" when no shots
function formatEfficiency(v: any): string {
  const n = safeNum(v)
  return n > 0 ? `${n.toFixed(2)}%` : "0%"
}

const DEFAULT_HOURS = [
  "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
  "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00",
]

const EMPTY_DETAIL = (): DprC4DetailRow[] =>
  DEFAULT_HOURS.map((hr, i) => ({
    Dpd_DPRCode: "", Dpd_SplitSeq: i + 1, Dpd_HrName: hr,
    Dpd_ResultCount: 0, Dpd_ShotsResultsDenominator: 0,
    Dpd_TargetNumeratorWBackup: 0, Dpd_TargetDenominatorWBackup: 0,
    Dpd_TargetNumeratorWOBackup: 0, Dpd_TargetDenominatorWOBackup: 0,
    Dpd_ActualResult1: 0, Dpd_ActualResult2: 0,
    Dpd_Judgement: "", Dpd_CastingDefectQty: 0, Dpd_KanbanNo: "",
    Dpd_CastingDate1: "", Dpd_CastingDate2: "", Dpd_DefectContent: "",
    Dpd_DefectQty: 0, Dpd_LossTimeCode: "", Dpd_LossTimeMins: 0,
    Dpd_LossTimeCode2: "", Dpd_LossTimeMins2: 0,
    Dpd_Abnormalities: "", Dpd_Abnormalities2: "",
    Dpd_HourlyCheck: "", Dpd_PIC: "", Dpd_Qualityok: null,
    Dpd_DieCheck1: "", Dpd_DieCheck2: "",
  }))

const computeFooter = (details: DprC4DetailRow[], foot: DprC4Footer): DprC4Footer => {
  let rawTotalShots = 0, totDef = 0, lossTotal = 0
  details.forEach(d => {
    rawTotalShots += safeNum(d.Dpd_ResultCount)
    totDef += safeNum(d.Dpd_DefectQty)
    lossTotal += safeNum(d.Dpd_LossTimeMins) + safeNum(d.Dpd_LossTimeMins2)
  })
  const okProducts = totDef > 0 ? rawTotalShots - totDef : rawTotalShots
  const last = details[details.length - 1]
  const shots = last ? safeNum(last.Dpd_ShotsResultsDenominator) : 0
  const target = last ? safeNum(last.Dpd_TargetDenominatorWBackup) : 0
  // Guard both values (legacy only checks shots > 0, which would yield "Infinity%" when target is 0)
  const eff = shots > 0 && target > 0 ? Number(((shots / target) * 100).toFixed(2)) : 0
  // Legacy: Dph_ActualPlanProductionTime = planTime - lossTime (no clamping)
  const actualPlan = safeNum(foot.Dph_PlanProductionTime) - lossTotal
  return {
    ...foot,
    rawTotalShots,
    Dph_TotDef: totDef,
    OkProducts: okProducts,
    Dph_TotShots: okProducts,
    grandTotalLossTime: lossTotal,
    efficiency: eff,
    Dph_ActualPlanProductionTime: actualPlan,
  }
}

const recalcCumulative = (rows: DprC4DetailRow[]): DprC4DetailRow[] => {
  let cumShots = 0, cumTarget = 0
  return rows.map(d => {
    cumShots += safeNum(d.Dpd_ResultCount)
    cumTarget += safeNum(d.Dpd_TargetNumeratorWBackup)
    return { ...d, Dpd_ShotsResultsDenominator: cumShots, Dpd_TargetDenominatorWBackup: cumTarget }
  })
}

export default function DprC4Page() {
  usePageTitle("DPR Entry (C4)")

  const [filter, setFilter] = useState<DprC4Filter>({
    line: C4_LINE, partName: "Crank Case", shift: "", date: new Date().toISOString().slice(0, 10),
    model: "8-98247-187-2", dieNo: "", workingTime: "", std: "", operator: "",
  })
  const [shifts, setShifts] = useState<ShiftInfo[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [shiftsError, setShiftsError] = useState(false)
  const [teamLeaders, setTeamLeaders] = useState<LeaderInfo[]>([])
  const [groupLeaders, setGroupLeaders] = useState<LeaderInfo[]>([])
  const [lineCheckers, setLineCheckers] = useState<LeaderInfo[]>([])
  const [dprDetails, setDprDetails] = useState<DprC4DetailRow[]>(() => EMPTY_DETAIL())
  const [isLoaded, setIsLoaded] = useState(false)
  const [footerObj, setFooterObj] = useState<DprC4Footer>(EMPTY_FOOTER())
  const [qualityOKChecked, setQualityOKChecked] = useState<boolean[]>(new Array(8).fill(false))
  const [qualityNGChecked, setQualityNGChecked] = useState<boolean[]>(new Array(8).fill(false))
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
    if (!filter.operator || filter.operator === "undefined") return "Please enter number of operator"
    if (!filter.line) return "Please select a line"
    if (!filter.partName) return "Please select a part name"
    if (!filter.shift) return "Please select a shift"
    if (!filter.date) return "Please select a date"
    if (!filter.model) return "Please select a model"
    return null
  }, [filter])

  const loadNewDetails = useCallback(async (f: DprC4Filter) => {
    const details: DprC4DetailRow[] = []
    for (let i = 0; i < 8; i++) {
      try {
        const result = await fetchDPRDetails({ ...f, i })
        if (result.length > 0) {
          details.push({ ...result[0], Dpd_SplitSeq: i + 1 })
        }
      } catch { break }
    }
    const rows = recalcCumulative(details)
    setDprDetails(rows)
    setFooterObj(prev => computeFooter(rows, prev))
    setQualityOKChecked(new Array(8).fill(false))
    setQualityNGChecked(new Array(8).fill(false))
  }, [])

  const handleLoad = useCallback(async () => {
    const err = validate()
    if (err) { setModalMsg({ type: "warning", msg: err }); return }
    setLoading(true)
    try {
      const distinct = await fetchDistinctDieNo(filter)
      let currentFilter = { ...filter }
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
        const okArr = new Array(8).fill(false)
        const ngArr = new Array(8).fill(false)
        // Legacy: qualityOk === 1/'1' -> OK, === 0/'0' -> NG, else (incl. null) unchecked.
        // Do NOT use bare Number(q) === 0 — Number(null) === 0 would mark every unmarked row as NG.
        rows.forEach((d, i) => {
          const q = d.Dpd_Qualityok
          if (q != null && Number(q) === 1) okArr[i] = true
          else if (q != null && Number(q) === 0) ngArr[i] = true
        })
        setQualityOKChecked(okArr)
        setQualityNGChecked(ngArr)
        const hdr = existing.header[0]
        // Legacy: footerObj = header[0] (DB values), then loadDPRDetails recomputes
        // grandTotalLossTime + actualPlanProductionTime = planTime - lossTime from the
        // loaded details. We replicate by seeding header fields then recomputing via computeFooter
        // (Dph_ActualPlanProductionTime is always recomputed inside computeFooter).
        setFooterObj(prev => computeFooter(rows, {
          ...prev,
          Dph_PlanProductionTime: safeNum(hdr.Dph_PlanProductionTime),
          Dph_StdToolChange: safeNum(hdr.Dph_StdToolChange),
          Dph_ActualStdToolChange: safeNum(hdr.Dph_ActualStdToolChange),
          Dph_StdDieChange: safeNum(hdr.Dph_StdDieChange),
          Dph_MachineTrouble: safeNum(hdr.Dph_MachineTrouble),
          Dph_ActualStdDieChange: safeNum(hdr.Dph_ActualStdDieChange),
          Dph_ActualMachineTrouble: safeNum(hdr.Dph_ActualMachineTrouble),
          Dph_Operator: hdr.Dph_Operator || "",
          Dph_LineChecker: hdr.Dph_LineChecker || "",
          Dph_TeamLeader: hdr.Dph_TeamLeader || "",
          Dph_GroupLeader: hdr.Dph_GroupLeader || "",
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

  const handleDetailChange = useCallback((index: number, field: keyof DprC4DetailRow, value: any) => {
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

  // Legacy limitJudjementInputToXO: LEADER JUDGEMENT accepts ONLY X or O (uppercase).
  // Block any other printable key at the source so invalid characters can never appear.
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

  const handleFooterChange = useCallback((field: keyof DprC4Footer, value: any) => {
    setFooterObj(prev => {
      const next = { ...prev, [field]: value }
      // Legacy: calculateActualPlanProductionTime = planTime - lossTime (no clamping)
      if (field === "Dph_PlanProductionTime") {
        next.Dph_ActualPlanProductionTime = safeNum(value) - safeNum(prev.grandTotalLossTime)
      }
      return next
    })
  }, [])

  const toggleCheckOK = useCallback((index: number) => {
    setQualityOKChecked(prev => {
      const next = [...prev]; next[index] = !next[index]
      if (next[index]) {
        setQualityNGChecked(prevNg => { const n = [...prevNg]; n[index] = false; return n })
      }
      return next
    })
  }, [])

  const toggleCheckNG = useCallback((index: number) => {
    setQualityNGChecked(prev => {
      const next = [...prev]; next[index] = !next[index]
      if (next[index]) {
        setQualityOKChecked(prevOk => { const n = [...prevOk]; n[index] = false; return n })
      }
      return next
    })
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
    const rows = dprDetails.map((d, i) => ({
      ...d,
      Dpd_Qualityok: qualityOKChecked[i] ? 1 : qualityNGChecked[i] ? 0 : null,
    }))
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
      setModalMsg({ type: "success", msg: `C4 DPR successfully ${isExisting ? "updated" : "saved"}` })
    } catch (e: any) {
      setModalMsg({ type: "error", msg: e.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }, [filter, isExisting, footerObj, dprDetails, dprCode, qualityOKChecked, qualityNGChecked])

  const getLastManpowerCode = (): string => {
    for (let i = dprDetails.length - 1; i >= 0; i--) {
      const code = dprDetails[i].Ptm_ManpowerCode || dprDetails[i].Dpd_PIC || ""
      if (code.trim() !== "") return code
    }
    return ""
  }

  const buildPrintHtml = (f: DprC4Filter, details: DprC4DetailRow[], foot: DprC4Footer): string => {
    const p = (v: any) => v ?? ""
    const sf = (v: any) => (safeNum(v) > 0 ? String(safeNum(v)) : "")
    const fmt = (v: any) => (safeNum(v) > 0 ? String(safeNum(v)) : "0")

    let rows = ""
    details.forEach(d => {
      const q = d.Dpd_Qualityok
      const qOk = (q != null && Number(q) === 1) ? "✔" : ""
      const qNg = (q != null && Number(q) === 0) ? "X" : ""
      const pic = (d.Ptm_ManpowerCode || d.Dpd_PIC || "").split(",")[0]
      rows += `<tr style="height:22px">
        <td class="bg-white fw-bold">${p(d.Dpd_HrName)}</td>
        <td class="diagonal"><span class="numerator">${sf(d.Dpd_TargetNumeratorWBackup)}</span><span class="denominator">${sf(d.Dpd_TargetDenominatorWBackup)}</span></td>
        <td class="diagonal-yellow"><span class="numerator">${p(d.Dpd_ResultCount)}</span><span class="denominator">${sf(d.Dpd_ShotsResultsDenominator)}</span></td>
        <td class="bg-yellow">${p(d.Dpd_Judgement)}</td>
        <td class="bg-yellow">${p(d.Dpd_KanbanNo)}</td>
        <td class="bg-yellow">${p(d.Dpd_CastingDate1)}<div class="dashed-top"></div>${p(d.Dpd_CastingDate2)}</td>
        <td class="bg-yellow">${p(d.Dpd_DieCheck1)}<div class="dashed-top"></div>${p(d.Dpd_DieCheck2)}</td>
        <td class="bg-yellow">${p(d.Dpd_DefectQty)}</td>
        <td class="bg-yellow">${p(d.Dpd_DefectContent)}</td>
        <td class="bg-yellow">${p(d.Dpd_LossTimeCode)}<div class="dashed-top"></div>${p(d.Dpd_LossTimeCode2)}</td>
        <td class="bg-yellow">${p(d.Dpd_LossTimeMins)}<div class="dashed-top"></div>${p(d.Dpd_LossTimeMins2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Abnormalities)}<div class="dashed-top"></div>${p(d.Dpd_Abnormalities2)}</td>
        <td class="bg-yellow">${p(d.Dpd_HourlyCheck)}</td>
        <td class="bg-yellow">${qOk}</td>
        <td class="bg-yellow">${qNg}</td>
        <td class="bg-yellow">${pic}</td>
      </tr>`
    })

    const totalRow = `<tr style="height:22px" class="fw-bold">
      <td class="bg-white">TOTAL</td>
      <td class="bg-white">① OK<br>PRODUCTS<br>(⑤-④)</td>
      <td class="bg-yellow">${fmt(foot.OkProducts)}</td>
      <td colspan="4" class="bg-gray"></td>
      <td class="bg-white">③<br>DEFECTS<br>QTY</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotDef)}</td>
      <td colspan="7" class="bg-gray"></td>
    </tr>`

    const operatorDisplay = getLastManpowerCode().split(",")[0]

    const footerRows = `
      <tr><td colspan="16" style="height:4px;border:1px solid black"></td></tr>
      <tr style="height:18px">
        <td colspan="2" class="bg-white fw-bold">PLAN PRODUCTION TIME (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_PlanProductionTime)}</td>
        <td class="bg-white"></td>
        <td class="bg-white"></td>
        <td colspan="4" class="bg-white fw-bold">ACTUAL PRODUCTION TIME (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_ActualPlanProductionTime)}</td>
        <td class="bg-white fw-bold">TOTAL LOSS TIME (mins)</td>
        <td class="bg-white fw-bold">EFFICIENCY(%)</td>
        <td class="bg-white fw-bold">operator</td>
        <td class="bg-white fw-bold">line checker</td>
        <td class="bg-white fw-bold">team leader</td>
        <td class="bg-white fw-bold">group leader</td>
      </tr>
      <tr style="height:18px">
        <td class="bg-white fw-bold">STD TOOL CHANGE</td>
        <td class="bg-white">3%</td>
        <td class="bg-yellow">${p(foot.Dph_StdToolChange)}</td>
        <td class="bg-white">13.5 mins</td>
        <td class="bg-white"></td>
        <td colspan="4" class="bg-white fw-bold">ACTUAL TOOL CHANGE (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_ActualStdToolChange)}</td>
        <td rowspan="3" class="bg-yellow fw-bold">${fmt(foot.grandTotalLossTime)}</td>
        <td rowspan="3" class="bg-yellow fw-bold">${formatEfficiency(foot.efficiency)}</td>
        <td rowspan="2" class="bg-yellow">${operatorDisplay}</td>
        <td rowspan="2" class="bg-yellow">${p(foot.Dph_LineChecker)}</td>
        <td rowspan="2" class="bg-yellow">${p(foot.Dph_TeamLeader)}</td>
        <td rowspan="2" class="bg-yellow">${p(foot.Dph_GroupLeader)}</td>
      </tr>
      <tr style="height:18px">
        <td class="bg-white fw-bold">STD DIE CHANGE</td>
        <td class="bg-white">3%</td>
        <td class="bg-yellow">${p(foot.Dph_StdDieChange)}</td>
        <td class="bg-white">13.5 mins</td>
        <td class="bg-white"></td>
        <td colspan="4" class="bg-white fw-bold">ACTUAL DIE CHANGE (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_ActualStdDieChange)}</td>
      </tr>
      <tr style="height:18px">
        <td class="bg-white fw-bold">STD MACHINE TROUBLE</td>
        <td class="bg-white">8%</td>
        <td class="bg-yellow">${p(foot.Dph_MachineTrouble)}</td>
        <td class="bg-white">36 mins</td>
        <td class="bg-white"></td>
        <td colspan="4" class="bg-white fw-bold">ACTUAL MACHINE TROUBLE (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_ActualMachineTrouble)}</td>
      </tr>`

    const lastTarget = details.length > 0 ? safeNum(details[details.length - 1].Dpd_TargetDenominatorWBackup) : 0
    const lastShots = details.length > 0 ? safeNum(details[details.length - 1].Dpd_ShotsResultsDenominator) : 0

    const notesHtml = `<table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:2px">
      <tr>
        <td colspan="4" style="padding:4px;vertical-align:top;text-align:left;width:40%">
          <b>NOTE: Losstime Code</b><br>
          <b>TC</b> - Tool Change<br>
          <b>MC</b> - Model Change<br>
          <b>MT</b> - Machine Trouble<br>
          <b>MNT</b> - Machine Turnover to Maintenance for troubleshooting, repair etc.<br>
          <b>QC</b> - Workpieces turn-over to QC for result confirmation from model change and tool change<br>
          <b>ENGR</b> - Program adjustment, Trial etc<br>
          <b>KZ</b> - Kaizen and Improvement Activities
        </td>
        <td colspan="3" style="padding:4px;vertical-align:top;text-align:left;width:20%">
          <b>L J - Leader Judgement</b> OK / NG<br>
          <b>NRM</b> - No Raw Materials<br>
          <b>NO</b> - No Operator<br>
          <b>QP</b> - Quality Problem<br>
          <b>LP</b> - Line Preparation / Circle Meeting / Machine warm up / machine checking<br>
          <b>SS/TPM</b> - Team member special activity<br>
          <b>O</b> - Others (activities non production related)
        </td>
        <td colspan="2" style="padding:2px;text-align:center;vertical-align:top">
          <table style="width:100%;border-collapse:collapse;font-size:9px">
            <thead>
              <tr>
                <th colspan="2" class="bg-blue" style="border:1px solid black;font-size:12px">WST</th>
              </tr>
              <tr>
                <th class="bg-blue" style="border:1px solid black">PLAN</th>
                <th class="bg-blue" style="border:1px solid black">ACTUAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="bg-yellow" style="border:1px solid black;height:32px;padding:6px;font-size:14px;font-weight:bold">${sf(lastTarget)}</td>
                <td class="bg-yellow" style="border:1px solid black;height:32px;padding:6px;font-size:14px;font-weight:bold">${sf(lastShots)}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </table>`

    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo_npax.png` : "/logo_npax.png"

    return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
        <tr>
          <td style="width:70px;vertical-align:middle;text-align:left;border:none;padding:0">
            <img src="${logoUrl}" style="height:34px;width:auto" />
          </td>
          <td style="border:none;padding:0;text-align:center;vertical-align:middle">
            <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#003d6b">N-PAX CORPORATION PHILIPPINES</div>
            <div style="font-size:10px;color:#444;margin-top:2px;letter-spacing:0.5px">Aluminium Die Casting Section &mdash; C4 Line Daily Production Record</div>
          </td>
        </tr>
      </table>
      <div style="height:2px;background:#006ba6;margin-bottom:6px;border-radius:2px"></div>
      <table class="det-table">
        <tr>
          <td class="det-label">LINE</td>
          <td class="det-val">${p(f.line)}</td>
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
          <td class="det-val" colspan="3">${p(f.model)}</td>
        </tr>
        <tr>
          <td class="det-label">STD CYCLE TIME</td>
          <td class="det-val">${p(f.std)} mins</td>
          <td class="det-label">OPERATORS</td>
          <td class="det-val">${p(f.operator)}</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:9px">
        <colgroup>
          <col style="width:8%"><col style="width:5%"><col style="width:5%">
          <col style="width:5%"><col style="width:4%"><col style="width:6%">
          <col style="width:5%"><col style="width:4%"><col style="width:4%">
          <col style="width:4%"><col style="width:8%"><col style="width:12%">
          <col style="width:8%"><col style="width:4%"><col style="width:4%">
          <col style="width:8%">
        </colgroup>
        <thead>
          <tr style="height:18px">
            <th rowspan="2" class="bg-blue">TIME</th>
            <th rowspan="2" class="bg-blue">MAX<br>Ability<br>100%</th>
            <th rowspan="2" class="bg-blue">Results<br>Total</th>
            <th rowspan="2" class="bg-blue">LEADER<br>JUDGEMENT</th>
            <th rowspan="2" class="bg-blue">KANBAN<br>CONTROL<br>NO.</th>
            <th rowspan="2" class="bg-blue">Casting<br>DATE</th>
            <th rowspan="2" class="bg-blue">DIE#</th>
            <th colspan="2" class="bg-blue">Defects Information</th>
            <th rowspan="2" class="bg-blue">LOSSTIME<br>CODE</th>
            <th rowspan="2" class="bg-blue">LOSSTIME<br>(mins.)</th>
            <th rowspan="2" class="bg-blue">Abnormalities/Countermeasures</th>
            <th rowspan="2" class="bg-blue">Hourly<br>Checking<br>Result</th>
            <th colspan="2" class="bg-blue">QUALITY</th>
            <th rowspan="2" class="bg-blue">PIC</th>
          </tr>
          <tr style="height:18px">
            <th class="bg-blue">Qty</th>
            <th class="bg-blue">Content</th>
            <th class="bg-blue">OK (✔)</th>
            <th class="bg-blue">NG (X)</th>
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

      ${notesHtml}
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
          .bg-gray { background: rgba(128, 128, 128, 0.871); }
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
              <pattern id="dpr-c4-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dpr-c4-grid)" />
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
              DPR Entry (C4)
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Daily Production Recording &amp; Monitoring for C4 Line
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
                  Aluminium Die Casting Section — C4 Line Daily Production Record
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
                    <option value={C4_LINE}>C4</option>
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
                {/* Legacy has no Die No field in the filter — it is resolved internally by the backend */}
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Number of Operators</label>
                  <FilterField icon={Users}>
                    <input value={filter.operator} onChange={e => setFilter(f => ({ ...f, operator: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                      placeholder="Enter a number" maxLength={4} />
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
                <col style={{ width: '8%' }} /><col style={{ width: '5%' }} /><col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} /><col style={{ width: '4%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} /><col style={{ width: '8%' }} /><col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr style={{ height: 22 }}>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">TIME</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">MAX<br />Ability<br />100%</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Results<br />Total</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LEADER<br />JUDGEMENT</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">KANBAN<br />CONTROL<br />NO.</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Casting<br />DATE</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">DIE#</th>
                  <th colSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Defects Information</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LOSSTIME<br />CODE</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LOSSTIME<br />(mins.)</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Abnormalities/Countermeasures</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Hourly<br />Checking<br />Result</th>
                  <th colSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">QUALITY</th>
                  <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">PIC</th>
                </tr>
                <tr style={{ height: 22 }}>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Qty</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Content</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">OK (✔)</th>
                  <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">NG (X)</th>
                </tr>
              </thead>
              <tbody>
                {dprDetails.map((data, idx) => (
                  <tr key={idx} style={{ height: 44 }}>
                    <td className="border border-black text-center font-medium text-[11px] px-0.5 bg-white">{data.Dpd_HrName}</td>
                    <td className="border border-black p-0" style={{ background: 'linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%)' }}>
                      <div className="flex justify-between items-start" style={{ minHeight: 42 }}>
                        <span className="pl-1 pt-0.5 text-[10px] font-bold">{formatCell(data.Dpd_TargetNumeratorWBackup)}</span>
                        <span className="pr-1.5 pb-0.5 text-[10px] font-bold self-end">{formatCell(data.Dpd_TargetDenominatorWBackup)}</span>
                      </div>
                    </td>
                    <td className="border border-black p-0" style={{ background: 'linear-gradient(to right bottom, #F5F591 0%, #F5F591 49.9%, #000 50%, #000 51%, #F5F591 51.1%, #F5F591 100%)' }}>
                      <div className="flex items-start" style={{ minHeight: 42 }}>
                        <input value={data.Dpd_ResultCount ?? ""}
                          onChange={e => handleDetailChange(idx, "Dpd_ResultCount", safeNum(e.target.value))}
                          className="bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none self-start mt-0.5 ml-0.5"
                          style={{ width: `${Math.min(Math.max(String(data.Dpd_ResultCount ?? "").length, 1) * 8 + 4, 36)}px`, boxSizing: 'border-box', padding: 0 }}
                          maxLength={4} />
                        <span className="flex-1 min-w-0 text-right pr-1.5 pb-0.5 text-[10px] font-bold self-end truncate">{formatCell(data.Dpd_ShotsResultsDenominator)}</span>
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_Judgement ?? ""} onChange={e => handleDetailChange(idx, "Dpd_Judgement", e.target.value)}
                        onKeyDown={handleJudgementKeyDown}
                        onFocus={e => e.target.select()}
                        placeholder="X/O"
                        title="X or O only"
                        className="w-full bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none placeholder:text-black/25" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={1} />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_KanbanNo} onChange={e => handleDetailChange(idx, "Dpd_KanbanNo", e.target.value)}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <input type="date" value={data.Dpd_CastingDate1 || ""} onChange={e => handleDetailChange(idx, "Dpd_CastingDate1", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[10px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <input type="date" value={data.Dpd_CastingDate2 || ""} onChange={e => handleDetailChange(idx, "Dpd_CastingDate2", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[10px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <input value={data.Dpd_DieCheck1} onChange={e => handleDetailChange(idx, "Dpd_DieCheck1", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <input value={data.Dpd_DieCheck2} onChange={e => handleDetailChange(idx, "Dpd_DieCheck2", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_DefectQty ?? ""} onChange={e => handleDetailChange(idx, "Dpd_DefectQty", safeNum(e.target.value))}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <textarea value={data.Dpd_DefectContent} onChange={e => handleDetailChange(idx, "Dpd_DefectContent", e.target.value)}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{ height: 44, boxSizing: 'border-box', padding: 'calc((44px - 11px) / 2) 0 0 0', overflow: 'hidden' }} />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <input value={data.Dpd_LossTimeCode} onChange={e => handleDetailChange(idx, "Dpd_LossTimeCode", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <input value={data.Dpd_LossTimeCode2} onChange={e => handleDetailChange(idx, "Dpd_LossTimeCode2", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} />
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <input value={data.Dpd_LossTimeMins ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LossTimeMins", safeNum(e.target.value))}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <input value={data.Dpd_LossTimeMins2 ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LossTimeMins2", safeNum(e.target.value))}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ minHeight: 0, padding: 0, boxSizing: 'border-box' }} maxLength={4} />
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <div className="flex flex-col" style={{ height: 44, boxSizing: 'border-box' }}>
                        <textarea value={data.Dpd_Abnormalities} onChange={e => handleDetailChange(idx, "Dpd_Abnormalities", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{ minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden' }} />
                        <div className="border-t border-dashed border-black/30 shrink-0" />
                        <textarea value={data.Dpd_Abnormalities2} onChange={e => handleDetailChange(idx, "Dpd_Abnormalities2", e.target.value)}
                          className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{ minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden' }} />
                      </div>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0">
                      <input value={data.Dpd_HourlyCheck} onChange={e => handleDetailChange(idx, "Dpd_HourlyCheck", e.target.value)}
                        className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{ height: 44, padding: 0, boxSizing: 'border-box' }} />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0 text-center" style={{ width: '4%' }}>
                      <input type="checkbox" checked={!!qualityOKChecked[idx]} onChange={() => toggleCheckOK(idx)}
                        className="accent-[#005B96]" />
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0 text-center">
                      <label className="inline-flex items-center justify-center cursor-pointer select-none" style={{ height: 44 }}>
                        <input type="checkbox" checked={!!qualityNGChecked[idx]} onChange={() => toggleCheckNG(idx)} className="hidden" />
                        <span className={cn("font-bold text-sm", qualityNGChecked[idx] ? "text-red-600" : "text-transparent")}>X</span>
                      </label>
                    </td>
                    <td className="border border-black bg-[#F5F591] p-0 text-center text-[10px] font-medium" style={{ height: 44 }}>
                      {(data.Ptm_ManpowerCode || data.Dpd_PIC || "").split(",")[0]}
                    </td>
                  </tr>
                ))}

                {/* ── Spacer ──────────────────────────────── */}
                <tr><td colSpan={16} className="border border-black" style={{ height: 5 }} /></tr>

                {/* ── TOTAL ROW ────────────────────────────── */}
                <tr style={{ height: 36 }} className="font-semibold">
                  <td className="border border-black text-center text-[11px] font-bold px-0.5 bg-white">TOTAL</td>
                  <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">① OK<br />PRODUCTS<br />(⑤-④)</td>
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.OkProducts)}</td>
                  <td colSpan={4} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                  <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">③<br />DEFECTS<br />QTY</td>
                  <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotDef)}</td>
                  <td colSpan={7} className="border border-black bg-[rgba(128,128,128,0.871)]" />
                </tr>

                {/* ── Spacer ──────────────────────────────── */}
                <tr><td colSpan={16} className="border border-black" style={{ height: 5 }} /></tr>

                {/* ── Footer Row 1 ─────────────────────────── */}
                <tr style={{ height: 28 }}>
                  <td colSpan={2} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">PLAN PRODUCTION TIME (mins)</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_PlanProductionTime ?? ""}
                      onChange={e => handleFooterChange("Dph_PlanProductionTime", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                  <td className="border border-black bg-white" />
                  <td className="border border-black bg-white" />
                  <td colSpan={4} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">ACTUAL PRODUCTION TIME (mins)</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_ActualPlanProductionTime ?? ""} readOnly
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" />
                  </td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">TOTAL LOSS TIME (mins)</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">EFFICIENCY(%)</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">operator</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">line checker</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">team leader</td>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">group leader</td>
                </tr>

                {/* ── Footer Row 2 ─────────────────────────── */}
                <tr style={{ height: 28 }}>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">STD TOOL CHANGE</td>
                  <td className="border border-black text-center text-[10px] bg-white">3%</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_StdToolChange ?? ""}
                      onChange={e => handleFooterChange("Dph_StdToolChange", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                  <td className="border border-black text-center text-[10px] bg-white">13.5 mins</td>
                  <td className="border border-black bg-white" />
                  <td colSpan={4} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">ACTUAL TOOL CHANGE (mins)</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_ActualStdToolChange ?? ""}
                      onChange={e => handleFooterChange("Dph_ActualStdToolChange", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                  <td rowSpan={3} className="border border-black bg-[#F5F591] text-center font-bold text-xs">{formatCell(footerObj.grandTotalLossTime)}</td>
                  <td rowSpan={3} className="border border-black bg-[#F5F591] text-center font-bold text-xs">{formatEfficiency(footerObj.efficiency)}</td>
                  <td rowSpan={2} className="border border-black bg-[#F5F591] text-center text-[10px] font-medium">{getLastManpowerCode().split(",")[0]}</td>
                  <td rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_LineChecker} options={lineCheckers}
                      onChange={v => handleFooterChange("Dph_LineChecker", v)} />
                  </td>
                  <td rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_TeamLeader} options={teamLeaders}
                      onChange={v => handleFooterChange("Dph_TeamLeader", v)} />
                  </td>
                  <td rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                    <LeaderPicker value={footerObj.Dph_GroupLeader} options={groupLeaders}
                      onChange={v => handleFooterChange("Dph_GroupLeader", v)} />
                  </td>
                </tr>

                {/* ── Footer Row 3 ─────────────────────────── */}
                <tr style={{ height: 28 }}>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">STD DIE CHANGE</td>
                  <td className="border border-black text-center text-[10px] bg-white">3%</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_StdDieChange ?? ""}
                      onChange={e => handleFooterChange("Dph_StdDieChange", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                  <td className="border border-black text-center text-[10px] bg-white">13.5 mins</td>
                  <td className="border border-black bg-white" />
                  <td colSpan={4} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">ACTUAL DIE CHANGE (mins)</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_ActualStdDieChange ?? ""}
                      onChange={e => handleFooterChange("Dph_ActualStdDieChange", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                </tr>

                {/* ── Footer Row 4 ─────────────────────────── */}
                <tr style={{ height: 28 }}>
                  <td className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">STD MACHINE TROUBLE</td>
                  <td className="border border-black text-center text-[10px] bg-white">8%</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_MachineTrouble ?? ""}
                      onChange={e => handleFooterChange("Dph_MachineTrouble", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                  <td className="border border-black text-center text-[10px] bg-white">36 mins</td>
                  <td className="border border-black bg-white" />
                  <td colSpan={4} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">ACTUAL MACHINE TROUBLE (mins)</td>
                  <td className="border border-black bg-[#F5F591] text-center p-0">
                    <input value={footerObj.Dph_ActualMachineTrouble ?? ""}
                      onChange={e => handleFooterChange("Dph_ActualMachineTrouble", safeNum(e.target.value))}
                      className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                  </td>
                </tr>

                {/* ── Notes + WST ─────────────────────────── */}
                <tr>
                  <td colSpan={8} rowSpan={3} className="text-left text-[9px] p-1.5 align-top leading-tight bg-white">
                    <span className="font-bold">NOTE: Losstime Code</span><br />
                    <b>TC</b> - Tool Change<br />
                    <b>MC</b> - Model Change<br />
                    <b>MT</b> - Machine Trouble<br />
                    <b>MNT</b> - Machine Turnover to Maintenance for troubleshooting, repair etc.<br />
                    <b>QC</b> - Workpieces turn-over to QC for result confirmation from model change and tool change<br />
                    <b>ENGR</b> - Program adjustment, Trial etc<br />
                    <b>KZ</b> - Kaizen and Improvement Activities
                  </td>
                  <td colSpan={5} rowSpan={3} className="text-left text-[9px] p-1.5 align-top leading-tight bg-white">
                    <span className="font-bold">L J - Leader Judgement</span> OK / NG<br />
                    <b>NRM</b> - No Raw Materials<br />
                    <b>NO</b> - No Operator<br />
                    <b>QP</b> - Quality Problem<br />
                    <b>LP</b> - Line Preparation / Circle Meeting / Machine warm up / machine checking<br />
                    <b>SS/TPM</b> - Team member special activity<br />
                    <b>O</b> - Others (activities non production related)
                  </td>
                  <td colSpan={3} rowSpan={3} className="p-0 align-top">
                    <table className="w-full text-[10px] border-collapse" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th colSpan={2} className="border border-black bg-[#006ba6] text-white font-bold text-sm">WST</th>
                        </tr>
                        <tr>
                          <th className="border border-black bg-[#006ba6] text-white font-semibold">PLAN</th>
                          <th className="border border-black bg-[#006ba6] text-white font-semibold">ACTUAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black bg-[#F5F591] text-center font-bold" style={{ height: 32, padding: "6px" }}>
                            {formatCell(dprDetails.length > 0 ? dprDetails[dprDetails.length - 1].Dpd_TargetDenominatorWBackup : 0)}
                          </td>
                          <td className="border border-black bg-[#F5F591] text-center font-bold" style={{ height: 32, padding: "6px" }}>
                            {formatCell(dprDetails.length > 0 ? dprDetails[dprDetails.length - 1].Dpd_ShotsResultsDenominator : 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
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
