import { encodeCourseShareToken } from "./courseShareToken";
import { liveWebOrigin } from "./liveWebOrigin";
import { buildShareUrl } from "./shareUrl";

/**
 * 课程分享长链接。
 * 路径带 courseId；`c` 仅编码 kind+inviterId（与直播同级精简，见 courseShareToken）。
 * 拼装一律走 {@link buildShareUrl}；hint 仅 kind/inviterId（与直播对齐，不附 courseId）。
 */
export function buildCourseShareUrl(courseId: string, employeeInviterId?: number): string {
  const id = courseId.trim();
  const base = `${liveWebOrigin()}/course/${id}`;
  if (!employeeInviterId || employeeInviterId <= 0) return base;
  return buildShareUrl(base, encodeCourseShareToken(employeeInviterId), {
    kind: 1,
    inviterId: employeeInviterId,
  });
}
