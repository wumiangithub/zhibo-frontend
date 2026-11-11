const PREFIX = "zhibo.viewerPendingSign.";

export interface ViewerPendingSignSession {
  activityId: string;
  orderId: string;
  orderNo: string;
  /** 待签合同 create 返回的长链；立即签署用 */
  signUrl: string;
  /** 占位合同名（本轮无对方合同名称字段） */
  contractTitle: string;
  savedAt: number;
}

function storageKey(activityId: string, orderId: string): string {
  return `${PREFIX}${activityId.trim()}.${orderId.trim()}`;
}

export function saveViewerPendingSignSession(
  session: Omit<ViewerPendingSignSession, "savedAt"> & { savedAt?: number },
): void {
  const activityId = session.activityId?.trim();
  const orderId = session.orderId?.trim();
  const orderNo = session.orderNo?.trim();
  const signUrl = session.signUrl?.trim();
  if (!activityId || !orderId || !orderNo || !signUrl) return;
  const row: ViewerPendingSignSession = {
    activityId,
    orderId,
    orderNo,
    signUrl,
    contractTitle: (session.contractTitle || "").trim() || "《服务合同》",
    savedAt: session.savedAt ?? Date.now(),
  };
  try {
    sessionStorage.setItem(storageKey(activityId, orderId), JSON.stringify(row));
  } catch {
    /* quota / private mode */
  }
}

export function loadViewerPendingSignSession(
  activityId: string,
  orderId: string,
): ViewerPendingSignSession | null {
  const aid = activityId?.trim();
  const oid = orderId?.trim();
  if (!aid || !oid) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(aid, oid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewerPendingSignSession;
    if (parsed?.activityId?.trim() !== aid) return null;
    if (parsed?.orderId?.trim() !== oid) return null;
    if (!parsed.orderNo?.trim() || !parsed.signUrl?.trim()) return null;
    return {
      activityId: aid,
      orderId: oid,
      orderNo: String(parsed.orderNo).trim(),
      signUrl: String(parsed.signUrl).trim(),
      contractTitle:
        typeof parsed.contractTitle === "string" && parsed.contractTitle.trim()
          ? parsed.contractTitle.trim()
          : "《服务合同》",
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function clearViewerPendingSignSession(
  activityId: string,
  orderId: string,
): void {
  const aid = activityId?.trim();
  const oid = orderId?.trim();
  if (!aid || !oid) return;
  try {
    sessionStorage.removeItem(storageKey(aid, oid));
  } catch {
    /* ignore */
  }
}
