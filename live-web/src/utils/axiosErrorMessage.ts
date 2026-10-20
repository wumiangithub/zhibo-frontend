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

/**
 * 超时改成带接口的中文提示，例如「接口超时（15000ms）：GET /api/v1/employees」。
 * 其它错误保持 axios / 调用方原来的 message。
 */
export function axiosErrorMessage(err: unknown, fallback = "网络错误"): string {
  if (axios.isAxiosError(err) && isTimeoutError(err)) {
    const where = requestLabel(err.config);
    const ms = err.config?.timeout;
    const wait = typeof ms === "number" && ms > 0 ? `${ms}ms` : "";
    if (where && wait) return `接口超时（${wait}）：${where}`;
    if (where) return `接口超时：${where}`;
    if (wait) return `接口超时（${wait}）`;
    return "接口超时";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
