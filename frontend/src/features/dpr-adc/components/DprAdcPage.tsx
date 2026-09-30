import { useState, useEffect, useCallback, useRef } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import {
  ChevronDown, ChevronUp, Settings, Save, Search, Printer, Factory, CalendarDays,
  AlertTriangle, CheckCircle, XCircle, HelpCircle, Box, Clock, Hash, Timer, Users
} from "lucide-react"
import {
  fetchDistinctDieNo, fetchDieNo, fetchDPRData, fetchDPRDetails,
  insertDPRHeader, updateDPRHeader, insertDPRDetails, updateDPRDetails,
  fetchShifts
} from "../api"
import type { DprAdcFilter, DprAdcDetailRow, DprAdcFooter, ShiftInfo } from "../types"
import { MODELS, LINES, MACHINE_MAP } from "../types"



const EMPTY_FOOTER = (): DprAdcFooter => ({
  Dph_TotShots: 0, Dph_TotFastShot: 0, Dph_TotLowShot: 0,
  Dph_TotDef: 0, Dph_TotNG: 0, Dph_TotLossMins: 0, Dph_Efficiency: 0,
  Dph_ActualProdTime: 0, Dph_ActualModelChangeMins: 0,
  Dph_ActualMachineTroubleMins: 0, Dph_DieTroubleMins: 0,
  Dph_HotChangeMins: 0, Dph_WarmUpShotMins: 0, Dph_NGPercentage: 0,
  Dph_Operator: "", Dph_TeamLeader: "", Dph_GroupLeader: "",
  Dph_WpStart1: "", Dph_WpEnd1: "", Dph_Problem1: "",
  Dph_NgQty1: 0, Dph_Action1: "", Dph_Status1: "",
  Dph_WpStart2: "", Dph_WpEnd2: "", Dph_Problem2: "",
  Dph_NgQty2: 0, Dph_Action2: "", Dph_Status2: "", Dph_NgWPNo: "",
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

const DEFAULT_HOURS = [
  "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
  "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00",
]

const EMPTY_DETAIL = (): DprAdcDetailRow[] =>
  DEFAULT_HOURS.map((hr, i) => ({
    Dpd_DPRCode: "", Dpd_SplitSeq: i + 1, Dpd_HrName: hr,
    Dpd_ResultCount: 0, Dpd_ShotsResultsDenominator: 0,
    Dpd_TargetNumerator: 0, Dpd_TargetDenominator: 0,
    Dpd_FastShot: 0, Dpd_FastShot2: 0, Dpd_LowShot: 0, Dpd_LowShot2: 0,
    Dpd_DefectQty: 0, Dpd_KanbanNo: "", Dpd_KanbanNo2: "", Dpd_Judgement: "",
    Dpd_LossTimeMins: 0, Dpd_LossTimeMins2: 0, Dpd_DefectContent: "",
    Dpd_LossTimeCode: "", Dpd_LossTimeCode2: "",
    Dpd_Abnormalities: "", Dpd_Abnormalities2: "",
    Dpd_WorkNo1: "", Dpd_WorkNo2: "",
    Dpd_DieCheck1: "", Dpd_DieCheck2: "",
    Dpd_QualityCheck1: "", Dpd_QualityCheck2: "",
    Dpd_CounterMeasures: "", Dpd_CounterMeasures2: "",
    Dpd_Biscuit: "", Dpd_HydOil1: "", Dpd_HydOil2: "",
    Dpd_Operator: "", Dpd_PIC: "",
  }))

export default function DprAdcPage() {
  usePageTitle("DPR Entry (ADC)")

  const [filter, setFilter] = useState<DprAdcFilter>({
    line: "1", partName: "Crank Case", shift: "", date: new Date().toISOString().slice(0, 10),
    model: "8-98247-187-2", dieNo: "", workingTime: "", std: "", operator: "",
  })
  const [shifts, setShifts] = useState<ShiftInfo[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [shiftsError, setShiftsError] = useState(false)
  const [dprDetails, setDprDetails] = useState<DprAdcDetailRow[]>(() => EMPTY_DETAIL())
  const [isLoaded, setIsLoaded] = useState(false)
  const [footerObj, setFooterObj] = useState<DprAdcFooter>(EMPTY_FOOTER())
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
  }, [])

  const validate = useCallback((): string | null => {
    if (!filter.std || filter.std === "undefined") return "Please enter STD CT"
    if (!filter.operator || filter.operator === "undefined") return "Please enter number of operator"
    if (!filter.line) return "Please select a line"
    if (!filter.partName) return "Please select a part name"
    if (!filter.shift) return "Please select a shift"
    if (!filter.date) return "Please select a date"
    if (!filter.model) return "Please select a model"
    if (!filter.workingTime) return "Please enter a working time"
    return null
  }, [filter])

  const calculateFooter = useCallback((details: DprAdcDetailRow[], f: DprAdcFilter): DprAdcFooter => {
    let TotFastShot = 0, TotLowShot = 0, TotDef = 0
    let LossMins1 = 0, LossMins2 = 0
    let totJudgement = 0
    details.forEach(d => {
      TotFastShot += safeNum(d.Dpd_FastShot) + safeNum(d.Dpd_FastShot2)
      TotLowShot += safeNum(d.Dpd_LowShot) + safeNum(d.Dpd_LowShot2)
      TotDef += safeNum(d.Dpd_DefectQty)
      LossMins1 += safeNum(d.Dpd_LossTimeMins)
      LossMins2 += safeNum(d.Dpd_LossTimeMins2)
      if (d.Dpd_Judgement === "OK") totJudgement++
    })
    const TotNG = TotFastShot + TotLowShot + TotDef
    const lastShot = details.length > 0 ? safeNum(details[details.length - 1].Dpd_ShotsResultsDenominator) : 0
    const TotShots = lastShot - TotNG
    const std = safeNum(f.std)
    const wt = safeNum(f.workingTime)
    const Efficiency = wt > 0 ? Math.round((TotShots * std / wt) * 100) : 0
    return {
      Dph_TotShots: Math.max(0, TotShots), Dph_TotFastShot: TotFastShot, Dph_TotLowShot: TotLowShot,
      Dph_TotDef: TotDef, Dph_TotNG: TotNG, Dph_TotLossMins: LossMins1 + LossMins2,
      Dph_Efficiency: Efficiency, Dph_ActualProdTime: 0, Dph_ActualModelChangeMins: 0,
      Dph_ActualMachineTroubleMins: 0, Dph_DieTroubleMins: 0, Dph_HotChangeMins: 0,
      Dph_WarmUpShotMins: 0, Dph_NGPercentage: 0,
      Dph_Operator: "", Dph_TeamLeader: "", Dph_GroupLeader: "",
      Dph_WpStart1: "", Dph_WpEnd1: "", Dph_Problem1: "", Dph_NgQty1: 0,
      Dph_Action1: "", Dph_Status1: "", Dph_WpStart2: "", Dph_WpEnd2: "",
      Dph_Problem2: "", Dph_NgQty2: 0, Dph_Action2: "", Dph_Status2: "", Dph_NgWPNo: "",
      Dpr_TotJudgement: totJudgement,
    }
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
        let cumulativeTarget = 0, cumulativeShots = 0
        const enhanced = fetched.map((d, i) => {
          const targetNum = safeNum(d.Dpd_TargetNumerator)
          const resultCount = safeNum(d.Dpd_ResultCount)
          if (i === 0) {
            cumulativeTarget = targetNum
            cumulativeShots = resultCount
          } else {
            cumulativeTarget += targetNum
            cumulativeShots += resultCount
          }
          return {
            ...d,
            Dpd_TargetNumerator: targetNum,
            Dpd_TargetDenominator: cumulativeTarget,
            Dpd_ResultCount: resultCount,
            Dpd_ShotsResultsDenominator: cumulativeShots,
          }
        })
        setDprDetails(enhanced)
        const hdr = existing.header[0]
        const fo = calculateFooter(enhanced, currentFilter)
        setFooterObj({
          ...fo,
          Dph_ActualProdTime: safeNum(hdr.Dph_ActualProdTime),
          Dph_ActualModelChangeMins: safeNum(hdr.Dph_ActualModelChangeMins),
          Dph_ActualMachineTroubleMins: safeNum(hdr.Dph_ActualMachineTroubleMins),
          Dph_DieTroubleMins: safeNum(hdr.Dph_DieTroubleMins),
          Dph_HotChangeMins: safeNum(hdr.Dph_HotChangeMins),
          Dph_WarmUpShotMins: safeNum(hdr.Dph_WarmUpShotMins),
          Dph_NGPercentage: safeNum(hdr.Dph_NGPercentage),
          Dph_Operator: hdr.Dph_Operator || "",
          Dph_TeamLeader: hdr.Dph_TeamLeader || "",
          Dph_GroupLeader: hdr.Dph_GroupLeader || "",
          Dph_WpStart1: hdr.Dph_WpStart1 || "", Dph_WpEnd1: hdr.Dph_WpEnd1 || "",
          Dph_Problem1: hdr.Dph_Problem1 || "", Dph_NgQty1: safeNum(hdr.Dph_NgQty1),
          Dph_Action1: hdr.Dph_Action1 || "", Dph_Status1: hdr.Dph_Status1 || "",
          Dph_WpStart2: hdr.Dph_WpStart2 || "", Dph_WpEnd2: hdr.Dph_WpEnd2 || "",
          Dph_Problem2: hdr.Dph_Problem2 || "", Dph_NgQty2: safeNum(hdr.Dph_NgQty2),
          Dph_Action2: hdr.Dph_Action2 || "", Dph_Status2: hdr.Dph_Status2 || "",
          Dph_NgWPNo: hdr.Dph_NgWPNo || "",
        })
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
  }, [filter, validate, calculateFooter])

  const loadNewDetails = useCallback(async (f: DprAdcFilter) => {
    const details: DprAdcDetailRow[] = []
    let cumulativeTarget = 0, cumulativeShots = 0
    for (let i = 0; i < 8; i++) {
      try {
        const result = await fetchDPRDetails({ ...f, i })
        if (result.length > 0) {
          const row = result[0]
          const targetNum = safeNum(row.Dpd_TargetNumerator)
          const resultCount = safeNum(row.Dpd_ResultCount)
          cumulativeTarget += targetNum
          cumulativeShots += resultCount
          details.push({
            ...row,
            Dpd_TargetNumerator: targetNum,
            Dpd_TargetDenominator: cumulativeTarget,
            Dpd_ResultCount: resultCount,
            Dpd_ShotsResultsDenominator: cumulativeShots,
          })
        }
      } catch { break }
    }
    setDprDetails(details)
    setFooterObj(prev => ({ ...prev, ...calculateFooter(details, f) }))
  }, [calculateFooter])

  const handleDetailChange = useCallback((index: number, field: keyof DprAdcDetailRow, value: any) => {
    setDprDetails(prev => {
      const updated = prev.map((d, i) => i === index ? { ...d, [field]: value } : d)
      let cumulativeShots = 0
      const recalculated = updated.map((d) => {
        cumulativeShots += safeNum(d.Dpd_ResultCount)
        return { ...d, Dpd_ShotsResultsDenominator: cumulativeShots }
      })
      setFooterObj(prevF => ({ ...prevF, ...calculateFooter(recalculated, filter) }))
      return recalculated
    })
  }, [filter, calculateFooter])

  const handleFooterChange = useCallback((field: keyof DprAdcFooter, value: any) => {
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
  }, [filter, filterOrig, isExisting, dprCode, footerObj, dprDetails, validate])

  const doSave = useCallback(async () => {
    setConfirmOpen(false)
    setSaving(true)
    const newFilter = { ...filter }
    try {
      let code = dprCode
      if (isExisting) {
        await updateDPRHeader(newFilter, footerObj)
        await updateDPRDetails(dprDetails.map(d => ({ ...d, Dpd_DPRCode: code })))
      } else {
        const result = await insertDPRHeader(newFilter, footerObj)
        code = result.code
        setDprCode(code)
        await insertDPRDetails(dprDetails.map(d => ({ ...d, Dpd_DPRCode: code })))
        setIsExisting(true)
      }
      setModalMsg({ type: "success", msg: `ADC DPR successfully ${isExisting ? "updated" : "saved"}` })
    } catch (e: any) {
      setModalMsg({ type: "error", msg: e.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }, [filter, isExisting, footerObj, dprDetails, dprCode])

  const buildPrintHtml = (f: DprAdcFilter, details: DprAdcDetailRow[], foot: DprAdcFooter, mName: string): string => {
    const p = (v: any) => v ?? ""
    const sf = (v: any) => (safeNum(v) > 0 ? String(safeNum(v)) : "")
    const fmt = (v: any) => (safeNum(v) > 0 ? String(safeNum(v)) : "0")

    let rows = ""
    details.forEach(d => {
      rows += `<tr style="height:22px">
        <td class="bg-white fw-bold">${p(d.Dpd_HrName)}</td>
        <td class="diagonal"><span class="numerator">${sf(d.Dpd_TargetNumerator)}</span><span class="denominator">${sf(d.Dpd_TargetDenominator)}</span></td>
        <td class="diagonal-yellow"><span class="numerator">${p(d.Dpd_ResultCount)}</span><span class="denominator">${sf(d.Dpd_ShotsResultsDenominator)}</span></td>
        <td class="bg-yellow">${p(d.Dpd_KanbanNo)}<div class="dashed-top"></div>${p(d.Dpd_KanbanNo2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Judgement)}</td>
        <td class="bg-yellow">${p(d.Dpd_FastShot)}<div class="dashed-top"></div>${p(d.Dpd_FastShot2)}</td>
        <td class="bg-yellow">${p(d.Dpd_LowShot)}<div class="dashed-top"></div>${p(d.Dpd_LowShot2)}</td>
        <td class="bg-yellow">${p(d.Dpd_DefectQty)}</td>
        <td class="bg-yellow">${p(d.Dpd_DefectContent)}</td>
        <td class="bg-yellow">${p(d.Dpd_LossTimeCode)}<div class="dashed-top"></div>${p(d.Dpd_LossTimeCode2)}</td>
        <td class="bg-yellow">${p(d.Dpd_LossTimeMins)}<div class="dashed-top"></div>${p(d.Dpd_LossTimeMins2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Abnormalities)}<div class="dashed-top"></div>${p(d.Dpd_Abnormalities2)}</td>
        <td class="bg-yellow">${p(d.Dpd_WorkNo1)}<div class="dashed-top"></div>${p(d.Dpd_WorkNo2)}</td>
        <td class="bg-yellow">${p(d.Dpd_DieCheck1)}<div class="dashed-top"></div>${p(d.Dpd_DieCheck2)}</td>
        <td class="bg-yellow">${p(d.Dpd_QualityCheck1)}<div class="dashed-top"></div>${p(d.Dpd_QualityCheck2)}</td>
        <td class="bg-yellow">${p(d.Dpd_CounterMeasures)}<div class="dashed-top"></div>${p(d.Dpd_CounterMeasures2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Biscuit)}</td>
        <td class="bg-yellow">${p(d.Dpd_HydOil1)}<div class="dashed-top"></div>${p(d.Dpd_HydOil2)}</td>
        <td class="bg-yellow">${p(d.Dpd_Operator)}</td>
        <td class="bg-yellow">${p(d.Dpd_PIC)}</td>
      </tr>`
    })

    const totalRow = `<tr style="height:24px" class="fw-bold">
      <td class="bg-white">TOTAL</td>
      <td class="bg-white">① OK<br>PRODUCTS<br>(⑤-④)</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotShots)}</td>
      <td class="bg-white">② WARM<br>UP<br>SHOTS</td>
      <td class="bg-yellow">${foot.Dpr_TotJudgement ?? 0}</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotFastShot)}</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotLowShot)}</td>
      <td class="bg-white">③<br>DEFECTS<br>QTY</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotDef)}</td>
      <td class="bg-white">④ TOTAL<br>NG (②+③)</td>
      <td class="bg-yellow">${fmt(foot.Dph_TotNG)}</td>
      <td colspan="5" class="diagonal"></td>
      <td colspan="4" class="bg-white"></td>
    </tr>`

    const footerRows = `
      <tr><td colspan="20" style="height:4px;border:1px solid black"></td></tr>
      <tr style="height:20px">
        <td colspan="5" class="bg-white fw-bold">ACTUAL PRODUCTION TIME (mins)</td>
        <td colspan="4" class="bg-yellow">${p(foot.Dph_ActualProdTime)}</td>
        <td class="bg-white fw-bold">TOTAL<br>LOSSTIME<br>(mins.)</td>
        <td class="bg-white fw-bold">EFFICIENCY<br>%<br>(①×⑥÷⑦)</td>
        <td colspan="2" class="bg-white fw-bold">OPERATOR</td>
        <td colspan="3" class="bg-white fw-bold">TEAM LEADER</td>
        <td colspan="4" class="bg-white fw-bold">GROUP LEADER</td>
      </tr>
      <tr style="height:20px">
        <td colspan="3" class="bg-white fw-bold">ACTUAL MODEL CHANGE (mins)</td>
        <td colspan="2" class="bg-yellow">${p(foot.Dph_ActualModelChangeMins)}</td>
        <td colspan="3" class="bg-white fw-bold">HOT CHARGE (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_HotChangeMins)}</td>
        <td rowspan="2" class="bg-yellow fw-bold">${fmt(foot.Dph_TotLossMins)}</td>
        <td rowspan="2" class="bg-yellow fw-bold">${foot.Dph_Efficiency} %</td>
        <td colspan="2" rowspan="2" class="bg-yellow">${p(foot.Dph_Operator)}</td>
        <td colspan="3" rowspan="2" class="bg-yellow">${p(foot.Dph_TeamLeader)}</td>
        <td colspan="4" rowspan="2" class="bg-yellow">${p(foot.Dph_GroupLeader)}</td>
      </tr>
      <tr style="height:20px">
        <td colspan="3" class="bg-white fw-bold">ACTUAL MACHINE TROUBLE (mins.)</td>
        <td colspan="2" class="bg-yellow">${p(foot.Dph_ActualMachineTroubleMins)}</td>
        <td colspan="3" class="bg-white fw-bold">WARM UP SHOT (mins)</td>
        <td class="bg-yellow">${p(foot.Dph_WarmUpShotMins)}</td>
      </tr>
      <tr style="height:20px">
        <td colspan="3" class="bg-white fw-bold">DIE TROUBLE (mins)</td>
        <td colspan="2" class="bg-yellow">${p(foot.Dph_DieTroubleMins)}</td>
        <td colspan="3" class="bg-white fw-bold">TOTAL DEFECTS</td>
        <td class="bg-yellow fw-bold">${fmt(foot.Dph_TotDef)}</td>
        <td class="bg-white fw-bold">NG%</td>
        <td class="bg-yellow">${p(foot.Dph_NGPercentage)}</td>
        <td colspan="2" class="bg-white"></td>
        <td colspan="7" class="bg-white fw-bold">QUALITY CONFIRMATION AFTER CASE</td>
      </tr>`

    const notesHtml = `<table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:0">
      <tr>
        <td colspan="8" style="border:1px solid black;padding:4px;vertical-align:top;text-align:left;width:40%">
          <b>NOTE: Losstime Code</b><br>
          <b>HC</b> - Hot Charge<br>
          <b>MC</b> - Model Change<br>
          <b>MT</b> - Machine Trouble<br>
          <b>MNT</b> - Machine Turnover to Maintenance<br>
          <b>ENGR</b> - Program adjustment, Trial etc<br>
          <b>KZ</b> - Kaizen and Improvement Activities
        </td>
        <td colspan="4" style="border:1px solid black;padding:4px;vertical-align:top;text-align:left;width:20%">
          ④×⑥/⑦<br>
          Target above 71% : N.G. product, low shots or warm up shot and die change<br>
          <b>DT</b>- Die Trouble<br>
          <b>NO</b> - No Operator<br>
          <b>QP</b> - Crack, Dent, Burning, Thickness of biscuit, Burrs, Scratch.<br>
          <b>LP</b> - Line Preparation / Circle Meeting<br>
          <b>5S/TPM</b> - Team Member Special Activity<br>
          <b>O</b> - Other ADC activities non production related.
        </td>
        <td class="bg-white"></td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">W/P<br>START</td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">W/P END</td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">PROBLEM</td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">N.G QTY.</td>
        <td colspan="2" class="bg-white fw-bold" style="border:1px solid black;font-size:8px">ACTION</td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">STATUS</td>
      </tr>
      <tr style="height:20px">
        <td colspan="8" rowspan="3" style="border:none"></td>
        <td colspan="4" rowspan="3" style="border:none"></td>
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">1ST<br>PALLET</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_WpStart1)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_WpEnd1)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Problem1)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_NgQty1)}</td>
        <td colspan="2" class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Action1)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Status1)}</td>
      </tr>
      <tr style="height:20px">
        <td class="bg-white fw-bold" style="border:1px solid black;font-size:8px">2ND<br>PALLET</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_WpStart2)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_WpEnd2)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Problem2)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_NgQty2)}</td>
        <td colspan="2" class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Action2)}</td>
        <td class="bg-yellow" style="border:1px solid black">${p(foot.Dph_Status2)}</td>
      </tr>
      <tr style="height:20px">
        <td colspan="3" class="bg-white fw-bold" style="border:1px solid black;font-size:8px">N.G WORKPIECE<br>NUMBER</td>
        <td colspan="9" class="bg-yellow" style="border:1px solid black">${p(foot.Dph_NgWPNo)}</td>
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
            <div style="font-size:10px;color:#444;margin-top:2px;letter-spacing:0.5px">Aluminium Die Casting Section &mdash; Daily Production Record</div>
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
          <td class="det-val">${p(f.model)}</td>
          <td class="det-label">MACHINE</td>
          <td class="det-val">${mName}</td>
        </tr>
        <tr>
          <td class="det-label">WORKING TIME</td>
          <td class="det-val">${p(f.workingTime)} mins</td>
          <td class="det-label">DIE NO.</td>
          <td class="det-val">${p(f.dieNo)}</td>
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
          <col style="width:9%"><col style="width:5%"><col style="width:5%">
          <col style="width:5%"><col style="width:3%"><col style="width:3%">
          <col style="width:3%"><col style="width:3%"><col style="width:5%">
          <col style="width:3%"><col style="width:3%"><col style="width:13%">
          <col style="width:4%"><col style="width:3%"><col style="width:3%">
          <col style="width:12%"><col style="width:3%"><col style="width:3%">
          <col style="width:6%"><col style="width:6%">
        </colgroup>
        <thead>
          <tr style="height:18px">
            <th rowspan="2" class="bg-blue">TIME</th>
            <th rowspan="2" class="bg-blue">100%<br>Efficiency<br>Target</th>
            <th class="bg-blue">Shots<br>Results</th>
            <th rowspan="2" class="bg-blue">KANBAN<br>NO. &amp;<br>W/P NO.</th>
            <th rowspan="2" class="bg-blue">JUDGE<br>MENT</th>
            <th colspan="2" class="bg-blue">WARM<br>UP SHOTS</th>
            <th colspan="2" class="bg-blue">Defects<br>Information</th>
            <th rowspan="2" class="bg-blue">LOSSTIME<br>CODE</th>
            <th rowspan="2" class="bg-blue">LOSSTIME<br>(mins.)</th>
            <th rowspan="2" class="bg-blue">Abnormalities<br>(Recorded by Operator)</th>
            <th rowspan="2" class="bg-blue">Work<br>number</th>
            <th rowspan="2" class="bg-blue">Die<br>Checking</th>
            <th rowspan="2" class="bg-blue">Quality<br>Checking</th>
            <th class="bg-blue">Counter<br>measures</th>
            <th rowspan="2" class="bg-blue">BISCUIT<br>30 ± 5</th>
            <th class="bg-blue">HYD.OIL<br>TEMP.</th>
            <th rowspan="2" class="bg-blue">OPERATOR</th>
            <th rowspan="2" class="bg-blue">PIC</th>
          </tr>
          <tr style="height:18px">
            <th class="bg-blue">⑤ Total</th>
            <th class="bg-blue">FAST<br>SHOT</th>
            <th class="bg-blue">LOW<br>SHOT</th>
            <th class="bg-blue">Qty</th>
            <th class="bg-blue">Content</th>
            <th class="bg-blue">(Update by Operator &amp; Back up)</th>
            <th class="bg-blue">TIME</th>
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
          .diagonal { background: linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%); }
          .diagonal-yellow { background: linear-gradient(to right bottom, #F5F591 0%, #F5F591 49.9%, #000 50%, #000 51%, #F5F591 51.1%, #F5F591 100%); }
          .numerator { float: left; }
          .denominator { float: right; }
          .print-info { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .print-info td { border: none; padding: 2px 8px; font-size: 11px; text-align: left; }
          .det-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9.5px; }
          .det-table td { border: 1px solid #ccc; padding: 2px 6px; }
          .det-label { background: #eaf2f8; font-weight: bold; letter-spacing: 0.5px; font-size: 8.5px; color: #005b96; width: 18%; text-align: right; white-space: nowrap; }
          .det-val { font-weight: 600; text-align: left; }
          .fw-bold { font-weight: bold; }
          .dashed-top { border-top: 1px dashed black; }
        </style>
      </head><body onload="window.print()">
        ${buildPrintHtml(filter, dprDetails, footerObj, getMachineName())}
      </body></html>
    `)
    w.document.close()
  }, [filter, dprDetails, footerObj])

  const getMachineName = () => MACHINE_MAP[filter.line] || ""

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dpr-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dpr-grid)" />
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
              DPR Entry (ADC)
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Daily Production Recording &amp; Monitoring for ADC Line
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
                  Aluminium Die Casting Section — Daily Production Record
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
                      {LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Die No</label>
                  <FilterField icon={Hash}>
                    <input value={filter.dieNo} onChange={e => setFilter(f => ({ ...f, dieNo: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                      maxLength={1} readOnly={!!filterOrig?.dieNo} />
                  </FilterField>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Working Time</label>
                  <FilterField icon={Timer}>
                    <input value={filter.workingTime} onChange={e => setFilter(f => ({ ...f, workingTime: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                        transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                      placeholder="Enter a number" maxLength={6} />
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Machine</label>
                  <div className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-border/60 bg-slate-50 dark:bg-slate-900/50 px-3.5 text-sm shadow-sm">
                    <Factory className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">{getMachineName() || "—"}</span>
                  </div>
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
            <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed', width: '100%', borderTop: '1px solid black', borderLeft: '1px solid black' }}>
            <colgroup>
              <col style={{width: '9%'}} /><col style={{width: '5%'}} /><col style={{width: '5%'}} />
              <col style={{width: '5%'}} /><col style={{width: '3%'}} /><col style={{width: '3%'}} />
              <col style={{width: '3%'}} /><col style={{width: '3%'}} /><col style={{width: '5%'}} />
              <col style={{width: '3%'}} /><col style={{width: '3%'}} /><col style={{width: '13%'}} />
              <col style={{width: '4%'}} /><col style={{width: '3%'}} /><col style={{width: '3%'}} />
              <col style={{width: '12%'}} /><col style={{width: '3%'}} /><col style={{width: '3%'}} />
              <col style={{width: '6%'}} /><col style={{width: '6%'}} />
            </colgroup>
            <thead>
              <tr style={{height: 22}}>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">TIME</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">100% Efficiency<br />Target</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Shots Results</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">KANBAN NO. &amp;<br />W/P NO.</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">JUDGE<br />MENT</th>
                <th colSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">WARM UP SHOTS</th>
                <th colSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Defects Information</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LOSSTIME CODE</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LOSSTIME (mins.)</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Abnormalities<br />(Recorded by Operator)</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Work number</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Die Checking</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Quality Checking</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Countermeasures</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">BISCUIT<br />30 ± 5</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">HYD.OIL TEMP.</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">OPERATOR</th>
                <th rowSpan={2} className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">PIC</th>
              </tr>
              <tr style={{height: 22}}>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">⑤ Total</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">FAST SHOT</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">LOW SHOT</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Qty</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">Content</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">(Update by Operator &amp; Back up)</th>
                <th className="border border-black px-0.5 bg-[#006ba6] text-white font-semibold text-[10px] leading-tight">TIME</th>
              </tr>
            </thead>
            <tbody>
              {dprDetails.map((data, idx) => (
                <tr key={idx} style={{height: 44}}>
                  <td className="border border-black text-center font-medium text-[11px] px-0.5 bg-white">{data.Dpd_HrName}</td>
                  <td className="border border-black p-0" style={{background: 'linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%)'}}>
                    <div className="flex justify-between items-start" style={{minHeight: 42}}>
                      <span className="pl-1 pt-0.5 text-[10px] font-bold">{formatCell(data.Dpd_TargetNumerator)}</span>
                      <span className="pr-1.5 pb-0.5 text-[10px] font-bold self-end">{formatCell(data.Dpd_TargetDenominator)}</span>
                    </div>
                  </td>
                  <td className="border border-black p-0" style={{background: 'linear-gradient(to right bottom, #F5F591 0%, #F5F591 49.9%, #000 50%, #000 51%, #F5F591 51.1%, #F5F591 100%)'}}>
                    <div className="flex items-start" style={{minHeight: 42}}>
                      <input value={data.Dpd_ResultCount ?? ""}
                        onChange={e => handleDetailChange(idx, "Dpd_ResultCount", safeNum(e.target.value))}
                        className="bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none self-start mt-0.5 ml-0.5"
                        style={{width: `${Math.min(Math.max(String(data.Dpd_ResultCount ?? "").length, 1) * 8 + 4, 36)}px`, boxSizing: 'border-box', padding: 0}}
                        maxLength={4} />
                      <span className="flex-1 min-w-0 text-right pr-1.5 pb-0.5 text-[10px] font-bold self-end truncate">{formatCell(data.Dpd_ShotsResultsDenominator)}</span>
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_KanbanNo} onChange={e => handleDetailChange(idx, "Dpd_KanbanNo", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_KanbanNo2} onChange={e => handleDetailChange(idx, "Dpd_KanbanNo2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <input value={data.Dpd_Judgement} onChange={e => handleDetailChange(idx, "Dpd_Judgement", e.target.value)}
                      className="w-full bg-transparent border-none text-center text-[11px] font-bold outline-none focus:outline-none" style={{height: 44, padding: 0, boxSizing: 'border-box'}} maxLength={1} />
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_FastShot ?? ""} onChange={e => handleDetailChange(idx, "Dpd_FastShot", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_FastShot2 ?? ""} onChange={e => handleDetailChange(idx, "Dpd_FastShot2", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_LowShot ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LowShot", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_LowShot2 ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LowShot2", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <input value={data.Dpd_DefectQty ?? ""} onChange={e => handleDetailChange(idx, "Dpd_DefectQty", safeNum(e.target.value))}
                      className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{height: 44, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <textarea value={data.Dpd_DefectContent} onChange={e => handleDetailChange(idx, "Dpd_DefectContent", e.target.value)}
                      className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{height: 44, boxSizing: 'border-box', padding: 'calc((44px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_LossTimeCode} onChange={e => handleDetailChange(idx, "Dpd_LossTimeCode", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_LossTimeCode2} onChange={e => handleDetailChange(idx, "Dpd_LossTimeCode2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_LossTimeMins ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LossTimeMins", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_LossTimeMins2 ?? ""} onChange={e => handleDetailChange(idx, "Dpd_LossTimeMins2", safeNum(e.target.value))}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} maxLength={4} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <textarea value={data.Dpd_Abnormalities} onChange={e => handleDetailChange(idx, "Dpd_Abnormalities", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <textarea value={data.Dpd_Abnormalities2} onChange={e => handleDetailChange(idx, "Dpd_Abnormalities2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_WorkNo1} onChange={e => handleDetailChange(idx, "Dpd_WorkNo1", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_WorkNo2} onChange={e => handleDetailChange(idx, "Dpd_WorkNo2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_DieCheck1} onChange={e => handleDetailChange(idx, "Dpd_DieCheck1", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_DieCheck2} onChange={e => handleDetailChange(idx, "Dpd_DieCheck2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_QualityCheck1} onChange={e => handleDetailChange(idx, "Dpd_QualityCheck1", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_QualityCheck2} onChange={e => handleDetailChange(idx, "Dpd_QualityCheck2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <textarea value={data.Dpd_CounterMeasures} onChange={e => handleDetailChange(idx, "Dpd_CounterMeasures", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <textarea value={data.Dpd_CounterMeasures2} onChange={e => handleDetailChange(idx, "Dpd_CounterMeasures2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{minHeight: 0, boxSizing: 'border-box', padding: 'calc((21.5px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <textarea value={data.Dpd_Biscuit} onChange={e => handleDetailChange(idx, "Dpd_Biscuit", e.target.value)}
                      className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none resize-none leading-none" style={{height: 44, boxSizing: 'border-box', padding: 'calc((44px - 11px) / 2) 0 0 0', overflow: 'hidden'}} />
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <div className="flex flex-col" style={{height: 44, boxSizing: 'border-box'}}>
                      <input value={data.Dpd_HydOil1} onChange={e => handleDetailChange(idx, "Dpd_HydOil1", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                      <div className="border-t border-dashed border-black/30 shrink-0" />
                      <input value={data.Dpd_HydOil2} onChange={e => handleDetailChange(idx, "Dpd_HydOil2", e.target.value)}
                        className="w-full flex-1 bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{minHeight: 0, padding: 0, boxSizing: 'border-box'}} />
                    </div>
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <input value={data.Dpd_Operator} onChange={e => handleDetailChange(idx, "Dpd_Operator", e.target.value)}
                      className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{height: 44, padding: 0, boxSizing: 'border-box'}} />
                  </td>
                  <td className="border border-black bg-[#F5F591] p-0">
                    <input value={data.Dpd_PIC} onChange={e => handleDetailChange(idx, "Dpd_PIC", e.target.value)}
                      className="w-full bg-transparent border-none text-center text-[11px] outline-none focus:outline-none" style={{height: 44, padding: 0, boxSizing: 'border-box'}} />
                  </td>
                </tr>
              ))}

              {/* ── Spacer ──────────────────────────────── */}
              <tr><td colSpan={20} className="border border-black" style={{height: 5}} /></tr>

              {/* ── TOTAL ROW ────────────────────────────── */}
              <tr style={{height: 36}} className="font-semibold">
                <td className="border border-black text-center text-[11px] font-bold px-0.5 bg-white">TOTAL</td>
                <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">① OK<br />PRODUCTS<br />(⑤-④)</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotShots)}</td>
                <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">② WARM<br />UP<br />SHOTS</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{footerObj.Dpr_TotJudgement ?? 0}</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotFastShot)}</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotLowShot)}</td>
                <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">③<br />DEFECTS<br />QTY</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotDef)}</td>
                <td className="border border-black text-center text-[9px] px-0.5 leading-tight bg-white">④ TOTAL<br />NG (②+③)</td>
                <td className="border border-black text-center font-bold text-xs bg-[#F5F591]">{formatCell(footerObj.Dph_TotNG)}</td>
                <td colSpan={5} className="border border-black p-0" style={{background: 'linear-gradient(to right bottom, white 0%, white 49.9%, #000 50%, #000 51%, white 51.1%, white 100%)'}} />
                <td className="border border-black bg-white" />
                <td className="border border-black bg-white" />
                <td className="border border-black bg-white" />
                <td className="border border-black bg-white" />
              </tr>

              {/* ── Spacer ──────────────────────────────── */}
              <tr><td colSpan={20} className="border border-black" style={{height: 5}} /></tr>

              {/* ── Row 1: ACTUAL PRODUCTION TIME ──────── */}
              <tr style={{height: 28}}>
                <td colSpan={5} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">ACTUAL PRODUCTION TIME (mins)</td>
                <td colSpan={4} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_ActualProdTime ?? ""}
                    onChange={e => handleFooterChange("Dph_ActualProdTime", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">TOTAL<br />LOSSTIME<br />(mins.)</td>
                <td className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">EFFICIENCY<br />%<br />(①×⑥÷⑦)</td>
                <td colSpan={2} className="border border-black text-center text-[9px] font-bold px-0.5 bg-white">OPERATOR</td>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 bg-white">TEAM LEADER</td>
                <td colSpan={4} className="border border-black text-center text-[9px] font-bold px-0.5 bg-white">GROUP LEADER</td>
              </tr>

              {/* ── Row 2: ACTUAL MODEL CHANGE + HOT CHARGE ── */}
              <tr style={{height: 28}}>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">ACTUAL MODEL CHANGE (mins)</td>
                <td colSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_ActualModelChangeMins ?? ""}
                    onChange={e => handleFooterChange("Dph_ActualModelChangeMins", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">HOT CHARGE (mins)</td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_HotChangeMins ?? ""}
                    onChange={e => handleFooterChange("Dph_HotChangeMins", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td rowSpan={2} className="border border-black bg-[#F5F591] text-center font-bold text-xs">{formatCell(footerObj.Dph_TotLossMins)}</td>
                <td rowSpan={2} className="border border-black bg-[#F5F591] text-center font-bold text-xs">{footerObj.Dph_Efficiency} %</td>
                <td colSpan={2} rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Operator} onChange={e => handleFooterChange("Dph_Operator", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td colSpan={3} rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_TeamLeader} onChange={e => handleFooterChange("Dph_TeamLeader", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td colSpan={4} rowSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_GroupLeader} onChange={e => handleFooterChange("Dph_GroupLeader", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
              </tr>

              {/* ── Row 3: ACTUAL MACHINE TROUBLE + WARM UP SHOT ── */}
              <tr style={{height: 28}}>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">ACTUAL MACHINE TROUBLE (mins.)</td>
                <td colSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_ActualMachineTroubleMins ?? ""}
                    onChange={e => handleFooterChange("Dph_ActualMachineTroubleMins", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">WARM UP SHOT (mins)</td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_WarmUpShotMins ?? ""}
                    onChange={e => handleFooterChange("Dph_WarmUpShotMins", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
              </tr>

              {/* ── Row 4: DIE TROUBLE + TOTAL DEFECTS + NG% ── */}
              <tr style={{height: 28}}>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">DIE TROUBLE (mins)</td>
                <td colSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_DieTroubleMins ?? ""}
                    onChange={e => handleFooterChange("Dph_DieTroubleMins", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td colSpan={3} className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">TOTAL DEFECTS</td>
                <td className="border border-black bg-[#F5F591] text-center font-bold text-xs">{formatCell(footerObj.Dph_TotDef)}</td>
                <td className="border border-black text-center text-[9px] font-bold px-0.5 leading-tight bg-white">NG%</td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_NGPercentage ?? ""}
                    onChange={e => handleFooterChange("Dph_NGPercentage", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-xs font-bold outline-none" maxLength={4} />
                </td>
                <td colSpan={2} className="bg-white border border-black" />
                <td colSpan={7} className="border border-black text-center text-[10px] font-bold px-0.5 bg-white">QUALITY CONFIRMATION AFTER CASE</td>
              </tr>

              {/* ── Notes Row ──────────────────────────── */}
              <tr>
                <td colSpan={8} rowSpan={9} className="border border-black text-left text-[9px] p-1.5 align-top leading-tight bg-white">
                  <span className="font-bold">NOTE: Losstime Code</span><br />
                  <b>HC</b> - Hot Charge<br />
                  <b>MC</b> - Model Change<br />
                  <b>MT</b> - Machine Trouble<br />
                  <b>MNT</b> - Machine Turnover to Maintenance for troubleshooting, repair etc.<br />
                  <b>ENGR</b> - Program adjustment, Trial etc<br />
                  <b>KZ</b> - Kaizen and Improvement Activities
                </td>
                <td colSpan={4} rowSpan={9} className="border border-black text-left text-[9px] p-1.5 align-top leading-tight bg-white">
                  ④×⑥/⑦<br />
                  Target above 71% : N.G. product, low shots or warm up shot and die change<br />
                  <b>DT</b>- Die Trouble<br />
                  <b>NO</b> - No Operator<br />
                  <b>QP</b> - Crack, Dent, Burning, Thickness of biscuit, Burrs, Scratch.<br />
                  <b>LP</b> - Line Preparation / Circle Meeting / Machine Warm-up / Machine Checking<br />
                  <b>5S/TPM</b> - Team Member Special Activity<br />
                  <b>O</b> - Other ADC activities non production related.
                </td>
                <td className="border border-black bg-white" />
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">W/P<br />START</td>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">W/P END</td>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">PROBLEM</td>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">N.G QTY.</td>
                <td colSpan={2} className="border border-black text-[9px] font-semibold px-0.5 bg-white">ACTION</td>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">STATUS</td>
              </tr>

              {/* ── 1ST PALLET ─────────────────────────── */}
              <tr style={{height: 28}}>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">1ST<br />PALLET</td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_WpStart1 ?? ""}
                    onChange={e => handleFooterChange("Dph_WpStart1", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_WpEnd1 ?? ""}
                    onChange={e => handleFooterChange("Dph_WpEnd1", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Problem1 ?? ""}
                    onChange={e => handleFooterChange("Dph_Problem1", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_NgQty1 ?? ""}
                    onChange={e => handleFooterChange("Dph_NgQty1", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" maxLength={4} />
                </td>
                <td colSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Action1 ?? ""}
                    onChange={e => handleFooterChange("Dph_Action1", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Status1 ?? ""}
                    onChange={e => handleFooterChange("Dph_Status1", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
              </tr>

              {/* ── 2ND PALLET ─────────────────────────── */}
              <tr style={{height: 28}}>
                <td className="border border-black text-[9px] font-semibold px-0.5 bg-white">2ND<br />PALLET</td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_WpStart2 ?? ""}
                    onChange={e => handleFooterChange("Dph_WpStart2", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_WpEnd2 ?? ""}
                    onChange={e => handleFooterChange("Dph_WpEnd2", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Problem2 ?? ""}
                    onChange={e => handleFooterChange("Dph_Problem2", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_NgQty2 ?? ""}
                    onChange={e => handleFooterChange("Dph_NgQty2", safeNum(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" maxLength={4} />
                </td>
                <td colSpan={2} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Action2 ?? ""}
                    onChange={e => handleFooterChange("Dph_Action2", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
                <td className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_Status2 ?? ""}
                    onChange={e => handleFooterChange("Dph_Status2", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
                </td>
              </tr>

              {/* ── N.G WORKPIECE NUMBER ───────────────── */}
              <tr style={{height: 28}}>
                <td colSpan={3} className="border border-black text-[9px] font-bold px-0.5 bg-white">N.G WORKPIECE<br />NUMBER</td>
                <td colSpan={5} className="border border-black bg-[#F5F591] text-center p-0">
                  <input value={footerObj.Dph_NgWPNo} onChange={e => handleFooterChange("Dph_NgWPNo", e.target.value)}
                    className="w-full h-full bg-transparent border-none text-center text-[11px] outline-none" />
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
