import JSZip from "jszip"
import ExcelJS, { type Borders, type Fill, type Font, type Alignment } from "exceljs"
import type { MprDayAggregates, MprNgDetailRow } from "../types"
import { formatMprDate } from "./aggregate"

// ════════════════════════════════════════════════════════════════════════════
// MPR — EXPORT TO EXCEL (PREMIUM, SINGLE SHEET)
// ════════════════════════════════════════════════════════════════════════════
// Reproduces the legacy AngularJS "Export to Excel" capability with a premium,
// themed workbook built on exceljs (full styling: fills, fonts, borders,
// merges, tab colors). Everything lives on ONE visible worksheet, laid out like
// a professional management report, top-to-bottom:
//
//   1. Report header — blue title band, machine/model/period subtitle, amber
//      summary strip (grand totals + efficiency + NG record count)
//   2. Chart — a NATIVE Excel combo chart (PLAN/ACTUAL bars + running-total
//      lines). It is injected into the XLSX package after exceljs writes the
//      buffer (JSZip post-processing), and reads from a hidden "_MPR_ChartData"
//      source sheet so its values stay editable while never appearing on screen.
//   3. Production matrix — per-shift PLAN/ACTUAL (1ST/2ND/3RD), TOTAL P./A.,
//      EFF%, running T.PLAN/T.ACTUAL, DIFF with color-coded row fills
//   4. NG Details — styled table (zebra rows, colored STATUS chips) with
//      autofilter and a totals footer
//
// No backend change required — exports the already-loaded dashboard data.

// ── EON theme (ISUZU blue family + legacy MPR fills) ──────────────────────
const T = {
  blue: "FF005B96",
  blueDeep: "FF003B66",
  blueLight: "FF0078C8",
  border: "FFAFC3D4",
  planFill: "FFE7F3E7",
  planText: "FF1C6B32",
  actualFill: "FFF7FAFC",
  fgFill: "FFE8F5E9",
  fgText: "FF2E7D32",
  headerFill: "FFF0F6FC",
  totalFill: "FFE9F2FB",
  amberFill: "FFFFF0DC",
  amberText: "FF8A5A00",
  redFill: "FFFDECEC",
  redText: "FFB42323",
  runningFill: "FFDCEBF7",
  emeraldFill: "FFDCFCE7",
  emeraldText: "FF166534",
  greyText: "FF5B6B7B",
  greySoft: "FF9AA7B4",
  zebra: "FFF7FAFC",
  white: "FFFFFFFF",
} as const

const thinBorder = (): Partial<Borders> => ({
  top: { style: "thin", color: { argb: T.border } },
  left: { style: "thin", color: { argb: T.border } },
  bottom: { style: "thin", color: { argb: T.border } },
  right: { style: "thin", color: { argb: T.border } },
})

const center: Partial<Alignment> = { vertical: "middle", horizontal: "center" }
const leftMid: Partial<Alignment> = { vertical: "middle", horizontal: "left" }

const whiteBold: Partial<Font> = { name: "Calibri", bold: true, color: { argb: T.white } }
const blueDeepBold: Partial<Font> = { name: "Calibri", bold: true, color: { argb: T.blueDeep } }

function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: unknown,
  opt: {
    fill?: string
    font?: Partial<Font>
    align?: Partial<Alignment>
    border?: Partial<Borders>
    numFmt?: string
  } = {},
): void {
  const cell = ws.getCell(row, col)
  cell.value = value as ExcelJS.CellValue
  applyStyle(ws, row, col, opt)
  if (opt.numFmt) cell.numFmt = opt.numFmt
}

// Apply formatting to a cell WITHOUT touching its value.
function applyStyle(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  opt: {
    fill?: string
    font?: Partial<Font>
    align?: Partial<Alignment>
    border?: Partial<Borders>
  } = {},
): void {
  const cell = ws.getCell(row, col)
  if (opt.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opt.fill } } as Fill
  if (opt.font) cell.font = opt.font as Font
  if (opt.align) cell.alignment = opt.align as unknown as Alignment
  if (opt.border) cell.border = opt.border as unknown as Borders
}

// Merge a rectangular box and dress EVERY cell so the rendered merged range
// shows a clean uniform fill + full outer border.
function mergeBox(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  fill: string,
  font: Partial<Font>,
  align: Partial<Alignment>,
): void {
  ws.mergeCells(r1, c1, r2, c2)
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      setCell(ws, r, c, r === r1 && c === c1 ? ws.getCell(r1, c1).value : "", {
        fill,
        font,
        align,
        border: thinBorder(),
      })
    }
  }
}

// A full-width deep-blue section divider band with a white title.
function sectionBand(
  ws: ExcelJS.Worksheet,
  row: number,
  fromCol: number,
  toCol: number,
  title: string,
): void {
  ws.getRow(row).height = 22
  mergeBox(ws, row, fromCol, row, toCol, T.blueDeep, { ...whiteBold, size: 12 }, leftMid)
  setCell(ws, row, fromCol, title, { font: { ...whiteBold, size: 12 }, align: leftMid })
}

// Column letter for ordinals beyond 26 (e.g. 33 → "AG").
function colLetter(n: number): string {
  let s = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Split `total` sheet columns into column-count spans proportional to the
// given weights (largest-remainder method, every span ≥ 1, sum == total).
function distributeSpans(total: number, weights: number[]): number[] {
  const wsum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / wsum) * total)
  const alloc = exact.map((e) => Math.floor(e))
  let used = alloc.reduce((a, b) => a + b, 0)
  const order = exact
    .map((e, i) => ({ frac: e - Math.floor(e), i }))
    .sort((a, b) => b.frac - a.frac)
  let k = 0
  while (used < total) {
    alloc[order[k % order.length].i]++
    used++
    k++
  }
  return alloc
}

// Write a single row cell that is horizontally merged across cols c1..c2,
// dressing every underlying cell with the same fill/border.
function mergedRowCell(
  ws: ExcelJS.Worksheet,
  row: number,
  c1: number,
  c2: number,
  value: unknown,
  opt: {
    fill?: string
    font?: Partial<Font>
    align?: Partial<Alignment>
    border?: Partial<Borders>
  } = {},
): void {
  // Write the value into the top-left (master) cell BEFORE merging. Merging
  // afterwards preserves it. Non-master cells in the range are styled WITHOUT
  // a value — writing (even "") to a covered cell after a merge causes exceljs
  // to drop the master value on save, which emptied the NG header labels.
  setCell(ws, row, c1, value, opt)
  if (c2 > c1) ws.mergeCells(row, c1, row, c2)
  for (let c = c1 + 1; c <= c2; c++) {
    applyStyle(ws, row, c, opt)
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Native Excel chart helpers — parts injected into the XLSX package with JSZip
// after exceljs writes the buffer. Referencing a hidden "_MPR_ChartData" sheet
// keeps the chart fully editable in Excel while the source stays out of sight.
// ════════════════════════════════════════════════════════════════════════════

const CHART_SRC = "'_MPR_ChartData'"

function rangeRef(col: string, r1: number, r2: number): string {
  return `${CHART_SRC}!$${col}$${r1}:$${col}$${r2}`
}

function numCache(values: number[]): string {
  return (
    `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join("") +
    `</c:numCache>`
  )
}

function seriesName(col: string, label: string): string {
  return (
    `<c:tx><c:strRef><c:f>${CHART_SRC}!$${col}$1</c:f><c:strCache><c:ptCount val="1"/>` +
    `<c:pt idx="0"><c:v>${label}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
  )
}

function barSer(
  idx: number,
  col: string,
  label: string,
  color: string,
  cats: number[],
  vals: number[],
  lastRow: number,
): string {
  return (
    `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>${seriesName(col, label)}` +
    `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>` +
    `<c:cat><c:numRef><c:f>${rangeRef("A", 2, lastRow)}</c:f>${numCache(cats)}</c:numRef></c:cat>` +
    `<c:val><c:numRef><c:f>${rangeRef(col, 2, lastRow)}</c:f>${numCache(vals)}</c:numRef></c:val></c:ser>`
  )
}

function lineSer(
  idx: number,
  col: string,
  label: string,
  color: string,
  cats: number[],
  vals: number[],
  lastRow: number,
): string {
  return (
    `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>${seriesName(col, label)}` +
    `<c:spPr><a:ln w="28575" cap="flat"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></c:spPr>` +
    `<c:marker><c:symbol val="none"/></c:marker>` +
    `<c:cat><c:numRef><c:f>${rangeRef("A", 2, lastRow)}</c:f>${numCache(cats)}</c:numRef></c:cat>` +
    `<c:val><c:numRef><c:f>${rangeRef(col, 2, lastRow)}</c:f>${numCache(vals)}</c:numRef></c:val>` +
    `<c:smooth val="0"/></c:ser>`
  )
}

const AXIS_TX_PR =
  `<c:txPr><a:bodyPr rot="0" spcFirstLastPara="0"/><a:lstStyle/><a:p>` +
  `<a:pPr><a:defRPr sz="950"><a:latin typeface="Calibri"/></a:defRPr></a:pPr>` +
  `<a:endParaRPr lang="en-US"/></a:p></c:txPr>`

function buildChartXml(
  lastRow: number,
  cats: number[],
  actualS1: number[],
  actualS2: number[],
  actualS3: number[],
  plannedS1: number[],
  plannedS2: number[],
  plannedS3: number[],
  runActual: number[],
  runPlanned: number[],
): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:lang val="en-US"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/>
        <a:p>
          <a:pPr><a:defRPr sz="1300" b="1"><a:solidFill><a:srgbClr val="005B96"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr>
          <a:r><a:rPr lang="en-US" sz="1300" b="1"><a:solidFill><a:srgbClr val="005B96"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>Plan vs Actual Production Performance</a:t></a:r>
        </a:p>
      </c:rich></c:tx>
      <c:layout/>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${barSer(0, "B", "Actual — Shift 1", "005B96", cats, actualS1, lastRow)}
        ${barSer(1, "C", "Actual — Shift 2", "F59E0B", cats, actualS2, lastRow)}
        ${barSer(2, "D", "Actual — Shift 3", "7C3AED", cats, actualS3, lastRow)}
        ${barSer(3, "E", "Planned — Shift 1", "93C5FD", cats, plannedS1, lastRow)}
        ${barSer(4, "F", "Planned — Shift 2", "FCD34D", cats, plannedS2, lastRow)}
        ${barSer(5, "G", "Planned — Shift 3", "C4B5FD", cats, plannedS3, lastRow)}
        <c:gapWidth val="55"/>
        <c:shape val="box"/>
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:barChart>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${lineSer(6, "H", "Running Actual", "003B63", cats, runActual, lastRow)}
        ${lineSer(7, "I", "Running Planned", "0EA5A8", cats, runPlanned, lastRow)}
        <c:marker val="1"/>
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="1"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:numFmt formatCode="General" sourceLinked="1"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        ${AXIS_TX_PR}
        <c:crossAx val="2"/>
        <c:crosses val="autoZero"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="2"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="General" sourceLinked="1"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        ${AXIS_TX_PR}
        <c:crossAx val="1"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:layout/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>
`
}

function buildDrawingXml(lastCol: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr
  xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor editAs="twoCell">
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${lastCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>28</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="1" name="Chart 1"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>
`
}

const DRAWING_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="/xl/charts/chart1.xml"/>
</Relationships>
`

const SHEET_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="/xl/drawings/drawing1.xml"/>
</Relationships>
`

// Inject the native combo chart + drawing into the exceljs-produced package.
async function attachNativeChart(
  src: ExcelJS.Buffer,
  cfg: {
    cats: number[]
    actualS1: number[]
    actualS2: number[]
    actualS3: number[]
    plannedS1: number[]
    plannedS2: number[]
    plannedS3: number[]
    runActual: number[]
    runPlanned: number[]
    lastCol: number
  },
): Promise<ArrayBuffer> {
  const n = cfg.cats.length
  if (n <= 0) {
    const blob = new Blob([src], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    return await blob.arrayBuffer()
  }
  const lastRow = n + 1

  const zip = await JSZip.loadAsync(src)
  await zip.file(
    "xl/charts/chart1.xml",
    buildChartXml(
      lastRow,
      cfg.cats,
      cfg.actualS1,
      cfg.actualS2,
      cfg.actualS3,
      cfg.plannedS1,
      cfg.plannedS2,
      cfg.plannedS3,
      cfg.runActual,
      cfg.runPlanned,
    ),
  )
  await zip.file("xl/drawings/drawing1.xml", buildDrawingXml(cfg.lastCol))
  await zip.file("xl/drawings/_rels/drawing1.xml.rels", DRAWING_RELS)
  await zip.file("xl/worksheets/_rels/sheet1.xml.rels", SHEET_RELS)

  const sheet1 = await zip.file("xl/worksheets/sheet1.xml")?.async("string")
  if (sheet1) {
    await zip.file("xl/worksheets/sheet1.xml", sheet1.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>'))
  }

  const contentTypes = await zip.file("[Content_Types].xml")?.async("string")
  if (contentTypes) {
    const overrides =
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
      '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
    await zip.file("[Content_Types].xml", contentTypes.replace("</Types>", `${overrides}</Types>`))
  }

  return await zip.generateAsync({ type: "arraybuffer" })
}

export async function exportMprToExcel(opts: {
  reportTitle: string
  fileName: string
  monthYearString: string
  machineName: string
  modelName: string
  agg: MprDayAggregates
  ngDetails: MprNgDetailRow[]
  showFg?: boolean
}): Promise<void> {
  const { reportTitle, fileName, monthYearString, machineName, modelName, agg, ngDetails, showFg = false } = opts

  const days = agg.dateRange.map(String)
  const firstDataCol = 3 // C
  const lastCol = Math.max(firstDataCol + days.length - 1, 11) // at least wide enough for NG table
  const showRunning = agg.tPlan > 0 || agg.tActual > 0

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "NXPERT EON"
  workbook.title = `MPR - ${reportTitle}`
  workbook.subject = monthYearString

  // ════════════════════════════════════════════════════════════════════
  // SINGLE SHEET — report layout: header → chart → matrix → NG
  // ════════════════════════════════════════════════════════════════════
  const sheet = workbook.addWorksheet("Monthly Production Record")
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  sheet.properties.tabColor = { argb: T.blue }

  // Column widths: two label columns + one per day.
  sheet.getColumn(1).width = 12
  sheet.getColumn(2).width = 13
  for (let c = firstDataCol; c <= lastCol; c++) sheet.getColumn(c).width = 9.5

  // ── 1. REPORT HEADER ───────────────────────────────────────────────
  sheet.getRow(1).height = 30
  mergeBox(sheet, 1, 1, 1, lastCol, T.blue, { ...whiteBold, size: 16 }, center)
  setCell(sheet, 1, 1, `MPR - ${reportTitle}`, { font: { ...whiteBold, size: 16 }, align: center })

  // Subtitle band (machine / model / period)
  sheet.getRow(2).height = 20
  mergeBox(sheet, 2, 1, 2, lastCol, T.headerFill, { name: "Calibri", italic: true, color: { argb: T.greyText } }, leftMid)
  setCell(sheet, 2, 1, `Machine: ${machineName}      Model: ${modelName}      Period: ${monthYearString}`, {
    font: { name: "Calibri", italic: true, color: { argb: T.greyText } },
    align: leftMid,
  })

  // Summary strip (grand totals + efficiency)
  sheet.getRow(3).height = 22
  const summary = [
    `Total Planned: ${agg.tPlan.toLocaleString()}`,
    `Total WIP: ${agg.tActual.toLocaleString()}`,
    ...(showFg ? [`Total FG: ${agg.tFg.toLocaleString()}`] : []),
    `Efficiency: ${agg.tPlan > 0 ? ((agg.tActual / agg.tPlan) * 100).toFixed(2) : "0.00"}%`,
    `Difference: ${(agg.tPlan - agg.tActual).toLocaleString()}`,
    `NG Records: ${ngDetails.length}`,
  ].join("      |      ")
  mergeBox(sheet, 3, 1, 3, lastCol, T.amberFill, blueDeepBold, center)
  setCell(sheet, 3, 1, summary, { font: blueDeepBold, align: center })

  // ── 2. CHART — NATIVE EXCEL COMBO CHART (PLAN/ACTUAL bars + running lines) ──
  let r = 5 // chart section band row
  sectionBand(sheet, r, 1, lastCol, "Plan vs Actual Production Performance")

  // The drawing part (injected after save) occupies rows 7..29 below the band;
  // a centered caption sits at row 30.
  r = 30
  mergeBox(sheet, r, 1, r, lastCol, T.white, { name: "Calibri", italic: true, color: { argb: T.greyText } }, center)
  setCell(sheet, r, 1, `Daily plan vs actual production — ${monthYearString}`, {
    font: { name: "Calibri", italic: true, color: { argb: T.greyText } },
    align: center,
  })
  r++

  // ── 3. PRODUCTION MATRIX ───────────────────────────────────────────
  // The matrix uses column A = row label, B = PLAN/ACTUAL label, C.. = days.
  const rowDefs: Array<{
    label?: string
    name: string
    values: number[]
    fill: string
    bold?: boolean
    fontColor?: string
    numFmt?: string
  }> = [
    { label: "1ST SHIFT", name: "PLAN", values: agg.planDataShift1, fill: T.planFill, bold: true, fontColor: T.planText },
    { name: "WIP", values: agg.actualDataShift1, fill: T.actualFill },
    ...(showFg ? [{ name: "FG", values: agg.fgDataShift1, fill: T.fgFill, bold: true, fontColor: T.fgText }] : []),
    { label: "2ND SHIFT", name: "PLAN", values: agg.planDataShift2, fill: T.planFill, bold: true, fontColor: T.planText },
    { name: "WIP", values: agg.actualDataShift2, fill: T.actualFill },
    ...(showFg ? [{ name: "FG", values: agg.fgDataShift2, fill: T.fgFill, bold: true, fontColor: T.fgText }] : []),
    { label: "3RD SHIFT", name: "PLAN", values: agg.planDataShift3, fill: T.planFill, bold: true, fontColor: T.planText },
    { name: "WIP", values: agg.actualDataShift3, fill: T.actualFill },
    ...(showFg ? [{ name: "FG", values: agg.fgDataShift3, fill: T.fgFill, bold: true, fontColor: T.fgText }] : []),
    { name: "TOTAL P.", values: agg.totalPlannedData, fill: T.totalFill, bold: true },
    { name: "TOTAL W.", values: agg.totalActualData, fill: T.totalFill, bold: true },
    ...(showFg ? [{ name: "TOTAL FG", values: agg.totalFgData, fill: T.fgFill, bold: true, fontColor: T.fgText }] : []),
    { name: "EFF%", values: agg.eff.map((e) => (Number(e) > 0 ? Number(e.toFixed(2)) : 0)), fill: T.amberFill, bold: true, fontColor: T.amberText, numFmt: '0.00"%"' },
  ]
  if (showRunning) {
    rowDefs.push(
      { name: "T.PLAN", values: agg.runningTotalPlannedData.map((v) => (v > 0 ? v : 0)), fill: T.runningFill, bold: true },
      { name: "T.WIP", values: agg.runningTotalActualData.map((v) => (v > 0 ? v : 0)), fill: T.runningFill, bold: true },
      ...(showFg ? [{ name: "T.FG", values: agg.runningTotalFgData.map((v) => (v > 0 ? v : 0)), fill: T.fgFill, bold: true, fontColor: T.fgText }] : []),
    )
  }
  rowDefs.push({ name: "DIFF", values: agg.diff, fill: T.redFill, bold: true, fontColor: T.redText })

  r += 1 // blank spacer row
  sectionBand(sheet, r, 1, lastCol, "Production Matrix")
  r++

  // Header row: month-year merged across A:B, then day numbers.
  sheet.getRow(r).height = 24
  mergeBox(sheet, r, 1, r, 2, T.blueDeep, { ...whiteBold, size: 12 }, center)
  setCell(sheet, r, 1, monthYearString, { font: { ...whiteBold, size: 12 }, align: center })
  for (let c = firstDataCol; c < firstDataCol + days.length; c++) {
    setCell(sheet, r, c, Number(days[c - firstDataCol]), {
      fill: T.blue,
      font: { name: "Calibri", bold: true, color: { argb: T.white }, size: 9 },
      align: center,
      border: thinBorder(),
    })
  }
  r++

  // Data rows
  for (const def of rowDefs) {
    const row = sheet.getRow(r)
    row.height = 19
    setCell(sheet, r, 1, def.label ?? "", {
      fill: def.label ? T.greySoft : T.actualFill,
      font: def.label ? { ...whiteBold, size: 9 } : { name: "Calibri", color: { argb: T.greyText }, size: 9 },
      align: center,
      border: thinBorder(),
    })
    setCell(sheet, r, 2, def.name, {
      fill: def.fill,
      font: {
        name: "Calibri",
        size: 9,
        bold: def.bold ?? false,
        color: { argb: def.fontColor ?? T.blueDeep },
      },
      align: center,
      border: thinBorder(),
    })
    for (let c = firstDataCol; c < firstDataCol + days.length; c++) {
      setCell(sheet, r, c, def.values[c - firstDataCol] ?? 0, {
        fill: def.fill,
        font: {
          name: "Calibri",
          size: 9,
          bold: def.bold ?? false,
          color: { argb: def.fontColor ?? "FF33475B" },
        },
        align: center,
        border: thinBorder(),
        numFmt: def.numFmt ?? "#,##0",
      })
    }
    r++
  }

  // ── 4. NG DETAILS TABLE ───────────────────────────────────────────
  r += 1 // blank spacer row
  sectionBand(sheet, r, 1, lastCol, `NG Details (${ngDetails.length} records)`)
  r++

  const NG_HEADERS = [
    "DATE",
    "MODEL",
    "DIE NO.",
    "SHIFT",
    "PROBLEM",
    "CAUSE",
    "ACTION",
    "COUNTERMEASURES",
    "PIC",
    "DOWN TIME",
    "STATUS",
  ]
  // Proportional column spans so the NG table fills the SAME overall width as
  // the production matrix (columns 1..lastCol): narrow / medium / wide text.
  const ngSpanWeights = [1.0, 1.5, 1.0, 1.0, 2.6, 2.4, 2.4, 2.8, 0.9, 1.0, 1.0]
  const ngSpans = distributeSpans(lastCol, ngSpanWeights)
  // Build cumulative column boundaries for each header.
  const ngBounds: Array<{ c1: number; c2: number }> = []
  let start = 1
  for (const s of ngSpans) {
    ngBounds.push({ c1: start, c2: start + s - 1 })
    start += s
  }

  NG_HEADERS.forEach((h, i) => {
    mergedRowCell(sheet, r, ngBounds[i].c1, ngBounds[i].c2, h, {
      fill: T.blue,
      font: { ...whiteBold, size: 10 },
      align: center,
      border: thinBorder(),
    })
  })
  const ngHeaderRow = r
  r++

  ngDetails.forEach((t, i) => {
    const fill = i % 2 === 1 ? T.zebra : T.white
    const values = [
      formatMprDate(t.DateNo),
      t.ProductCode,
      t.DieNo,
      t.Shift,
      t.Dfm_DefectDesc,
      t.Cause,
      t.Action,
      t.Countermeasures,
      t.PIC,
      t.DownTime,
      t.Dfm_status,
    ]
    values.forEach((v, c) => {
      const isStatus = c === NG_HEADERS.length - 1
      const status = String(v).trim().toUpperCase()
      mergedRowCell(sheet, r, ngBounds[c].c1, ngBounds[c].c2, v, {
        fill: isStatus ? (status === "A" ? T.emeraldFill : T.redFill) : fill,
        font: {
          name: "Calibri",
          size: 10,
          color: { argb: isStatus ? (status === "A" ? T.emeraldText : T.redText) : "FF33475B" },
          bold: isStatus,
        },
        align: isStatus ? center : leftMid,
        border: thinBorder(),
      })
    })
    r++
  })

  // Footer totals spanning the full NG width
  const totalNgQty = ngDetails.reduce((s, t) => s + (Number(t.Total_NG) || 0), 0)
  mergedRowCell(sheet, r, 1, lastCol, `TOTAL NG RECORDS: ${ngDetails.length}      TOTAL NG QTY: ${totalNgQty.toLocaleString()}`, {
    fill: T.totalFill,
    font: blueDeepBold,
    align: center,
    border: thinBorder(),
  })

  // Autofilter over the NG table only
  if (ngDetails.length > 0) {
    sheet.autoFilter = `A${ngHeaderRow}:${colLetter(lastCol)}${ngHeaderRow + ngDetails.length}`
  }

  // ── Persist (exceljs → inject native chart → download) ─────────────
  // Hidden source sheet for the native chart (visible to Excel, not the user).
  const src = workbook.addWorksheet("_MPR_ChartData")
  src.state = "hidden"
  src.getRow(1).values = [
    "DATE",
    "Actual S1",
    "Actual S2",
    "Actual S3",
    "Planned S1",
    "Planned S2",
    "Planned S3",
    "Running Actual",
    "Running Planned",
  ]
  for (let i = 0; i < agg.dateRange.length; i++) {
    src.getCell(i + 2, 1).value = agg.dateRange[i]
    src.getCell(i + 2, 2).value = agg.actualDataShift1[i] ?? 0
    src.getCell(i + 2, 3).value = agg.actualDataShift2[i] ?? 0
    src.getCell(i + 2, 4).value = agg.actualDataShift3[i] ?? 0
    src.getCell(i + 2, 5).value = agg.planDataShift1[i] ?? 0
    src.getCell(i + 2, 6).value = agg.planDataShift2[i] ?? 0
    src.getCell(i + 2, 7).value = agg.planDataShift3[i] ?? 0
    src.getCell(i + 2, 8).value = agg.runningTotalActualData[i] ?? 0
    src.getCell(i + 2, 9).value = agg.runningTotalPlannedData[i] ?? 0
  }

  const buffer = await workbook.xlsx.writeBuffer()

  const finalBuffer = await attachNativeChart(buffer, {
    cats: agg.dateRange,
    actualS1: agg.actualDataShift1,
    actualS2: agg.actualDataShift2,
    actualS3: agg.actualDataShift3,
    plannedS1: agg.planDataShift1,
    plannedS2: agg.planDataShift2,
    plannedS3: agg.planDataShift3,
    runActual: agg.runningTotalActualData,
    runPlanned: agg.runningTotalPlannedData,
    lastCol,
  })

  const blob = new Blob([finalBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}