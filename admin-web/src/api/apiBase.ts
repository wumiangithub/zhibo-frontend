import { getApiPrefix } from "@/utils/apiTarget";

/**
 * 接口根路径。默认用 VITE_APP_BASE_API（同源前缀或分机后的域名）。
 * 测试环境可由页面按钮改写为 /zhibo-admin。/api/v1 固定接在后面。
 */
export function apiV1(path = ""): string {
  const prefix = getApiPrefix();
  const rest = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${prefix}/api/v1${rest}`;
}
