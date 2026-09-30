import sql from 'mssql';
import { env } from './env';

const dbConfig: sql.config = {
  server: env.db.server,
  database: env.db.database,
  user: env.db.user,
  // Required — provided by eon_backend/.env. Never hardcoded in source.
  password: env.db.password,
  port: env.db.port,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    min: env.db.poolMin,
    max: env.db.poolMax,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  pool = await sql.connect(dbConfig);
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool && pool.connected) {
    await pool.close();
    pool = null;
  }
}

export default sql;
