export interface DprKdFilter {
  line: string
  partName: string
  shift: string
  date: string
  model: string
  table: string
  dieNo: string
  std: string
  i?: number
  x?: number
}

export interface DprKdDetailRow {
  Dpd_DPRCode: string
  Dpd_SplitSeq: number
  Dpd_HrName: string
  Dpd_ResultCount: number
  Dpd_ActualDenominator: number
  Dpd_ShotsResultsDenominator: number
  Dpd_TargetNumeratorWBackup: number
  Dpd_TargetDenominatorWBackup: number
  Dpd_TargetNumeratorWOBackup: number
  Dpd_TargetDenominatorWOBackup: number
  Dpd_Judgement: string
  Dpd_NumberOfManpower: number
  Dpd_PartsWithChipsQty: number
  Dpd_MachiningDefectQty: number
  Dpd_CastingDefectQty: number
  Dpd_KanbanNo: string
  Dpd_KanbanNo2: string
  Dpd_Downtime: number
  Dpd_ProblemDetected: string
  Dpd_CounterMeasures: string
  Dpd_PIC: string
  Ptm_ManpowerCode?: string
  TimeInterval?: number
}

export interface DprKdFooter {
  totalActual: number
  actualEfficiency: number
  actualEfficiencyDisplay: string
  Dph_TotalPartWithChipsDefects: number
  Dph_TotalMachiningDefects: number
  Dph_TotalCastingDefects: number
  Dph_TeamLeader: string
  Dph_GroupLeader: string
  Dph_Inspector: string
}

export interface LeaderInfo {
  md_Usercode: string
  md_firstname: string
  md_lastname: string
  md_position: string
  md_status: string
}

export interface ShiftInfo {
  Scm_ShiftCode: string
  Scm_ShiftDesc: string
}

export const MODELS = [
  { value: "8-98247-187-2", label: "ES01" },
  { value: "8-97669-716-0", label: "ES05" },
  { value: "8-97533-464-1", label: "ES08" },
  { value: "8972787453", label: "ES30H/R" },
  { value: "8972787463", label: "ES30L/R" },
]

export const KD_TABLES = [
  { value: "KD Table 1", label: "Table 1" },
  { value: "KD Table 2", label: "Table 2" },
]

export const KD_LINE = "KD"
