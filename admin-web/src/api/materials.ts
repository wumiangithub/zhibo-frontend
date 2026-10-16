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

/** 素材中心 Tab。文章不是文件，不进封面/课件选择弹窗。 */
export type MaterialCenterType = MaterialType | "article";

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
  type: MaterialCenterType;
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
export function listMaterialGroups(type: MaterialCenterType) {
  return get<MaterialGroup[]>("/materials/groups", { params: { type } });
}

/** POST /api/materials/groups */
export function createMaterialGroup(type: MaterialCenterType, name: string) {
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

export interface CreateArticlePayload {
  groupId: string;
  title: string;
  author: string;
  content: string;
}

/** POST /api/materials/articles 新建文章 */
export function createArticle(payload: CreateArticlePayload) {
  return post<MaterialListItem>("/materials/articles", payload);
}

export interface ArticleDetail {
  id: string;
  groupId: string;
  title: string;
  author: string;
  content: string;
  aiAuditStatus: MaterialAuditStatus;
  riskAuditStatus: MaterialAuditStatus;
}

/** GET /api/materials/articles/{id} */
export function getArticle(id: string) {
  return get<ArticleDetail>(`/materials/articles/${id}`);
}

/** PUT /api/materials/articles/{id} 编辑。待审核 400。成功后两审回到 pending。 */
export function updateArticle(
  id: string,
  payload: Pick<CreateArticlePayload, "title" | "author" | "content">,
) {
  return put<MaterialListItem>(`/materials/articles/${id}`, payload);
}

/** PUT /api/materials/{id}/group 移动分组，不改审核 */
export function moveMaterial(id: string, groupId: string) {
  return put<MaterialListItem>(`/materials/${id}/group`, { groupId });
}

/** PUT /api/materials/{id}/image 裁剪替换。待审核 400。成功后两审回到 pending。 */
export function replaceMaterialImage(
  id: string,
  payload: { url: string; objectKey: string; fileSize?: number; meta?: string },
) {
  return put<MaterialListItem>(`/materials/${id}/image`, payload);
}

/** 两审任一为待审核或空，内容不可改。 */
export function isMaterialAuditPending(
  item: Pick<MaterialListItem, "aiAuditStatus" | "riskAuditStatus">,
): boolean {
  const pending = (s?: string | null) => !s || s === "pending";
  return pending(item.aiAuditStatus) || pending(item.riskAuditStatus);
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
