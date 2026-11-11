const PREFIX = "zhibo.viewerPendingPay.";

export interface ViewerPendingPaySession {
  activityId: string;
  orderId: string;
  chargeId: string;
  channel: string;
  /** 写入时间（ms），便于排查；轮询时限以开始轮询时刻为准 */
  savedAt: number;
}

function storageKey(activityId: string): string {
  return `${PREFIX}${activityId.trim()}`;
}

export function saveViewerPendingPaySession(
  session: Omit<ViewerPendingPaySession, "savedAt"> & { savedAt?: number },
): void {
  const activityId = session.activityId?.trim();
  const orderId = session.orderId?.trim();
  const chargeId = session.chargeId?.trim();
  if (!activityId || !orderId || !chargeId) return;
  const row: ViewerPendingPaySession = {
    activityId,
    orderId,
    chargeId,
    channel: (session.channel || "").trim(),
    savedAt: session.savedAt ?? Date.now(),
  };
  try {
    sessionStorage.setItem(storageKey(activityId), JSON.stringify(row));
  } catch {
    /* quota / private mode */
  }
}

export function loadViewerPendingPaySession(
  activityId: string,
): ViewerPendingPaySession | null {
  const id = activityId?.trim();
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewerPendingPaySession;
    if (parsed?.activityId?.trim() !== id) return null;
    if (!parsed.orderId?.trim() || !parsed.chargeId?.trim()) return null;
    return {
      activityId: id,
      orderId: String(parsed.orderId).trim(),
      chargeId: String(parsed.chargeId).trim(),
      channel: typeof parsed.channel === "string" ? parsed.channel : "",
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function clearViewerPendingPaySession(activityId: string): void {
  const id = activityId?.trim();
  if (!id) return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}

/** 微信内置浏览器（含公众号 H5；不含仅靠 miniProgram UA 的粗判场景也可命中）。 */
export function isWeChatInAppBrowser(): boolean {
  try {
    return /MicroMessenger/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}
