import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { clearSession, getAccessToken, getRefreshToken } from "@/utils/authSession";
import { AuthRefreshError, refreshAccessToken } from "@/utils/authRefresh";

export interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

export class ApiError extends Error {
  code: number;
  constructor(msg: string, code: number) {
    super(msg);
    this.name = "ApiError";
    this.code = code;
  }
}

/** 本请求遇到 401 时不要走静默换票（刷新接口自身、登录白名单） */
export type AuthRequestConfig = AxiosRequestConfig & {
  skipAuthRefresh?: boolean;
  __isRetryRequest?: boolean;
};

const instance = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

let redirectingToLogin = false;

function redirectToLogin() {
  if (redirectingToLogin) return;
  const path = window.location.pathname + window.location.search;
  if (path.startsWith("/login")) return;
  redirectingToLogin = true;
  clearSession();
  const redirect = encodeURIComponent(path || "/");
  window.location.assign(`/login?redirect=${redirect}`);
}

function shouldSkipAuthRefresh(config?: InternalAxiosRequestConfig): boolean {
  const cfg = config as AuthRequestConfig | undefined;
  if (cfg?.skipAuthRefresh) return true;
  if (cfg?.__isRetryRequest) return true;
  const url = `${cfg?.baseURL ?? ""}${cfg?.url ?? ""}`;
  return /\/auth\/(refresh|login|captcha|wechat\/callback)(\?|$)/.test(url)
    || /\/auth\/login\/query(\?|$)/.test(url);
}

async function tryRefreshAndReplay(config: InternalAxiosRequestConfig) {
  if (!getRefreshToken()) {
    redirectToLogin();
    return Promise.reject(new ApiError("未登录", 401));
  }
  try {
    await refreshAccessToken();
  } catch (e) {
    redirectToLogin();
    const code = e instanceof AuthRefreshError ? e.code : 401;
    return Promise.reject(
      new ApiError(e instanceof Error ? e.message : "未登录", code),
    );
  }
  const retryConfig: AuthRequestConfig = {
    ...config,
    __isRetryRequest: true,
  };
  // 重放时带上新 access（request 拦截器会读最新 token）
  if (retryConfig.headers) {
    delete (retryConfig.headers as Record<string, unknown>).Authorization;
  }
  return instance.request(retryConfig);
}

instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (resp): any => {
    const body = resp.data as ApiResult<unknown>;
    if (body && body.code === 0) {
      return body.data;
    }
    if (body?.code === 401) {
      if (shouldSkipAuthRefresh(resp.config)) {
        redirectToLogin();
        return Promise.reject(new ApiError(body?.msg ?? "未登录", 401));
      }
      return tryRefreshAndReplay(resp.config);
    }
    return Promise.reject(
      new ApiError(body?.msg ?? "请求失败", body?.code ?? -1),
    );
  },
  (err: AxiosError) => {
    const status = err.response?.status;
    const config = err.config as InternalAxiosRequestConfig | undefined;
    if (status === 401 && config && !shouldSkipAuthRefresh(config)) {
      return tryRefreshAndReplay(config);
    }
    if (status === 401) {
      redirectToLogin();
      return Promise.reject(new ApiError("未登录", 401));
    }
    return Promise.reject(new ApiError(err?.message ?? "网络错误", -1));
  },
);

export async function get<T>(url: string, config?: AuthRequestConfig): Promise<T> {
  return instance.get(url, config) as unknown as Promise<T>;
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AuthRequestConfig,
): Promise<T> {
  return instance.post(url, data, config) as unknown as Promise<T>;
}

export async function put<T>(
  url: string,
  data?: unknown,
  config?: AuthRequestConfig,
): Promise<T> {
  return instance.put(url, data, config) as unknown as Promise<T>;
}

export async function del<T>(url: string, config?: AuthRequestConfig): Promise<T> {
  return instance.delete(url, config) as unknown as Promise<T>;
}

export default instance;
