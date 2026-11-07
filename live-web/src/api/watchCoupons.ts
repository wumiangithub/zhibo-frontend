import { get } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface WatchCouponItem {
  couponId: number;
  couponNo?: string;
  couponName: string;
  couponAmount: string;
  couponStartDate?: string;
  couponEndDate?: string;
  allSku?: boolean;
  deptNames?: string;
  skuNames?: string;
  lastSentTime?: string;
  lastSenderEmployeeId?: number;
  lastSenderNickname?: string;
  lastSenderDeptId?: number;
  lastSenderDeptName?: string;
}

export interface WatchCouponListData {
  list: WatchCouponItem[];
}

export interface WatchCouponHistoryItem {
  id: number;
  senderName: string;
  timestamp: number;
  couponId: number;
  couponNo?: string;
  couponName: string;
  couponAmount: string;
  couponStartDate?: string;
  couponEndDate?: string;
  employeeId?: number;
  deptId?: number;
  deptName?: string;
}

export interface WatchCouponHistoryData {
  total: number;
  list: WatchCouponHistoryItem[];
}

export type CouponChatPayload = {
  couponId: number;
  couponNo?: string;
  couponName: string;
  couponAmount: string;
  couponStartDate?: string;
  couponEndDate?: string;
  employeeId?: number;
  deptId?: number;
  deptName?: string;
  commentId?: number;
  nickname?: string;
};

function watchGateHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 本场已发券列表（侧栏「券」图标；list.length > 0 则显示）。 */
export function listWatchCoupons(activityId: string) {
  return get<WatchCouponListData>(`/watch/coupons/${encodeURIComponent(activityId)}`, {
    headers: watchGateHeaders(activityId),
  });
}

/** 讨论区优惠券卡片历史（按 comment_time 旧→新）。 */
export function listWatchCouponHistory(activityId: string) {
  return get<WatchCouponHistoryData>(
    `/watch/coupon-history/${encodeURIComponent(activityId)}`,
    { headers: watchGateHeaders(activityId) },
  );
}

export function toCouponChatMessage(
  row: WatchCouponHistoryItem | CouponChatPayload,
  senderName?: string,
  timestamp?: number,
): ChatMessage | null {
  const couponId = "couponId" in row ? row.couponId : null;
  if (couponId == null || couponId <= 0) return null;
  const name =
    ("senderName" in row ? row.senderName : undefined)?.trim() ||
    senderName?.trim() ||
    ("nickname" in row ? row.nickname : undefined)?.trim() ||
    "直播助理";
  const couponName = row.couponName?.trim();
  const couponAmount = row.couponAmount?.trim();
  if (!couponName || !couponAmount) return null;
  const commentId =
    "id" in row && typeof row.id === "number"
      ? row.id
      : "commentId" in row
        ? row.commentId
        : undefined;
  const ts =
    timestamp ??
    ("timestamp" in row && typeof row.timestamp === "number" ? row.timestamp : Date.now());
  return {
    sender_id: row.employeeId != null ? `z${row.employeeId}` : "coupon",
    sender_name: name,
    msg: "",
    msgId: commentId != null ? `coupon_${commentId}` : `coupon_${couponId}_${ts}`,
    commentId: commentId ?? undefined,
    role_name: 3,
    timestamp: ts,
    kind: "coupon",
    coupon: {
      couponId,
      couponNo: row.couponNo,
      couponName,
      couponAmount,
      couponStartDate: row.couponStartDate,
      couponEndDate: row.couponEndDate,
      employeeId: row.employeeId,
      deptId: row.deptId,
      deptName: row.deptName,
    },
  };
}
