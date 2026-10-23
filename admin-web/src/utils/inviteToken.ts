/**
 * 开播邀约链接参数混淆：role + inviter 打成单个不透明 query，防随手改 URL。
 * 密钥写死在前端，只挡明文与乱改，不是服务端级机密。
 */

export type InviteTokenPayload = {
  role: number;
  inviterId: number;
};

/** 固定盐；改值会使已发出的邀约链接全部失效。 */
const INVITE_TOKEN_SECRET = "qk-live-invite-v1";

function fnv1a(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function xorBytes(bytes: Uint8Array, key: string): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]! ^ key.charCodeAt(i % key.length);
  }
  return out;
}

/** 生成邀约链接用的不透明 token（同 role+inviter 结果稳定，便于二维码复用）。 */
export function encodeInviteToken(role: number, inviterId: number): string {
  const body = `${role}.${inviterId}`;
  const sig = fnv1a(`${body}|${INVITE_TOKEN_SECRET}`);
  const plain = `${body}.${sig}`;
  const bytes = new TextEncoder().encode(plain);
  return toBase64Url(xorBytes(bytes, INVITE_TOKEN_SECRET));
}

/** 解析 token；校验失败或角色非法时返回 null。 */
export function decodeInviteToken(token: string): InviteTokenPayload | null {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) return null;
  const encrypted = fromBase64Url(raw);
  if (!encrypted || encrypted.byteLength === 0) return null;

  let plain: string;
  try {
    plain = new TextDecoder().decode(xorBytes(encrypted, INVITE_TOKEN_SECRET));
  } catch {
    return null;
  }

  const parts = plain.split(".");
  if (parts.length !== 3) return null;
  const [roleStr, inviterStr, sig] = parts;
  if (!roleStr || !inviterStr || !sig) return null;

  const body = `${roleStr}.${inviterStr}`;
  if (sig !== fnv1a(`${body}|${INVITE_TOKEN_SECRET}`)) return null;

  const role = Number(roleStr);
  const inviterId = Number(inviterStr);
  if (!Number.isInteger(role) || role < 1 || role > 3) return null;
  if (!Number.isInteger(inviterId) || inviterId <= 0) return null;
  return { role, inviterId };
}
