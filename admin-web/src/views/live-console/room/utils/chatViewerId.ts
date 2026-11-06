import { parsePresenceUserId } from "./presenceEmail";

/**
 * 从聊天原始项里抠邮箱或可拼成邮箱的第三方账号。
 * 优先顶层 / context / data 的 email；再兜底 third_account_id 等。
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

  const emailCandidates = [raw.email, ctx.email, data.email, raw.account, ctx.account];
  for (const v of emailCandidates) {
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }

  const thirds = [
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
    // 进房 account 常为纯数字观众 id 或 e{员工id}
    if (/^[1-9]\d{0,18}$/.test(s)) return `${s}@qkzb.com`;
    if (/^e[1-9]\d{0,18}$/i.test(s)) return `${s.toLowerCase()}@qkzb.com`;
  }
  return undefined;
}

/**
 * 聊天发送方 → 本站观众数字 id。
 * 仅观众形态（`{id}@qkzb.com`）；员工 / 游客返回 undefined。
 */
export function chatViewerIdFromRaw(raw: Record<string, unknown>): string | undefined {
  const email = pickChatEmailish(raw);
  const uid = parsePresenceUserId(email);
  if (uid && /^[1-9]\d{0,18}$/.test(uid)) return uid;
  return undefined;
}
