/**
 * 本站业务 UUID v4（D74）：32 位小写十六进制、无横线。
 * 不依赖 crypto.randomUUID，兼容非 secure context。
 * 随机源与口令加密同库（@noble/ciphers）。
 */
import { randomBytes } from "@noble/ciphers/utils.js";

export function randomUuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
