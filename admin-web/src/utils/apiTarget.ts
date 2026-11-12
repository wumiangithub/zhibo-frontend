/** 测试环境运行时切换 API 目标（真实的test服务 / mock服务）。仅 MODE === "test" 生效。 */

export type ApiTarget = "official" | "ours";

const STORAGE_KEY = "zhibo-api-target";
const OURS_PREFIX = "/zhibo-admin";

export function isApiSwitchEnabled(): boolean {
  return import.meta.env.MODE === "test";
}

function envPrefix(): string {
  const raw = String(import.meta.env.VITE_APP_BASE_API ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!raw || raw === "/") return "";
  return raw;
}

export function getOfficialPrefix(): string {
  return envPrefix() || "/live-admin";
}

export function getOursPrefix(): string {
  return OURS_PREFIX;
}

export function getApiTarget(): ApiTarget {
  if (!isApiSwitchEnabled()) return "official";
  try {
    return localStorage.getItem(STORAGE_KEY) === "ours" ? "ours" : "official";
  } catch {
    return "official";
  }
}

/** axios / 直连请求使用的同源前缀（不含 /api/v1） */
export function getApiPrefix(): string {
  if (isApiSwitchEnabled() && getApiTarget() === "ours") {
    return getOursPrefix();
  }
  return envPrefix();
}

export function persistApiTarget(target: ApiTarget): void {
  localStorage.setItem(STORAGE_KEY, target);
}

export function apiTargetLabel(target: ApiTarget = getApiTarget()): string {
  return target === "ours" ? "mock服务" : "真实的test服务";
}
