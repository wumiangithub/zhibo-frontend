/**
 * 进出上报前端开关（见迭代-9 / D32）。
 * 总开关关时不调 enter/leave；开时 enter 仍报，leave 再受各角色开关约束。
 */
function envFlag(key: string, defaultValue: boolean): boolean {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const text = String(raw).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(text)) return false;
  if (["1", "true", "yes", "on"].includes(text)) return true;
  return defaultValue;
}

function envMs(key: string, defaultValue: number): number {
  const n = Number(import.meta.env[key]);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return Math.floor(n);
}

/**
 * 客户端进出上报总开关。
 * 本地默认开；生产建议 `.env.production` 设 `false`（主通道走微吼回调）。
 */
export function clientReportEnabled(): boolean {
  return envFlag("VITE_ATTENDANCE_CLIENT_REPORT", true);
}

/** 离开节流间隔（毫秒），默认 300 */
export function leaveThrottleMs(): number {
  return envMs("VITE_ATTENDANCE_LEAVE_THROTTLE_MS", 300);
}

/** 观看页：最后一人是否上报 leave（仅总开关开时生效），默认开 */
export function leaveLastViewerEnabled(): boolean {
  return envFlag("VITE_ATTENDANCE_LEAVE_LAST_VIEWER", true);
}

/** 中控台助理：是否同步 leave（仅总开关开时生效），默认开 */
export function leaveAssistantEnabled(): boolean {
  return envFlag("VITE_ATTENDANCE_LEAVE_ASSISTANT", true);
}
