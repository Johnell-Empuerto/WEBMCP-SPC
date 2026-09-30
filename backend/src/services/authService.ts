import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';
import { LoginResponse, JwtPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';
import { env } from '../config/env';

// JWT settings come from eon_backend/.env (see config/env.ts). No fallbacks.
const JWT_SECRET = env.jwt.secret;
const JWT_EXPIRES_IN = env.jwt.accessExpiresIn;
const JWT_REFRESH_EXPIRES_IN = env.jwt.refreshExpiresIn;

function md5Prefix(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex').toUpperCase().slice(0, 14);
}

function mapRole(record: Record<string, unknown>): { roleId: number; roleName: string } {
  if (record.Umt_usermnt === true || record.Umt_usermnt === 1) {
    return { roleId: 1, roleName: 'Super Admin' };
  }
  if (record.Umt_usersupv === true || record.Umt_usersupv === 1) {
    return { roleId: 2, roleName: 'Admin' };
  }
  return { roleId: 3, roleName: 'User' };
}

function buildUserName(record: Record<string, unknown>): string {
  const parts = [record.Umt_userfname, record.Umt_usermi, record.Umt_userlname].filter(Boolean);
  return parts.join(' ') || (record.Umt_Usercode as string);
}

export class AuthService {
  async login(userCode: string, password: string): Promise<LoginResponse> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('UserCode', userCode)
      .query(`
        SELECT *
        FROM T_UserMaster
        WHERE Umt_Usercode = @UserCode
          AND Umt_status = 'A'
          AND (Umt_IsLocked IS NULL OR Umt_IsLocked = 0)
      `);

    const record = result.recordset[0] as Record<string, unknown> | undefined;

    if (!record) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const storedHash = record.Umt_Userpswd as string;
    const computedHash = md5Prefix(password);

    if (storedHash !== computedHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { roleId, roleName } = mapRole(record);
    const userName = buildUserName(record);
    const email = (record.Umt_Email as string) || '';

    const payload: JwtPayload = {
      userCode: record.Umt_Usercode as string,
      userName,
      roleId,
      roleName,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    });

    return {
      token,
      refreshToken,
      user: {
        userCode: record.Umt_Usercode as string,
        userName,
        email,
        roleId,
        roleName,
      },
    };
  }

  async refreshToken(token: string): Promise<LoginResponse> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const pool = await getPool();
      const result = await pool
        .request()
        .input('UserCode', decoded.userCode)
        .query(`
          SELECT *
          FROM T_UserMaster
          WHERE Umt_Usercode = @UserCode
            AND Umt_status = 'A'
            AND (Umt_IsLocked IS NULL OR Umt_IsLocked = 0)
        `);

      const record = result.recordset[0] as Record<string, unknown> | undefined;
      if (!record) {
        throw new UnauthorizedError('User not found');
      }

      const { roleId, roleName } = mapRole(record);
      const userName = buildUserName(record);
      const email = (record.Umt_Email as string) || '';

      const payload: JwtPayload = {
        userCode: decoded.userCode,
        userName,
        roleId,
        roleName,
      };

      const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      const newRefreshToken = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
      });

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user: {
          userCode: decoded.userCode,
          userName,
          email,
          roleId,
          roleName,
        },
      };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async getProfile(userCode: string) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('UserCode', userCode)
      .query(`
        SELECT *
        FROM T_UserMaster
        WHERE Umt_Usercode = @UserCode
      `);

    const record = result.recordset[0] as Record<string, unknown> | undefined;
    if (!record) return null;

    const { roleId, roleName } = mapRole(record);
    const userName = buildUserName(record);
    const email = (record.Umt_Email as string) || '';

    return {
      userCode: record.Umt_Usercode as string,
      userName,
      email,
      roleId,
      roleName,
      status: record.Umt_status as string,
      position: record.Umt_Position as string,
      isLocked: record.Umt_IsLocked,
      isSupervisor: record.Umt_usersupv,
      isMaintenance: record.Umt_usermnt,
    };
  }
}

export const authService = new AuthService();
