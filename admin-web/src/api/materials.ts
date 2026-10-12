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

export type MaterialStatus = "available" | "unavailable";

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
  uploadedAt: string;
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

/** DELETE /api/materials/{id} 软删 */
export function deleteMaterial(id: string) {
  return del<{ id: string }>(`/materials/${id}`);
}
