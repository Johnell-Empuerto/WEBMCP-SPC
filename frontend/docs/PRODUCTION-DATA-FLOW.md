# Production Data Flow - How It All Works

> Simple guide: from creating a lot to seeing it in Calendar and DPR.

---

## STEP 1: Create a Travelog (The Lot)

Everything starts here. A **Travelog** = one lot of parts moving through the factory.

### What happens:
A Stored Procedure called `CreateTravelogHD` creates **BOTH** the header AND all 9 detail rows at once.

### Example command:
```sql
EXEC CreateTravelogHD
    '26907001CH311000002S',   -- Lot Number (unique ID for this batch)
    '1250T #1',               -- Model/Product
    '00',                      -- First Process Code (Die Casting)
    'CX-002',                 -- Customer
    '11099',                  -- Job Order Number
    'OUT',                    -- Direction
    '';                       -- Extra info
```

### What gets created:

**Header** (`T_TravelogHeader`) - 1 row:
| Field | Value | What it means |
|-------|-------|---------------|
| Pth_TravelogNo | T26-XXXXXX | Unique travelog number (auto-generated) |
| Pth_ProductLotNo | 26907001CH311000002S | Your lot number |
| Pth_ProductCode | (from model) | Which product |
| Pth_JobOrderNo | 11099 | Job order reference |
| Pth_ReqInputDate | (today) | When production is planned |
| Pth_Status | N | Status: N = New (not started) |
| Pth_TargetCostCenter | 010103 | Which cost center (machine area) |

**Details** (`T_TravelogDetail`) - 9 rows (one per process):
| Seq | ProcessCode | Process Name | Status | InputActualQty |
|-----|------------|--------------|--------|----------------|
| 01 | 00 | Die Casting | N | 0 |
| 02 | 01 | Deburring | N | 0 |
| 03 | 02 | Machining 1 | N | 0 |
| 04 | 03 | Machining 2 | N | 0 |
| 05 | 04 | Washing | N | 0 |
| 06 | 05 | Inspection | N | 0 |
| 07 | 06 | Assembly | N | 0 |
| 08 | 07 | C4 Machining | N | 0 |
| 09 | 08 | KD Packing | N | 0 |

> **Key point:** All start with `Status = N` and `InputActualQty = 0`.
> They become visible in the system only AFTER being processed.

---

## STEP 2: Process Each Step (The Gateway Scripts)

The factory has **tablet stations** at each process. When a worker finishes a batch, they tap the tablet. This calls a Python script that updates the database.

### The Chain Reaction:

```
Process 00 (Die Casting)
    ↓ sets InputActualQty=1, Status='A', passes Output_Qty to next step
Process 01 (Deburring)
    ↓ sets InputActualQty=Output_Qty from previous, Status='A'
Process 02 (Machining 1)
    ↓ same pattern...
Process 03 (Machining 2)
    ↓ ...
Process 04 (Washing)
    ↓ ...
Process 05 (Inspection)
    ↓ ...
Process 06 (Assembly)
    ↓ ...
Process 07 (C4 Machining)  <-- This is the C4 line!
    ↓ ...
Process 08 (KD Packing)     <-- This is the KD line!
```

### What happens at each step (example: Process 00):

The tablet script (`updateProcessOne.py`) does this:

```sql
-- 1. Check: is this step already done?
SELECT Ptd_Status FROM T_TravelogDetail
WHERE Ptd_TravelogNo = '26907001CH311000002S' AND Ptd_ProcessCode = '00'
-- If Status = 'A', error: "Process already completed"

-- 2. Update THIS step
UPDATE T_TravelogDetail
SET Ptd_InputActualDate = '2026-09-07 06:30:00',  -- Start time
    Ptd_InputActualQty = 1,                         -- Mark as processed!
    Ptd_OKQty = 1000,                               -- Good parts
    Ptd_NGQty = 10,                                 -- Defective parts
    Ptd_TransInQty = 0,
    Ptd_TransOutQty = 990,                          -- Output to next step
    Ptd_ActualFinishDate = '2026-09-07 08:30:00',  -- End time
    Ptd_Status = 'A'                                -- A = Active/Done
WHERE Ptd_TravelogNo = '26907001CH311000002S'
  AND Ptd_ProcessCode = '00'

-- 3. Pass output quantity to NEXT step's input
UPDATE T_TravelogDetail
SET Ptd_InputActualQty = 990   -- Next process receives 990 parts
WHERE Ptd_TravelogNo = '26907001CH311000002S'
  AND Ptd_ProcessCode = '01'
```

### Important Rules:
- Each step **MUST wait** for the previous step to be Status='A'
- When you complete a step, you set `Ptd_InputActualQty = 1` for YOUR step
- You pass your `Output_Qty` as `InputActualQty` to the NEXT step
- `Status = A` means "this step is done"

---

## STEP 3: How It Connects to Production Calendar

The **Production Calendar** page shows a monthly view with Plan vs Actual for each day.

### Data Source:
The calendar uses `actualProductionRepository.ts` which queries **directly from tables** (not from the gateway scripts).

### The Query Flow:
```
Calendar Page (Frontend)
  → POST /production-management/calendar-events
    → productionManagementRepository.ts (getCalendarEvents)
      → actualProductionRepository.ts (buildActualDataSource)
        → T_TravelogHeader
        → T_TravelogDetail
```

### Conditions for data to appear:

**ADC Lines (1, 2, 3):**
```sql
-- Must have:
Ptd_ProcessCode = '00'          -- Die Casting process
Ptd_InputActualQty >= 1         -- Must be processed (gateway set this to 1)
SUBSTRING(Pth_ProductLotNo, 12, 1) = '1'  -- Line 1 (or '2' for Line 2, '3' for Line 3)
Pth_ReqInputDate in viewed month           -- Date must match the calendar month
```

**C4 Line:**
```sql
-- Must have:
Ptd_ProcessCode = '07'          -- C4 Machining process
Ptd_InputActualQty >= 1         -- Must be processed
Ptd_InputActualDate in viewed month (with 05:30 offset)
```

### Shift Assignment (Calendar):
```
T_ShiftCodeMaster defines:
  Shift01: 06:00 - 14:00  (360 - 840 minutes)
  Shift02: 14:00 - 22:00  (840 - 1320 minutes)
  Shift03: 22:00 - 06:00  (1320 - 360+1440 minutes)

Calendar calculates: t = HOUR*60 + MINUTE of Ptd_InputActualDate
  t < 360       → Shift03
  t >= 840      → Shift02
  else          → Shift01
```

### WIP / NG / FG Status:
| Status | ADC/C4 Rule | KD Rule |
|--------|-------------|---------|
| **WIP** (Work In Progress) | `Pth_Status IN ('N','A')` | `Pth_Status IN ('N')` only |
| **NG** (No Good / Defect) | `Pth_Status = 'F' AND ActualFinishQty = 0` | Same |
| **FG** (Finished Goods) | `ActualFinishQty = 1 AND Status IN ('N','F')` | `ActualFinishQty = 1` |

> **WIP = 1** means the lot exists but hasn't finished yet.
> Calendar shows: `actqty = WIP + NG + FG`

---

## STEP 4: How It Connects to DPR C4

The **DPR (Daily Production Report)** is a separate module for C4 machining line.

### Data Source:
DPR C4 uses a **VIEW** called `V_ActualProductionInfo` (NOT the same as the calendar).

### The Query Flow:
```
DPR C4 Page (Frontend)
  → POST /dpr-c4/data
    → dprC4Service.ts
      → dprC4Repository.ts
        → V_ActualProductionInfo (VIEW in database)
        → GetDPR_C4KDShiftWorkHours (Stored Procedure)
          → V_ActualProductionInfo
```

### V_ActualProductionInfo C4 Branch:
```sql
-- Gets lots that went through C4 machining (ProcessCode = '07')
FROM T_TravelogHeader
OUTER APPLY (
    SELECT TOP 1 Ptd_InputActualDate
    FROM T_TravelogDetail
    WHERE Ptd_ProcessCode = '07'
      AND Ptd_InputActualQty >= 1
) AS lastDetail
WHERE C4InputDate IS NOT NULL
```

### Conditions for DPR C4:
| # | Condition | What it checks |
|---|-----------|---------------|
| 1 | `Ptd_ProcessCode = '07'` | Must have C4 machining process |
| 2 | `Ptd_InputActualQty >= 1` | Must be processed |
| 3 | `Pth_ProductCode = @model` | Must match selected model |
| 4 | `Pth_ReqInputDate = @date` | Must match selected date |
| 5 | `T_CostCenter → T_SectionCodeMaster` | Cost center must map to a shift |
| 6 | `E_DPRMaster` must exist | Model must have DPR config |

### DPR C4 Die Number Query:
```sql
-- Finds die numbers for the selected model/shift/date
FROM T_TravelogHeader
LEFT JOIN T_TravelogDetail ON Pth_TravelogNo = Ptd_TravelogNo AND Ptd_ProcessCode = 07
LEFT JOIN T_CostCenter ON Cct_CostCenterCode = Pth_TargetCostCenter
LEFT JOIN T_SectionCodeMaster ON Scm_Sectioncode = Cct_Sectioncode
WHERE Pth_ProductCode = @model
  AND Scm_SectionHead = @shift
  AND Ptd_TravelogNo IS NOT NULL
```

### Shift Assignment (DPR):
DPR uses `GetShiftDateF()` function which reads from `T_ShiftCodeMaster`:
```
Shift01: In=0600 Out=1400  →  360 - 840 min
Shift02: In=1400 Out=2200  →  840 - 1320 min
Shift03: In=2200 Out=0600  →  1320 - 360+1440 min
```

---

## Quick Reference: Lot Number Decoding

Lot: `26907001CH311000001S`

```
Position:  12345678901234567890
           26907001CH311000001S
                     ^
                     Position 12 = Line identifier:
                       '1' = ADC Line 1
                       '2' = ADC Line 2
                       '3' = ADC Line 3
                       '4' = C4 Line
                       '5' = KD Line

Position 13 = Die number (used by DPR)
```

---

## Quick Reference: Process Codes

| Code | Process | Calendar Branch | DPR |
|------|---------|----------------|-----|
| 00 | Die Casting | ADC (Line 1/2/3 from lot pos 12) | ADC module |
| 01 | Deburring | - | - |
| 02 | Machining 1 | - | - |
| 03 | Machining 2 | - | - |
| 04 | Washing | - | - |
| 05 | Inspection | - | - |
| 06 | Assembly | - | - |
| 07 | C4 Machining | C4 (Machine_Line=4) | C4 module |
| 08 | KD Packing | KD (Machine_Line=5) | KD module |

---

## Quick Reference: Status Values

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| **N** | New / Not started | CreateTravelogHD (initial) |
| **A** | Active / Done | Gateway scripts (updateProcess*.py) |
| **F** | Finished | Final process completion |

---

## End-to-End UI Flow

### Step 1: Create Travelog
```
Run: EXEC CreateTravelogHD '26907001CH311000002S','1250T #1','00','CX-002','11099','OUT',''
```
**What happens:** Header + 9 detail rows created. All Status=N, InputActualQty=0.
**Result:** Lot exists in database but NOT visible in Calendar or DPR yet.

---

### Step 2: Worker finishes Process 00 (Die Casting) on tablet
```
Tablet shows:
  Travelog: T26-XXXXXX
  Lot: 26907001CH311000002S
  Process: Die Casting (00)

Worker fills in:
  Start Time:  06:30:00
  OK Qty:      1000
  NG Qty:      10
  Output Qty:  990
  End Time:    08:30:00

Worker taps SAVE
```
**What happens in database:**
- ProcessCode='00': Status → A, InputActualQty → 1
- ProcessCode='01': InputActualQty → 990 (output passed to next step)

**UI result:**
- Tablet shows green checkmark on Process 00
- Process 01 is now unlocked (previous step is A)
- **ADC Calendar:** Lot NOW appears on ADC Line (because ProcessCode='00', InputActualQty>=1)
- **C4 Calendar:** NOT yet (C4 needs ProcessCode='07')

---

### Step 3: Worker finishes Process 01 (Deburring) on tablet
```
Tablet shows:
  Travelog: T26-XXXXXX
  Lot: 26907001CH311000002S
  Process: Deburring (01)
  Input: 990 (from previous step)

Worker fills in and taps SAVE
```
**What happens:** ProcessCode='01': Status → A, InputActualQty → 1
**UI result:** Process 02 unlocked. ADC Calendar still shows the lot.

---

### Step 4-6: Workers finish Processes 02, 03, 04, 05, 06
```
Each step: worker fills data → taps SAVE → Status → A → next step unlocks
```
**UI result:** Each step unlocks one by one. ADC Calendar continues showing the lot.

---
### Step 7: Worker finishes Process 07 (C4 Machining) on tablet

```
Tablet shows:
  Travelog: T26-XXXXXX
  Lot: 26907001CH311000002S
  Process: C4 Machining (07)
  Input: (from previous step)

Worker fills in:
  Start Time:  11:00:00
  OK Qty:      500
  NG Qty:      5
  Output Qty:  495
  End Time:    13:50:00

Worker taps SAVE
```

**What happens:**
- ProcessCode='07': Status → A, InputActualQty → 1
- Header: Status stays as 'N' (not finished yet)

**UI result - This is where C4 appears:**
- **C4 Calendar:** Lot NOW appears! Shows in Shift 1 (13:50 is before 14:00)
- **DPR C4:** When you open DPR C4 page and set the parameters, the lot appears

---

### Step 8: Worker finishes Process 08 (KD Packing) on tablet - FINAL STEP

```
Tablet shows:
  Travelog: T26-XXXXXX
  Lot: 26907001CH311000002S
  Process: KD Packing (08)
  Input: (from previous step)

Worker fills in:
  Start Time:  14:00:00
  OK Qty:      490
  NG Qty:      5
  Output Qty:  485
  End Time:    16:00:00

Worker taps SAVE
```

**What happens in database:**
- ProcessCode='08': Status → A, InputActualQty → 1
- **HEADER updates:** Pth_Status → 'F', Pth_ActualFinishQty → 1

**UI result - LOT IS NOW FINISHED:**
- **KD Calendar:** Lot NOW appears on KD line
- **ADC Calendar:** Still shows lot (WIP → now FG)
- **C4 Calendar:** Still shows lot (WIP → now FG)
- **All calendars:** Lot status changes from WIP to FG
---

### Step 8: View in Production Calendar
```
User opens: Production Management → Calendar tab
User selects:
  Line:    Machining (C4) Line    (or "All Lines")
  Date:    September 2026

What user sees on Sep 7:
  ┌──────────────────────────────────────┐
  │  Mon 7                               │
  │  ┌─────────────────────────────┐     │
  │  │  C4                         │     │
  │  │  ch3 (8972787453)           │     │
  │  │  Plan: 0   Actual: 1        │     │
  │  │  ┌──────┬─────┬─────┬─────┐ │     │
  │  │  │ WIP  │ NG  │ FG  │ Act │ │     │
  │  │  │  1   │  0  │  0  │  1  │ │     │
  │  │  └──────┴─────┴─────┴─────┘ │     │
  │  └─────────────────────────────┘     │
  └──────────────────────────────────────┘

User clicks the amber "Actual" chip:
  → Production Details Dialog opens
  → Shows shift-by-shift breakdown
  → Shift 1: WIP=1, NG=0, FG=0
```

---

### Step 9: View in DPR C4
```
User opens: Planning → Entries → DPR Entry (C4)

User fills in filter:
  Line:           C4
  Part Name:      Crank Case
  Shift:          1st Shift (06:00 AM ~ 02:00 PM)
  Date:           09/07/2026
  Model/Ratio:    ES30H/R (8972787453)
  STD CT (mins.): 1

User clicks LOAD

What user sees:
  ┌──────────────────────────────────────────────────┐
  │ DPR Entry (C4)                                    │
  │                                                    │
  │ Line: C4  |  Model: ES30H/R  |  Date: 09/07/2026 │
  │ Die No: 1  |  Shift: 1st Shift                    │
  │                                                    │
  │ ┌────┬──────────┬────────┬──────┬────────────────┐ │
  │ │ Hr │ Time     │ Result │ Def  │ Manpower       │ │
  │ ├────┼──────────┼────────┼──────┼────────────────┤ │
  │ │  1 │ 06:00-   │   0    │  0   │                │ │
  │ │    │ 07:00    │        │      │                │ │
  │ │  2 │ 07:00-   │   0    │  0   │                │ │
  │ │    │ 08:00    │        │      │                │ │
  │ │  3 │ 08:00-   │   0    │  0   │                │ │
  │ │    │ 09:00    │        │      │                │ │
  │ │  4 │ 09:00-   │   0    │  0   │                │ │
  │ │    │ 10:00    │        │      │                │ │
  │ │  5 │ 10:00-   │   0    │  0   │                │ │
  │ │    │ 11:00    │        │      │                │ │
  │ │  6 │ 11:00-   │   0    │  0   │                │ │
  │ │    │ 12:00    │        │      │                │ │
  │ │  7 │ 12:00-   │   0    │  0   │                │ │
  │ │    │ 13:00    │        │      │                │ │
  │ │  8 │ 13:00-   │   1    │  0   │ R.Dalisay      │ │
  │ │    │ 14:00    │        │      │                │ │
  │ └────┴──────────┴────────┴──────┴────────────────┘ │
  └──────────────────────────────────────────────────┘

  Hour 8 shows 1 because the lot was processed at 13:50
  (falls in the 13:00-14:00 window for Shift 1)
```

---

### Summary: When Does Data Appear?

| After This Step | ADC Calendar | C4 Calendar | KD Calendar | DPR C4 |
|----------------|-------------|-------------|-------------|--------|
| CreateTravelogHD | Not visible | Not visible | Not visible | Not visible |
| Process 00 saved (Die Casting) | **VISIBLE** (WIP) | Not visible | Not visible | Not visible |
| Process 01-06 saved | Visible (WIP) | Not visible | Not visible | Not visible |
| Process 07 saved (C4 Machining) | Visible (WIP) | **VISIBLE** (WIP) | Not visible | **VISIBLE** |
| Process 08 saved (KD Packing) | Visible (**FG**) | Visible (**FG**) | **VISIBLE** (WIP) | Visible (C4) |

> **Key rule:** Calendar and DPR only show data AFTER the relevant process is saved with Status='A' and InputActualQty>=1 on the tablet.
> 
> **Header changes at Process 08:** Pth_Status → 'F', Pth_ActualFinishQty → 1 (marks lot as finished)
