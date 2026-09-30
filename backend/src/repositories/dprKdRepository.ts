import sql, { getPool } from '../config/database';

// ────────────────────────────────────────────────────────────────────────────
// Legacy: getKDDistinctDieNo — count of distinct die no (SUBSTRING 13) for
// the KD line. Note the position is 12 for line ('5') and 13 for the die no,
// exactly like the legacy Node-RED distinctCount function.
// ────────────────────────────────────────────────────────────────────────────
export async function getDistinctDieNo(
  model: string, shift: string, date: string
): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('date', sql.Date, date)
    .input('model', sql.NVarChar, model)
    .input('shift', sql.NVarChar, shift)
    .query(`
      SELECT COUNT(DISTINCT SUBSTRING(Pth_ProductLotNo, 13, 1)) as counter
      FROM T_TravelogHeader
      LEFT JOIN T_TravelogDetail
        ON Pth_TravelogNo = Ptd_TravelogNo
         AND Ptd_ProcessCode = 08
      LEFT JOIN T_CostCenter
        ON Cct_CostCenterCode = Pth_TargetCostCenter
      LEFT JOIN T_SectionCodeMaster
        ON Scm_Sectioncode = Cct_Sectioncode
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND Scm_SectionHead = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = '5'
    `);
  return result.recordset[0]?.counter ?? 0;
}

// Legacy: getKDDieNo — single distinct die no for the KD line.
export async function getDieNo(
  model: string, shift: string, date: string
): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input('date', sql.Date, date)
    .input('model', sql.NVarChar, model)
    .input('shift', sql.NVarChar, shift)
    .query(`
      SELECT DISTINCT SUBSTRING(Pth_ProductLotNo, 13, 1) AS dieNo
      FROM T_TravelogHeader
      LEFT JOIN T_TravelogDetail
        ON Pth_TravelogNo = Ptd_TravelogNo
         AND Ptd_ProcessCode = 08
      LEFT JOIN T_CostCenter
        ON Cct_CostCenterCode = Pth_TargetCostCenter
      LEFT JOIN T_SectionCodeMaster
        ON Scm_Sectioncode = Cct_Sectioncode
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND Scm_SectionHead = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = '5'
    `);
  return result.recordset[0]?.dieNo ?? null;
}

// Legacy: getDPRHeader — E_DPRHeader lookup by KD line + shift + model + date.
export async function getDPRKDHeader(
  line: string, shift: string, model: string, date: string
): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('line', sql.NVarChar, line)
    .input('shift', sql.NVarChar, shift)
    .input('model', sql.NVarChar, model)
    .input('date', sql.Date, date)
    .query(`
      SELECT * FROM E_DPRHeader
      WHERE Dph_Line = @line
        AND Dph_ShiftCode = @shift
        AND Dph_ProductCode = @model
        AND Dph_PlanDate = @date
    `);
  return result.recordset;
}

// Legacy: getDPRDetails — E_DPRDetail rows for the header code.
export async function getDPRKDDetails(dprCode: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dprCode', sql.NVarChar, dprCode)
    .query(`SELECT * FROM E_DPRDetail WHERE Dpd_DPRCode = @dprCode ORDER BY Dpd_SplitSeq`);
  return result.recordset;
}

// Legacy: searchDPRMaster — E_DPRMaster for the KD line (Dpm_Line = 'KD').
export async function getDPRKDMaster(model: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('model', sql.NVarChar, model)
    .query(`SELECT * FROM E_DPRMaster WHERE Dpm_ProductCode = @model AND Dpm_Line = 'KD'`);
  return result.recordset;
}

// Legacy: searchPerMachine — GetDPR_C4KDShiftWorkHours per hour slice with the
// KD table name passed as @KD. Verified against the live SP parameter list:
// @DieNo, @Shift, @Date, @Line, @Model, @StartHr, @EndHr, @TimeInterval, @KD
export async function getDPRKDShiftWorkHours(
  dieNo: string, shift: string, date: string, line: string,
  model: string, startHr: number, endHr: number, timeInterval: number, kd: string
): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dieNo', sql.NVarChar, dieNo)
    .input('shift', sql.NVarChar, shift)
    .input('date', sql.Date, date)
    .input('line', sql.NVarChar, line)
    .input('model', sql.NVarChar, model)
    .input('startHr', sql.Int, startHr)
    .input('endHr', sql.Int, endHr)
    .input('timeInterval', sql.Int, timeInterval)
    .input('kd', sql.NVarChar, kd ?? '')
    .query(`EXEC [dbo].[GetDPR_C4KDShiftWorkHours] @dieNo, @shift, @date, @line, @model, @startHr, @endHr, @timeInterval, @kd`);
  return result.recordset;
}

// Legacy: searchDPRMaster (code generator) — CONCAT(internal code, '-', yyyyMMdd, seq)
export async function generateDPRKDCode(model: string): Promise<string> {
  const pool = await getPool();
  const result = await pool.request()
    .input('model', sql.NVarChar, model)
    .query(`
      SELECT CONCAT(
        (SELECT TRIM(Pmt_InternalProdCode) FROM T_ProductMaster WHERE Pmt_ProductCode = @model),
        '-', FORMAT(GETDATE(), 'yyyyMMdd'),
        FORMAT(COUNT(*)+1, '000')
      ) as code
      FROM E_DPRHeader
      WHERE SUBSTRING(Dph_DPRCode, 5, 8) = FORMAT(GETDATE(), 'yyyyMMdd')
    `);
  return result.recordset[0]?.code ?? 'KD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-001';
}

// Legacy: checkExisting — exists guard for insert (KD line).
export async function checkExistingKDHeader(
  line: string, shift: string, model: string, date: string
): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input('line', sql.NVarChar, line)
    .input('shift', sql.NVarChar, shift)
    .input('model', sql.NVarChar, model)
    .input('date', sql.Date, date)
    .query(`
      SELECT Dph_DPRCode FROM E_DPRHeader
      WHERE Dph_PlanDate = @date
        AND Dph_ShiftCode = @shift
        AND Dph_Line = @line
        AND Dph_ProductCode = @model
    `);
  return result.recordset[0]?.Dph_DPRCode ?? null;
}

export async function insertDPRKDHeader(data: Record<string, any>): Promise<any> {
  const pool = await getPool();
  const fields = Object.keys(data);
  const values = fields.map(f => `@${f}`);
  const query = `INSERT INTO E_DPRHeader (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  const request = pool.request();
  fields.forEach(f => {
    const val = data[f];
    if (val === null || val === undefined) {
      request.input(f, sql.NVarChar, null);
    } else if (typeof val === 'number') {
      request.input(f, sql.Int, val);
    } else {
      request.input(f, sql.NVarChar, String(val));
    }
  });
  return request.query(query);
}

export async function updateDPRKDHeaderByCode(dprCode: string, data: Record<string, any>): Promise<any> {
  const pool = await getPool();
  const request = pool.request();
  // Values are bound as parameters — never interpolated into the SQL string.
  const setClauses = Object.keys(data)
    .filter(k => k !== 'Dph_DPRCode' && k !== 'Dph_Line' && k !== 'Dph_ProductCode' && k !== 'Dph_PlanDate' && k !== 'Dph_ShiftCode')
    .map((k, i) => {
      const val = data[k];
      if (val === null || val === undefined) {
        request.input(`p${i}`, sql.NVarChar, null);
      } else if (typeof val === 'number') {
        request.input(`p${i}`, sql.Float, val);
      } else {
        request.input(`p${i}`, sql.NVarChar, String(val));
      }
      return `${k} = @p${i}`;
    });
  request.input('dprCode', sql.NVarChar, dprCode);
  const query = `UPDATE E_DPRHeader SET ${setClauses.join(', ')} WHERE Dph_DPRCode = @dprCode`;
  return request.query(query);
}

// Detail-row writes accept an optional mssql Transaction. When one is provided
// the query runs inside that transaction (used by the service to save ALL DPR
// detail rows atomically); otherwise it runs on the shared pool.
export async function insertDPRKDDetail(data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
  const request = transaction ? transaction.request() : (await getPool()).request();
  const fields = Object.keys(data);
  const values = fields.map(f => `@${f}`);
  const query = `INSERT INTO E_DPRDetail (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  fields.forEach(f => {
    const val = data[f];
    if (val === null || val === undefined) {
      request.input(f, sql.NVarChar, null);
    } else if (typeof val === 'number') {
      request.input(f, sql.Int, val);
    } else {
      request.input(f, sql.NVarChar, String(val));
    }
  });
  return request.query(query);
}

export async function updateDPRKDDetailByCode(dprCode: string, splitSeq: number, data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
  const request = transaction ? transaction.request() : (await getPool()).request();
  // Values are bound as parameters — never interpolated into the SQL string.
  const setClauses = Object.keys(data)
    .filter(k => k !== 'Dpd_DPRCode' && k !== 'Dpd_SplitSeq')
    .map((k, i) => {
      const val = data[k];
      if (val === null || val === undefined) {
        request.input(`p${i}`, sql.NVarChar, null);
      } else if (typeof val === 'number') {
        request.input(`p${i}`, sql.Float, val);
      } else {
        request.input(`p${i}`, sql.NVarChar, String(val));
      }
      return `${k} = @p${i}`;
    });
  request.input('dprCode', sql.NVarChar, dprCode);
  request.input('splitSeq', sql.Int, splitSeq);
  const query = `UPDATE E_DPRDetail SET ${setClauses.join(', ')} WHERE Dpd_DPRCode = @dprCode AND Dpd_SplitSeq = @splitSeq`;
  return request.query(query);
}

export async function getTeamLeaders(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM T_MasterDprTeamLeader WHERE md_status <> 'I'`);
  return result.recordset;
}

export async function getGroupLeaders(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM T_MasterDprGroupLeader WHERE md_status <> 'I'`);
  return result.recordset;
}

export async function getLineCheckers(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM T_MasterDprLineChecker WHERE md_status <> 'I'`);
  return result.recordset;
}

export async function getShifts(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .query(`
      SELECT Scm_ShiftCode, Scm_ShiftDesc FROM T_ShiftCodeMaster
      ORDER BY Scm_ShiftCode ASC
    `);
  return result.recordset;
}
