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

export interface DprKdHeader {
  Dph_DPRCode: string
  Dph_Line: string
  Dph_ProductCode: string
  Dph_ProcessGroup: string
  Dph_PlanDate: string
  Dph_ShiftCode: string
  Dph_StdCount: number
  Dph_DieNo: string
  Dph_PartName: string
  Dph_Actual: number
  Dph_Efficiency: number
  Dph_TotalPartWithChipsDefects: number
  Dph_TotalMachiningDefects: number
  Dph_TotalCastingDefects: number
  Dph_Inspector: string
  Dph_TeamLeader: string
  Dph_GroupLeader: string
  Dph_Status: string
}

export interface DprKdDetail {
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

export interface DprKdDataResponse {
  code: number
  message: string
  header: DprKdHeader[]
  detail: DprKdDetail[]
  status: string
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
