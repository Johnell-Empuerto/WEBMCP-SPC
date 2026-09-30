import sql, { getPool } from '../config/database';
import * as repo from '../repositories/dprKdRepository';
import type { DprKdDetail, DprKdFilter } from '../types/dprKd';

// Legacy KDDPRController: filter.line = '5' (SP @Line), E_DPRHeader stores Dph_Line = 'KD'
const KD_SP_LINE = '5';
const KD_HEADER_LINE = 'KD';

function num(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Legacy Node-RED returnData: manpower code is comma-separated; take the first value.
function firstManpower(v: any): string {
  const s = (v === null || v === undefined ? '' : String(v));
  return s.split(',')[0].trim();
}

// Legacy Node-RED returnData target calcs (exact port):
//   seq 1,3,6 -> (TimeInterval - 15) / std ; * 0.81 (parseInt)
//   seq 8     -> (TimeInterval - 10) / std ; * 0.81 (Math.ceil)
//   else      -> TimeInterval / std        ; * 0.81 (Math.ceil)
function computeTargets(seq: number, interval: number, std: number) {
  let targetWBackup: number;
  let targetWOBackup: number;
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
  return { targetWBackup, targetWOBackup };
}

export async function getDistinctDieNo(filter: DprKdFilter) {
  return repo.getDistinctDieNo(filter.model, filter.shift, filter.date);
}

export async function getDieNo(filter: DprKdFilter) {
  return repo.getDieNo(filter.model, filter.shift, filter.date);
}

// Legacy loadDPRDetails(): per-hour SP slice (i..i+1) using the KD master's
// Dpm_DPRTimeInterval and the selected KD table passed as @KD. Builds the
// target numerator values (with / without backup) for each split.
export async function getDPRDetails(filter: DprKdFilter) {
  const master = await repo.getDPRKDMaster(filter.model);
  if (master.length === 0) return [];
  const timeInterval = num(master[0].Dpm_DPRTimeInterval) || 60;
  const std = parseFloat(filter.std) || 1;
  const i = filter.i ?? 0;
  const result = await repo.getDPRKDShiftWorkHours(
    filter.dieNo, filter.shift, filter.date, KD_SP_LINE,
    filter.model, i, i + 1, timeInterval, filter.table
  );
  return result.map((row: any) => {
    const seq = num(row.Dpd_SplitSeq) || i + 1;
    const interval = num(row.TimeInterval) || timeInterval;
    const { targetWBackup, targetWOBackup } = computeTargets(seq, interval, std);
    return {
      Dpd_SplitSeq: seq,
      Dpd_HrName: row.Dpd_HrName ?? '',
      Dpd_ResultCount: num(row.Dpd_ResultCount),
      Dpd_ShotsResultsDenominator: 0,
      Dpd_ActualDenominator: 0,
      Dpd_TargetNumeratorWBackup: targetWBackup,
      Dpd_TargetNumeratorWOBackup: targetWOBackup,
      Dpd_TargetDenominatorWBackup: 0,
      Dpd_TargetDenominatorWOBackup: 0,
      Dpd_Judgement: row.Dpd_Judgement ?? '',
      Dpd_NumberOfManpower: num(row.Dpd_NumberOfManpower),
      Dpd_PartsWithChipsQty: num(row.Dpd_PartsWithChipsQty),
      Dpd_MachiningDefectQty: num(row.Dpd_MachiningDefectQty),
      Dpd_CastingDefectQty: num(row.Dpd_CastingDefectQty),
      Dpd_KanbanNo: row.Dpd_KanbanNo ?? '',
      Dpd_KanbanNo2: row.Dpd_KanbanNo2 ?? '',
      Dpd_Downtime: num(row.Dpd_Downtime),
      Dpd_ProblemDetected: row.Dpd_ProblemDetected ?? '',
      Dpd_CounterMeasures: row.Dpd_CounterMeasures ?? '',
      Dpd_PIC: row.Dpd_PIC ?? '',
      Ptm_ManpowerCode: firstManpower(row.Ptm_ManpowerCode),
      TimeInterval: interval,
    };
  });
}

// Legacy loadDPRDetails(): override stored Dpd_ResultCount / Dpd_DefectQty /
// Ptm_ManpowerCode with live SP production per hour (like the C4 module).
async function mergeSPProduction(filter: DprKdFilter, details: any[]): Promise<any[]> {
  if (details.length === 0) return details;
  const master = await repo.getDPRKDMaster(filter.model);
  if (master.length === 0) return details;
  const timeInterval = num(master[0].Dpm_DPRTimeInterval) || 60;

  const spBySeq = new Map<number, any>();
  for (let i = 0; i < 8; i++) {
    try {
      const rows = await repo.getDPRKDShiftWorkHours(
        filter.dieNo, filter.shift, filter.date, KD_SP_LINE,
        filter.model, i, i + 1, timeInterval, filter.table
      );
      if (rows.length > 0) spBySeq.set(num(rows[0].Dpd_SplitSeq) || i + 1, rows[0]);
    } catch (err) {
      console.warn(`[dprKd] getDPRKDShiftWorkHours failed for hour ${i + 1}`, (err as Error)?.message);
    }
  }

  return details.map((d: any) => {
    const sp = spBySeq.get(num(d.Dpd_SplitSeq));
    if (!sp) return d;
    return {
      ...d,
      Dpd_ResultCount: num(sp.Dpd_ResultCount),
      Dpd_DefectQty: num(sp.Dpd_DefectQty),
      Ptm_ManpowerCode: firstManpower(sp.Ptm_ManpowerCode),
    };
  });
}

export async function getDPRData(filter: DprKdFilter) {
  const header = await repo.getDPRKDHeader(
    KD_HEADER_LINE, filter.shift, filter.model, filter.date
  );
  if (header.length > 0) {
    const details = (await repo.getDPRKDDetails(header[0].Dph_DPRCode)).map((r: any) => ({
      ...r,
      // Normalize string fields so React controlled inputs stay editable after Load.
      Dpd_HrName: r.Dpd_HrName ?? '',
      Dpd_Judgement: r.Dpd_Judgement ?? '',
      Dpd_KanbanNo: r.Dpd_KanbanNo ?? '',
      Dpd_KanbanNo2: r.Dpd_KanbanNo2 ?? '',
      Dpd_ProblemDetected: r.Dpd_ProblemDetected ?? '',
      Dpd_CounterMeasures: r.Dpd_CounterMeasures ?? '',
      Dpd_PIC: r.Dpd_PIC ?? '',
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

// Legacy "Insert DPR Header" — exact legacy column mapping (KD line, ProcessGroup = 8).
export async function insertHeader(
  filter: DprKdFilter,
  footer: Record<string, any>,
  accountid?: string
) {
  const existing = await repo.checkExistingKDHeader(
    KD_HEADER_LINE, filter.shift, filter.model, filter.date
  );
  if (existing) {
    return { success: true, code: existing, isExisting: true };
  }
  const dprCode = await repo.generateDPRKDCode(filter.model);
  const data: Record<string, any> = {
    Dph_DPRCode: dprCode,
    Dph_ProductCode: filter.model,
    Dph_PlanDate: filter.date,
    Dph_ShiftCode: filter.shift,
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_DieNo: filter.dieNo || 1,
    Dph_PartName: filter.partName,
    Dph_ProcessGroup: 8,
    Dph_Line: KD_HEADER_LINE,
    Dph_Actual: num(footer.totalActual),
    Dph_Efficiency: num(footer.actualEfficiency),
    Dph_TotalPartWithChipsDefects: num(footer.Dph_TotalPartWithChipsDefects),
    Dph_TotalMachiningDefects: num(footer.Dph_TotalMachiningDefects),
    Dph_TotalCastingDefects: num(footer.Dph_TotalCastingDefects),
    Dph_Inspector: footer.Dph_Inspector || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_Status: '1',
    user_login: accountid || '',
    ludatetime: new Date().toISOString(),
  };
  await repo.insertDPRKDHeader(data);
  return { success: true, code: dprCode, isExisting: false };
}

// Legacy "Update Query" — updates the header row for the loaded DPR code.
export async function updateHeader(
  dprCode: string,
  filter: DprKdFilter,
  footer: Record<string, any>,
  accountid?: string
) {
  const data: Record<string, any> = {
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_DieNo: filter.dieNo || 1,
    Dph_PartName: filter.partName,
    Dph_Actual: num(footer.totalActual),
    Dph_Efficiency: num(footer.actualEfficiency),
    Dph_TotalPartWithChipsDefects: num(footer.Dph_TotalPartWithChipsDefects),
    Dph_TotalMachiningDefects: num(footer.Dph_TotalMachiningDefects),
    Dph_TotalCastingDefects: num(footer.Dph_TotalCastingDefects),
    Dph_Inspector: footer.Dph_Inspector || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_Status: footer.Dph_Status ?? '1',
    user_login: accountid || '',
    ludatetime: new Date().toISOString(),
  };
  await repo.updateDPRKDHeaderByCode(dprCode, data);
  return { success: true, code: dprCode };
}

function toDetailData(d: DprKdDetail): Record<string, any> {
  return {
    Dpd_DPRCode: d.Dpd_DPRCode,
    Dpd_SplitSeq: d.Dpd_SplitSeq,
    Dpd_HrName: d.Dpd_HrName || '',
    Dpd_TargetNumeratorWBackup: num(d.Dpd_TargetNumeratorWBackup),
    Dpd_TargetDenominatorWBackup: num(d.Dpd_TargetDenominatorWBackup),
    Dpd_TargetNumeratorWOBackup: num(d.Dpd_TargetNumeratorWOBackup),
    Dpd_TargetDenominatorWOBackup: num(d.Dpd_TargetDenominatorWOBackup),
    // Legacy update flow: Dpd_ActualResult1 = Dpd_ResultCount, Dpd_ActualResult2 = Dpd_ActualDenominator
    Dpd_ActualResult1: num(d.Dpd_ResultCount),
    Dpd_ActualResult2: num(d.Dpd_ActualDenominator),
    Dpd_Judgement: d.Dpd_Judgement || '',
    Dpd_NumberOfManpower: num(d.Dpd_NumberOfManpower),
    Dpd_PartsWithChipsQty: num(d.Dpd_PartsWithChipsQty),
    Dpd_MachiningDefectQty: num(d.Dpd_MachiningDefectQty),
    Dpd_CastingDefectQty: num(d.Dpd_CastingDefectQty),
    Dpd_KanbanNo: d.Dpd_KanbanNo || '',
    Dpd_KanbanNo2: d.Dpd_KanbanNo2 || '',
    Dpd_Downtime: num(d.Dpd_Downtime),
    Dpd_ProblemDetected: d.Dpd_ProblemDetected || '',
    Dpd_CounterMeasures: d.Dpd_CounterMeasures || '',
    Dpd_PIC: d.Dpd_PIC || '',
  };
}

export async function insertDetails(details: DprKdDetail[]) {
  // One database transaction for the whole DPR KD detail-save batch: all rows
  // are inserted together or none are (no partially saved DPR).
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      await repo.insertDPRKDDetail(toDetailData(detail), transaction);
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
      console.warn('[dprKd] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
  return { success: true };
}

export async function updateDetails(details: DprKdDetail[]) {
  // One transaction for the whole detail-update batch: all rows update
  // together or none do.
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      const { Dpd_DPRCode, Dpd_SplitSeq, ...rest } = toDetailData(detail);
      await repo.updateDPRKDDetailByCode(Dpd_DPRCode, Dpd_SplitSeq, rest, transaction);
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
      console.warn('[dprKd] transaction.rollback() failed:', (rollbackError as Error)?.message);
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

export async function checkExistingHeader(filter: DprKdFilter) {
  return repo.checkExistingKDHeader(KD_HEADER_LINE, filter.shift, filter.model, filter.date);
}
