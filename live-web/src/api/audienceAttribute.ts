import { post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

/**
 * 邀请归因（D97）。被邀请观众 id 只从 Authorization 取；Body 不传 viewerId。
 * `inviterKind`：`employee` 员工 / `audience` 观众；本站只落员工邀请。
 */
export function attributeAudience(
  activityId: string,
  body: {
    inviterId: number;
    inviterKind?: "employee" | "audience";
  },
) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<{ id: number; viewerId: number }>(
    `/watch/audience/attribute/${activityId}`,
    { inviterKind: "employee", ...body },
    { headers },
  );
}
