import sql, { getPool } from '../config/database';
import * as repo from '../repositories/dprC4Repository';
import type { DprC4Detail, DprC4Filter } from '../types/dprC4';

const C4_HEADER_LINE = '4';

function num(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Legacy getFormattedDate(): SQL datetime columns come back as JS Date objects
// (serialized to ISO strings like "2026-07-30T00:00:00.000Z"). React's <input type="date">
// requires "YYYY-MM-DD", so we normalize before returning to the frontend.
function toDateInput(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const datePart = v.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getDistinctDieNo(filter: DprC4Filter) {
  return repo.getDistinctDieNo(filter.model, filter.shift, filter.date);
}

export async function getDieNo(filter: DprC4Filter) {
  return repo.getDieNo(filter.model, filter.shift, filter.date);
}

// Legacy loadDPRDetails(): the per-hour "Results Total" (Dpd_ResultCount), Dpd_DefectQty and
// Ptm_ManpowerCode come from the SP GetDPR_C4KDShiftWorkHours (actual production from
// V_ActualProductionInfo), NOT from E_DPRDetail (whose Dpd_ResultCount is usually NULL).
// Optimized: single query replaces 8 sequential SP calls.
async function mergeSPProduction(filter: DprC4Filter, details: any[]): Promise<any[]> {
  if (details.length === 0) return details;
  const master = await repo.getDPRC4Master(filter.model);
  if (master.length === 0) return details;
  const timeInterval = num(master[0].Dpm_DPRTimeInterval) || 60;

  const spBySeq = new Map<number, any>();
  try {
    const rows = await repo.getDPRC4ShiftWorkHoursAll(
      filter.dieNo, filter.shift, filter.date, C4_HEADER_LINE,
      filter.model, timeInterval
    );
    for (const row of rows) {
      spBySeq.set(num(row.Dpd_SplitSeq), row);
    }
  } catch (err) {
    console.warn('[dprC4] getDPRC4ShiftWorkHoursAll failed', (err as Error)?.message);
  }

  return details.map((d: any) => {
    const sp = spBySeq.get(num(d.Dpd_SplitSeq));
    if (!sp) return d;
    return {
      ...d,
      // Legacy: dprRecord[ind].Dpd_ResultCount = detail.Dpd_ResultCount || 0
      Dpd_ResultCount: num(sp.Dpd_ResultCount),
      Dpd_DefectQty: num(sp.Dpd_DefectQty),
      Ptm_ManpowerCode: sp.Ptm_ManpowerCode || d.Ptm_ManpowerCode || '',
    };
  });
}

export async function getDPRData(filter: DprC4Filter) {
  const header = await repo.getDPRC4Header(
    C4_HEADER_LINE, filter.shift, filter.model, filter.date
  );
  if (header.length > 0) {
    const details = (await repo.getDPRC4Details(header[0].Dph_DPRCode)).map((r: any) => ({
      ...r,
      // Normalize string fields so the frontend never receives null/undefined and the
      // React controlled inputs stay editable after Load (value={null} disables typing).
      // Mirrors the getDPRDetails mapping so existing-DPR rows behave like new ones.
      Dpd_HrName: r.Dpd_HrName ?? '',
      Dpd_Judgement: r.Dpd_Judgement ?? '',
      Dpd_KanbanNo: r.Dpd_KanbanNo ?? '',
      Dpd_DefectContent: r.Dpd_DefectContent ?? '',
      Dpd_LossTimeCode: r.Dpd_LossTimeCode ?? '',
      Dpd_LossTimeCode2: r.Dpd_LossTimeCode2 ?? '',
      Dpd_Abnormalities: r.Dpd_Abnormalities ?? '',
      Dpd_Abnormalities2: r.Dpd_Abnormalities2 ?? '',
      Dpd_HourlyCheck: r.Dpd_HourlyCheck ?? '',
      Dpd_PIC: r.Dpd_PIC ?? '',
      Dpd_DieCheck1: r.Dpd_DieCheck1 ?? '',
      Dpd_DieCheck2: r.Dpd_DieCheck2 ?? '',
      Dpd_CastingDate1: toDateInput(r.Dpd_CastingDate1),
      Dpd_CastingDate2: toDateInput(r.Dpd_CastingDate2),
    }));
    const merged = await mergeSPProduction(filter, details);
    return {
      code: 200,
      message: 'DPR Record Found',
      header,
      detail: merged,
      status: 'success',
    };
  }
  return {
    code: 204,
    message: 'No DPR Record Found',
    header: [],
    detail: [],
    status: 'error',
  };
}

export async function getDPRDetails(filter: DprC4Filter) {
  const master = await repo.getDPRC4Master(filter.model);
  if (master.length === 0) return [];
  const timeInterval = num(master[0].Dpm_DPRTimeInterval) || 60;
  const std = parseFloat(filter.std) || 1;
  // Legacy: loadData() sets filter.line = "4" before calling the SP,
  // so @line is always the header line code, not the UI label ("C4").
  // The production SP also requires @KD — the legacy getDPR_C4Details flow passes ''
  const result = await repo.getDPRC4ShiftWorkHours(
    filter.dieNo, filter.shift, filter.date, C4_HEADER_LINE,
    filter.model, filter.i ?? 0, (filter.i ?? 0) + 1, timeInterval, ''
  );
  return result.map((row: any) => {
    let targetWBackup: number;
    let targetWOBackup: number;
    const seq = row.Dpd_SplitSeq;
    const interval = num(row.TimeInterval) || timeInterval;
    if (seq === 1 || seq === 3 || seq === 6) {
      targetWBackup = parseInt(String((interval - 15) / std));
      targetWOBackup = parseInt(String(targetWBackup * 0.81));
    } else if (seq === 8) {
      targetWBackup = parseInt(String((interval - 10) / std));
      targetWOBackup = Math.ceil(targetWBackup * 0.81);
    } else {
      targetWBackup = parseInt(String(interval / std));
      targetWOBackup = Math.ceil(targetWBackup * 0.81);
    }
    return {
      Dpd_SplitSeq: seq,
      Dpd_HrName: row.Dpd_HrName ?? '',
      Dpd_ResultCount: num(row.Dpd_ResultCount),
      Dpd_ShotsResultsDenominator: 0,
      Dpd_TargetNumeratorWBackup: targetWBackup,
      Dpd_TargetNumeratorWOBackup: targetWOBackup,
      Dpd_TargetDenominatorWBackup: 0,
      Dpd_TargetDenominatorWOBackup: 0,
      Dpd_ActualResult1: 0,
      Dpd_ActualResult2: 0,
      Dpd_FastShot: 0,
      Dpd_FastShot2: 0,
      Dpd_LowShot: 0,
      Dpd_LowShot2: 0,
      Dpd_DefectQty: num(row.Dpd_DefectQty),
      Dpd_DefectContent: row.Dpd_DefectContent ?? '',
      Dpd_KanbanNo: row.Dpd_KanbanNo ?? '',
      Dpd_Qualityok: row.Dpd_Qualityok ?? null,
      Dpd_CastingDefectQty: 0,
      Dpd_CastingDate1: toDateInput(row.Dpd_CastingDate1),
      Dpd_CastingDate2: toDateInput(row.Dpd_CastingDate2),
      Dpd_Judgement: row.Dpd_Judgement ?? '',
      Dpd_LossTimeCode: row.Dpd_LossTimeCode ?? '',
      Dpd_LossTimeMins: num(row.Dpd_LossTimeMins),
      Dpd_LossTimeCode2: row.Dpd_LossTimeCode2 ?? '',
      Dpd_LossTimeMins2: num(row.Dpd_LossTimeMins2),
      Dpd_Abnormalities: row.Dpd_Abnormalities ?? '',
      Dpd_Abnormalities2: row.Dpd_Abnormalities2 ?? '',
      Dpd_HourlyCheck: row.Dpd_HourlyCheck ?? '',
      Dpd_PIC: row.Dpd_PIC ?? '',
      // Legacy operator display uses Ptm_ManpowerCode (returned by the SP)
      Ptm_ManpowerCode: row.Ptm_ManpowerCode ?? row.Dpd_PIC ?? '',
      Dpd_DieCheck1: row.Dpd_DieCheck1 ?? '',
      Dpd_DieCheck2: row.Dpd_DieCheck2 ?? '',
      TimeInterval: interval,
    };
  });
}

export async function insertHeader(
  filter: DprC4Filter,
  footer: Record<string, any>,
  accountid?: string
) {
  const existing = await repo.checkExistingC4Header(
    C4_HEADER_LINE, filter.shift, filter.model, filter.date
  );
  if (existing) {
    return { success: true, code: existing, isExisting: true };
  }
  const dprCode = await repo.generateDPRC4Code(filter.model);
  const data: Record<string, any> = {
    Dph_DPRCode: dprCode,
    Dph_Line: C4_HEADER_LINE,
    Dph_ProductCode: filter.model,
    Dph_ProcessGroup: filter.i ?? null,
    Dph_PlanDate: filter.date,
    Dph_ShiftCode: filter.shift,
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_PlanProductionTime: num(footer.Dph_PlanProductionTime),
    Dph_ActualPlanProductionTime: num(footer.Dph_ActualPlanProductionTime),
    Dph_StdToolChange: num(footer.Dph_StdToolChange),
    Dph_StdDieChange: num(footer.Dph_StdDieChange),
    Dph_MachineTrouble: num(footer.Dph_MachineTrouble),
    Dph_ActualStdToolChange: num(footer.Dph_ActualStdToolChange),
    Dph_ActualMachineTrouble: num(footer.Dph_ActualMachineTrouble),
    Dph_ActualStdDieChange: num(footer.Dph_ActualStdDieChange),
    Dph_WorkingTimeMins: parseFloat(filter.workingTime ?? '') || 0,
    Dph_Operator: footer.Dph_Operator || '',
    Dph_LineChecker: footer.Dph_LineChecker || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_Status: '1',
    user_login: accountid || '',
    ludatetime: new Date().toISOString(),
    Dph_PartName: filter.partName,
    Dph_OperatorNo: parseInt(filter.operator) || 0,
    Dph_TotShots: num(footer.Dph_TotShots),
    Dph_TotDef: num(footer.Dph_TotDef),
  };
  await repo.insertDPRC4Header(data);
  return { success: true, code: dprCode, isExisting: false };
}

export async function updateHeader(
  dprCode: string,
  filter: DprC4Filter,
  footer: Record<string, any>,
  accountid?: string
) {
  const data: Record<string, any> = {
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_WorkingTimeMins: parseFloat(filter.workingTime ?? '') || 0,
    Dph_PartName: filter.partName,
    Dph_OperatorNo: parseInt(filter.operator) || 0,
    Dph_PlanProductionTime: num(footer.Dph_PlanProductionTime),
    Dph_ActualPlanProductionTime: num(footer.Dph_ActualPlanProductionTime),
    Dph_StdToolChange: num(footer.Dph_StdToolChange),
    Dph_StdDieChange: num(footer.Dph_StdDieChange),
    Dph_MachineTrouble: num(footer.Dph_MachineTrouble),
    Dph_ActualStdToolChange: num(footer.Dph_ActualStdToolChange),
    Dph_ActualMachineTrouble: num(footer.Dph_ActualMachineTrouble),
    Dph_ActualStdDieChange: num(footer.Dph_ActualStdDieChange),
    Dph_Operator: footer.Dph_Operator || '',
    Dph_LineChecker: footer.Dph_LineChecker || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_TotShots: num(footer.Dph_TotShots),
    Dph_TotDef: num(footer.Dph_TotDef),
    Dph_Status: footer.Dph_Status ?? '1',
    user_login: accountid || '',
    ludatetime: new Date().toISOString(),
  };
  await repo.updateDPRC4HeaderByCode(dprCode, data);
  return { success: true, code: dprCode };
}

function toDetailData(d: DprC4Detail): Record<string, any> {
  return {
    Dpd_DPRCode: d.Dpd_DPRCode,
    Dpd_SplitSeq: d.Dpd_SplitSeq,
    Dpd_HrName: d.Dpd_HrName || '',
    // Legacy insert/update flows persist Dpd_ResultCount + Dpd_ShotsResultsDenominator.
    // Without them the "Results Total" column comes back empty after save -> reload.
    Dpd_ResultCount: num(d.Dpd_ResultCount),
    Dpd_ShotsResultsDenominator: num(d.Dpd_ShotsResultsDenominator),
    Dpd_TargetNumeratorWBackup: num(d.Dpd_TargetNumeratorWBackup),
    Dpd_TargetDenominatorWBackup: num(d.Dpd_TargetDenominatorWBackup),
    Dpd_TargetNumeratorWOBackup: num(d.Dpd_TargetNumeratorWOBackup),
    Dpd_TargetDenominatorWOBackup: num(d.Dpd_TargetDenominatorWOBackup),
    Dpd_ActualResult1: num(d.Dpd_ActualResult1) || num(d.Dpd_ResultCount),
    Dpd_ActualResult2: num(d.Dpd_ActualResult2) || num(d.Dpd_ShotsResultsDenominator),
    Dpd_Judgement: d.Dpd_Judgement || '',
    Dpd_CastingDefectQty: num(d.Dpd_CastingDefectQty),
    Dpd_KanbanNo: d.Dpd_KanbanNo || '',
    Dpd_CastingDate1: d.Dpd_CastingDate1 || null,
    Dpd_CastingDate2: d.Dpd_CastingDate2 || null,
    Dpd_DefectContent: d.Dpd_DefectContent || '',
    Dpd_DefectQty: num(d.Dpd_DefectQty),
    Dpd_LossTimeCode: d.Dpd_LossTimeCode || '',
    Dpd_LossTimeMins: num(d.Dpd_LossTimeMins),
    Dpd_LossTimeCode2: d.Dpd_LossTimeCode2 || '',
    Dpd_LossTimeMins2: num(d.Dpd_LossTimeMins2),
    Dpd_Abnormalities: d.Dpd_Abnormalities || '',
    Dpd_Abnormalities2: d.Dpd_Abnormalities2 || '',
    Dpd_HourlyCheck: d.Dpd_HourlyCheck || '',
    Dpd_PIC: d.Dpd_PIC || '',
    Dpd_Qualityok: d.Dpd_Qualityok === null || d.Dpd_Qualityok === undefined ? null : (d.Dpd_Qualityok ? 1 : 0),
    Dpd_DieCheck1: d.Dpd_DieCheck1 || '',
    Dpd_DieCheck2: d.Dpd_DieCheck2 || '',
  };
}

export async function insertDetails(details: DprC4Detail[]) {
  // One database transaction for the whole DPR C4 detail-save batch: all rows
  // are inserted together or none are (no partially saved DPR).
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      await repo.insertDPRC4Detail(toDetailData(detail), transaction);
    }
    // Every detail row was saved — commit the whole batch.
    await transaction.commit();
  } catch (error) {
    // Try to undo every detail insert; if SQL Server already aborted the
    // transaction ("Transaction has been aborted"), rollback is a no-op —
    // rethrow the original error either way.
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Normally "Transaction has been aborted" — the server already rolled
      // everything back and released the connection. If anything else is
      // thrown, warn so a genuine rollback failure stays diagnosable.
      console.warn('[dprC4] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
  return { success: true };
}

export async function updateDetails(details: DprC4Detail[]) {
  // One transaction for the whole detail-update batch: all rows update
  // together or none do.
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      const { Dpd_DPRCode, Dpd_SplitSeq, ...rest } = toDetailData(detail);
      await repo.updateDPRC4DetailByCode(Dpd_DPRCode, Dpd_SplitSeq, rest, transaction);
    }
    await transaction.commit();
  } catch (error) {
    // Try to undo the writes; if SQL Server already aborted the transaction
    // ("Transaction has been aborted"), rollback is a no-op — rethrow the
    // original error either way.
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Normally "Transaction has been aborted" — the server already rolled
      // everything back and released the connection. If anything else is
      // thrown, warn so a genuine rollback failure stays diagnosable.
      console.warn('[dprC4] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
  return { success: true };
}

export async function getTeamLeaders() {
  return repo.getTeamLeaders();
}

export async function getGroupLeaders() {
  return repo.getGroupLeaders();
}

export async function getLineCheckers() {
  return repo.getLineCheckers();
}

export async function getShifts() {
  return repo.getShifts();
}

export async function checkExistingHeader(filter: DprC4Filter) {
  return repo.checkExistingC4Header(C4_HEADER_LINE, filter.shift, filter.model, filter.date);
}
