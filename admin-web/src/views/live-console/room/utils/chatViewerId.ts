import { parsePresenceUserId } from "./presenceEmail";

/**
 * 本站 TOS 头像路径：`.../viewer/avatar/{username}.png`（不含 default-avatar）。
 * 解析顺序里排在 query {@code v=} 之后（D111/D118）。
 */
const AVATAR_VIEWER = /\/viewer\/avatar\/([A-Za-z0-9]{1,16})(?:\.[a-z0-9]+)?(?:\?|#|$)/i;

/**
 * 任意头像 URL 的 `?v=` / `&v=`。
 * 观众 username ≤16；`v=z276` / `v=e276` 不当作观众（与 PresenceUserIds / email 本地部分一致）。
 */
const AVATAR_QUERY_V = /[?&]v=([A-Za-z0-9]{1,16})(?:&|#|$)/i;

/** 本站签给微吼的 account / 第三方账号本地部分：观众 username、z*、e*。 */
const ACCOUNT_LOCAL = /^(?:[A-Za-z0-9]{1,16}|[ze][1-9]\d{0,18})$/i;

function isStaffOrConsoleId(id: string): boolean {
  return /^e\d+$/i.test(id) || /^z\d+$/i.test(id);
}

/**
 * 从聊天原始项里抠邮箱或可拼成邮箱的第三方账号。
 * 含进房签名回显的 {@code account}（= 第三方用户唯一标识：观众 username / 中控 {@code z{id}} / 角色 {@code e{id}}）。
 * 聊天回包未必带回 account，故调用方仍要靠头像 {@code ?v=} 兜底。
 */
function pickChatEmailish(raw: Record<string, unknown>): string | undefined {
  const ctx =
    raw.context && typeof raw.context === "object"
      ? (raw.context as Record<string, unknown>)
      : {};
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : {};

  // 1a. 带 @ 的 email（含误放在 account 里的完整邮箱）
  const emailCandidates = [
    raw.email,
    ctx.email,
    data.email,
    raw.account,
    ctx.account,
    data.account,
  ];
  for (const v of emailCandidates) {
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }

  // 1b. account / third_*：本站进房 account 或微吼第三方账号（无 @ 的本地部分）
  const thirds = [
    raw.account,
    ctx.account,
    data.account,
    ctx.third_account_id,
    raw.third_account_id,
    ctx.third_party_user_id,
    raw.third_party_user_id,
    raw.third_user_id,
    ctx.third_user_id,
    data.third_account_id,
  ];
  for (const v of thirds) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (s.includes("@")) return s;
    if (ACCOUNT_LOCAL.test(s)) return `${s.toLowerCase()}@qkzb.com`;
  }
  return undefined;
}

/**
 * 从单个头像 URL 抠观众 username。
 * 顺序：先 query {@code v=}，再 path {@code /viewer/avatar/{username}}。
 */
export function viewerIdFromAvatarUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const q = AVATAR_QUERY_V.exec(trimmed);
  if (q?.[1]) {
    const v = q[1];
    if (isStaffOrConsoleId(v)) return undefined;
    return v;
  }
  const path = AVATAR_VIEWER.exec(trimmed);
  if (path?.[1]) return path[1];
  return undefined;
}

function viewerIdFromAvatar(raw: Record<string, unknown>): string | undefined {
  const ctx =
    raw.context && typeof raw.context === "object"
      ? (raw.context as Record<string, unknown>)
      : {};
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : {};
  for (const v of [raw.avatar, ctx.avatar, data.avatar, raw.avatarUrl, raw.avatar_url]) {
    if (typeof v !== "string" || !v.trim()) continue;
    const id = viewerIdFromAvatarUrl(v);
    if (id) return id;
  }
  return undefined;
}

/**
 * 聊天发送方 → 本站观众 username。
 * 仅观众形态；员工（{@code e*}/{@code z*}）/ 游客返回 undefined。
 *
 * 认人顺序（强制）：
 * 1. email / account / 第三方账号类字段（进房 {@code account} = 第三方用户唯一标识：观众 username /
 *    中控 {@code z{id}} / 角色 {@code e{id}}；聊天回包未必带回，故不能只靠它）
 * 2. 头像 URL 的 query {@code v=}（{@code v=z*}/{@code v=e*} 不当观众）
 * 3. 头像 path {@code /viewer/avatar/{username}.png}
 *
 * 若第 1 步已解析出非观众身份（{@code z*}/{@code e*}/游客），直接 undefined，不再用头像猜。
 */
export function chatViewerIdFromRaw(raw: Record<string, unknown>): string | undefined {
  const email = pickChatEmailish(raw);
  if (email) {
    const userId = parsePresenceUserId(email);
    if (userId && !isStaffOrConsoleId(userId)) return userId;
    if (userId) return undefined;
  }
  return viewerIdFromAvatar(raw);
}
