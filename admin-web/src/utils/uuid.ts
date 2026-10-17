/**
 * UUID v4（不依赖 crypto.randomUUID，兼容非 secure context）。
 * 随机源与口令加密同库（@noble/ciphers）。
 */
import { randomBytes } from "@noble/ciphers/utils.js";

export function randomUuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
