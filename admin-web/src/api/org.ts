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
  roleNames: string;
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
  /** 空 = 全部角色 */
  roleId?: string;
  page?: number;
  pageSize?: number;
}) {
  const all = !params.deptId || params.deptId === ORG_DEPT_ALL;
  return get<OrgEmployeeListResult>("/org/employees", {
    params: {
      deptId: all ? undefined : params.deptId,
      userName: params.userName || undefined,
      roleId: params.roleId || undefined,
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

export interface RoleListItem {
  id: string;
  name: string;
}

export interface RoleMenuNode {
  code: string;
  name: string;
  children: RoleMenuNode[];
}

export interface RoleMemberItem {
  id: string;
  userName: string;
  departmentName: string;
}

export interface RoleDetail {
  id: string;
  name: string;
  remark: string;
  members: RoleMemberItem[];
  menus: RoleMenuNode[];
  menuCodes: string[];
}

export function fetchRoles() {
  return get<RoleListItem[]>("/org/roles");
}

export function fetchRoleDetail(id: string) {
  return get<RoleDetail>(`/org/roles/${id}`);
}

export function saveRoleMenus(id: string, menuCodes: string[]) {
  return put<RoleDetail>(`/org/roles/${id}/menus`, { menuCodes });
}

export function memberLabel(member: RoleMemberItem): string {
  if (member.departmentName) return `${member.userName}(${member.departmentName})`;
  return member.userName;
}

export function hqStatusLabel(status: HqStatus): string {
  if (status === "normal") return "正常";
  if (status === "disabled") return "禁用";
  return "—";
}
