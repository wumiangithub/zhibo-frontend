import { get, post } from "./http";

export interface CaptchaData {
  captchaId: string;
  imageBase64: string;
}

export interface LoginStateData {
  state: string;
  expiresIn: number;
}

export interface AuthUser {
  id: number;
  userAccount: string;
  userName?: string;
  avatar?: string;
  /** 所在部门；多部门顿号连接。登录接口已返回，无则省略 */
  departmentName?: string;
}

/** login/query 的 data */
export interface LoginQueryData {
  status: 0 | 1 | 2 | 3;
  errorMsg: string | null;
  accessToken: string | null;
  expiresIn: number | null;
  refreshToken: string | null;
  refreshExpiresIn: number | null;
  user: AuthUser | null;
}

export interface RefreshTokenData {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

export interface LoginBody {
  userAccount: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

export function fetchCaptcha() {
  return get<CaptchaData>("/auth/captcha");
}

export function postLogin(body: LoginBody) {
  return post<LoginStateData>("/auth/login", body);
}

export function queryLoginState(state: string) {
  return get<LoginQueryData>("/auth/login/query", { params: { state } });
}

export function fetchMe() {
  return get<AuthUser>("/auth/me");
}
