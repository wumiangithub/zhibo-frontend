import { del, get, post, put } from "./http";

/** GET /api/v1/uploads/tos-sts 响应 data，字段对齐 upload.js / tosConfig */
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

/** 素材 AI/风控审核。库与接口均为整数（D55）。 */
export const MaterialAudit = {
  /** 0 待审核 */
  PENDING: 0,
  /** 1 已通过 */
  PASSED: 1,
  /** 2 已驳回 */
  REJECTED: 2,
} as const;

export type MaterialAuditStatus = (typeof MaterialAudit)[keyof typeof MaterialAudit];

/** 列表 / 筛选展示用 */
export const MATERIAL_AUDIT_LABEL: Record<MaterialAuditStatus, string> = {
  [MaterialAudit.PENDING]: "待审核",
  [MaterialAudit.PASSED]: "已通过",
  [MaterialAudit.REJECTED]: "已驳回",
};

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
  /** AI 审核；列表接口必有，缺省按 {@link MaterialAudit.PENDING} */
  aiAuditStatus?: MaterialAuditStatus;
  /** 风控合规审核；列表接口必有，缺省按 {@link MaterialAudit.PENDING} */
  riskAuditStatus?: MaterialAuditStatus;
  /** 上传人员工 id（rs_mainkey_id）；旧行可空 */
  uploaderId?: number;
  /** 上传人姓名快照 */
  uploaderName?: string;
  /** 所在部门展示名快照 */
  departmentName?: string;
  uploadedTime: string;
}

/**
 * 是否可用 / 选择弹窗是否允许勾选。
 * 仅当 AI、风控两审都为 {@link MaterialAudit.PASSED} 才可用；缺省、pending、rejected 一律不可用。
 * 不回退 `status`：登记后后端常写 `status=available`，与审核未通过并存。
 */
export function isMaterialSelectable(
  item: Pick<MaterialListItem, "status" | "aiAuditStatus" | "riskAuditStatus">,
): boolean {
  return (
    item.aiAuditStatus === MaterialAudit.PASSED &&
    item.riskAuditStatus === MaterialAudit.PASSED
  );
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
   * 联合审核：0 待审核 / 1 已通过 / 2 已驳回（{@link MaterialAudit}）。
   * 任一方驳回算驳回；否则任一方待审核算待审核；两方都通过才算通过。
   * 素材中心主列表按筛选传；不传表示全部。
   */
  auditStatus?: MaterialAuditStatus;
  /**
   * true：仅两审均为 {@link MaterialAudit.PASSED}（封面/课件选择弹窗）。
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

/** GET /api/v1/materials/groups/list?type= */
export function listMaterialGroups(type: MaterialCenterType) {
  return get<MaterialGroup[]>("/materials/groups/list", { params: { type } });
}

/** POST /api/v1/materials/groups/create */
export function createMaterialGroup(type: MaterialCenterType, name: string) {
  return post<MaterialGroup>("/materials/groups/create", { type, name });
}

/** PUT /api/v1/materials/groups/rename/{id} */
export function renameMaterialGroup(id: string, name: string) {
  return put<MaterialGroup>(`/materials/groups/rename/${id}`, { name });
}

/** DELETE /api/v1/materials/groups/delete/{id} */
export function deleteMaterialGroup(id: string) {
  return del<{ id: string }>(`/materials/groups/delete/${id}`);
}

/** GET /api/v1/materials/list */
export function listMaterials(query: MaterialListQuery) {
  return get<MaterialListData>("/materials/list", {
    params: {
      type: query.type,
      groupId: query.groupId || undefined,
      keyword: query.keyword || undefined,
      // 0 待审核是合法值，勿用 truthy 判断
      ...(typeof query.auditStatus === "number" ? { auditStatus: query.auditStatus } : {}),
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

/** POST /api/v1/materials/articles/create 新建文章 */
export function createArticle(payload: CreateArticlePayload) {
  return post<MaterialListItem>("/materials/articles/create", payload);
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

/** GET /api/v1/materials/articles/detail/{id} */
export function getArticle(id: string) {
  return get<ArticleDetail>(`/materials/articles/detail/${id}`);
}

/** PUT /api/v1/materials/articles/update/{id} 编辑。待审核 400。成功后两审回到 pending。 */
export function updateArticle(
  id: string,
  payload: Pick<CreateArticlePayload, "title" | "author" | "content">,
) {
  return put<MaterialListItem>(`/materials/articles/update/${id}`, payload);
}

/** PUT /api/v1/materials/group/{id} 移动分组，不改审核 */
export function moveMaterial(id: string, groupId: string) {
  return put<MaterialListItem>(`/materials/group/${id}`, { groupId });
}

/** PUT /api/v1/materials/image/{id} 裁剪替换。待审核 400。成功后两审回到 pending。 */
export function replaceMaterialImage(
  id: string,
  payload: { url: string; objectKey: string; fileSize?: number; meta?: string },
) {
  return put<MaterialListItem>(`/materials/image/${id}`, payload);
}

/** 两审任一为待审核或空，内容不可改。 */
export function isMaterialAuditPending(
  item: Pick<MaterialListItem, "aiAuditStatus" | "riskAuditStatus">,
): boolean {
  const pending = (s?: MaterialAuditStatus | null) =>
    s == null || s === MaterialAudit.PENDING;
  return pending(item.aiAuditStatus) || pending(item.riskAuditStatus);
}

/** POST /api/v1/materials/create 批量登记 */
export function createMaterials(payload: CreateMaterialsPayload) {
  return post<{ list: MaterialListItem[] }>("/materials/create", payload);
}

/** PUT /api/v1/materials/rename/{id} 修改展示名（不改 TOS） */
export function renameMaterial(id: string, name: string) {
  return put<MaterialListItem>(`/materials/rename/${id}`, { name });
}

/** PUT /api/v1/materials/ai-audit/{id} 仅 {@link MaterialAudit.PASSED} / {@link MaterialAudit.REJECTED} */
export function updateMaterialAiAudit(
  id: string,
  status: typeof MaterialAudit.PASSED | typeof MaterialAudit.REJECTED,
) {
  return put<MaterialListItem>(`/materials/ai-audit/${id}`, { status });
}

/** PUT /api/v1/materials/risk-audit/{id} 仅 {@link MaterialAudit.PASSED} / {@link MaterialAudit.REJECTED} */
export function updateMaterialRiskAudit(
  id: string,
  status: typeof MaterialAudit.PASSED | typeof MaterialAudit.REJECTED,
) {
  return put<MaterialListItem>(`/materials/risk-audit/${id}`, { status });
}

/** 素材审核流水：`action` 为 `submit` / `ai` / `risk` */
export interface MaterialAuditRecord {
  id: string;
  action: "submit" | "ai" | "risk" | string;
  /** submit 无 result */
  result?: "passed" | "rejected";
  operatorId: number;
  operatorName: string;
  departmentName?: string;
  createdTime: string;
}

/** GET /api/v1/materials/audits/{id} */
export function listMaterialAudits(id: string) {
  return get<{ list: MaterialAuditRecord[] }>(`/materials/audits/${encodeURIComponent(id)}`);
}

/**
 * 接口未带 submit 时，展示层按上传信息补一条「发起申请」（倒序末尾）。
 * 与直播管理 `ensureActivitySubmitAudit` 同口径；后端 listAudits 也会合成。
 */
export function ensureMaterialSubmitAudit(
  rows: MaterialAuditRecord[],
  opts?: {
    uploadedTime?: string;
    uploaderName?: string;
    departmentName?: string;
    uploaderId?: number;
  },
): MaterialAuditRecord[] {
  const hasSubmit = rows.some((r) => r.action === "submit");
  if (hasSubmit) return rows;
  return [
    ...rows,
    {
      id: "synthetic-submit",
      action: "submit",
      operatorId: opts?.uploaderId ?? 0,
      operatorName: opts?.uploaderName?.trim() || "系统",
      departmentName: opts?.departmentName,
      createdTime: opts?.uploadedTime ?? "",
    },
  ];
}

/** DELETE /api/v1/materials/delete/{id} 软删 */
export function deleteMaterial(id: string) {
  return del<{ id: string }>(`/materials/delete/${id}`);
}
