/**
 * 课程分享链接不透明 query `c`（XOR + 校验和 + Base64URL）。
 *
 * 明文组成字段（与直播观看链同级精简；课程 id 在路径 `/course/{id}`，**不进 `c`**）：
 *   1. kind      — 邀请类型（与直播共用）：`1` 员工邀请 / `2` 观众邀请（废弃）
 *   2. inviterId — kind=1 时为员工 `rs_mainkey_id`
 *   3. sig       — fnv1a(`${kind}.${inviterId}|SECRET`)
 *
 * 此前曾把 courseId 打进 `c`，导致 token 远长于直播（多 32 hex + 更长 sig）；已压缩。
 * 密钥独立于直播（`qk-course-share-v1`），避免 watch `c` 被挪到 course 误用。
 * URL hint 见 `buildShareUrl`；解码/enroll **只信 `c`**。
 */

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
