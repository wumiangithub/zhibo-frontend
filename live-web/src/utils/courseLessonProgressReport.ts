import { reportLessonProgress } from "@/api/learning";

/** 课程进观看/回放时 query 是否带有效小节上下文 */
export function hasCourseLessonContext(
  courseId: string,
  lessonNodeId: number,
): boolean {
  return (
    !!courseId && Number.isFinite(lessonNodeId) && lessonNodeId > 0
  );
}

/**
 * 静默上报课程小节进度（失败不打断观看）。
 * 直播结束页 → live_ended；回放进度/播完 → heartbeat + progressPercent。
 */
export function reportCourseLessonProgress(
  courseId: string,
  lessonNodeId: number,
  event: "open" | "heartbeat" | "scroll_bottom" | "live_ended",
  extra?: {
    deltaLearnDurationSec?: number;
    progressBarSec?: number;
    progressPercent?: number;
  },
): void {
  if (!hasCourseLessonContext(courseId, lessonNodeId)) return;
  void reportLessonProgress(courseId, {
    lessonNodeId,
    event,
    ...extra,
  }).catch(() => {
    /* 上报失败不打断观看 */
  });
}
