/**
 * 课程分享链接不透明 query `c`（XOR + 校验和 + Base64URL）。
 *
 * 明文组成字段（与直播观看链同级精简；课程 id 在路径 `/course/{id}`，**不进 `c`**）：
 *   1. kind      — 邀请类型（与直播共用）：`1` 员工邀请 / `2` 观众邀请（废弃）
 *   2. inviterId — kind=1 时为员工 `rs_mainkey_id`
 *   3. sig       — fnv1a(`${kind}.${inviterId}|SECRET`)
 *
 * 此前曾把 courseId 打进 `c`，导致 token 远长于直播；已压缩。解码/enroll **只信 `c`**，忽略 hint query。
 */

export type CourseSharePayload = {
  kind: "employee";
  inviterId: number;
};

const SECRET = "qk-course-share-v1";

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

/** 生成课程分享 `c`（仅 kind + inviterId + sig）。 */
export function encodeCourseShareToken(inviterId: number): string {
  const body = `1.${inviterId}`;
  const sig = fnv1a(`${body}|${SECRET}`);
  const plain = `${body}.${sig}`;
  return toBase64Url(xorBytes(new TextEncoder().encode(plain), SECRET));
}

/** 解析 `c`；校验失败返回 null。不读 URL 上的 hint 参数。 */
export function decodeCourseShareToken(token: string): CourseSharePayload | null {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) return null;
  const encrypted = fromBase64Url(raw);
  if (!encrypted || encrypted.byteLength === 0) return null;
  let plain: string;
  try {
    plain = new TextDecoder().decode(xorBytes(encrypted, SECRET));
  } catch {
    return null;
  }
  const parts = plain.split(".");
  if (parts.length !== 3) return null;
  const [typeStr, inviterStr, sig] = parts;
  if (!typeStr || !inviterStr || !sig) return null;
  const body = `${typeStr}.${inviterStr}`;
  if (sig !== fnv1a(`${body}|${SECRET}`)) return null;
  const type = Number(typeStr);
  const inviterId = Number(inviterStr);
  if (type !== 1) return null;
  if (!Number.isInteger(inviterId) || inviterId <= 0) return null;
  return { kind: "employee", inviterId };
}
