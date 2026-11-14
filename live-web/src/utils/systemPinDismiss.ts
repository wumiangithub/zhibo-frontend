/** 观众本地关闭系统消息置顶条（按活动 + commentId；换新置顶仍会再显示） */

const PREFIX = "lw_system_pin_dismissed:";

function storageKey(activityId: string): string {
  return `${PREFIX}${activityId.trim()}`;
}

export function isSystemPinDismissed(activityId: string, commentId: number): boolean {
  const id = activityId.trim();
  if (!id || !(commentId > 0)) return false;
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return false;
    const n = Number(raw);
    return Number.isFinite(n) && n === commentId;
  } catch {
    return false;
  }
}

export function rememberSystemPinDismissed(activityId: string, commentId: number): void {
  const id = activityId.trim();
  if (!id || !(commentId > 0)) return;
  try {
    localStorage.setItem(storageKey(id), String(commentId));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSystemPinDismissed(activityId: string): void {
  const id = activityId.trim();
  if (!id) return;
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}
