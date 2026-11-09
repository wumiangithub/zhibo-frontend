import { get, post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

function viewerAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * 本场业务员（下单 salesmanId）。
 * 读 activity_audience：优先员工邀请人，否则导入人；皆无返回 null。
 */
export async function getAudienceSalesman(activityId: string): Promise<number | null> {
  const data = await get<{ salesmanId?: number | null }>(
    `/watch/audience/salesman/${activityId}`,
    { headers: viewerAuthHeaders() },
  );
  const id = data?.salesmanId;
  if (id == null) return null;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
  return post<{ id: number; viewerId: number }>(
    `/watch/audience/attribute/${activityId}`,
    { inviterKind: "employee", ...body },
    { headers: viewerAuthHeaders() },
  );
}
