import { get, post } from "./http";

/** 1 直播状态异常 / 2 报备审核 / 3 直播审核 / 4 素材审核 */
export type NotificationType = 1 | 2 | 3 | 4;

/** 0 无 / 1 已通过 / 2 已驳回 */
export type NotificationAuditResult = 0 | 1 | 2;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  body: string;
  auditResult: NotificationAuditResult;
  refType: number;
  refId: string;
  unread: boolean;
  /** yyyy-MM-dd HH:mm:ss */
  createdTime: string;
}

export interface NotificationListData {
  page: number;
  pageSize: number;
  total: number;
  list: NotificationItem[];
}

export const NOTIFICATION_PREVIEW_PAGE_SIZE = 10;

export function listNotifications(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  /** 0/省略=全部 */
  type?: number;
  /** 0/省略=全部；1 通过 / 2 驳回 */
  auditResult?: number;
}) {
  return get<NotificationListData>("/notifications/list", { params });
}

export function getNotificationUnreadCount() {
  return get<{ count: number }>("/notifications/unread-count");
}

export function readNotification(id: string) {
  return post<{ id: string }>(`/notifications/read/${id}`);
}

export function readAllNotifications() {
  return post<{ count: number }>("/notifications/read-all");
}
