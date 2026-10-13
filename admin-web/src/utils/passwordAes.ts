/**
 * AES-256-GCM：口令传输与本地「记住密码」共用。
 * 使用 @noble/ciphers（纯 JS），因联调域名 `http://wx.qktz.com.cn` 非 secure context，
 * `crypto.subtle` 不可用，不能依赖 Web Crypto。
 */
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

function requireAesKeyBase64(): string {
  const key = import.meta.env.VITE_AUTH_PASSWORD_AES_KEY_BASE64;
  if (!key || typeof key !== "string") {
    throw new Error("未配置 VITE_AUTH_PASSWORD_AES_KEY_BASE64");
  }
  return key;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function decodeAesKey(keyBase64: string): Uint8Array {
  const raw = base64ToBytes(keyBase64);
  if (raw.byteLength !== 32) {
    throw new Error("AES 密钥须为 32 字节（Base64 解码后）");
  }
  return raw;
}

/** UUID v4（不依赖 crypto.randomUUID，兼容非 secure context） */
function randomUuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 布局：IV(12) + ciphertext + tag(16) → Base64 */
function aesGcmEncryptUtf8(plain: string, keyBase64: string): string {
  const key = decodeAesKey(keyBase64);
  const iv = randomBytes(12);
  const encoded = new TextEncoder().encode(plain);
  // gcm.encrypt 返回 ciphertext||tag
  const cipher = gcm(key, iv).encrypt(encoded);
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return bytesToBase64(out);
}

function aesGcmDecryptUtf8(payloadB64: string, keyBase64: string): string {
  const key = decodeAesKey(keyBase64);
  const all = base64ToBytes(payloadB64);
  if (all.byteLength < 12 + 16) {
    throw new Error("密文过短");
  }
  const iv = all.slice(0, 12);
  const data = all.slice(12);
  const plain = gcm(key, iv).decrypt(data);
  return new TextDecoder().decode(plain);
}

/**
 * 登录提交用：明文 JSON `{"request_id","password"}` → AES-GCM Base64。
 * 每次调用生成新 `request_id`（防重放）。
 */
export async function encryptLoginPassword(password: string): Promise<string> {
  const requestId = randomUuid();
  const json = JSON.stringify({ request_id: requestId, password });
  return aesGcmEncryptUtf8(json, requireAesKeyBase64());
}

/** 本地记住密码：仅加密口令明文（非登录信封） */
export async function encryptRememberPassword(password: string): Promise<string> {
  return aesGcmEncryptUtf8(password, requireAesKeyBase64());
}

export async function decryptRememberPassword(cipherB64: string): Promise<string> {
  return aesGcmDecryptUtf8(cipherB64, requireAesKeyBase64());
}
