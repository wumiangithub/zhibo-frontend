import { post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface ReportCommentBody {
  content: string;
  nickname?: string;
  roleName?: number;
  providerMsgId?: string;
  commentTime?: string;
}

/** 评论上报。viewerId 只从 Authorization 取；Body 不传 guestId / viewerId。 */
export function reportComment(activityId: string, body: ReportCommentBody) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number }>(`/watch/comments/report/${activityId}`, body, { headers });
}

export function deleteComment(
  activityId: string,
  body: { providerMsgId?: string; commentId?: number },
) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number }>(`/watch/comments/delete/${activityId}`, body, { headers });
}
