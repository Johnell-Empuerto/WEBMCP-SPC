export interface DprAdcFilter {
  line: string;
  partName: string;
  shift: string;
  date: string;
  model: string;
  dieNo: string;
  workingTime: string;
  std: string;
  operator: string;
  i?: number;
}

export interface DprAdcDetailRow {
  Dpd_DPRCode: string;
  Dpd_SplitSeq: number;
  Dpd_HrName: string;
  Dpd_ResultCount: number;
  Dpd_ShotsResultsDenominator: number;
  Dpd_TargetNumerator: number;
  Dpd_TargetDenominator: number;
  Dpd_FastShot: number;
  Dpd_FastShot2: number;
  Dpd_LowShot: number;
  Dpd_LowShot2: number;
  Dpd_DefectQty: number;
  Dpd_KanbanNo: string;
  Dpd_KanbanNo2: string;
  Dpd_Judgement: string;
  Dpd_LossTimeMins: number;
  Dpd_LossTimeMins2: number;
  Dpd_DefectContent: string;
  Dpd_LossTimeCode: string;
  Dpd_LossTimeCode2: string;
  Dpd_Abnormalities: string;
  Dpd_Abnormalities2: string;
  Dpd_WorkNo1: string;
  Dpd_WorkNo2: string;
  Dpd_DieCheck1: string;
  Dpd_DieCheck2: string;
  Dpd_QualityCheck1: string;
  Dpd_QualityCheck2: string;
  Dpd_CounterMeasures: string;
  Dpd_CounterMeasures2: string;
  Dpd_Biscuit: string;
  Dpd_HydOil1: string;
  Dpd_HydOil2: string;
  Dpd_Operator: string;
  Dpd_PIC: string;
}

export interface DprAdcFooter {
  Dph_TotShots: number;
  Dph_TotFastShot: number;
  Dph_TotLowShot: number;
  Dph_TotDef: number;
  Dph_TotNG: number;
  Dph_TotLossMins: number;
  Dph_Efficiency: number;
  Dph_ActualProdTime: number;
  Dph_ActualModelChangeMins: number;
  Dph_ActualMachineTroubleMins: number;
  Dph_DieTroubleMins: number;
  Dph_HotChangeMins: number;
  Dph_WarmUpShotMins: number;
  Dph_NGPercentage: number;
  Dph_Operator: string;
  Dph_TeamLeader: string;
  Dph_GroupLeader: string;
  Dph_WpStart1: string;
  Dph_WpEnd1: string;
  Dph_Problem1: string;
  Dph_NgQty1: number;
  Dph_Action1: string;
  Dph_Status1: string;
  Dph_WpStart2: string;
  Dph_WpEnd2: string;
  Dph_Problem2: string;
  Dph_NgQty2: number;
  Dph_Action2: string;
  Dph_Status2: string;
  Dph_NgWPNo: string;
  Dpr_TotJudgement?: number;
}

export interface ShiftInfo {
  Scm_ShiftCode: string;
  Scm_ShiftDesc: string;
}

export const MODELS = [
  { value: "8-98247-187-2", label: "ES01" },
  { value: "8-97669-716-0", label: "ES25" },
  { value: "8-97533-464-1", label: "ES08" },
  { value: "8972787453", label: "ES30H/R" },
  { value: "8972787463", label: "ES30L/R" },
];

export const LINES = [
  { value: "1", label: "ADC 1", machine: "1250T DCM # 1" },
  { value: "2", label: "ADC 2", machine: "1250T DCM # 2" },
  { value: "3", label: "ADC 3", machine: "1250T DCM # 3" },
];

export const MACHINE_MAP: Record<string, string> = {
  "1": "1250T DCM # 1",
  "2": "1250T DCM # 2",
  "3": "1250T DCM # 3",
};
