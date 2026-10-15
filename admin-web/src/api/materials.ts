import { del, get, post, put } from "./http";

/** GET /api/uploads/tos-sts 响应 data，字段对齐 upload.js / tosConfig */
export interface TosStsConfig {
  region: string;
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  /** ISO-8601 UTC，带 Z */
  expiredTime: string;
}

/** 拉取火山 TOS 临时上传凭证 */
export function fetchTosSts() {
  return get<TosStsConfig>("/uploads/tos-sts");
}

export type MaterialType = "image" | "video" | "document";

/** 展示/可用态：两审都通过才 available（以后端返回为准，前端用审核字段兜底） */
export type MaterialStatus = "available" | "unavailable";

/** AI / 风控合规审核：pending 待审核 / passed 已通过 / rejected 已驳回 */
export type MaterialAuditStatus = "pending" | "passed" | "rejected";

export interface MaterialGroup {
  id: string;
  name: string;
  count: number;
  isDefault: boolean;
}

export interface MaterialListItem {
  id: string;
  type: MaterialType;
  groupId: string;
  name: string;
  url: string;
  objectKey: string;
  thumbUrl?: string;
  meta?: string;
  fileSize?: number;
  status: MaterialStatus;
  /** AI 审核；列表接口必有，缺省按 pending */
  aiAuditStatus?: MaterialAuditStatus;
  /** 风控合规审核；列表接口必有，缺省按 pending */
  riskAuditStatus?: MaterialAuditStatus;
  /** 上传人员工 id；旧行可空 */
  uploaderId?: string;
  /** 上传人姓名快照 */
  uploaderName?: string;
  /** 所在部门展示名快照 */
  departmentName?: string;
  uploadedAt: string;
}

/**
 * 是否可用 / 选择弹窗是否允许勾选。
 * 仅当 AI、风控两审都为 `passed` 才可用；缺省、空串、pending、rejected 一律不可用。
 * 不回退 `status`：登记后后端常写 `status=available`，与审核未通过并存。
 */
export function isMaterialSelectable(
  item: Pick<MaterialListItem, "status" | "aiAuditStatus" | "riskAuditStatus">,
): boolean {
  return item.aiAuditStatus === "passed" && item.riskAuditStatus === "passed";
}

/** 状态列文案：可用 / 不可用 */
export function materialAvailabilityLabel(
  item: Pick<MaterialListItem, "status" | "aiAuditStatus" | "riskAuditStatus">,
): "可用" | "不可用" {
  return isMaterialSelectable(item) ? "可用" : "不可用";
}

export interface MaterialListData {
  total: number;
  page: number;
  pageSize: number;
  list: MaterialListItem[];
}

export interface MaterialListQuery {
  type: MaterialType;
  groupId?: string;
  keyword?: string;
  /**
   * true：仅两审均为 passed（封面/课件选择弹窗）。
   * 素材中心主列表不传；勿用 status=available 代替。
   */
  selectableOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateMaterialItem {
  name: string;
  url: string;
  objectKey: string;
  fileSize?: number;
  mimeType?: string;
  meta?: string;
}

export interface CreateMaterialsPayload {
  type: MaterialType;
  groupId: string;
  items: CreateMaterialItem[];
}

/** GET /api/materials/groups?type= */
export function listMaterialGroups(type: MaterialType) {
  return get<MaterialGroup[]>("/materials/groups", { params: { type } });
}

/** POST /api/materials/groups */
export function createMaterialGroup(type: MaterialType, name: string) {
  return post<MaterialGroup>("/materials/groups", { type, name });
}

/** PUT /api/materials/groups/{id} */
export function renameMaterialGroup(id: string, name: string) {
  return put<MaterialGroup>(`/materials/groups/${id}`, { name });
}

/** DELETE /api/materials/groups/{id} */
export function deleteMaterialGroup(id: string) {
  return del<{ id: string }>(`/materials/groups/${id}`);
}

/** GET /api/materials */
export function listMaterials(query: MaterialListQuery) {
  return get<MaterialListData>("/materials", {
    params: {
      type: query.type,
      groupId: query.groupId || undefined,
      keyword: query.keyword || undefined,
      // 仅选择场景传 true；主列表省略，走后端默认 false
      ...(query.selectableOnly === true ? { selectableOnly: true } : {}),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    },
  });
}

/** POST /api/materials 批量登记 */
export function createMaterials(payload: CreateMaterialsPayload) {
  return post<{ list: MaterialListItem[] }>("/materials", payload);
}

/** PUT /api/materials/{id} 修改展示名（不改 TOS） */
export function renameMaterial(id: string, name: string) {
  return put<MaterialListItem>(`/materials/${id}`, { name });
}

/** PUT /api/materials/{id}/ai-audit 仅 passed / rejected */
export function updateMaterialAiAudit(id: string, status: "passed" | "rejected") {
  return put<MaterialListItem>(`/materials/${id}/ai-audit`, { status });
}

/** PUT /api/materials/{id}/risk-audit 仅 passed / rejected */
export function updateMaterialRiskAudit(id: string, status: "passed" | "rejected") {
  return put<MaterialListItem>(`/materials/${id}/risk-audit`, { status });
}

/** DELETE /api/materials/{id} 软删 */
export function deleteMaterial(id: string) {
  return del<{ id: string }>(`/materials/${id}`);
}
