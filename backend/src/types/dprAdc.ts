export interface DprAdcFilter {
  line: string
  partName: string
  shift: string
  date: string
  model: string
  dieNo: string
  workingTime: string
  std: string
  operator: string
  i?: number
  x?: number
}

export interface DprAdcHeader {
  Dph_DPRCode: string
  Dph_Line: string
  Dph_ProductCode: string
  Dph_ProcessGroup: string
  Dph_PlanDate: string
  Dph_ShiftCode: string
  Dph_StdCount: number
  Dph_DieNo: string
  Dph_WorkingTimeMins: number
  Dph_ActualModelChangeMins: number
  Dph_ActualMachineTroubleMins: number
  Dph_DieTroubleMins: number
  Dph_HotChangeMins: number
  Dph_WarmUpShotMins: number
  Dph_Operator: string
  Dph_TeamLeader: string
  Dph_GroupLeader: string
  Dph_Status: string
  Dph_PartName: string
  Dph_OperatorNo: number
  Dph_TotShots: number
  Dph_TotFastShot: number
  Dph_TotLowShot: number
  Dph_TotDef: number
  Dph_TotNG: number
  Dph_ActualProdTime: number
  Dph_TotLossMins: number
  Dph_Efficiency: number
  Dph_NGPercentage: number
  Dph_WpStart1: string
  Dph_WpEnd1: string
  Dph_Problem1: string
  Dph_NgQty1: number
  Dph_Action1: string
  Dph_Status1: string
  Dph_WpStart2: string
  Dph_WpEnd2: string
  Dph_Problem2: string
  Dph_NgQty2: number
  Dph_Action2: string
  Dph_Status2: string
  Dph_NgWPNo: string
}

export interface DprAdcDetail {
  Dpd_DPRCode: string
  Dpd_SplitSeq: number
  Dpd_HrName: string
  Dpd_ResultCount: number
  Dpd_ShotsResultsDenominator: number
  Dpd_TargetNumerator: number
  Dpd_TargetDenominator: number
  Dpd_FastShot: number
  Dpd_FastShot2: number
  Dpd_LowShot: number
  Dpd_LowShot2: number
  Dpd_DefectQty: number
  Dpd_KanbanNo: string
  Dpd_KanbanNo2: string
  Dpd_Judgement: string
  Dpd_LossTimeMins: number
  Dpd_LossTimeMins2: number
  Dpd_DefectContent: string
  Dpd_LossTimeCode: string
  Dpd_LossTimeCode2: string
  Dpd_Abnormalities: string
  Dpd_Abnormalities2: string
  Dpd_WorkNo1: string
  Dpd_WorkNo2: string
  Dpd_DieCheck1: string
  Dpd_DieCheck2: string
  Dpd_QualityCheck1: string
  Dpd_QualityCheck2: string
  Dpd_CounterMeasures: string
  Dpd_CounterMeasures2: string
  Dpd_Biscuit: string
  Dpd_HydOil1: string
  Dpd_HydOil2: string
  Dpd_Operator: string
  Dpd_PIC: string
}

export interface DprAdcDataResponse {
  code: number
  message: string
  header: DprAdcHeader[]
  detail: DprAdcDetail[]
  status: string
}

export interface DprAdcDetailRequest {
  filter: DprAdcFilter
  accountid: string
  date: string
}

export interface DprAdcSaveRequest {
  accountid: string
  date: string
  header: DprAdcFilter
  footer: Partial<DprAdcHeader>
  detail?: DprAdcDetail[]
}

export interface ShiftInfo {
  Scm_ShiftCode: string
  Scm_ShiftDesc: string
}

export interface ProductCodeInfo {
  Pmt_ProductCode: string
  Pmt_ProductDesc: string
}
