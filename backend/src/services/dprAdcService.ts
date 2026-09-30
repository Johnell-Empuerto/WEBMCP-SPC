import sql, { getPool } from '../config/database';
import * as repo from '../repositories/dprAdcRepository';
import type { DprAdcFilter, DprAdcDetail, DprAdcHeader } from '../types/dprAdc';

export async function getDistinctDieNo(filter: DprAdcFilter) {
  const counter = await repo.getDistinctDieNo(
    filter.line, filter.model, filter.shift, filter.date
  );
  return counter;
}

export async function getDieNo(filter: DprAdcFilter) {
  const dieNo = await repo.getDieNo(
    filter.line, filter.model, filter.shift, filter.date
  );
  return dieNo;
}

export async function getDPRData(filter: DprAdcFilter) {
  const header = await repo.getDPRHeader(
    filter.line, filter.shift, filter.model, filter.dieNo, filter.date
  );
  if (header.length > 0) {
    const details = await repo.getDPRDetails(header[0].Dph_DPRCode);
    return {
      code: 200,
      message: 'DPR Record Found',
      header,
      detail: details,
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

export async function getDPRDetails(filter: DprAdcFilter) {
  const timeInterval = await repo.getDPRTimeInterval();
  const std = parseFloat(filter.std) || 1;
  const result = await repo.getDPRShiftWorkHours(
    filter.dieNo, filter.shift, filter.date, filter.line,
    filter.model, filter.i ?? 0, (filter.i ?? 0) + 1, timeInterval
  );
  if (result.length > 0) {
    const row = result[0];
    const isBreak = row.Dpd_SplitSeq === 3 || row.Dpd_SplitSeq === 6;
    const timeMins = isBreak ? timeInterval - 15 : timeInterval;
    const targetNum = Math.floor(timeMins / std);
    return [{
      Dpd_DPRCode: '',
      Dpd_SplitSeq: row.Dpd_SplitSeq,
      Dpd_HrName: row.Dpd_HrName,
      Dpd_ResultCount: row.Dpd_ResultCount ?? 0,
      Dpd_ShotsResultsDenominator: 0,
      Dpd_TargetNumerator: targetNum,
      Dpd_TargetDenominator: 0,
      Dpd_FastShot: row.Dpd_FastShot ?? 0,
      Dpd_FastShot2: row.Dpd_FastShot2 ?? 0,
      Dpd_LowShot: row.Dpd_LowShot ?? 0,
      Dpd_LowShot2: row.Dpd_LowShot2 ?? 0,
      Dpd_DefectQty: row.Dpd_DefectQty ?? 0,
      Dpd_KanbanNo: row.Dpd_KanbanNo ?? '',
      Dpd_KanbanNo2: row.Dpd_KanbanNo2 ?? '',
      Dpd_Judgement: row.Dpd_Judgement ?? '',
      Dpd_LossTimeMins: row.Dpd_LossTimeMins ?? 0,
      Dpd_LossTimeMins2: row.Dpd_LossTimeMins2 ?? 0,
      Dpd_DefectContent: row.Dpd_DefectContent ?? '',
      Dpd_LossTimeCode: row.Dpd_LossTimeCode ?? '',
      Dpd_LossTimeCode2: row.Dpd_LossTimeCode2 ?? '',
      Dpd_Abnormalities: row.Dpd_Abnormalities ?? '',
      Dpd_Abnormalities2: row.Dpd_Abnormalities2 ?? '',
      Dpd_WorkNo1: row.Dpd_WorkNo1 ?? '',
      Dpd_WorkNo2: row.Dpd_WorkNo2 ?? '',
      Dpd_DieCheck1: row.Dpd_DieCheck1 ?? '',
      Dpd_DieCheck2: row.Dpd_DieCheck2 ?? '',
      Dpd_QualityCheck1: row.Dpd_QualityCheck1 ?? '',
      Dpd_QualityCheck2: row.Dpd_QualityCheck2 ?? '',
      Dpd_CounterMeasures: row.Dpd_CounterMeasures ?? '',
      Dpd_CounterMeasures2: row.Dpd_CounterMeasures2 ?? '',
      Dpd_Biscuit: row.Dpd_Biscuit ?? '',
      Dpd_HydOil1: row.Dpd_HydOil1 ?? '',
      Dpd_HydOil2: row.Dpd_HydOil2 ?? '',
      Dpd_Operator: row.Dpd_Operator ?? '',
      Dpd_PIC: row.Dpd_PIC ?? '',
    }];
  }
  return [];
}

export async function insertHeader(filter: DprAdcFilter, footer: Record<string, any>) {
  const dprCode = await repo.generateDPRCode(filter.model);
  const data: Record<string, any> = {
    Dph_DPRCode: dprCode,
    Dph_Line: filter.line,
    Dph_ProductCode: filter.model,
    Dph_ProcessGroup: 'ADC',
    Dph_PlanDate: filter.date,
    Dph_ShiftCode: filter.shift,
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_DieNo: filter.dieNo,
    Dph_WorkingTimeMins: parseFloat(filter.workingTime) || 0,
    Dph_OperatorNo: parseInt(filter.operator) || 0,
    Dph_PartName: filter.partName,
    Dph_Operator: footer.Dph_Operator || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_Status: '1',
    user_login: '',
    ludatetime: new Date().toISOString(),
    Dph_TotShots: footer.Dph_TotShots || 0,
    Dph_TotFastShot: footer.Dph_TotFastShot || 0,
    Dph_TotLowShot: footer.Dph_TotLowShot || 0,
    Dph_TotDef: footer.Dph_TotDef || 0,
    Dph_TotNG: footer.Dph_TotNG || 0,
    Dph_ActualProdTime: parseFloat(footer.Dph_ActualProdTime) || 0,
    Dph_TotLossMins: footer.Dph_TotLossMins || 0,
    Dph_Efficiency: footer.Dph_Efficiency || 0,
    Dph_NGPercentage: parseFloat(footer.Dph_NGPercentage) || 0,
    Dph_ActualModelChangeMins: parseFloat(footer.Dph_ActualModelChangeMins) || 0,
    Dph_ActualMachineTroubleMins: parseFloat(footer.Dph_ActualMachineTroubleMins) || 0,
    Dph_DieTroubleMins: parseFloat(footer.Dph_DieTroubleMins) || 0,
    Dph_HotChangeMins: parseFloat(footer.Dph_HotChangeMins) || 0,
    Dph_WarmUpShotMins: parseFloat(footer.Dph_WarmUpShotMins) || 0,
    Dph_WpStart1: footer.Dph_WpStart1 || '',
    Dph_WpEnd1: footer.Dph_WpEnd1 || '',
    Dph_Problem1: footer.Dph_Problem1 || '',
    Dph_NgQty1: parseInt(footer.Dph_NgQty1) || 0,
    Dph_Action1: footer.Dph_Action1 || '',
    Dph_Status1: footer.Dph_Status1 || '',
    Dph_WpStart2: footer.Dph_WpStart2 || '',
    Dph_WpEnd2: footer.Dph_WpEnd2 || '',
    Dph_Problem2: footer.Dph_Problem2 || '',
    Dph_NgQty2: parseInt(footer.Dph_NgQty2) || 0,
    Dph_Action2: footer.Dph_Action2 || '',
    Dph_Status2: footer.Dph_Status2 || '',
    Dph_NgWPNo: footer.Dph_NgWPNo || '',
  };
  await repo.insertDPRHeader(data);
  return { success: true, code: dprCode };
}

export async function updateHeader(filter: DprAdcFilter, footer: Record<string, any>) {
  const data: Record<string, any> = {
    Dph_StdCount: parseFloat(filter.std) || 0,
    Dph_WorkingTimeMins: parseFloat(filter.workingTime) || 0,
    Dph_OperatorNo: parseInt(filter.operator) || 0,
    Dph_PartName: filter.partName,
    Dph_Operator: footer.Dph_Operator || '',
    Dph_TeamLeader: footer.Dph_TeamLeader || '',
    Dph_GroupLeader: footer.Dph_GroupLeader || '',
    Dph_ActualModelChangeMins: parseFloat(footer.Dph_ActualModelChangeMins) || 0,
    Dph_ActualMachineTroubleMins: parseFloat(footer.Dph_ActualMachineTroubleMins) || 0,
    Dph_DieTroubleMins: parseFloat(footer.Dph_DieTroubleMins) || 0,
    Dph_HotChangeMins: parseFloat(footer.Dph_HotChangeMins) || 0,
    Dph_WarmUpShotMins: parseFloat(footer.Dph_WarmUpShotMins) || 0,
    Dph_TotShots: footer.Dph_TotShots || 0,
    Dph_TotFastShot: footer.Dph_TotFastShot || 0,
    Dph_TotLowShot: footer.Dph_TotLowShot || 0,
    Dph_TotDef: footer.Dph_TotDef || 0,
    Dph_TotNG: footer.Dph_TotNG || 0,
    Dph_ActualProdTime: parseFloat(footer.Dph_ActualProdTime) || 0,
    Dph_TotLossMins: footer.Dph_TotLossMins || 0,
    Dph_Efficiency: footer.Dph_Efficiency || 0,
    Dph_NGPercentage: parseFloat(footer.Dph_NGPercentage) || 0,
    Dph_WpStart1: footer.Dph_WpStart1 || '',
    Dph_WpEnd1: footer.Dph_WpEnd1 || '',
    Dph_Problem1: footer.Dph_Problem1 || '',
    Dph_NgQty1: parseInt(footer.Dph_NgQty1) || 0,
    Dph_Action1: footer.Dph_Action1 || '',
    Dph_Status1: footer.Dph_Status1 || '',
    Dph_WpStart2: footer.Dph_WpStart2 || '',
    Dph_WpEnd2: footer.Dph_WpEnd2 || '',
    Dph_Problem2: footer.Dph_Problem2 || '',
    Dph_NgQty2: parseInt(footer.Dph_NgQty2) || 0,
    Dph_Action2: footer.Dph_Action2 || '',
    Dph_Status2: footer.Dph_Status2 || '',
    Dph_NgWPNo: footer.Dph_NgWPNo || '',
    user_login: '',
    ludatetime: new Date().toISOString(),
  };
  await repo.updateDPRHeader(filter.line, filter.shift, filter.model, filter.dieNo, filter.date, data);
  return { success: true };
}

export async function insertDetails(details: DprAdcDetail[]) {
  // Start one database transaction for the entire DPR detail-save operation.
  // This guarantees that ALL detail rows are saved together — if any row fails,
  // every detail insert is rolled back so no partial DPR is left behind.
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      const data: Record<string, any> = {
        Dpd_DPRCode: detail.Dpd_DPRCode,
        Dpd_SplitSeq: detail.Dpd_SplitSeq,
        Dpd_HrName: detail.Dpd_HrName || '',
        Dpd_ResultCount: detail.Dpd_ResultCount || 0,
        Dpd_ShotsResultsDenominator: detail.Dpd_ShotsResultsDenominator || 0,
        Dpd_TargetNumerator: detail.Dpd_TargetNumerator || 0,
        Dpd_TargetDenominator: detail.Dpd_TargetDenominator || 0,
        Dpd_FastShot: detail.Dpd_FastShot || 0,
        Dpd_FastShot2: detail.Dpd_FastShot2 || 0,
        Dpd_LowShot: detail.Dpd_LowShot || 0,
        Dpd_LowShot2: detail.Dpd_LowShot2 || 0,
        Dpd_DefectQty: detail.Dpd_DefectQty || 0,
        Dpd_KanbanNo: detail.Dpd_KanbanNo || '',
        Dpd_KanbanNo2: detail.Dpd_KanbanNo2 || '',
        Dpd_Judgement: detail.Dpd_Judgement || '',
        Dpd_LossTimeMins: detail.Dpd_LossTimeMins || 0,
        Dpd_LossTimeMins2: detail.Dpd_LossTimeMins2 || 0,
        Dpd_DefectContent: detail.Dpd_DefectContent || '',
        Dpd_LossTimeCode: detail.Dpd_LossTimeCode || '',
        Dpd_LossTimeCode2: detail.Dpd_LossTimeCode2 || '',
        Dpd_Abnormalities: detail.Dpd_Abnormalities || '',
        Dpd_Abnormalities2: detail.Dpd_Abnormalities2 || '',
        Dpd_WorkNo1: detail.Dpd_WorkNo1 || '',
        Dpd_WorkNo2: detail.Dpd_WorkNo2 || '',
        Dpd_DieCheck1: detail.Dpd_DieCheck1 || '',
        Dpd_DieCheck2: detail.Dpd_DieCheck2 || '',
        Dpd_QualityCheck1: detail.Dpd_QualityCheck1 || '',
        Dpd_QualityCheck2: detail.Dpd_QualityCheck2 || '',
        Dpd_CounterMeasures: detail.Dpd_CounterMeasures || '',
        Dpd_CounterMeasures2: detail.Dpd_CounterMeasures2 || '',
        Dpd_Biscuit: detail.Dpd_Biscuit || '',
        Dpd_HydOil1: detail.Dpd_HydOil1 || '',
        Dpd_HydOil2: detail.Dpd_HydOil2 || '',
        Dpd_Operator: detail.Dpd_Operator || '',
        Dpd_PIC: detail.Dpd_PIC || '',
      };
      // All detail inserts run through the same transaction.
      await repo.insertDPRDetail(data, transaction);
    }
    // Every detail row was saved — make the whole batch permanent.
    await transaction.commit();
  } catch (error) {
    // Something failed. Try to undo every detail insert made in this
    // transaction; if SQL Server already aborted it (e.g. conversion errors
    // raise "Transaction has been aborted" and release the connection),
    // there is nothing left to roll back — keep the original error.
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Normally "Transaction has been aborted" — the server already rolled
      // everything back and released the connection. If anything else is
      // thrown, warn so a genuine rollback failure stays diagnosable.
      console.warn('[dprAdc] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
  return { success: true };
}

export async function updateDetails(details: DprAdcDetail[]) {
  // One transaction for the entire DPR detail-update batch: all detail rows
  // are updated together or none are.
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const detail of details) {
      const data: Record<string, any> = {
        Dpd_HrName: detail.Dpd_HrName || '',
        Dpd_ResultCount: detail.Dpd_ResultCount || 0,
        Dpd_ShotsResultsDenominator: detail.Dpd_ShotsResultsDenominator || 0,
        Dpd_TargetNumerator: detail.Dpd_TargetNumerator || 0,
        Dpd_TargetDenominator: detail.Dpd_TargetDenominator || 0,
        Dpd_FastShot: detail.Dpd_FastShot || 0,
        Dpd_FastShot2: detail.Dpd_FastShot2 || 0,
        Dpd_LowShot: detail.Dpd_LowShot || 0,
        Dpd_LowShot2: detail.Dpd_LowShot2 || 0,
        Dpd_DefectQty: detail.Dpd_DefectQty || 0,
        Dpd_KanbanNo: detail.Dpd_KanbanNo || '',
        Dpd_KanbanNo2: detail.Dpd_KanbanNo2 || '',
        Dpd_Judgement: detail.Dpd_Judgement || '',
        Dpd_LossTimeMins: detail.Dpd_LossTimeMins || 0,
        Dpd_LossTimeMins2: detail.Dpd_LossTimeMins2 || 0,
        Dpd_DefectContent: detail.Dpd_DefectContent || '',
        Dpd_LossTimeCode: detail.Dpd_LossTimeCode || '',
        Dpd_LossTimeCode2: detail.Dpd_LossTimeCode2 || '',
        Dpd_Abnormalities: detail.Dpd_Abnormalities || '',
        Dpd_Abnormalities2: detail.Dpd_Abnormalities2 || '',
        Dpd_WorkNo1: detail.Dpd_WorkNo1 || '',
        Dpd_WorkNo2: detail.Dpd_WorkNo2 || '',
        Dpd_DieCheck1: detail.Dpd_DieCheck1 || '',
        Dpd_DieCheck2: detail.Dpd_DieCheck2 || '',
        Dpd_QualityCheck1: detail.Dpd_QualityCheck1 || '',
        Dpd_QualityCheck2: detail.Dpd_QualityCheck2 || '',
        Dpd_CounterMeasures: detail.Dpd_CounterMeasures || '',
        Dpd_CounterMeasures2: detail.Dpd_CounterMeasures2 || '',
        Dpd_Biscuit: detail.Dpd_Biscuit || '',
        Dpd_HydOil1: detail.Dpd_HydOil1 || '',
        Dpd_HydOil2: detail.Dpd_HydOil2 || '',
        Dpd_Operator: detail.Dpd_Operator || '',
        Dpd_PIC: detail.Dpd_PIC || '',
      };
      await repo.updateDPRDetail(detail.Dpd_DPRCode, detail.Dpd_SplitSeq, data, transaction);
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
      console.warn('[dprAdc] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
  return { success: true };
}

export async function getShifts() {
  return repo.getShifts();
}

export async function getProductCodes() {
  return repo.getProductCodes();
}

export async function checkExistingHeader(filter: DprAdcFilter) {
  return repo.checkExistingHeader(filter.line, filter.shift, filter.model, filter.date);
}
