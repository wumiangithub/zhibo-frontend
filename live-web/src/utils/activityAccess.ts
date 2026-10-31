/** 加密售卖本场访问 JWT（D90）；与观众登录 JWT 分开存。 */

function storageKey(activityId: string): string {
  return `zhibo.activityAccess.${activityId}`;
}

export function getActivityAccessToken(activityId: string): string {
  if (!activityId) return "";
  try {
    return localStorage.getItem(storageKey(activityId))?.trim() || "";
  } catch {
    return "";
  }
}

export function setActivityAccessToken(activityId: string, token: string): void {
  if (!activityId) return;
  const t = token.trim();
  if (!t) return;
  try {
    localStorage.setItem(storageKey(activityId), t);
  } catch {
    /* ignore */
  }
}

export function clearActivityAccessToken(activityId: string): void {
  if (!activityId) return;
  try {
    localStorage.removeItem(storageKey(activityId));
  } catch {
    /* ignore */
  }
}

export function activityAccessHeader(
  activityId: string,
): { "X-Activity-Access": string } | Record<string, never> {
  const token = getActivityAccessToken(activityId);
  return token ? { "X-Activity-Access": token } : {};
}
