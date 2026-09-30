export interface DprC4Filter {
  line: string
  partName: string
  shift: string
  date: string
  model: string
  dieNo: string
  workingTime?: string
  std: string
  operator: string
  i?: number
  x?: number
}

export interface DprC4Header {
  Dph_DPRCode: string
  Dph_Line: string
  Dph_ProductCode: string
  Dph_ProcessGroup: string
  Dph_PlanDate: string
  Dph_ShiftCode: string
  Dph_StdCount: number
  Dph_PlanProductionTime: number
  Dph_ActualPlanProductionTime: number
  Dph_StdToolChange: number
  Dph_StdDieChange: number
  Dph_MachineTrouble: number
  Dph_ActualStdToolChange: number
  Dph_ActualMachineTrouble: number
  Dph_ActualStdDieChange: number
  Dph_WorkingTimeMins: number
  Dph_Operator: string
  Dph_LineChecker: string
  Dph_TeamLeader: string
  Dph_GroupLeader: string
  Dph_Status: string
  Dph_PartName: string
  Dph_OperatorNo: number
  Dph_TotShots: number
  Dph_TotDef: number
}

export interface DprC4Detail {
  Dpd_DPRCode: string
  Dpd_SplitSeq: number
  Dpd_HrName: string
  Dpd_ResultCount: number
  Dpd_ShotsResultsDenominator: number
  Dpd_TargetNumeratorWBackup: number
  Dpd_TargetDenominatorWBackup: number
  Dpd_TargetNumeratorWOBackup: number
  Dpd_TargetDenominatorWOBackup: number
  Dpd_ActualResult1: number
  Dpd_ActualResult2: number
  Dpd_Judgement: string
  Dpd_CastingDefectQty: number
  Dpd_KanbanNo: string
  Dpd_CastingDate1: string
  Dpd_CastingDate2: string
  Dpd_DefectContent: string
  Dpd_DefectQty: number
  Dpd_LossTimeCode: string
  Dpd_LossTimeMins: number
  Dpd_LossTimeCode2: string
  Dpd_LossTimeMins2: number
  Dpd_Abnormalities: string
  Dpd_Abnormalities2: string
  Dpd_HourlyCheck: string
  Dpd_PIC: string
  Dpd_Qualityok: number | null
  Dpd_DieCheck1: string
  Dpd_DieCheck2: string
  Ptm_ManpowerCode?: string
  TimeInterval?: number
}

export interface DprC4DataResponse {
  code: number
  message: string
  header: DprC4Header[]
  detail: DprC4Detail[]
  status: string
}

export interface DprC4SaveRequest {
  accountid?: string
  date?: string
  header: DprC4Filter
  footer: Partial<DprC4Header>
  dprCode?: string
  detail?: DprC4Detail[]
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
