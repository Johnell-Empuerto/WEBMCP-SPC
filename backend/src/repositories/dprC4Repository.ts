import sql, { getPool } from '../config/database';

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
         AND Ptd_ProcessCode = 07
      LEFT JOIN T_CostCenter
        ON Cct_CostCenterCode = Pth_TargetCostCenter
      LEFT JOIN T_SectionCodeMaster
        ON Scm_Sectioncode = Cct_Sectioncode
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND Scm_SectionHead = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = '4'
    `);
  return result.recordset[0]?.counter ?? 0;
}

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
         AND Ptd_ProcessCode = 07
      LEFT JOIN T_CostCenter
        ON Cct_CostCenterCode = Pth_TargetCostCenter
      LEFT JOIN T_SectionCodeMaster
        ON Scm_Sectioncode = Cct_Sectioncode
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND Scm_SectionHead = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = '4'
    `);
  return result.recordset[0]?.dieNo ?? null;
}

export async function getDPRC4Header(
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

export async function getDPRC4Details(dprCode: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dprCode', sql.NVarChar, dprCode)
    .query(`SELECT * FROM E_DPRDetail WHERE Dpd_DPRCode = @dprCode ORDER BY Dpd_SplitSeq`);
  return result.recordset;
}

export async function getDPRC4Master(model: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('model', sql.NVarChar, model)
    .query(`SELECT * FROM E_DPRMaster WHERE Dpm_ProductCode = @model AND Dpm_Line = 'C4'`);
  return result.recordset;
}

export async function getDPRC4ShiftWorkHours(
  dieNo: string, shift: string, date: string, line: string,
  model: string, i: number, x: number, timeInterval: number, kd?: string
): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dieNo', sql.NVarChar, dieNo)
    .input('shift', sql.NVarChar, shift)
    .input('date', sql.Date, date)
    .input('line', sql.NVarChar, line)
    .input('model', sql.NVarChar, model)
    .input('i', sql.Int, i)
    .input('x', sql.Int, x)
    .input('timeInterval', sql.Int, timeInterval)
    .input('kd', sql.NVarChar, kd ?? '')
    .query(`EXEC [dbo].[GetDPR_C4KDShiftWorkHours] @dieNo, @shift, @date, @line, @model, @i, @x, @timeInterval, @kd`);
  return result.recordset;
}

// Single-query replacement for the 8x sequential SP calls in mergeSPProduction.
// Fetches all 8 hour-buckets for a shift in one query instead of calling
// GetDPR_C4KDShiftWorkHours 8 times.
export async function getDPRC4ShiftWorkHoursAll(
  dieNo: string, shift: string, date: string, line: string,
  model: string, timeInterval: number
): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request()
    .input('dieNo', sql.NVarChar, dieNo)
    .input('shift', sql.NVarChar, shift)
    .input('date', sql.Date, date)
    .input('line', sql.NVarChar, line)
    .input('model', sql.NVarChar, model)
    .input('timeInterval', sql.Int, timeInterval);

  const result = await request.query(`
    WITH ShiftTime AS (
      SELECT
        Scm_ShiftTimeIn,
        ((Scm_ShiftTimeIn / 100) * 60 + (Scm_ShiftTimeIn % 100)) AS StartMin
      FROM T_ShiftCodeMaster
      WHERE Scm_ShiftCode = @shift
    ),
    HourBuckets AS (
      SELECT
        v.*,
        CAST((DATEPART(HOUR, v.Ptd_InputActualDate) * 60) + DATEPART(MINUTE, v.Ptd_InputActualDate) AS INT) AS ActualMin
      FROM V_ActualProductionInfo v
      INNER JOIN ShiftTime st ON st.Scm_ShiftCode = v.Scm_ShiftCode
      WHERE v.Machine_Line = @line
        AND CONVERT(DATE, v.Pth_ReqInputDate) = @date
        AND v.Scm_ShiftCode = @shift
        AND v.Pth_ProductCode = @model
        AND st.StartMin + (@timeInterval * 0) <= CAST((DATEPART(HOUR, v.Ptd_InputActualDate) * 60) + DATEPART(MINUTE, v.Ptd_InputActualDate) AS INT)
        AND CAST((DATEPART(HOUR, v.Ptd_InputActualDate) * 60) + DATEPART(MINUTE, v.Ptd_InputActualDate) AS INT) < st.StartMin + (@timeInterval * 8)
        ${dieNo ? `AND SUBSTRING(v.Pth_ProductLotNo, 13, 1) = @dieNo` : ''}
    )
    SELECT
      (FLOOR((hb.ActualMin - st.StartMin) / @timeInterval) + 1) AS Dpd_SplitSeq,
      COUNT(*) AS Dpd_ResultCount,
      SUM(hb.Ng_Stat) AS Dpd_DefectQty,
      STRING_AGG(hb.Ptm_ManpowerCode, ',') AS Ptm_ManpowerCode
    FROM HourBuckets hb
    CROSS JOIN ShiftTime st
    GROUP BY FLOOR((hb.ActualMin - st.StartMin) / @timeInterval) + 1
    ORDER BY Dpd_SplitSeq
  `);

  return result.recordset ?? [];
}

export async function generateDPRC4Code(model: string): Promise<string> {
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
  return result.recordset[0]?.code ?? 'C4-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-001';
}

export async function checkExistingC4Header(
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

export async function insertDPRC4Header(data: Record<string, any>): Promise<any> {
  const pool = await getPool();
  const fields = Object.keys(data);
  const values = fields.map((f, i) => `@${f}`);
  const query = `INSERT INTO E_DPRHeader (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  const request = pool.request();
  fields.forEach(f => {
    const val = data[f];
    if (val === null || val === undefined) {
      request.input(f, sql.NVarChar, null);
    } else if (typeof val === 'number') {
      request.input(f, sql.Float, val);
    } else {
      request.input(f, sql.NVarChar, String(val));
    }
  });
  return request.query(query);
}

export async function updateDPRC4HeaderByCode(dprCode: string, data: Record<string, any>): Promise<any> {
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
export async function insertDPRC4Detail(data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
  const request = transaction ? transaction.request() : (await getPool()).request();
  const fields = Object.keys(data);
  const values = fields.map((f, i) => `@${f}`);
  const query = `INSERT INTO E_DPRDetail (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  fields.forEach(f => {
    const val = data[f];
    if (val === null || val === undefined) {
      request.input(f, sql.NVarChar, null);
    } else if (typeof val === 'number') {
      request.input(f, sql.Float, val);
    } else {
      request.input(f, sql.NVarChar, String(val));
    }
  });
  return request.query(query);
}

export async function updateDPRC4DetailByCode(dprCode: string, splitSeq: number, data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
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
