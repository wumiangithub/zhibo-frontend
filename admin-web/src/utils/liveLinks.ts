import { encodeInviteToken } from "./inviteToken";

/** 观众观看页根地址。换域名或端口只改这里。 */
const AUDIENCE_WATCH_ORIGIN = "http://localhost:5174";

/** 主播邀请页路径，须与路由 HostInviteView 一致。 */
export const HOST_INVITE_PATH_PREFIX = "/invite/host";

/** 本站开播页（iframe 嵌微吼参会地址），须与路由 LiveStudioView 一致。 */
export const LIVE_STUDIO_PATH_PREFIX = "/live/studio";

/** 邀约页不透明参数名（内含 role + inviter，见 inviteToken）。 */
export const HOST_INVITE_TOKEN_QUERY = "c";

/**
 * 观众观看链接。
 * 列表分享、详情复制、开播设置都走本函数，避免各处手写地址。
 */
export function buildAudienceWatchUrl(activityId: string): string {
  const id = activityId.trim();
  return `${AUDIENCE_WATCH_ORIGIN}/watch/${id}`;
}

/**
 * 开播角色邀约链接。开播设置「邀请主播」与角色设置「微信邀约」共用本函数。
 * 主播、助理、嘉宾都进同一个邀请页；role / inviter 打成单个不透明 query（`c`），不落明文。
 * role：1 主播 / 2 嘉宾 / 3 助理（与微吼 type 一致）。inviterId 为发出邀约的员工 id。
 */
export function buildRoleInviteUrl(
  activityId: string,
  role: number,
  inviterId: number,
): string {
  const id = activityId.trim();
  const origin = window.location.origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    [HOST_INVITE_TOKEN_QUERY]: encodeInviteToken(role, inviterId),
  });
  return `${origin}${HOST_INVITE_PATH_PREFIX}/${id}?${params.toString()}`;
}

/**
 * 本站开播页路径（相对当前管理端）。
 * role：1 主播 / 2 嘉宾 / 3 助理，与微吼 type 一致。
 */
export function buildLiveStudioPath(activityId: string, role: number): string {
  const id = activityId.trim();
  return `${LIVE_STUDIO_PATH_PREFIX}/${id}?role=${role}`;
}
