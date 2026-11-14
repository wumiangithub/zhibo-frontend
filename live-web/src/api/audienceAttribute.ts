import { get, post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

function viewerAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export interface AudienceSalesman {
  /** hr_uimsyhxx.identifier */
  salesmanId: string;
  /** hr_uimsyhgwxx.bmid；无岗位可省略 */
  salesmanDeptId?: number;
}

/**
 * 本场业务员（下单 salesmanId / salesmanDeptId）。
 * 只认员工邀请人；无邀请人或档案缺失返回 null（不回退导入人）。
 */
export async function getAudienceSalesman(
  activityId: string,
): Promise<AudienceSalesman | null> {
  // LOCAL-ONLY：本地联调固定业务员，勿提交到生产构建。
  if (import.meta.env.DEV) {
    return {
      salesmanId: "d84dbf1b-d266-4133-9fd8-49e0de044d8a",
      salesmanDeptId: 94,
    };
  }
  const data = await get<{
    salesmanId?: string | null;
    salesmanDeptId?: number | null;
  }>(`/watch/audience/salesman/${activityId}`, { headers: viewerAuthHeaders() });
  const id = data?.salesmanId;
  if (id == null) return null;
  const salesmanId = String(id).trim();
  if (!salesmanId) return null;
  const deptRaw = data?.salesmanDeptId;
  const deptNum = deptRaw == null ? NaN : Number(deptRaw);
  const salesmanDeptId =
    Number.isInteger(deptNum) && deptNum > 0 ? Math.floor(deptNum) : undefined;
  return salesmanDeptId != null ? { salesmanId, salesmanDeptId } : { salesmanId };
}

/**
 * 直播分享登记邀请人（D97）。被邀请观众 username 只从 Authorization 取。
 * Body 与课程 enroll 同形：`inviterId` 必传；`inviterKind`；`username` 仅 audience 时传邀请人。
 * 本站只落员工邀请；audience 后端拒收。
 */
export function attributeAudience(
  activityId: string,
  body: {
    inviterId: number;
    inviterKind?: "employee" | "audience";
    /** 仅 audience：邀请人 username（不是被邀请人） */
    username?: string;
  },
) {
  return post<{ id: number; username: string }>(
    `/watch/audience/attribute/${activityId}`,
    { inviterKind: "employee", ...body },
    { headers: viewerAuthHeaders() },
  );
}
