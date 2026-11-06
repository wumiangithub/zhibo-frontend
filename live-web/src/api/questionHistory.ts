import { get } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";
import { parseVhallChatRole } from "@/utils/vhallChatRole";

export interface WatchQuestionHistoryItemDto {
  questionId?: string;
  senderId?: string;
  senderName?: string;
  msg?: string;
  msgId?: string;
  roleName?: number | null;
  timestamp?: number;
  answerContent?: string;
  answerNickname?: string;
  answerRoleName?: number | null;
}

export interface WatchQuestionHistoryData {
  total: number;
  list: WatchQuestionHistoryItemDto[];
}

const ANSWER_ROLE: Record<string, string> = {
  "1": "主持人",
  "3": "助理",
  "4": "嘉宾",
};

function watchGateHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * 本站问答历史（room_comment 提问行）。
 * 回放页直接用；直播页在微吼 `vhall_get_live_history_question_msg` 空/失败后兜底。
 * 与 chat-history 同售卖门禁。
 */
export function fetchWatchQuestionHistory(activityId: string) {
  return get<WatchQuestionHistoryData>(`/watch/question-history/${activityId}`, {
    headers: watchGateHeaders(activityId),
  });
}

export function toQuestionChatMessage(row: WatchQuestionHistoryItemDto): ChatMessage | null {
  const name = (row.senderName || "").trim();
  const msg = (row.msg || "").trim();
  if (!name || !msg) return null;

  const role = parseVhallChatRole(row.roleName);
  const questionId = (row.questionId || "").trim();
  const cloudMsgId = (row.msgId || "").trim();
  const msgId = questionId || cloudMsgId || undefined;

  const answerContent = (row.answerContent || "").trim();
  let answer: ChatMessage["answer"] | undefined;
  if (answerContent) {
    const roleLabel = ANSWER_ROLE[String(row.answerRoleName ?? "").trim()];
    answer = {
      nickname: (row.answerNickname || "").trim(),
      content: answerContent,
      ...(roleLabel ? { roleLabel } : {}),
    };
  }

  return {
    sender_id: String(row.senderId || ""),
    sender_name: name,
    msg,
    ...(msgId ? { msgId } : {}),
    role_name: role,
    is_host: role === 1,
    timestamp: Number(row.timestamp) || Date.now(),
    kind: "question",
    ...(answer ? { answer } : {}),
  };
}
