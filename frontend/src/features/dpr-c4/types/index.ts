export interface DprC4Filter {
  line: string;
  partName: string;
  shift: string;
  date: string;
  model: string;
  dieNo: string;
  workingTime?: string;
  std: string;
  operator: string;
  i?: number;
  x?: number;
}

export interface DprC4DetailRow {
  Dpd_DPRCode: string;
  Dpd_SplitSeq: number;
  Dpd_HrName: string;
  Dpd_ResultCount: number;
  Dpd_ShotsResultsDenominator: number;
  Dpd_TargetNumeratorWBackup: number;
  Dpd_TargetDenominatorWBackup: number;
  Dpd_TargetNumeratorWOBackup: number;
  Dpd_TargetDenominatorWOBackup: number;
  Dpd_ActualResult1: number;
  Dpd_ActualResult2: number;
  Dpd_Judgement: string;
  Dpd_CastingDefectQty: number;
  Dpd_KanbanNo: string;
  Dpd_CastingDate1: string;
  Dpd_CastingDate2: string;
  Dpd_DefectContent: string;
  Dpd_DefectQty: number;
  Dpd_LossTimeCode: string;
  Dpd_LossTimeMins: number;
  Dpd_LossTimeCode2: string;
  Dpd_LossTimeMins2: number;
  Dpd_Abnormalities: string;
  Dpd_Abnormalities2: string;
  Dpd_HourlyCheck: string;
  Dpd_PIC: string;
  Dpd_Qualityok: number | null;
  Dpd_DieCheck1: string;
  Dpd_DieCheck2: string;
  Ptm_ManpowerCode?: string;
  TimeInterval?: number;
}

export interface DprC4Footer {
  Dph_TotShots: number;
  Dph_TotDef: number;
  OkProducts: number;
  rawTotalShots: number;
  Dph_PlanProductionTime: number;
  Dph_ActualPlanProductionTime: number;
  Dph_StdToolChange: number;
  Dph_ActualStdToolChange: number;
  Dph_StdDieChange: number;
  Dph_MachineTrouble: number;
  Dph_ActualStdDieChange: number;
  Dph_ActualMachineTrouble: number;
  Dph_Operator: string;
  Dph_LineChecker: string;
  Dph_TeamLeader: string;
  Dph_GroupLeader: string;
  grandTotalLossTime: number;
  efficiency: number;
}

export interface LeaderInfo {
  md_Usercode: string;
  md_firstname: string;
  md_lastname: string;
  md_position: string;
  md_status: string;
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

export const C4_LINE = "C4";
