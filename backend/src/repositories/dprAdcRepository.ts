import sql, { getPool } from '../config/database';

export async function getDistinctDieNo(
  line: string, model: string, shift: string, date: string
): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('date', sql.Date, date)
    .input('model', sql.NVarChar, model)
    .input('shift', sql.NVarChar, shift)
    .input('line', sql.NVarChar, line)
    .query(`
      SELECT COUNT(DISTINCT SUBSTRING(Pth_ProductLotNo, 13, 1)) as counter
      FROM T_TravelogHeader
      LEFT JOIN T_TravelogDetail ON Pth_TravelogNo = Ptd_TravelogNo AND Ptd_ProcessCode = 00
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND (SELECT Shift_Name FROM dbo.GetShiftDateF(Ptd_InputActualDate)) = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = @line
    `);
  return result.recordset[0]?.counter ?? 0;
}

export async function getDieNo(
  line: string, model: string, shift: string, date: string
): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input('date', sql.Date, date)
    .input('model', sql.NVarChar, model)
    .input('shift', sql.NVarChar, shift)
    .input('line', sql.NVarChar, line)
    .query(`
      SELECT DISTINCT SUBSTRING(Pth_ProductLotNo, 13, 1) AS dieNo
      FROM T_TravelogHeader
      LEFT JOIN T_TravelogDetail ON Pth_TravelogNo = Ptd_TravelogNo AND Ptd_ProcessCode = 00
      WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, @date)
        AND Pth_ProductCode = @model
        AND (SELECT Shift_Name FROM dbo.GetShiftDateF(Ptd_InputActualDate)) = @shift
        AND SUBSTRING(Pth_ProductLotNo, 12, 1) = @line
    `);
  return result.recordset[0]?.dieNo ?? null;
}

export async function getDPRHeader(
  line: string, shift: string, model: string, dieNo: string, date: string
): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('line', sql.NVarChar, line)
    .input('shift', sql.NVarChar, shift)
    .input('model', sql.NVarChar, model)
    .input('dieNo', sql.NVarChar, dieNo)
    .input('date', sql.Date, date)
    .query(`
      SELECT * FROM E_DPRHeader
      WHERE Dph_Line = @line
        AND Dph_ShiftCode = @shift
        AND Dph_ProductCode = @model
        AND Dph_DieNo = @dieNo
        AND Dph_PlanDate = @date
    `);
  return result.recordset;
}

export async function getDPRDetails(dprCode: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dprCode', sql.NVarChar, dprCode)
    .query(`SELECT * FROM E_DPRDetail WHERE Dpd_DPRCode = @dprCode ORDER BY Dpd_SplitSeq`);
  return result.recordset;
}

export async function getDPRShiftWorkHours(
  dieNo: string, shift: string, date: string, line: string,
  model: string, i: number, x: number, timeInterval: number
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
    .query(`EXEC [dbo].[GetDPRShiftWorkHours] @dieNo, @shift, @date, @line, @model, @i, @x, @timeInterval`);
  return result.recordset;
}

export async function getDPRTimeInterval(): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .query(`SELECT TOP 1 Dpm_DPRTimeInterval FROM E_DPRMaster`);
  return result.recordset[0]?.Dpm_DPRTimeInterval ?? 60;
}

export async function generateDPRCode(model: string): Promise<string> {
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
  return result.recordset[0]?.code ?? 'ADC-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-001';
}

export async function insertDPRHeader(data: Record<string, any>): Promise<any> {
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

export async function updateDPRHeader(
  line: string, shift: string, model: string, dieNo: string, date: string,
  data: Record<string, any>
): Promise<any> {
  const pool = await getPool();
  const request = pool.request();
  // Values are bound as parameters — never interpolated into the SQL string.
  const setClauses = Object.keys(data)
    .filter(k => k !== 'Dph_Line' && k !== 'Dph_ShiftCode' && k !== 'Dph_ProductCode' && k !== 'Dph_DieNo' && k !== 'Dph_PlanDate')
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
  request.input('line', sql.NVarChar, line);
  request.input('shift', sql.NVarChar, shift);
  request.input('model', sql.NVarChar, model);
  request.input('dieNo', sql.NVarChar, dieNo);
  request.input('date', sql.Date, date);
  const query = `UPDATE E_DPRHeader SET ${setClauses.join(', ')} WHERE Dph_Line = @line AND Dph_ShiftCode = @shift AND Dph_ProductCode = @model AND Dph_DieNo = @dieNo AND Dph_PlanDate = @date`;
  return request.query(query);
}

// Detail-row writes accept an optional mssql Transaction. When one is provided
// the query runs inside that transaction (used by the service to save ALL DPR
// detail rows atomically); otherwise it runs on the shared pool.
export async function insertDPRDetail(data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
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

export async function updateDPRDetail(dprCode: string, splitSeq: number, data: Record<string, any>, transaction?: sql.Transaction): Promise<any> {
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

export async function getShifts(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .query(`
      SELECT Scm_ShiftCode, Scm_ShiftDesc FROM T_ShiftCodeMaster
      ORDER BY Scm_ShiftCode ASC
    `);
  return result.recordset;
}

export async function getProductCodes(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .query(`SELECT DISTINCT Pmt_ProductCode, Pmt_ProductDesc FROM T_ProductMaster WHERE Pmt_Status = 'Active'`);
  return result.recordset;
}

export async function checkExistingHeader(
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
