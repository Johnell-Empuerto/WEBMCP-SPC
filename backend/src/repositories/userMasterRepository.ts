import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for User Master.
// Responsible for database access only — all SQL Server queries for User
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in userMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface UserListParams {
  size: number;
  offset: number;
  search: string;
  status: string;
}

/** List user records with filters + pagination. */
export async function listRecords(
  params: UserListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, status } = params;

  const conditions: string[] = ['Umt_Usercode IS NOT NULL'];
  const condParams: Array<[string, string]> = [];
  if (search) {
    conditions.push(`(
      Umt_Usercode LIKE @search0 + '%'
      OR LTRIM(RTRIM(Umt_userfname)) LIKE '%' + @search0 + '%'
      OR LTRIM(RTRIM(Umt_userlname)) LIKE '%' + @search0 + '%'
      OR Umt_Email LIKE '%' + @search0 + '%'
    )`);
    condParams.push(['search0', search]);
  }
  if (status) {
    conditions.push(`LTRIM(RTRIM(Umt_status)) = @status`);
    condParams.push(['status', status]);
  }

  const where = conditions.join(' AND ');

  const query = `
SELECT Umt_Usercode, Umt_Email, Umt_status, Umt_usersupv, Umt_usermnt,
  Umt_IsLocked, Umt_IsSystemAccount, Umt_PasswordExpired, Umt_LoginAttempts,
  Umt_UserCostCenter, Umt_Usernumber, Umt_Position, user_login, ludatetime,
  LTRIM(RTRIM(Umt_userfname)) AS fn,
  LTRIM(RTRIM(Umt_usermi)) AS mi,
  LTRIM(RTRIM(Umt_userlname)) AS ln
FROM T_UserMaster
WHERE ${where}
ORDER BY Umt_Usercode
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_UserMaster
WHERE ${where};
`;

  const pool = await getPool();

  const request = pool.request();
  request.input('offset', sql.Int, offset);
  request.input('size', sql.Int, size);
  for (const [k, v] of condParams) request.input(k, sql.VarChar, v);
  const dataResult = await request.query(query);

  const totalReq = pool.request();
  for (const [k, v] of condParams) totalReq.input(k, sql.VarChar, v);
  const totalResult = await totalReq.query(totalQuery);

  const rows = dataResult.recordset ?? [];
  const totalItems = Number(totalResult.recordset?.[0]?.TotalCount ?? 0);

  return { rows, totalItems };
}

/** Duplicate user code check. Returns true if the code exists. */
export async function checkCodeExists(usercode: string): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('usercode', sql.VarChar, usercode);
  const result = await request.query(`
SELECT COUNT(*) AS n
FROM T_UserMaster
WHERE Umt_Usercode = @usercode;
`);
  return Number(result.recordset?.[0]?.n ?? 0) > 0;
}

/** Insert a new user (legacy md5Prefix hash is applied by the service). */
export async function insertRecord(params: {
  usercode: string;
  passwordHash: string;
  fname: string;
  mi: string;
  lname: string;
  email: string;
  position: string;
  costcenter: string | null;
  usernumber: string | null;
  status: string;
  usermnt: boolean;
  usersupv: boolean;
  userlogin: string;
}): Promise<void> {
  const pool = await getPool();
  const request = pool.request();
  request.input('usercode', sql.VarChar, params.usercode);
  request.input('password', sql.VarChar, params.passwordHash);
  request.input('fname', sql.VarChar, params.fname);
  request.input('mi', sql.VarChar, params.mi);
  request.input('lname', sql.VarChar, params.lname);
  request.input('email', sql.VarChar, params.email);
  request.input('position', sql.VarChar, params.position);
  request.input('costcenter', sql.Char, params.costcenter);
  request.input('usernumber', sql.Char, params.usernumber);
  request.input('status', sql.Char, params.status);
  request.input('usermnt', sql.Bit, params.usermnt ? 1 : 0);
  request.input('usersupv', sql.Bit, params.usersupv ? 1 : 0);
  request.input('userlogin', sql.VarChar, params.userlogin);

  await request.query(`
INSERT INTO T_UserMaster
  (Umt_Usercode, Umt_Userpswd, Umt_userlname, Umt_userfname, Umt_usermi,
   Umt_Email, Umt_Position, Umt_UserCostCenter, Umt_Usernumber, Umt_status,
   Umt_usermnt, Umt_usersupv, Umt_IsLocked, Umt_IsSystemAccount,
   Umt_PasswordExpired, Umt_LoginAttempts, Umt_PasswordChangeDate,
   user_login, ludatetime)
VALUES
  (@usercode, @password, @lname, @fname, @mi,
   @email, @position, @costcenter, @usernumber, @status,
   @usermnt, @usersupv, 0, 0,
   0, 0, GETDATE(),
   @userlogin, GETDATE());
`);
}

/**
 * Update a user keyed on Umt_Usercode (code immutable).
 * password is optional — when provided it resets the password hash.
 * Returns affected rows (0 → not found).
 */
export async function updateRecord(params: {
  usercode: string;
  fname: string;
  mi: string;
  lname: string;
  email: string;
  position: string;
  costcenter: string | null;
  usernumber: string | null;
  status: string;
  usermnt: boolean;
  usersupv: boolean;
  userlogin: string;
  passwordHash: string | null;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('usercode', sql.VarChar, params.usercode);
  request.input('fname', sql.VarChar, params.fname);
  request.input('mi', sql.VarChar, params.mi);
  request.input('lname', sql.VarChar, params.lname);
  request.input('email', sql.VarChar, params.email);
  request.input('position', sql.VarChar, params.position);
  request.input('costcenter', sql.Char, params.costcenter);
  request.input('usernumber', sql.Char, params.usernumber);
  request.input('status', sql.Char, params.status);
  request.input('usermnt', sql.Bit, params.usermnt ? 1 : 0);
  request.input('usersupv', sql.Bit, params.usersupv ? 1 : 0);
  request.input('userlogin', sql.VarChar, params.userlogin);

  const params2 = [
    `Umt_userlname = @lname`,
    `Umt_userfname = @fname`,
    `Umt_usermi = @mi`,
    `Umt_Email = @email`,
    `Umt_Position = @position`,
    `Umt_UserCostCenter = @costcenter`,
    `Umt_Usernumber = @usernumber`,
    `Umt_status = @status`,
    `Umt_usermnt = @usermnt`,
    `Umt_usersupv = @usersupv`,
    `user_login = @userlogin`,
    `ludatetime = GETDATE()`,
  ];

  if (params.passwordHash) {
    request.input('newpassword', sql.VarChar, params.passwordHash);
    params2.push(`Umt_Userpswd = @newpassword`);
    params2.push(`Umt_PasswordExpired = 0`);
    params2.push(`Umt_PasswordChangeDate = GETDATE()`);
  }

  const result = await request.query(`
UPDATE T_UserMaster
SET ${params2.join(', ')}
WHERE Umt_Usercode = @usercode;
`);
  return result.rowsAffected?.[0] ?? 0;
}

/** Fetch the system-account flag for a user (delete guard). Returns undefined when not found. */
export async function getSystemAccountFlag(usercode: string): Promise<any | undefined> {
  const pool = await getPool();
  const sysReq = pool.request();
  sysReq.input('usercode', sql.VarChar, usercode);
  const sysResult = await sysReq.query(`
SELECT Umt_IsSystemAccount
FROM T_UserMaster
WHERE Umt_Usercode = @usercode;
`);
  return sysResult.recordset?.[0];
}

// Tables that reference a user code — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['T_MasterDprGroupLeader', 'md_Usercode'],
  ['T_MasterDprInspector', 'md_Usercode'],
  ['T_MasterDprLeadMan', 'md_Usercode'],
  ['T_MasterDprLineChecker', 'md_Usercode'],
  ['T_MasterDprTeamLeader', 'md_Usercode'],
  ['T_SavedUserView', 'Suv_UserCode'],
  ['T_SchedulerServiceEmailRecipient', 'Sse_UserCode'],
  ['T_UserGroupDetail', 'Ugd_usercode'],
  ['T_UserViewQueryMaster', 'Uvq_Usercode'],
];

/**
 * Check every referencing table for the user code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(usercode: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('usercode', sql.VarChar, usercode);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE LTRIM(RTRIM(${col})) = @usercode`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/** Hard-delete a user keyed on Umt_Usercode. */
export async function deleteRecord(usercode: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('usercode', sql.VarChar, usercode);
  const result = await request.query(`
DELETE FROM T_UserMaster
WHERE Umt_Usercode = @usercode;
`);
  return result.rowsAffected?.[0] ?? 0;
}
