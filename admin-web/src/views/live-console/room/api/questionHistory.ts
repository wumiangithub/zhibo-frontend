import { get } from "@/api/http";
import { parseVhallChatRole } from "../utils/vhallChatRole";

export interface ConsoleQuestionHistoryItemDto {
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

export interface ConsoleQuestionHistoryData {
  total: number;
  list: ConsoleQuestionHistoryItemDto[];
}

const ANSWER_ROLE: Record<string, string> = {
  "1": "主持人",
  "3": "助理",
  "4": "嘉宾",
};

/** 中控台问答兜底（本站 room_comment）；admin JWT。微吼历史空/失败后调用。 */
export function fetchConsoleQuestionHistory(activityId: string) {
  return get<ConsoleQuestionHistoryData>(
    `/activities/console/question-history/${encodeURIComponent(activityId)}`,
  );
}

export function toQuestionChatMessage(row: ConsoleQuestionHistoryItemDto): ChatMessage | null {
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
