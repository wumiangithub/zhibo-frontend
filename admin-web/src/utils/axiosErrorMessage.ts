import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

function isTimeoutError(err: AxiosError): boolean {
  if (err.code === "ETIMEDOUT") return true;
  return /timeout of \d+ms exceeded|^timeout exceeded$/i.test(err.message ?? "");
}

/** 方法 + 路径。去掉 query，避免把 token 打进提示。 */
function requestLabel(config?: AxiosRequestConfig): string {
  if (!config) return "";
  const method = (config.method ?? "GET").toUpperCase();
  let uri = "";
  try {
    uri = axios.getUri(config);
  } catch {
    uri = `${config.baseURL ?? ""}${config.url ?? ""}`;
  }
  uri = uri.split(/[?#]/)[0] ?? "";
  let path = uri;
  if (/^https?:\/\//i.test(uri)) {
    try {
      path = new URL(uri).pathname;
    } catch {
      path = uri;
    }
  }
  return path ? `${method} ${path}` : method;
}

/** 从响应体取业务文案（本站 ApiResult.msg / 订单中心 message）。 */
function responseBodyMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  for (const key of ["msg", "message"] as const) {
    const v = o[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

/**
 * 超时改成带接口的中文提示，例如「接口超时（15000ms）：GET /api/v1/employees」。
 * HTTP 错误优先用响应体业务 message/msg，再回退 axios / fallback。
 */
export function axiosErrorMessage(err: unknown, fallback = "网络错误"): string {
  if (axios.isAxiosError(err)) {
    if (isTimeoutError(err)) {
      const where = requestLabel(err.config);
      const ms = err.config?.timeout;
      const wait = typeof ms === "number" && ms > 0 ? `${ms}ms` : "";
      if (where && wait) return `接口超时（${wait}）：${where}`;
      if (where) return `接口超时：${where}`;
      if (wait) return `接口超时（${wait}）`;
      return "接口超时";
    }
    const fromBody = responseBodyMessage(err.response?.data);
    if (fromBody) return fromBody;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
