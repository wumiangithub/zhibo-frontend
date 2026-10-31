import { get } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface WatchChatHistoryItemDto {
  senderId?: string;
  senderName?: string;
  msg?: string;
  msgId?: string;
  avatar?: string;
  roleName?: number | null;
  timestamp?: number;
}

export interface WatchChatHistoryData {
  total: number;
  page: number;
  pageSize: number;
  list: WatchChatHistoryItemDto[];
}

function watchGateHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 回放页只读聊天历史（D91）；page 从 1。 */
export function fetchWatchChatHistory(activityId: string, page = 1) {
  return get<WatchChatHistoryData>(`/watch/chat-history/${activityId}`, {
    params: { page },
    headers: watchGateHeaders(activityId),
  });
}

export function toChatMessage(row: WatchChatHistoryItemDto): ChatMessage | null {
  const name = (row.senderName || "").trim();
  const msg = (row.msg || "").trim();
  if (!name || !msg) return null;
  const role =
    row.roleName === 1 ||
    row.roleName === 2 ||
    row.roleName === 3 ||
    row.roleName === 4
      ? row.roleName
      : undefined;
  return {
    sender_id: String(row.senderId || ""),
    sender_name: name,
    msg,
    msgId: row.msgId ? String(row.msgId) : undefined,
    avatar: row.avatar?.trim() || undefined,
    role_name: role,
    is_host: role === 1,
    timestamp: Number(row.timestamp) || Date.now(),
  };
}
