import { getPool } from '../src/config/database.ts';

async function main() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 10 Umt_Usercode, Umt_userfname, Umt_userlname, Umt_usermnt, Umt_usersupv, Umt_status
    FROM T_UserMaster
    WHERE Umt_status = 'A'
    ORDER BY Umt_Usercode
  `);
  console.log('USERS:', JSON.stringify(result.recordset, null, 2));
  await pool.close();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
