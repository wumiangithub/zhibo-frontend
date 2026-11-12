import axios from "axios";
import { getAccessToken } from "@/utils/authSession";
import { apiV1 } from "./apiBase";
import { del, get, post, put } from "./http";

export type ShelfStatus = "pending" | "on" | "off" | "banned";
export type RiskStatus = "pending" | "passed" | "rejected";
export type CourseSortKey = "entitledUserCount" | "totalUserCount" | "salesCount" | "updatedTime";
export type CourseSellType = "free" | "encrypted" | "specified";
export type CourseAccessValidityType = "long" | "days" | "fixed";

export const COURSE_SELL_TYPE_LABEL: Record<CourseSellType, string> = {
  free: "免费",
  encrypted: "加密",
  specified: "指定学员",
};

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
  listedTime?: string;
  owners?: CoursePerson[];
  contentCount: number;
  entitledUserCount: number;
  totalUserCount: number;
  salesCount: number;
  sellType?: CourseSellType;
  validityLabel?: string;
  updatedTime?: string;
  createdTime?: string;
  canList: boolean;
  canUnlist: boolean;
  /** 提示可否删除；缺省按可删。UI 不置灰，由 DELETE 接口校验并 toast */
  canDelete?: boolean;
}

export interface CourseDetail extends CourseListItem {
  introduction?: string;
  detailHtml?: string;
  coverMaterialId?: string;
  materials?: CourseMaterial[];
  sellAlone?: boolean;
  accessValidityType?: CourseAccessValidityType;
  accessValidityDays?: number;
  /** type=fixed，yyyy-MM-dd HH:mm:ss */
  accessValidityFixedTime?: string;
  /** 仅 encrypted 时回显明文 */
  password?: string;
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
  /** 是否上架：true → 创建/保存成功 shelfStatus=on */
  listed: boolean;
  /** 归属人员工 id（rs_mainkey_id） */
  ownerIds: number[];
  /** 课件（有序）：素材 id + 学员权限 */
  materials?: CreateCourseMaterialItem[];
}

export function createCourse(payload: CreateCoursePayload) {
  return post<{ id: string }>("/courses/create", payload);
}

/** 更新课程基本信息；免审保持 passed；listed 立刻改上架 */
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

export interface UpdateCourseSalesPayload {
  sellAlone: boolean;
  sellType: CourseSellType;
  password?: string;
  accessValidityType?: CourseAccessValidityType;
  accessValidityDays?: number;
  /** type=fixed，yyyy-MM-dd HH:mm:ss */
  accessValidityFixedTime?: string;
}

export function updateCourseSales(id: string, payload: UpdateCourseSalesPayload) {
  return put<{ id: string; sellType: CourseSellType; validityLabel: string }>(
    `/courses/sales/${encodeURIComponent(id)}`,
    payload,
  );
}

/** 列表/导出售卖标签：免费 / 长期有效 */
export function courseSellTagText(item: Pick<CourseListItem, "sellType" | "validityLabel">) {
  const sell = item.sellType ? COURSE_SELL_TYPE_LABEL[item.sellType] : "";
  const validity = item.validityLabel?.trim() || "长期有效";
  if (sell) return `${sell} / ${validity}`;
  return validity;
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
  return post<null>(
    `/courses/catalog/lessons/bind-lives/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function bindCatalogMaterials(
  courseId: string,
  payload: { parentId: number; materialIds: string[] },
) {
  return post<null>(
    `/courses/catalog/lessons/bind-materials/${encodeURIComponent(courseId)}`,
    payload,
  );
}

export function updateCatalogLesson(
  courseId: string,
  payload: { id: number; title: string },
) {
  return post<CatalogNode>(
    `/courses/catalog/lessons/update/${encodeURIComponent(courseId)}`,
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

/** 课程用户列表权益计算态（D100） */
export type CourseUserEntitlementState = "valid" | "expired" | "invalid";

export interface CourseUserListItem {
  id: number;
  nickname?: string;
  avatar?: string;
  phoneMasked?: string;
  tagLabels?: string[];
  chapterCompletionRate: number;
  entitlementStatus: number;
  entitlementState: CourseUserEntitlementState;
  entitlementStateLabel: string;
  acquireWayLabel: string;
  /** 权益首次获取时间 = created_time */
  firstAcquireTime?: string;
  expireTime?: string;
  expireDisplay: string;
}

export interface CourseUserListResult {
  page: number;
  pageSize: number;
  total: number;
  list: CourseUserListItem[];
}

export type CourseUserKeywordType = "nickname" | "id" | "phone";

export type CourseUserListQuery = {
  page?: number;
  pageSize?: number;
  keywordType?: CourseUserKeywordType;
  keyword?: string;
  entitlementState?: CourseUserEntitlementState;
};

export function listCourseUsers(courseId: string, params: CourseUserListQuery = {}) {
  return get<CourseUserListResult>(`/courses/users/list/${encodeURIComponent(courseId)}`, {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      keywordType: params.keywordType || undefined,
      keyword: params.keyword?.trim() || undefined,
      entitlementState: params.entitlementState,
    },
  });
}

export function updateCourseUserEntitlement(rowId: number, entitlementStatus: 0 | 1) {
  return put<{ id: number; entitlementStatus: number }>(
    `/courses/users/entitlement/${rowId}`,
    { entitlementStatus },
  );
}

export function updateCourseUserExpire(rowId: number, expireTime: string) {
  return put<{ id: number; expireTime: string }>(`/courses/users/expire/${rowId}`, {
    expireTime,
  });
}

export interface CourseUserImportByTagsResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface CourseUserImportByTagsEstimate {
  /** 所选标签「满足其一」去重后的观众数 */
  total: number;
}

/** 标签导入预计人数（去重，不写入） */
export function estimateCourseUsersByTags(courseId: string, tagIds: number[]) {
  return post<CourseUserImportByTagsEstimate>(
    `/courses/users/import-by-tags/estimate/${encodeURIComponent(courseId)}`,
    { tagIds },
  );
}

/** 标签导入：所选标签「满足其一」的观众 upsert 本课学员；expireTime 选填（yyyy-MM-dd） */
export function importCourseUsersByTags(
  courseId: string,
  tagIds: number[],
  expireTime?: string,
) {
  const body: { tagIds: number[]; expireTime?: string } = { tagIds };
  const expire = expireTime?.trim();
  if (expire) body.expireTime = expire;
  return post<CourseUserImportByTagsResult>(
    `/courses/users/import-by-tags/${encodeURIComponent(courseId)}`,
    body,
  );
}

/** phone 与 username 二选一；created=false 表示本课已有该学员；expireTime 选填仅新建生效 */
export function createCourseUser(
  courseId: string,
  body: ({ phone: string } | { username: string }) & { expireTime?: string },
) {
  return post<{ id: number; username: string; created: boolean }>(
    `/courses/users/create/${encodeURIComponent(courseId)}`,
    body,
  );
}

export interface CourseUserImportResult {
  importId?: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: { row: number; phone?: string; reason?: string }[];
}

export interface CourseUserImportHistoryItem {
  id: number;
  importTime?: string;
  importerId?: number;
  importerName?: string;
  successCount: number;
  failCount: number;
}

export async function importCourseUsers(
  courseId: string,
  file: File,
  expireTime?: string,
) {
  const form = new FormData();
  form.append("file", file);
  const expire = expireTime?.trim();
  if (expire) form.append("expireTime", expire);
  const token = getAccessToken();
  const resp = await axios.post(
    apiV1(`/courses/users/import/${encodeURIComponent(courseId)}`),
    form,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 60000,
    },
  );
  const body = resp.data as { code: number; msg: string; data: CourseUserImportResult };
  if (body?.code !== 0) {
    throw new Error(body?.msg || "导入失败");
  }
  return body.data;
}

export function listCourseUserImports(courseId: string) {
  return get<{ list: CourseUserImportHistoryItem[] }>(
    `/courses/users/imports/list/${encodeURIComponent(courseId)}`,
  );
}

async function downloadAuthorizedBlob(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
) {
  const token = getAccessToken();
  try {
    const resp = await axios.get(url, {
      responseType: "blob",
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 60000,
    });
    await saveBlob(resp.data as Blob, filename);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      throw new Error(await blobErrorMessage(e.response.data));
    }
    throw e;
  }
}

async function saveBlob(blob: Blob, filename: string) {
  if (blob.type && blob.type.includes("application/json")) {
    throw new Error(await blobErrorMessage(blob));
  }
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

async function blobErrorMessage(blob: Blob): Promise<string> {
  const text = await blob.text();
  try {
    const body = JSON.parse(text) as { msg?: string };
    if (body?.msg) return body.msg;
  } catch {
    // not json
  }
  return "下载失败";
}

export async function downloadCourseUserImportTemplate() {
  await downloadAuthorizedBlob(
    apiV1("/courses/users/import-template"),
    "course-user-import.csv",
  );
}

export async function downloadCourseUserImportFailures(importId: number) {
  await downloadAuthorizedBlob(
    apiV1(`/courses/users/imports/failures/${importId}`),
    "course-user-import-failures.csv",
  );
}

export async function exportCourseUsers(courseId: string, params: CourseUserListQuery = {}) {
  await downloadAuthorizedBlob(
    apiV1(`/courses/users/export/${encodeURIComponent(courseId)}`),
    "course-user-export.csv",
    {
      keywordType: params.keywordType || undefined,
      keyword: params.keyword?.trim() || undefined,
      entitlementState: params.entitlementState,
    },
  );
}

/** 数据分析 · 小节概况（D101） */
export type CourseAnalyticsLessonSortBy =
  | "participateCount"
  | "participateRate"
  | "completeCount"
  | "completeRate";

export interface CourseAnalyticsLessonItem {
  lessonNodeId: number;
  title: string;
  contentKind?: number;
  participateCount: number;
  participateRate: number;
  completeCount: number;
  completeRate: number;
}

export interface CourseAnalyticsLessonListResult {
  total: number;
  page: number;
  pageSize: number;
  validStudentCount: number;
  list: CourseAnalyticsLessonItem[];
}

export interface CourseAnalyticsLessonQuery {
  page?: number;
  pageSize?: number;
  sortBy?: CourseAnalyticsLessonSortBy | "";
  sortOrder?: "asc" | "desc" | "";
}

export function listCourseAnalyticsLessons(
  courseId: string,
  params: CourseAnalyticsLessonQuery = {},
) {
  return get<CourseAnalyticsLessonListResult>(
    `/courses/analytics/lessons/${encodeURIComponent(courseId)}`,
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        sortBy: params.sortBy || undefined,
        sortOrder: params.sortOrder || undefined,
      },
    },
  );
}

export async function exportCourseAnalyticsLessons(
  courseId: string,
  params: Pick<CourseAnalyticsLessonQuery, "sortBy" | "sortOrder"> = {},
) {
  await downloadAuthorizedBlob(
    apiV1(`/courses/analytics/lessons/export/${encodeURIComponent(courseId)}`),
    "course-analytics-lessons.csv",
    {
      sortBy: params.sortBy || undefined,
      sortOrder: params.sortOrder || undefined,
    },
  );
}

/** 数据分析 · 用户详情（D101） */
export type CourseAnalyticsParticipateStatus = 0 | 1 | 2;
export type CourseAnalyticsEntitlementDisplay = "valid" | "expired" | "invalid";

export interface CourseAnalyticsUserItem {
  username: string;
  nickname: string;
  avatarUrl?: string;
  participateStatus: CourseAnalyticsParticipateStatus;
  completedLessonCount: number;
  lessonCompletionRate: number;
  learnDurationSec: number;
  entitlementDisplay: CourseAnalyticsEntitlementDisplay;
}

export interface CourseAnalyticsUserListResult {
  total: number;
  page: number;
  pageSize: number;
  list: CourseAnalyticsUserItem[];
}

export function listCourseAnalyticsUsers(
  courseId: string,
  params: { page?: number; pageSize?: number; keywordType?: string; keyword?: string } = {},
) {
  return get<CourseAnalyticsUserListResult>(
    `/courses/analytics/users/${encodeURIComponent(courseId)}`,
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        keywordType: params.keywordType || undefined,
        keyword: params.keyword?.trim() || undefined,
      },
    },
  );
}

export async function exportCourseAnalyticsUsers(
  courseId: string,
  params: { keywordType?: string; keyword?: string } = {},
) {
  await downloadAuthorizedBlob(
    apiV1(`/courses/analytics/users/export/${encodeURIComponent(courseId)}`),
    "course-analytics-users.csv",
    {
      keywordType: params.keywordType || undefined,
      keyword: params.keyword?.trim() || undefined,
    },
  );
}

export interface CourseAnalyticsUserLessonItem {
  lessonNodeId: number;
  title: string;
  contentKind?: number;
  participateStatus: CourseAnalyticsParticipateStatus;
  learnDurationSec: number;
  progressBarSec?: number | null;
}

export interface CourseAnalyticsUserLessonListResult {
  username: string;
  nickname: string;
  avatarUrl?: string;
  completedLessonCount: number;
  lessonCompletionRate: number;
  totalLessonCount: number;
  total: number;
  page: number;
  pageSize: number;
  list: CourseAnalyticsUserLessonItem[];
}

export function listCourseAnalyticsUserLessons(
  courseId: string,
  params: { username: string; page?: number; pageSize?: number },
) {
  return get<CourseAnalyticsUserLessonListResult>(
    `/courses/analytics/users/lessons/${encodeURIComponent(courseId)}`,
    {
      params: {
        username: params.username,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
      },
    },
  );
}

export const COURSE_ANALYTICS_PARTICIPATE_LABEL: Record<number, string> = {
  0: "未开始",
  1: "进行中",
  2: "已完成",
};

export const COURSE_ANALYTICS_ENTITLEMENT_LABEL: Record<string, string> = {
  valid: "有效",
  expired: "已到期",
  invalid: "已失效",
};
