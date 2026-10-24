import { encodeInviteToken } from "./inviteToken";

/** 观众观看页根地址。换域名或端口只改这里。 */
const AUDIENCE_WATCH_ORIGIN = "http://localhost:5174";

/** 主播邀请页路径，须与路由 HostInviteView 一致。 */
export const HOST_INVITE_PATH_PREFIX = "/invite/host";

/** 本站开播页（iframe 嵌微吼参会地址），须与路由 LiveStudioView 一致。 */
export const LIVE_STUDIO_PATH_PREFIX = "/live/studio";

/**
 * 口令开播 H5 落地页（公开）。须与路由 PasscodeHostView 一致。
 * 口令本身是凭证；链接只负责预填，App 以后也可只输口令进房。
 */
export const PASSCODE_HOST_PATH = "/host/passcode";

/** 口令进房后的 iframe 开播壳（公开，读 sessionStorage）。 */
export const PASSCODE_STUDIO_PATH = "/live/studio-by-passcode";

/** 口令开播链接 query：口令。 */
export const PASSCODE_HOST_CODE_QUERY = "code";

/** 口令开播链接 query：讲师名称（可选，默认「讲师」）。 */
export const PASSCODE_HOST_NAME_QUERY = "name";

/** 口令进房成功后写入 sessionStorage，供 studio-by-passcode 读 hostUrl。 */
export const PASSCODE_STUDIO_SESSION_KEY = "zhibo.passcodeStudio";

/** 邀约页不透明参数名（内含 role + inviter，见 inviteToken）。 */
export const HOST_INVITE_TOKEN_QUERY = "c";

/** 口令开播默认讲师名（表单预填与 enter 缺省一致）。 */
export const PASSCODE_DEFAULT_NICKNAME = "讲师";

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

/**
 * 口令开播链接（发给主播的本站 H5，不是微吼 hostUrl）。
 * nickname 省略则不带 name query，页面默认「讲师」。
 */
export function buildPasscodeHostUrl(passcode: string, nickname?: string): string {
  const code = passcode.trim();
  const origin = window.location.origin.replace(/\/$/, "");
  const params = new URLSearchParams({ [PASSCODE_HOST_CODE_QUERY]: code });
  const name = (nickname ?? "").trim();
  if (name && name !== PASSCODE_DEFAULT_NICKNAME) {
    params.set(PASSCODE_HOST_NAME_QUERY, name);
  }
  return `${origin}${PASSCODE_HOST_PATH}?${params.toString()}`;
}

export interface PasscodeStudioSession {
  activityId: string;
  hostUrl: string;
  nickname?: string;
}

export function savePasscodeStudioSession(session: PasscodeStudioSession): void {
  sessionStorage.setItem(PASSCODE_STUDIO_SESSION_KEY, JSON.stringify(session));
}

export function loadPasscodeStudioSession(): PasscodeStudioSession | null {
  const raw = sessionStorage.getItem(PASSCODE_STUDIO_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PasscodeStudioSession;
    const activityId = String(parsed?.activityId ?? "").trim();
    const hostUrl = String(parsed?.hostUrl ?? "").trim();
    if (!activityId || !hostUrl) return null;
    return {
      activityId,
      hostUrl,
      nickname: parsed.nickname?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export function clearPasscodeStudioSession(): void {
  sessionStorage.removeItem(PASSCODE_STUDIO_SESSION_KEY);
}
