# Complete Folder Structure — All Files

```text
src/
├── App.tsx
├── main.tsx
├── index.css
│
├── api/
│   ├── auth.ts
│   └── client.ts
│
├── auth/
│   ├── AuthProvider.tsx
│   ├── permissions.ts
│   └── types.ts
│
├── components/
│   ├── common/
│   │   └── Logo.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── login/
│   │   └── LoginPage.tsx
│   └── ui/
│       ├── avatar.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── FilterField.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── MonthField.tsx
│       ├── Pagination.tsx
│       ├── popover.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       └── tooltip.tsx
│
├── features/
│   ├── analysis/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── ProductionCharts.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── dpr-adc/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── DprAdcPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── dpr-c4/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── DprC4Page.tsx
│   │   │   └── LeaderPicker.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── dpr-kd/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── DprKdPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── dpr-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── DprMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── kanban-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── KanbanMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── locator-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── LocatorMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── logs/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── LogsPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── mpr-adc/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── MprAdcPage.tsx
│   │   │   ├── MprChart.tsx
│   │   │   ├── MprTable.tsx
│   │   │   └── NgDetailsTable.tsx
│   │   ├── lib/
│   │   │   ├── aggregate.ts
│   │   │   └── exportExcel.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── mpr-c4/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── MprC4Page.tsx
│   │   ├── lib/
│   │   │   └── aggregate.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── mpr-kd/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── MprKdPage.tsx
│   │   ├── lib/
│   │   │   └── aggregate.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── ng-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── NgMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── ng-report/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── NgReportFilters.tsx
│   │   │   ├── NgReportKpis.tsx
│   │   │   ├── NgReportPage.tsx
│   │   │   └── NgReportTable.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── ng-tagging/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── NgTaggingPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── pallet-entry/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EntryModal.tsx
│   │   │   ├── PalletEntryPage.tsx
│   │   │   ├── PrintModal.tsx
│   │   │   ├── SearchModal.tsx
│   │   │   └── SuccessDialog.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── pallet-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── PalletMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── plan-uploader/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── FileUploader.tsx
│   │   │   ├── MonthSelector.tsx
│   │   │   ├── PlanUploaderPage.tsx
│   │   │   ├── PreviewTable.tsx
│   │   │   ├── TemplateSelector.tsx
│   │   │   ├── UploadSuccessDialog.tsx
│   │   │   └── ValidationLog.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── preference-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── PreferenceMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── product-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── ProductMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── production-charts/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── ChartCard.tsx
│   │   │   ├── KpiCards.tsx
│   │   │   ├── LinePerformanceChart.tsx
│   │   │   ├── PlanVsActualChart.tsx
│   │   │   ├── ProductionByLineChart.tsx
│   │   │   ├── ProductionChartsPage.tsx
│   │   │   ├── ProductTable.tsx
│   │   │   ├── StatusDonutChart.tsx
│   │   │   ├── TopProductsChart.tsx
│   │   │   └── YearlyPerformanceChart.tsx
│   │   ├── lib/
│   │   │   └── format.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── production-management/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── CalendarDay.tsx
│   │   │   ├── CalendarEvent.tsx
│   │   │   ├── ProductionCalendar.tsx
│   │   │   ├── ProductionDetailsDialog.tsx
│   │   │   └── ProductionManagementPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── settings/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── SettingsPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── shift-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── ShiftMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── user-master/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── UserMasterPage.tsx
│   │   └── types/
│   │       └── index.ts
│   │
│   └── users/
│       ├── api/
│       │   └── index.ts
│       ├── components/
│       │   └── UsersPage.tsx
│       └── types/
│           └── index.ts
│
├── hooks/
│   ├── usePageTitle.ts
│   └── useSessionTimeout.ts
│
├── lib/
│   ├── formatters.ts
│   ├── index.ts
│   ├── status.ts
│   ├── tokenStorage.ts
│   └── utils.ts
│
├── pages/
│   └── NotFound.tsx
│
└── types/
    └── index.ts
```

---

# What Each File Does

## Root Files

|File|Purpose|
|---|---|
|`src/main.tsx`|React 19 entry point — `createRoot`, renders `<App/>` with `StrictMode`|
|`src/App.tsx`|Root component — wraps everything in `AuthProvider`, defines all routes via `react-router-dom`|
|`src/index.css`|Tailwind CSS v4 imports + custom theme variables + animations|

---

# src/api/ — HTTP Layer

|File|Purpose|
|---|---|
|`client.ts`|Axios instance — base URL from env, 30s timeout, request interceptor adds Authorization header, response interceptor handles 401 token refresh + redirect|
|`auth.ts`|Auth API calls — `login()`, `logout()`, `getMe()`, `refreshToken()`|

---

# src/auth/ — Authentication & Authorization

|File|Purpose|
|---|---|
|`AuthProvider.tsx`|React Context provider — manages `isAuthenticated`, `user`, `isLoading`, `login()`, `logout()`. Restores session on mount via `GET /auth/me`|
|`permissions.ts`|Role constants (`SUPER_ADMIN=1` through `OPERATOR_7=10`) + permission functions: `canManageUsers()`, `canAccessSettings()`, `canViewCharts()`, `canExportExcel()`|
|`types.ts`|TypeScript interfaces — `AuthState`, `User` shape|

---

# src/components/ — Shared UI

## Common

|File|Purpose|
|---|---|
|`common/Logo.tsx`|Isuzu logo image component|

## Layout

|File|Purpose|
|---|---|
|`layout/AppShell.tsx`|Root layout — Sidebar + Header + `<Outlet/>`. Uses `React.memo()` on `MainContent` to prevent re-renders during sidebar toggle|
|`layout/Header.tsx`|Blue top bar — hamburger menu toggle + user avatar dropdown (logout, settings link)|
|`layout/Sidebar.tsx`|Collapsible nav (60px/240px). Section groups: **PLANNING**, **REPORTS**, **QUALITY**, **MASTERS**, **SETTINGS**, **LOGS**. Role-based item visibility|

## Login

|File|Purpose|
|---|---|
|`login/LoginPage.tsx`|Split login page — left branding image, right form (User Code, Password, Remember Me, Forgot Password dialog, session-expired message)|

## UI Components

|File|Purpose|
|---|---|
|`ui/avatar.tsx`|Radix Avatar + fallback initials|
|`ui/button.tsx`|CVA button — variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon|
|`ui/card.tsx`|`Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter`|
|`ui/dialog.tsx`|Radix Dialog wrapper|
|`ui/dropdown-menu.tsx`|Radix DropdownMenu wrapper|
|`ui/FilterField.tsx`|Reusable filter input with icon adornment (Search, Calendar, etc.) + label|
|`ui/input.tsx`|Styled native `<input>`|
|`ui/label.tsx`|Styled `<label>`|
|`ui/MonthField.tsx`|Month/year picker with Calendar icon (native month input)|
|`ui/Pagination.tsx`|Full paginator — page buttons, page windowing, page-size selector (10/20/50/**100**/**500**), first/last/prev/next|
|`ui/popover.tsx`|Radix Popover wrapper|
|`ui/separator.tsx`|Horizontal `<hr>` styled separator|
|`ui/skeleton.tsx`|Loading skeleton placeholder|
|`ui/tooltip.tsx`|Radix Tooltip wrapper|

---

# src/features/ — All 22 Feature Modules

## analysis/ — Legacy Machine Analytics

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getMachines()`, `getMonthlyCharts()`, `getTotals()`, `getSummary()`, `getProductionTrend()`, `getPlanVsActual()`, `getNgSummary()` — calls `GET /analysis/*` endpoints|axios (via client)|
|`components/ProductionCharts.tsx`|Legacy analysis view — fetches machine data + monthly charts + trend + NG summary, renders overview cards and trend data|`useState`, `useCallback`, `useEffect`|
|`types/index.ts`|`MachineInfo`, `MonthlyMachineChart`, `ProductionTrend`, `NgSummary` interfaces|—|

---

## dpr-adc/ — ADC Daily Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getDprAdcData()`, `getDprAdcDetails()`, `insertHeader()`, `updateHeader()`, `insertDetails()`, `updateDetails()`, `getDistinctDieNo()`, `getDieNo()`, `getShifts()`, `getProductCodes()`|axios (via client)|
|`components/DprAdcPage.tsx`|Full DPR entry page for ADC line — filters (date/shift), hourly row entry (shots, fast/low, defects, loss time), die check, biscuit, hyd oil, countermeasures, save/update|`useState`, `useCallback`, `useEffect`, `react-hook-form`|
|`types/index.ts`|`DprAdcFilter`, `DprAdcDetailRow`, `DprAdcFooter`, `LINES` enum, `MODELS` enum|—|

---

## dpr-c4/ — C4 Daily Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getDprC4Data()`, `getDprC4Details()`, `insertHeader()`, `updateHeader()`, `insertDetails()`, `updateDetails()`, `getShifts()`, `getTeamLeaders()`, `getGroupLeaders()`, `getLineCheckers()`|axios (via client)|
|`components/DprC4Page.tsx`|DPR entry for C4 machining line — casting defects, machined parts, tool/die changes, machine trouble, line checker signatures|`useState`, `useCallback`, `useEffect`|
|`components/LeaderPicker.tsx`|Reusable dropdown for selecting team leader / group leader / line checker personnel|`useState`, `useEffect`|
|`types/index.ts`|`DprC4Filter`, `DprC4DetailRow`, `DprC4Footer`, `LeaderInfo`|—|

---

## dpr-kd/ — KD Daily Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getDprKdData()`, `getDprKdDetails()`, `insertHeader()`, `updateHeader()`, `insertDetails()`, `updateDetails()`, `getShifts()`, `getTeamLeaders()`, `getGroupLeaders()`, `getLineCheckers()`|axios (via client)|
|`components/DprKdPage.tsx`|DPR entry for KD palletizing line — parts with chips, machining defects, casting defects, downtime, countermeasures, manpower count|`useState`, `useCallback`, `useEffect`|
|`types/index.ts`|`DprKdFilter`, `DprKdDetailRow`, `DprKdFooter`, `KD_TABLES` enum|—|

---

## dpr-master/ — DPR Personnel Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getDprMasterList()`, `createDprMaster()`, `updateDprMaster()`, `deleteDprMaster()` — params: tab (`team-leader/group-leader/leadman/inspector/line-checker`)|axios (via client)|
|`components/DprMasterPage.tsx`|Tabbed page with 5 tabs — each tab is a CRUD table for one personnel type. Add/Edit modal per tab, delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner` (toast)|
|`types/index.ts`|`DprMasterTab` (union type), `DprMasterRow`, CRUD payload types|—|

---

## kanban-master/ — Kanban Card Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getKanbanList()`, `getKanbanLookups()`, `createKanban()`, `updateKanban()`, `deleteKanban()`|axios (via client)|
|`components/KanbanMasterPage.tsx`|CRUD table — filter by ID/part number, Add/Edit modal (kanban ID, part number, quantity, locator, remarks), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`KanbanMasterRow`, `PartNoOption`, `LookupOption`|—|

---

## locator-master/ — Warehouse Locator Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getLocatorList()`, `getLocatorCheck()`, `createLocator()`, `updateLocator()`, `deleteLocator()`|axios (via client)|
|`components/LocatorMasterPage.tsx`|CRUD table — filter by code/type/area, Add/Edit modal (code, type, area, occupancy, warehouse), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`LocatorMasterRow`, filter type, CRUD payloads|—|

---

## logs/ — Production Log Viewer

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getLogs()`, `getLogOptions()` — `GET /logs` with machine filter + `GET /logs/options`|axios (via client)|
|`components/LogsPage.tsx`|Log viewer — machine selector dropdown (ADC/Machining/KD/NG), date range filter, free-text search, server-side paginated table, export|`useState`, `useCallback`, `useEffect`|
|`types/index.ts`|`LogMachine`, `ProductionLogRow`, `NgLogRow`, `LOG_MACHINE_OPTIONS` array|—|

---

## mpr-adc/ — ADC Monthly Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getMprAdcData()`, `getMprAdcNgData()` — `POST /mpr-adc/data`, `POST /mpr-adc/ng-data`|axios (via client)|
|`components/MprAdcPage.tsx`|Main MPR page — month/year + model + line selector, renders `MprChart` + `MprTable` + `NgDetailsTable`, export button|`useState`, `useCallback`, `useEffect`|
|`components/MprChart.tsx`|Stacked bar chart — 3 shifts per day, plan (blue) vs actual (green) bars, running total lines. Uses Recharts `BarChart`, `Bar`, `Line`, `ComposedChart`|recharts|
|`components/MprTable.tsx`|Daily production matrix — days as rows, shifts + totals as columns, plan/actual/achievement cells|—|
|`components/NgDetailsTable.tsx`|NG defect details table — defect descriptions, causes, actions, countermeasures per day|—|
|`lib/aggregate.ts`|`buildMprAggregates()` — shift-based day-by-day rollup logic, merges plan + actual data, computes running totals|—|
|`lib/exportExcel.ts`|Premium Excel export — ExcelJS workbook with styled headers, production matrix, native Excel chart XML injected via JSZip, NG details sheet|exceljs, jszip|
|`types/index.ts`|`MprAdcFilter`, `MprAdcRow`, `MprDayAggregates`, chart color constants|—|

---

## mpr-c4/ — C4 Monthly Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getMprC4Data()`, `getMprC4NgData()` — `POST /mpr-c4/data`, `POST /mpr-c4/ng-data`|axios (via client)|
|`components/MprC4Page.tsx`|Monthly report page for C4 line — same chart/table pattern as MPR ADC but single machine|`useState`, `useCallback`, `useEffect`|
|`lib/aggregate.ts`|Same aggregation logic as MPR ADC (no dedup)|—|
|`types/index.ts`|`MprC4Filter`, `MprC4Row`, `MACHINES=[C4]`|—|

---

## mpr-kd/ — KD Monthly Production Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getMprKdData()`, `getMprKdNgData()` — `POST /mpr-kd/data`, `POST /mpr-kd/ng-data`|axios (via client)|
|`components/MprKdPage.tsx`|Monthly report page for KD line|`useState`, `useCallback`, `useEffect`|
|`lib/aggregate.ts`|Same aggregation with FULL OUTER JOIN dedup logic|—|
|`types/index.ts`|`MprKdFilter`, `MprKdRow`, `MACHINES=[KD]`|—|

---

## ng-master/ — NG Defect Code Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getNgMasterList()`, `checkNgCode()`, `createNgMaster()`, `updateNgMaster()`, `deleteNgMaster()`|axios (via client)|
|`components/NgMasterPage.tsx`|CRUD table — filter by code/category, Add/Edit modal (code, shortName, definition, category=process mapping), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`NgMasterRow`, category (Casting/Machining/Pallet), process mapping|—|

---

## ng-report/ — NG Quality Report

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getNgReport()`, `getNgReportOptions()` — `GET /ng-report` with filters + `GET /ng-report/options`|axios (via client)|
|`components/NgReportPage.tsx`|Main page — orchestrates filters + KPIs + table, loads data on filter change|`useState`, `useCallback`, `useEffect`|
|`components/NgReportFilters.tsx`|Filter bar — year, month, line, model, shift, status dropdowns|—|
|`components/NgReportKpis.tsx`|Summary KPI cards — total NG qty, top cause, most affected line, achievement %|—|
|`components/NgReportTable.tsx`|Paginated table of NG records with server-side pagination|—|
|`types/index.ts`|`NgReportRow`, `NgReportSummary`, `LINE_LABELS`|—|

---

## ng-tagging/ — NG Defect Tagging (Barcode Scan)

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getProcesses()`, `getDefects()`, `lookupPart()`, `tagNg()`, `getHistory()`|axios (via client)|
|`components/NgTaggingPage.tsx`|Scan part ID → select process + defect code → tag as NG. Shows history of tagged items. Uses `spHandyNGTagging` stored procedure|`useState`, `useCallback`, `useEffect`|
|`types/index.ts`|`NgTagProcess`, `NgTagDefect`, `NgPartLookup`, `NgTagPayload`|—|

---

## pallet-entry/ — Pallet Shipping + QR Labels

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`filterPallets()`, `loadPallet()`, `updatePallet()`, `cancelPallet()`, `printPallet()`, `getProductDetails()`, `getCustomerCodes()`|axios (via client)|
|`components/PalletEntryPage.tsx`|Main page — filter pallets by status/date/part, action buttons (add/edit/cancel/print)|`useState`, `useCallback`, `useEffect`|
|`components/EntryModal.tsx`|Create/edit pallet modal — header form (PO, invoice, case no, customer, destination) + product detail rows (std packing, gross weight)|`react-hook-form`, `zod`|
|`components/SearchModal.tsx`|Search pallets modal — filter by multiple criteria, select pallet to load|—|
|`components/PrintModal.tsx`|Print pallet label — renders QR code (via `qrcode` library as data URL), preview, print|qrcode|
|`components/ConfirmDialog.tsx`|Generic confirmation dialog for cancel/delete actions|—|
|`components/SuccessDialog.tsx`|Success feedback dialog after operations|—|
|`types/index.ts`|`PalletFilter`, `PalletRow`, `PalletHeaderForm`, `PrintEntry`|—|

---

## pallet-master/ — Pallet Type Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getPalletMasterList()`, `checkPalletCode()`, `createPallet()`, `updatePallet()`, `deletePallet()`|axios (via client)|
|`components/PalletMasterPage.tsx`|CRUD table — filter by code/description, Add/Edit modal (code, description, color, category), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`PalletMasterRow`, palletcode key|—|

---

## plan-uploader/ — Excel Plan Upload Wizard

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getCostCenters()`, `getProductCodes()`, `getTemplates()`, `getTemplateList()`, `validatePlan()`, `insertPlan()`, `getHistory()`|axios (via client)|
|`components/PlanUploaderPage.tsx`|Multi-step wizard — orchestrates `MonthSelector` → `TemplateSelector` → `FileUploader` → `PreviewTable` → `ValidationLog` → `UploadSuccessDialog`|`useState`, `useCallback`, `useEffect`|
|`components/MonthSelector.tsx`|Month/year picker for selecting upload target period|—|
|`components/TemplateSelector.tsx`|Template dropdown — selects which plan template to use|—|
|`components/FileUploader.tsx`|Drag-and-drop / browse file upload zone, reads Excel file, sends to backend for validation|—|
|`components/PreviewTable.tsx`|Table showing validated rows before insert — highlights errors, shows row count|—|
|`components/ValidationLog.tsx`|Validation error/success log — lists issues found during validation|—|
|`components/UploadSuccessDialog.tsx`|Post-insert summary dialog — shows records inserted/updated|—|
|`types/index.ts`|`CostCenter`, `ProductCode`, `PlanUploaderTemplate`, `ValidationResult`, `ValidationRow`|—|

---

## preference-master/ — Key-Value Config Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getPreferenceList()`, `getPreferenceGroups()`, `checkPreference()`, `createPreference()`, `updatePreference()`, `deletePreference()`|axios (via client)|
|`components/PreferenceMasterPage.tsx`|CRUD table — filter by group/description, Add/Edit modal (group, seq, description, value), compound key (group+seq)|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`PreferenceMasterRow`, compound key: group + seq|—|

---

## product-master/ — Product Master (40+ Fields)

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getProductList()`, `getProductDetails()`, `getProductLookups()`, `createProduct()`, `updateProduct()`, `deleteProduct()`|axios (via client)|
|`components/ProductMasterPage.tsx`|CRUD table — filter by code/name/model, Add/Edit modal with 40+ fields (cost center, BOM, lead time, packing, weights, dimensions, etc.), detail view, delete with safety guard|`useState`, `useCallback`, `useEffect`, `react-hook-form`, `sonner`|
|`types/index.ts`|`ProductMasterRow`, `ProductDetail`, 40+ field payload type|—|

---

## production-charts/ — Analytics Dashboard

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getYearlyAnalytics()`, `getMonthlyTrend()` — `POST /production-charts/yearly`, `POST /production-charts/monthly-trend`|axios (via client)|
|`components/ProductionChartsPage.tsx`|Main dashboard page — loads yearly data + monthly trend, renders KPIs + all chart cards + product table|`useState`, `useCallback`, `useEffect`|
|`components/KpiCards.tsx`|Summary KPI tiles — total production, achievement %, NG count, plan completion|—|
|`components/ChartCard.tsx`|Reusable chart container — card wrapper with title + content area|—|
|`components/PlanVsActualChart.tsx`|Monthly plan vs actual bar chart — 12-month view with achievement overlay|recharts BarChart|
|`components/LinePerformanceChart.tsx`|Per-line achievement horizontal bars — shows each production line's performance|recharts BarChart (horizontal)|
|`components/ProductionByLineChart.tsx`|Production volume by line — stacked/grouped bars per line|recharts BarChart|
|`components/TopProductsChart.tsx`|Top products bar chart — highest volume products|recharts BarChart|
|`components/StatusDonutChart.tsx`|WIP/NG/FG donut chart — status distribution|recharts PieChart|
|`components/ProductTable.tsx`|Product detail data table — sortable, filterable product list|—|
|`components/YearlyPerformanceChart.tsx`|Yearly trend line chart — monthly production trend over the year|recharts LineChart|
|`lib/format.ts`|`formatCompact()`, chart color constants, achievement percentage helpers|—|
|`types/index.ts`|`YearlyAnalyticsData`, `MonthlyTrendPoint`, `CHART_LINES`|—|

---

## production-management/ — Calendar + Plan vs Actual

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getProductDetails()`, `getDailyDetails()`, `getCalendarEvents()`, `getMonthlySummary()` — all `POST /production-management/*`|axios (via client)|
|`components/ProductionManagementPage.tsx`|Home page — calendar view + plan vs actual chart + monthly summary, full filter panel (line, product alias), 12-month bar chart with KPI cards|`useState`, `useCallback`, `useEffect`, `useMemo`, `useRef`, recharts|
|`components/ProductionCalendar.tsx`|Full month calendar — renders grid of `CalendarDay` cells, event dots (plan/actual/NG), today highlight, month navigation|—|
|`components/CalendarDay.tsx`|Single day cell — shows date number with event indicator dots (blue=plan, green=actual, red=NG)|—|
|`components/CalendarEvent.tsx`|Event indicator pill — colored dot with tooltip showing event type|—|
|`components/ProductionDetailsDialog.tsx`|Dialog on day click — shows shift-level detail (shift 1/2/3), plan vs actual per shift, product breakdown|—|
|`types/index.ts`|`CalendarEvent`, `ProductDetail`, `MonthlySummary`, `ProductionFilters`|—|

---

## settings/ — System Health + Session Config

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getHealth()`, `getSessionTimeout()`, `updateSessionTimeout()` — `GET /health`, `GET`/`PUT /settings/session-timeout`|axios (via client)|
|`components/SettingsPage.tsx`|Tabbed page — **Session & Security** (timeout dropdown, save) + **System Health** (API Server, Database, Node-RED cards with animated status badges, database details, service availability table, refresh)|`useState`, `useCallback`, `useEffect`, lucide-react icons|
|`types/index.ts`|`HealthStatus`, `ApiHealth`, `DatabaseHealth`, `NodeRedHealth`|—|

---

## shift-master/ — Shift Schedule Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getShiftList()`, `checkShiftCode()`, `createShift()`, `updateShift()`, `deleteShift()`|axios (via client)|
|`components/ShiftMasterPage.tsx`|CRUD table — filter by code/description, Add/Edit modal (code, desc, schedule type, time-in/break/time-out as `HHMM` strings), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`ShiftMasterRow` — time fields as `HHMM` strings matching `char(4)` SQL columns|—|

---

## user-master/ — User Account Master

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getUserMasterList()`, `checkUserCode()`, `createUser()`, `updateUser()`, `deleteUser()`|axios (via client)|
|`components/UserMasterPage.tsx`|CRUD table — filter by code/name, Add/Edit modal (code, name, email, position, cost center, role dropdown, lock status, password expiry), delete with safety guard|`useState`, `useCallback`, `useEffect`, `sonner`|
|`types/index.ts`|`UserMasterRow`, role as `U/A/SA`, lock/expiry fields|—|

---

## users/ — Admin User Listing

|File|What It Does|Used Libraries|
|---|---|---|
|`api/index.ts`|`getUsers()` — `GET /tamiya/eon/users` with pagination|axios (via client)|
|`components/UsersPage.tsx`|Paginated user listing table — search by name/code, role badge, status badge, edit/delete action buttons. Used as admin user overview (distinct from `user-master` CRUD)|`useState`, `useCallback`, `useEffect`|
|`types/index.ts`|`UserItem`|—|

---

# src/hooks/ — Custom Hooks

|File|Purpose|Used Libraries|
|---|---|---|
|`usePageTitle.ts`|Sets `document.title` with brand suffix (e.g., `Production Management - NXPERT EON`)|`useEffect`|
|`useSessionTimeout.ts`|Client-side idle timeout monitor — fetches server-configured timeout from `GET /settings/session-timeout`, shows warning dialog ~1 min before expiry, auto-logout on timeout|`useState`, `useEffect`, `useCallback`|

---

# src/lib/ — Utilities & Helpers

|File|Purpose|
|---|---|
|`utils.ts`|`cn()` function — `twMerge(clsx(...))` for class merging|
|`formatters.ts`|`formatNumber()`, `formatDate()`, `formatDateTime()`, `formatTime()` — consistent display formatting|
|`tokenStorage.ts`|`getAccessToken()`, `getRefreshToken()`, `setTokens()`, `clearTokens()` — manages JWT pair. Remember Me: `localStorage` / No Remember: `sessionStorage`. Keys: `nxpert_token`, `nxpert_refresh`|
|`status.ts`|Display-only status mapping — `A` → `Active`, `I` → `Inactive`, etc.|
|`index.ts`|Re-exports `cn` + formatters for cleaner imports|

---

# src/pages/ — Standalone Pages

|File|Purpose|
|---|---|
|`NotFound.tsx`|404 page — centered message with "Go Home" link. Has no feature folder; kept at top level since it's a generic error page|

---

# src/types/ — Global Types

|File|Purpose|
|---|---|
|`index.ts`|`User`, `ApiResponse<T>`, `PaginatedData<T>` — shared TypeScript interfaces used across features|

---

# Feature Module Pattern

Every feature follows this consistent structure:

```text
features/<feature-name>/
├── api/
│   └── index.ts          ← API functions (axios calls to backend)
├── components/
│   ├── <Feature>Page.tsx ← Main page component (useState + useEffect + useCallback)
│   └── ...               ← Sub-components (modals, tables, charts, etc.)
├── lib/                  ← (optional) Business logic helpers
│   └── aggregate.ts
└── types/
    └── index.ts          ← TypeScript interfaces for this feature
```

---

# How to Add a New Feature

1. Create `src/features/<name>/` with `api/`, `components/`, `types/` subdirectories
2. Define TypeScript interfaces in `types/index.ts`
3. Create API functions in `api/index.ts` using the shared `client.ts` Axios instance
4. Build the page component in `components/<Name>Page.tsx`
5. Add the route in `src/App.tsx` — import the page and add a `<Route>` element
6. Add the nav item in `src/components/layout/Sidebar.tsx` under the appropriate section
