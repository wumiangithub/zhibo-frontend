import { post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export type EnrollCourseResult = {
  id: number;
  viewerId: number;
  courseId: string;
  created: boolean;
  title: string;
};

/**
 * 课程分享链 enroll。观众 id 只从 Authorization 取；Body 不传 viewerId。
 */
export function enrollCourse(
  courseId: string,
  body?: { inviterId?: number },
) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<EnrollCourseResult>(
    `/watch/course/enroll/${courseId}`,
    body ?? {},
    { headers },
  );
}
