import { get, put } from "./http";

export interface DeptTreeNode {
  id: string;
  name: string;
  code: string;
  parentId: string;
  children: DeptTreeNode[];
}

export type HqStatus = "normal" | "disabled" | "unknown";

export interface OrgEmployeeItem {
  id: string;
  userName: string;
  departmentName: string;
  liveEnabled: boolean;
  hqStatus: HqStatus;
}

export interface OrgEmployeeListResult {
  page: number;
  pageSize: number;
  total: number;
  list: OrgEmployeeItem[];
}

export function fetchDeptTree() {
  return get<DeptTreeNode[]>("/org/departments/tree");
}

/** 前端树「全部」节点 id；请求名单时不传 deptId */
export const ORG_DEPT_ALL = "all";

export function fetchOrgEmployees(params: {
  /** 空 / all = 全部员工；否则仅该部门 */
  deptId?: string;
  userName?: string;
  page?: number;
  pageSize?: number;
}) {
  const all = !params.deptId || params.deptId === ORG_DEPT_ALL;
  return get<OrgEmployeeListResult>("/org/employees", {
    params: {
      deptId: all ? undefined : params.deptId,
      userName: params.userName || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  });
}

export function setLiveEnabled(id: string, enabled: boolean) {
  return put<{ id: string; liveEnabled: boolean }>(`/org/employees/${id}/live-enabled`, {
    enabled,
  });
}

export function hqStatusLabel(status: HqStatus): string {
  if (status === "normal") return "正常";
  if (status === "disabled") return "禁用";
  return "—";
}
