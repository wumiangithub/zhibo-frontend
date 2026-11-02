import { encodeCourseShareToken } from "./courseShareToken";
import { buildShareUrl } from "./shareUrl";

/** 学员课程页根地址（live-web）。换域名或端口只改这里。 */
const COURSE_WATCH_ORIGIN = "http://localhost:5174";

/**
 * 课程分享长链接。
 * 路径带 courseId；`c` 仅编码 kind+inviterId（与直播同级精简，见 courseShareToken）。
 * 拼装一律走 {@link buildShareUrl}；hint 的 courseId/kind/inviterId 仅人读。
 */
export function buildCourseShareUrl(courseId: string, employeeInviterId?: number): string {
  const id = courseId.trim();
  const base = `${COURSE_WATCH_ORIGIN}/course/${id}`;
  if (!employeeInviterId || employeeInviterId <= 0) return base;
  return buildShareUrl(base, encodeCourseShareToken(employeeInviterId), {
    kind: 1,
    courseId: id,
    inviterId: employeeInviterId,
  });
}
