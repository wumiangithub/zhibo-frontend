/**
 * 评论上报走 live `/watch/comments/*`，需观众 JWT。
 * 中控台员工无观众票：useChat 在 getViewerId()==null 时已跳过；此处再兜底 soft-fail。
 */

export const CommentType = {
  CHAT: 1,
  QUESTION: 2,
} as const;

export interface ReportCommentBody {
  content: string;
  nickname?: string;
  roleName?: number;
  commentType?: number;
  msgId?: string;
  questionId?: string;
  commentTime?: string;
}

export interface UpsertQuestionAnswerBody {
  questionId: string;
  msgId?: string;
  content?: string;
  nickname?: string;
  roleName?: number;
  answerContent: string;
  answerNickname?: string;
  answerRoleName?: number;
}

function softSkip(): Promise<{ id: number }> {
  return Promise.reject(new Error("中控台无观众 JWT，跳过评论上报"));
}

export function reportComment(_activityId: string, _body: ReportCommentBody) {
  return softSkip();
}

export function deleteComment(
  _activityId: string,
  _body: { msgId?: string; commentId?: number },
) {
  return softSkip();
}

export function upsertQuestionAnswer(_activityId: string, _body: UpsertQuestionAnswerBody) {
  return softSkip();
}
