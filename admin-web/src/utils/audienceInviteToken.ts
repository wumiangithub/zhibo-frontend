/**
 * 与 live-web 同算法：观看链员工邀请参数 `c`（仅员工，D77）。
 */

const SECRET = "qk-live-audience-invite-v1";

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

/** 仅员工邀请。 */
export function encodeAudienceInviteToken(inviterId: number): string {
  const body = `1.${inviterId}`;
  const sig = fnv1a(`${body}|${SECRET}`);
  const plain = `${body}.${sig}`;
  return toBase64Url(xorBytes(new TextEncoder().encode(plain), SECRET));
}
