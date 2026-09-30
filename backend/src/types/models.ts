export interface User {
  usercode: string;
  password: string;
  usernumber: string;
  lastname: string;
  firstname: string;
  middlename: string;
  position: string;
  email: string;
  isSupervisor: boolean;
  isMaintenance: boolean;
  status: string;
  isLocked: boolean;
  loginAttempts: number;
  passwordExpired: boolean;
  passwordChangeDate: Date | null;
}

export interface LoginRequest {
  userCode: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    userCode: string;
    userName: string;
    email: string;
    roleId: number;
    roleName: string;
  };
}

export interface JwtPayload {
  userCode: string;
  userName: string;
  roleId: number;
  roleName: string;
}
