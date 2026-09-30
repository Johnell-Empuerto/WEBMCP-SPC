import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Settings.
// Responsible for database access only — all SQL Server queries for Settings
// live in this file. No HTTP concerns, no business rules.
// Business logic belongs in settingsService.ts.
// ════════════════════════════════════════════════════════════════════════════
//
// The session-timeout setting is a SYSTEM-WIDE administrative setting stored in
// the existing T_ParameterMaster key/value configuration table:
//   ParameterID = 'SESSIONTIMEOUT', Seq = 0, Desc = 'Session Timeout (minutes)',
//   Value = minutes as string (15 | 30 | 60 | 120 | 240 | 480).

/** Read the raw stored session-timeout value (may be undefined). */
export async function getSessionTimeoutValue(): Promise<string | undefined> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('parameterId', sql.VarChar, 'SESSIONTIMEOUT')
    .query(`
      SELECT Pmt_StringValue
      FROM T_ParameterMaster
      WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterId
        AND Pmt_ParameterSeq = 0
    `);
  return result.recordset[0]?.Pmt_StringValue as string | undefined;
}

/** Count existing SESSIONTIMEOUT rows (decides UPDATE vs INSERT). */
export async function countSessionTimeout(): Promise<number> {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('parameterId', sql.VarChar, 'SESSIONTIMEOUT')
    .query(`
      SELECT COUNT(*) AS n
      FROM T_ParameterMaster
      WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterId
        AND Pmt_ParameterSeq = 0
    `);
  return Number(existing.recordset[0]?.n ?? 0);
}

/** Update the existing SESSIONTIMEOUT value (with audit trail). */
export async function updateSessionTimeout(minutes: number, userLogin: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('parameterId', sql.VarChar, 'SESSIONTIMEOUT')
    .input('value', sql.Char, String(minutes))
    .input('userLogin', sql.Char, userLogin)
    .query(`
      UPDATE T_ParameterMaster
      SET Pmt_StringValue = @value, User_login = @userLogin, ludatetime = GETDATE()
      WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterId
        AND Pmt_ParameterSeq = 0
    `);
}

/** Insert the SESSIONTIMEOUT row (first time the setting is written). */
export async function insertSessionTimeout(minutes: number, userLogin: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('parameterId', sql.Char, 'SESSIONTIMEOUT')
    .input('seq', sql.Int, 0)
    .input('desc', sql.Char, 'Session Timeout (minutes)')
    .input('value', sql.Char, String(minutes))
    .input('userLogin', sql.Char, userLogin)
    .query(`
      INSERT INTO T_ParameterMaster
        (Pmt_ParameterID, Pmt_ParameterSeq, Pmt_ParameterDesc, Pmt_StringValue, Pmt_Status, User_login, ludatetime)
      VALUES
        (@parameterId, @seq, @desc, @value, 'A', @userLogin, GETDATE())
    `);
}
