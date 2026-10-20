/** 观众观看页根地址。换域名或端口只改这里。 */
const AUDIENCE_WATCH_ORIGIN = "http://localhost:5174";

/** 主播邀请页路径，须与路由 HostInviteView 一致。 */
export const HOST_INVITE_PATH_PREFIX = "/invite/host";

/**
 * 观众观看链接。
 * 列表分享、详情复制、开播设置都走本函数，避免各处手写地址。
 */
export function buildAudienceWatchUrl(activityId: string): string {
  const id = activityId.trim();
  return `${AUDIENCE_WATCH_ORIGIN}/watch/${id}`;
}

/**
 * 主播邀请链接，打开 admin-web 邀请页，不带角色参数，打开后不会写入开播角色。
 * 用当前管理端源站，本地和已部署环境各自得到自己的地址。
 */
export function buildHostInviteUrl(activityId: string): string {
  const id = activityId.trim();
  const origin = window.location.origin.replace(/\/$/, "");
  return `${origin}${HOST_INVITE_PATH_PREFIX}/${id}`;
}

/**
 * 微信邀约链接。主播、助理、嘉宾都进同一个邀请页，用查询参数区分角色和邀约人。
 * role：1 主播 / 2 助理 / 3 嘉宾。inviterId 为发出邀约的员工 id。
 */
export function buildRoleInviteUrl(
  activityId: string,
  role: number,
  inviterId: number,
): string {
  const id = activityId.trim();
  const origin = window.location.origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    role: String(role),
    inviter: String(inviterId),
  });
  return `${origin}${HOST_INVITE_PATH_PREFIX}/${id}?${params.toString()}`;
}
