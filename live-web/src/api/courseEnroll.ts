import { post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export type EnrollCourseResult = {
  id: number;
  uid: number;
  courseId: string;
  created: boolean;
  title: string;
};

export type EnrollCourseBody = {
  /** 有邀请时必传；employee=员工 id；audience 亦必传（本轮后端拒收） */
  inviterId?: number;
  /** 缺省按 employee */
  inviterKind?: "employee" | "audience";
  /** 仅 audience：邀请人 username（不是被邀请学员） */
  username?: string;
};

/**
 * 课程分享登记学员。被邀请学员 username 只从 Authorization 取。
 */
export function enrollCourse(courseId: string, body?: EnrollCourseBody) {
  const token = getViewerAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return post<EnrollCourseResult>(
    `/watch/course/enroll/${courseId}`,
    body ?? {},
    { headers },
  );
}
