import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";
import { apiV1 } from "./apiBase";

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

/** 本请求遇到鉴权失败时不要走静默换票（刷新/登录白名单、已重放过） */
export type AuthRequestConfig = AxiosRequestConfig & {
  skipAuthRefresh?: boolean;
  __isRetryRequest?: boolean;
};

const instance = axios.create({
  baseURL: apiV1(),
  timeout: 15000,
});

function shouldSkipAuthRefresh(config?: InternalAxiosRequestConfig): boolean {
  const cfg = config as AuthRequestConfig | undefined;
  if (cfg?.skipAuthRefresh) return true;
  if (cfg?.__isRetryRequest) return true;
  const url = `${cfg?.baseURL ?? ""}${cfg?.url ?? ""}`;
  return /\/viewer\/auth\/(refresh|wechat-login|phone-login|dev-phone-login)(\?|$)/.test(
    url,
  );
}

/** 业务码/文案判定需登录（拦截器 401；watch 门禁常 403/400「请先登录」） */
function isLoginRequiredBody(body: ApiResult<unknown> | undefined): boolean {
  if (!body) return false;
  if (body.code === 401) return true;
  const msg = String(body.msg ?? "");
  if (!msg) return false;
  if (body.code !== 400 && body.code !== 403) return false;
  return (
    msg.includes("请先登录") ||
    msg === "未登录" ||
    msg.includes("登录状态已失效")
  );
}

async function tryRefreshAndReplay(config: InternalAxiosRequestConfig) {
  const { tryRefreshViewerSession, goViewerLogin } = await import(
    "@/utils/viewerLogin"
  );
  const { clearViewerSession, getViewerAccessToken } = await import(
    "@/utils/viewerAuth"
  );

  const ok = await tryRefreshViewerSession();
  if (!ok) {
    clearViewerSession();
    await goViewerLogin();
    return Promise.reject(new ApiError("未登录", 401));
  }

  const token = getViewerAccessToken();
  const retryConfig: AuthRequestConfig = {
    ...config,
    __isRetryRequest: true,
    headers: {
      ...(config.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  return instance.request(retryConfig);
}

instance.interceptors.response.use(
  (resp): any => {
    const body = resp.data as ApiResult<unknown>;
    if (body && body.code === 0) {
      return body.data;
    }
    if (
      isLoginRequiredBody(body) &&
      !shouldSkipAuthRefresh(resp.config)
    ) {
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
    return Promise.reject(new ApiError(axiosErrorMessage(err), -1));
  },
);

export async function get<T>(
  url: string,
  config?: AuthRequestConfig,
): Promise<T> {
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

export default instance;
