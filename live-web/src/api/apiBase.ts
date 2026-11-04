/**
 * 接口根路径。VITE_APP_BASE_API 是同源前缀（/、/live-client）或分机后的域名。
 * /api/v1 固定接在后面。
 */
export function apiV1(path = ""): string {
  const raw = String(import.meta.env.VITE_APP_BASE_API ?? "")
    .trim()
    .replace(/\/+$/, "");
  const prefix = !raw || raw === "/" ? "" : raw;
  const rest = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${prefix}/api/v1${rest}`;
}
