import { get } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface WatchSystemMessageHistoryItem {
  commentId: number;
  text: string;
  pin: boolean;
  nickname?: string;
  commentTime?: string;
  timestamp?: number;
}

export interface WatchSystemMessageHistoryData {
  list: WatchSystemMessageHistoryItem[];
  pinnedCommentId?: number | null;
}

export type SystemChatPayload = {
  text: string;
  pin?: boolean;
  commentId?: number;
  nickname?: string;
  action?: string;
};

function watchGateHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 讨论区系统消息历史（按 comment_time 旧→新；含当前置顶 id）。 */
export function listWatchSystemMessageHistory(activityId: string) {
  return get<WatchSystemMessageHistoryData>(
    `/watch/system-message-history/${encodeURIComponent(activityId)}`,
    { headers: watchGateHeaders(activityId) },
  );
}

export function toSystemChatMessage(
  row: WatchSystemMessageHistoryItem | SystemChatPayload,
  senderName?: string,
  timestamp?: number,
): ChatMessage | null {
  const text = "text" in row ? String(row.text || "").trim() : "";
  if (!text) return null;
  const commentId =
    "commentId" in row && row.commentId != null && Number(row.commentId) > 0
      ? Number(row.commentId)
      : undefined;
  const nick =
    ("nickname" in row && row.nickname?.trim()) ||
    senderName?.trim() ||
    "系统消息";
  const ts =
    timestamp ??
    ("timestamp" in row && typeof row.timestamp === "number" ? row.timestamp : Date.now());
  return {
    sender_id: "system",
    sender_name: nick,
    msg: text,
    msgId: commentId != null ? `system_${commentId}` : `system_local_${ts}`,
    commentId,
    role_name: 3,
    timestamp: ts,
    kind: "system",
  };
}
