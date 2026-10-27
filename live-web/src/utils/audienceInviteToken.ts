/**
 * 观看链员工邀请参数混淆 → 不透明 query `c`（仅员工，D77）。
 */

export type AudienceInvitePayload = {
  kind: "employee";
  inviterId: number;
};

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

/** 仅员工邀请。type 固定 1。 */
export function encodeAudienceInviteToken(inviterId: number): string {
  const body = `1.${inviterId}`;
  const sig = fnv1a(`${body}|${SECRET}`);
  const plain = `${body}.${sig}`;
  return toBase64Url(xorBytes(new TextEncoder().encode(plain), SECRET));
}

export function decodeAudienceInviteToken(token: string): AudienceInvitePayload | null {
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
  // 仅认员工；旧 type=2 观众邀请直接丢弃
  if (type !== 1) return null;
  if (!Number.isInteger(inviterId) || inviterId <= 0) return null;
  return { kind: "employee", inviterId };
}
