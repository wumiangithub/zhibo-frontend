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

function authHeaders(): Record<string, string> {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
