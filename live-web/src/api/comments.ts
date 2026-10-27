import { post } from "./http";

export interface ReportCommentBody {
  content: string;
  guestId?: string;
  viewerId?: number;
  nickname?: string;
  roleName?: number;
  providerMsgId?: string;
  commentTime?: string;
}

export function reportComment(activityId: string, body: ReportCommentBody) {
  return post<{ id: number }>(`/watch/comments/report/${activityId}`, body);
}

export function deleteComment(
  activityId: string,
  body: { providerMsgId?: string; commentId?: number },
) {
  return post<{ id: number }>(`/watch/comments/delete/${activityId}`, body);
}
