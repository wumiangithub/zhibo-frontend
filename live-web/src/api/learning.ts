import { get, post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export type LessonContent = {
  lessonNodeId: number;
  title: string;
  contentKind: number;
  contentId: string;
  participateStatus: number;
  progressPercent?: number;
  progressBarSec?: number | null;
  materialUrl?: string | null;
  mimeType?: string | null;
  materialName?: string | null;
  articleHtml?: string | null;
  /** 仅文章作者 */
  author?: string | null;
  activityId?: string | null;
};

export type LessonProgressResult = {
  lessonNodeId: number;
  participateStatus: number;
  learnDurationSec: number;
  progressBarSec?: number | null;
  progressPercent: number;
  completed: boolean;
};

/** 目录节点：章节 */
export const NODE_CHAPTER = 1;
/** 目录节点：小节 */
export const NODE_LESSON = 3;

const STATUS_IN_PROGRESS = 1;
const STATUS_COMPLETED = 2;

export interface LearningPage<T> {
  total: number;
  list: T[];
}

/** GET /viewer/learning/lives 列表项，字段同公开观看列表。 */
export interface LearningLiveItem {
  id: string;
  title: string;
  state: number;
  startTime: string;
  coverUrl: string;
}

/** GET /viewer/learning/courses 列表项。 */
export interface LearningCourseItem {
  id: string;
  title: string;
  coverUrl: string;
  subCourseCount: number;
  lessonCount: number;
  acquiredTime: string;
}

export interface LearningSubCourse {
  id: number;
  title: string;
  coverUrl: string;
  lessonCount: number;
}

export interface LearningCatalogNode {
  id: number;
  parentId: number;
  nodeType: number;
  title: string;
  contentKind: number | null;
  contentId: string;
  coverUrl: string;
  lessonCount: number;
  contentKindLabel: string;
  metaLabel: string;
  participateStatus: number;
  progressPercent: number;
  /** 由 participateStatus 换成小程序文案，接口本身不返回该字段 */
  statusLabel: string;
}

export interface LearningCourseDetail {
  id: string;
  title: string;
  coverUrl: string;
  introduction: string;
  detailHtml: string;
  validityLabel: string;
  subCourses: LearningSubCourse[];
  nodes: LearningCatalogNode[];
}

function authHeaders(): Record<string, string> {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function asText(value: unknown): string {
  return value != null ? String(value) : "";
}

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 与小程序 participateStatusLabel 一致：0 未开始 / 1 学习中 / 2 已完成。 */
export function participateStatusLabel(status: number): string {
  if (status === STATUS_COMPLETED) return "已完成";
  if (status === STATUS_IN_PROGRESS) return "学习中";
  return "未开始";
}

function normalizeLive(raw: unknown): LearningLiveItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asText(r.id),
    title: asText(r.title),
    state: asNum(r.state),
    startTime: asText(r.startTime),
    coverUrl: asText(r.coverUrl),
  };
}

function normalizeCourse(raw: unknown): LearningCourseItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asText(r.id),
    title: asText(r.title),
    coverUrl: asText(r.coverUrl),
    subCourseCount: asNum(r.subCourseCount),
    lessonCount: asNum(r.lessonCount),
    acquiredTime: asText(r.acquiredTime),
  };
}

function normalizeSubCourse(raw: unknown): LearningSubCourse {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asNum(r.id),
    title: asText(r.title),
    coverUrl: asText(r.coverUrl),
    lessonCount: asNum(r.lessonCount),
  };
}

function normalizeNode(raw: unknown): LearningCatalogNode {
  const r = (raw ?? {}) as Record<string, unknown>;
  const status = r.participateStatus != null ? asNum(r.participateStatus) : 0;
  const kind = r.contentKind != null && r.contentKind !== "" ? asNum(r.contentKind, NaN) : null;
  return {
    id: asNum(r.id),
    parentId: asNum(r.parentId),
    nodeType: asNum(r.nodeType),
    title: asText(r.title),
    contentKind: kind != null && Number.isFinite(kind) ? kind : null,
    contentId: asText(r.contentId),
    coverUrl: asText(r.coverUrl),
    lessonCount: asNum(r.lessonCount),
    contentKindLabel: asText(r.contentKindLabel),
    metaLabel: asText(r.metaLabel),
    participateStatus: status,
    progressPercent: asNum(r.progressPercent),
    statusLabel: participateStatusLabel(status),
  };
}

function normalizeDetail(raw: unknown): LearningCourseDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const subCourses = Array.isArray(r.subCourses) ? r.subCourses.map(normalizeSubCourse) : [];
  const nodes = Array.isArray(r.nodes) ? r.nodes.map(normalizeNode) : [];
  return {
    id: asText(r.id),
    title: asText(r.title),
    coverUrl: asText(r.coverUrl),
    introduction: asText(r.introduction),
    detailHtml: asText(r.detailHtml),
    validityLabel: asText(r.validityLabel),
    subCourses,
    nodes,
  };
}

function normalizePage<T>(raw: unknown, mapItem: (item: unknown) => T): LearningPage<T> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.list) ? r.list.map(mapItem) : [];
  return {
    total: r.total != null ? asNum(r.total, list.length) : list.length,
    list,
  };
}

/** GET /viewer/learning/lives */
export function listLearningLives(opts?: { page?: number; pageSize?: number; state?: number }) {
  const params: Record<string, number> = {
    page: opts?.page ?? 1,
    pageSize: opts?.pageSize ?? 20,
  };
  if (opts?.state != null) params.state = opts.state;
  return get<unknown>("/viewer/learning/lives", {
    headers: authHeaders(),
    params,
  }).then((raw) => normalizePage(raw, normalizeLive));
}

/** GET /viewer/learning/courses */
export function listLearningCourses(opts?: { page?: number; pageSize?: number }) {
  return get<unknown>("/viewer/learning/courses", {
    headers: authHeaders(),
    params: {
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 20,
    },
  }).then((raw) => normalizePage(raw, normalizeCourse));
}

/** GET /viewer/learning/courses/detail/{courseId} */
export function getLearningCourseDetail(courseId: string) {
  const id = courseId.trim();
  if (!id) return Promise.reject(new Error("缺少课程 id"));
  return get<unknown>(`/viewer/learning/courses/detail/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  }).then(normalizeDetail);
}

/** GET /viewer/learning/courses/lessons/{courseId}/{lessonNodeId} */
export function getLearningLessonContent(courseId: string, lessonNodeId: number) {
  return get<LessonContent>(
    `/viewer/learning/courses/lessons/${encodeURIComponent(courseId)}/${lessonNodeId}`,
    { headers: authHeaders() },
  );
}

/** POST /watch/course/lessons/progress/{courseId} */
export function reportLessonProgress(
  courseId: string,
  body: {
    lessonNodeId: number;
    event: "open" | "heartbeat" | "scroll_bottom" | "live_ended";
    deltaLearnDurationSec?: number;
    progressBarSec?: number;
    progressPercent?: number;
  },
) {
  return post<LessonProgressResult>(
    `/watch/course/lessons/progress/${encodeURIComponent(courseId)}`,
    body,
    { headers: authHeaders() },
  );
}
