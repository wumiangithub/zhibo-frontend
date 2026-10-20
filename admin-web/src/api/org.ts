import { get, post, put } from "./http";

export interface DeptTreeNode {
  /** 部门 rs_mainkey_id */
  id: number;
  name: string;
  code: string;
  /** 上级部门 id；根为 0 */
  parentId: number;
  children: DeptTreeNode[];
}

export type HqStatus = "normal" | "disabled" | "unknown";

export interface OrgEmployeeItem {
  /** 账号 rs_mainkey_id */
  id: number;
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
export const ORG_DEPT_ALL = "all" as const;

export type OrgDeptSelectId = number | typeof ORG_DEPT_ALL;

export function fetchOrgEmployees(params: {
  /** 空 / all = 全部员工；否则仅该部门 */
  deptId?: OrgDeptSelectId;
  userName?: string;
  /** 空 = 全部角色 */
  roleId?: number;
  page?: number;
  pageSize?: number;
}) {
  const all = params.deptId == null || params.deptId === ORG_DEPT_ALL;
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

export function setLiveEnabled(id: number, enabled: boolean) {
  return put<{ id: number; liveEnabled: boolean }>(`/org/employees/live-enabled/${id}`, {
    enabled,
  });
}

export interface RoleListItem {
  id: number;
  name: string;
}

export interface RoleMenuNode {
  code: string;
  name: string;
  children: RoleMenuNode[];
}

export interface RoleMemberItem {
  /** 账号 rs_mainkey_id */
  id: number;
  userName: string;
  departmentName: string;
}

export interface RoleDetail {
  id: number;
  name: string;
  remark: string;
  members: RoleMemberItem[];
  menus: RoleMenuNode[];
  menuCodes: string[];
}

export function fetchRoles() {
  return get<RoleListItem[]>("/roles/list");
}

export function fetchRoleDetail(id: number) {
  return get<RoleDetail>(`/roles/detail/${id}`);
}

export function saveRoleMenus(id: number, menuCodes: string[]) {
  return post<RoleDetail>("/roles/save-menus", { id, menuCodes });
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
