import { post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

/** 与 room_comment.comment_type 一致：1 聊天 / 2 提问。 */
export const CommentType = {
  CHAT: 1,
  QUESTION: 2,
} as const;

export interface ReportCommentBody {
  content: string;
  nickname?: string;
  roleName?: number;
  /** 1 聊天 / 2 提问。省略时后端按聊天。 */
  commentType?: number;
  /**
   * 云消息 id（如微吼 msg_id）。聊天（D104）不传；提问可在 create 后补传。
   * 勿把提问 data.id 写进本字段。
   */
  msgId?: string;
  /** 云提问 id（如微吼 data.id）。提问上报必传；聊天不传。 */
  questionId?: string;
  commentTime?: string;
}

/** 评论上报。发送成功时调用；viewerId 只从 Authorization 取；Body 不传 guestId / viewerId。 */
export function reportComment(activityId: string, body: ReportCommentBody) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number }>(`/watch/comments/report/${activityId}`, body, { headers });
}

export function deleteComment(
  activityId: string,
  body: { msgId?: string; commentId?: number },
) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number }>(`/watch/comments/delete/${activityId}`, body, { headers });
}

/** 提问回复 upsert（D107）。任意已登录观众在 question_answer_commit 后调用；按云提问 id 幂等。 */
export interface UpsertQuestionAnswerBody {
  questionId: string;
  /** 云消息 id（如 data.msg_id）；可选，行上为空时补写。 */
  msgId?: string;
  /** 提问正文；库中尚无该提问行时必填（补建）。 */
  content?: string;
  nickname?: string;
  roleName?: number;
  answerContent: string;
  answerNickname?: string;
  answerRoleName?: number;
}

export function upsertQuestionAnswer(activityId: string, body: UpsertQuestionAnswerBody) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number }>(`/watch/comments/question-answer/${activityId}`, body, { headers });
}
