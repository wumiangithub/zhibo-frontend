import type {
  SelectableCouponItem,
  ViewerProductDetail,
} from "@/api/orderCenter";

const PREFIX = "zhibo.viewerOrderCheckout.";

export type WatchOrderRoomMode = "live" | "replay";

export interface ViewerOrderCheckoutSession {
  activityId: string;
  watchMode: WatchOrderRoomMode;
  checkoutDetail: ViewerProductDetail;
  /** 确认单拉取的可用券快照，建单时解析 couponId */
  checkoutCoupons?: SelectableCouponItem[];
  selectedCouponUserId: string | null;
  pendingOrderId?: string;
  coverImg?: string;
  riskGrade?: string;
  riskGradeName?: string;
}

function storageKey(activityId: string): string {
  return `${PREFIX}${activityId.trim()}`;
}

export function saveViewerOrderCheckoutSession(
  session: ViewerOrderCheckoutSession,
): void {
  const id = session.activityId?.trim();
  if (!id) return;
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function loadViewerOrderCheckoutSession(
  activityId: string,
): ViewerOrderCheckoutSession | null {
  const id = activityId?.trim();
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewerOrderCheckoutSession;
    if (parsed?.activityId?.trim() !== id) return null;
    if (!parsed.checkoutDetail?.spuId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function patchViewerOrderCheckoutSession(
  activityId: string,
  patch: Partial<
    Omit<ViewerOrderCheckoutSession, "activityId" | "watchMode">
  >,
): ViewerOrderCheckoutSession | null {
  const base = loadViewerOrderCheckoutSession(activityId);
  if (!base) return null;
  const next: ViewerOrderCheckoutSession = { ...base, ...patch };
  saveViewerOrderCheckoutSession(next);
  return next;
}

export function clearViewerOrderCheckoutSession(activityId: string): void {
  const id = activityId?.trim();
  if (!id) return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}
