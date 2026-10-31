import { del, get, post } from "./http";

export type ShelfStatus = "pending" | "on" | "off" | "banned";
export type RiskStatus = "pending" | "passed" | "rejected";
export type CourseSortKey = "entitledUserCount" | "totalUserCount" | "salesCount" | "updatedTime";

export const SHELF_STATUS_LABEL: Record<ShelfStatus, string> = {
  pending: "待上架",
  on: "已上架",
  off: "已下架",
  banned: "强制封禁",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  pending: "待审核",
  passed: "已通过",
  rejected: "已驳回",
};

export interface CoursePerson {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  avatar?: string;
}

/** 课程课件学员权限（D55 整数；对齐库 access_permission） */
export const CourseMaterialAccess = {
  /** 1 预览及下载 */
  PREVIEW_DOWNLOAD: 1,
  /** 2 仅预览 */
  PREVIEW_ONLY: 2,
  /** 3 仅下载 */
  DOWNLOAD_ONLY: 3,
} as const;

export type CourseMaterialAccessPermission =
  (typeof CourseMaterialAccess)[keyof typeof CourseMaterialAccess];

export interface CourseMaterial {
  id: string;
  name: string;
  url?: string;
  type: string;
  fileSize?: number;
  mimeType?: string;
  /** 1 预览及下载 / 2 仅预览 / 3 仅下载 */
  accessPermission?: CourseMaterialAccessPermission;
}

/** 创建课程课件项 */
export interface CreateCourseMaterialItem {
  id: string;
  accessPermission: CourseMaterialAccessPermission;
}

export interface CourseListItem {
  id: string;
  title: string;
  coverUrl?: string;
  shelfStatus: ShelfStatus;
  riskStatus: RiskStatus;
  autoList?: boolean;
  listedTime?: string;
  owners?: CoursePerson[];
  contentCount: number;
  entitledUserCount: number;
  totalUserCount: number;
  salesCount: number;
  updatedTime?: string;
  createdTime?: string;
  canList: boolean;
  canUnlist: boolean;
  canDelete: boolean;
}

export interface CourseDetail extends CourseListItem {
  introduction?: string;
  detailHtml?: string;
  coverMaterialId?: string;
  materials?: CourseMaterial[];
}

export interface CourseListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  shelfStatus?: ShelfStatus | "";
  ownerName?: string;
  riskStatus?: RiskStatus | "";
  sort?: CourseSortKey;
  order?: "asc" | "desc";
}

export interface CreateCoursePayload {
  title: string;
  introduction?: string;
  detailHtml?: string;
  coverMaterialId: string;
  autoList: boolean;
  /** 归属人员工 id（rs_mainkey_id） */
  ownerIds: number[];
  /** 课件（有序）：素材 id + 学员权限 */
  materials?: CreateCourseMaterialItem[];
  /** @deprecated 兼容旧调用；优先传 materials */
  materialIds?: string[];
}

export function createCourse(payload: CreateCoursePayload) {
  return post<{ id: string }>("/courses/create", payload);
}

/** 更新课程基本信息；审核中不可改，保存后重新进入待审核 */
export type UpdateCoursePayload = CreateCoursePayload;

export function updateCourse(id: string, payload: UpdateCoursePayload) {
  return post<{ id: string }>(`/courses/update/${encodeURIComponent(id)}`, payload);
}

export function listCourses(query: CourseListQuery) {
  return get<{ page: number; pageSize: number; total: number; list: CourseListItem[] }>("/courses/list", {
    params: query,
  });
}

export function getCourse(id: string) {
  return get<CourseDetail>(`/courses/detail/${encodeURIComponent(id)}`);
}

export function deleteCourse(id: string) {
  return del<{ id: string }>(`/courses/delete/${encodeURIComponent(id)}`);
}

export function setCourseShelf(id: string, listed: boolean) {
  return post<{ id: string; shelfStatus: ShelfStatus }>(`/courses/shelf/${encodeURIComponent(id)}`, {
    listed,
  });
}

export type AuditAction = "submit" | "audit";
export type AuditResult = "passed" | "rejected";

export interface CourseAuditRecord {
  id: string;
  action?: AuditAction;
  result?: AuditResult;
  reason?: string;
  /** 操作人员工 id（rs_mainkey_id） */
  operatorId: number;
  operatorName: string;
  /** 操作人部门展示名；无则省略 */
  departmentName?: string;
  createdTime: string;
}

export function listCourseAudits(id: string) {
  return get<{ list: CourseAuditRecord[] }>(`/courses/audits/${encodeURIComponent(id)}`);
}

/** 接口未带 submit 时，展示层按创建时间补一条「发起申请」。 */
export function ensureCourseSubmitAudit(rows: CourseAuditRecord[], createdTime?: string): CourseAuditRecord[] {
  const hasSubmit = rows.some((row) => row.action === "submit" || (!row.action && !row.result));
  if (hasSubmit) return rows;
  return [
    ...rows,
    {
      id: "synthetic-submit",
      action: "submit",
      operatorId: 0,
      operatorName: "系统",
      createdTime: createdTime ?? "",
    },
  ];
}

export function submitCourseAudit(id: string, payload: { result: AuditResult; reason?: string }) {
  return post<{ id: string; riskStatus: RiskStatus; shelfStatus: ShelfStatus }>(
    `/courses/audit/${encodeURIComponent(id)}`,
    payload,
  );
}

/** 1 章节 / 2 子课程 / 3 小节 */
export const CourseCatalogNodeType = {
  CHAPTER: 1,
  SUBCOURSE: 2,
  LESSON: 3,
} as const;

export type CourseCatalogNodeTypeValue =
  (typeof CourseCatalogNodeType)[keyof typeof CourseCatalogNodeType];

/** 1 直播 / 2 图片 / 3 视频 / 4 文档 / 5 文章 */
export const CourseCatalogContentKind = {
  LIVE: 1,
  IMAGE: 2,
  VIDEO: 3,
  DOCUMENT: 4,
  ARTICLE: 5,
} as const;

export type CourseCatalogContentKindValue =
  (typeof CourseCatalogContentKind)[keyof typeof CourseCatalogContentKind];

export const CATALOG_CONTENT_KIND_LABEL: Record<CourseCatalogContentKindValue, string> = {
  [CourseCatalogContentKind.LIVE]: "直播",
  [CourseCatalogContentKind.IMAGE]: "图片",
  [CourseCatalogContentKind.VIDEO]: "视频",
  [CourseCatalogContentKind.DOCUMENT]: "文档",
  [CourseCatalogContentKind.ARTICLE]: "文章",
};

export interface CatalogNode {
  id: number;
  courseId: string;
  parentId: number;
  nodeType: CourseCatalogNodeTypeValue;
  title: string;
  coverMaterialId?: string;
  coverUrl?: string;
  contentKind?: CourseCatalogContentKindValue;
  contentId?: string;
  sortOrder: number;
  chapterCount?: number;
  lessonCount?: number;
}

export function listCourseCatalog(courseId: string) {
  return get<{ list: CatalogNode[] }>(`/courses/catalog/list/${encodeURIComponent(courseId)}`);
}

export function listCatalogUsedContents(courseId: string) {
  return get<{ lives: string[]; materials: string[] }>(
    `/courses/catalog/used-contents/${encodeURIComponent(courseId)}`,
  );
}

export function bindCatalogLives(
  courseId: string,
  payload: { parentId: number; activityIds: string[] },
) {
  return post<{ list: CatalogNode[]; contentCount: number }>(
    `/courses/catalog/lessons/bind-lives/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function createCatalogChapter(
  courseId: string,
  payload: { parentId: number; title: string },
) {
  return post<CatalogNode>(`/courses/catalog/chapters/create/${encodeURIComponent(courseId)}`, payload);
}

export function updateCatalogChapter(
  courseId: string,
  payload: { id: number; title: string },
) {
  return post<CatalogNode>(`/courses/catalog/chapters/update/${encodeURIComponent(courseId)}`, payload);
}

export function deleteCatalogChapter(
  courseId: string,
  payload: { id: number; keepContents: boolean; targetChapterId?: number },
) {
  return post<{ id: number }>(
    `/courses/catalog/chapters/delete/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function createCatalogSubcourse(
  courseId: string,
  payload: { title: string; coverMaterialId: string; moveRootContents?: boolean },
) {
  return post<CatalogNode>(
    `/courses/catalog/subcourses/create/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function updateCatalogSubcourse(
  courseId: string,
  payload: { id: number; title: string; coverMaterialId: string },
) {
  return post<CatalogNode>(
    `/courses/catalog/subcourses/update/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function deleteCatalogSubcourse(
  courseId: string,
  payload: { id: number; keepContents: boolean; targetSubcourseId?: number },
) {
  return post<{ id: number }>(
    `/courses/catalog/subcourses/delete/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function reorderCatalogSubcourses(courseId: string, ids: number[]) {
  return post<null>(`/courses/catalog/subcourses/reorder/${encodeURIComponent(courseId)}`, { ids });
}

export function reorderCatalogChapters(
  courseId: string,
  payload: { parentId: number; ids: number[] },
) {
  return post<null>(
    `/courses/catalog/chapters/reorder/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function reorderCatalogLessons(
  courseId: string,
  payload: { parentId: number; ids: number[] },
) {
  return post<null>(
    `/courses/catalog/lessons/reorder/${encodeURIComponent(courseId)}`,
    payload,
  );
}

/** 目录排序弹窗统一保存：`mode` 为 chapters | lessons */
export function reorderCourseCatalog(
  courseId: string,
  payload: {
    parentId: number;
    mode: "chapters" | "lessons";
    items: { id: number; parentId: number }[];
  },
) {
  return post<null>(
    `/courses/catalog/reorder/${encodeURIComponent(courseId)}`,
    payload,
  );
}
