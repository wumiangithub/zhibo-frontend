import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/utils/authSession";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";

export class AuthRefreshError extends Error {
  code: number;
  constructor(msg: string, code: number) {
    super(msg);
    this.name = "AuthRefreshError";
    this.code = code;
  }
}

/** 并发 401 共用同一次换票 */
let inflight: Promise<string> | null = null;

/** 解析 JWT payload 的 exp（不做验签；仅判断是否该先换票） */
export function isAccessExpired(token: string, skewSec = 30): boolean {
  try {
    const seg = token.split(".")[1];
    if (!seg) return true;
    const json = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + skewSec * 1000;
  } catch {
    return true;
  }
}

/**
 * 调 POST /api/v1/auth/refresh（白名单，不走本站鉴权拦截器逻辑）。
 * 成功写入新 access + refresh，返回新 access。
 */
export function refreshAccessToken(): Promise<string> {
  if (inflight) return inflight;
  inflight = doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<string> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!accessToken || !refreshToken) {
    throw new AuthRefreshError("无 refresh，需重新登录", 401);
  }

  let resp;
  try {
    resp = await axios.post(
      "/api/v1/auth/refresh",
      { accessToken, refreshToken },
      { timeout: 15000 },
    );
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      throw new AuthRefreshError("刷新登录态失败", status);
    }
    throw new AuthRefreshError(
      axiosErrorMessage(e, "刷新登录态网络错误"),
      -1,
    );
  }

  const body = resp.data as {
    code?: number;
    msg?: string;
    data?: {
      accessToken?: string;
      refreshToken?: string;
    };
  };

  if (body?.code !== 0 || !body.data?.accessToken || !body.data?.refreshToken) {
    throw new AuthRefreshError(
      body?.msg ?? "刷新登录态失败",
      body?.code ?? 401,
    );
  }

  setTokens(body.data.accessToken, body.data.refreshToken);
  notifyAccessUpdated(body.data.accessToken);
  return body.data.accessToken;
}

/** 订单中心等直连前：access 将过期则先换票 */
export async function ensureFreshAccess(): Promise<string> {
  const access = getAccessToken();
  if (!access) throw new AuthRefreshError("未登录", 401);
  if (!isAccessExpired(access)) return access;
  if (!getRefreshToken()) throw new AuthRefreshError("无 refresh，需重新登录", 401);
  return refreshAccessToken();
}

type AccessListener = (accessToken: string) => void;
const listeners = new Set<AccessListener>();

export function onAccessTokenUpdated(listener: AccessListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyAccessUpdated(accessToken: string) {
  for (const fn of listeners) {
    try {
      fn(accessToken);
    } catch {
      /* ignore */
    }
  }
}
