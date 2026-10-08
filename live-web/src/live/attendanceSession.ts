/**
 * 辅通道关页/刷新：sessionStorage 记本 Tab 未 leave 的 enter，以及 keepalive leave。
 * leaveTime 例外：关页无推送 date_time 时用 Asia/Shanghai 当前秒（契约禁止本地时钟造 enter，leave 关页可用）。
 */

import type { LeaveAttendanceItem } from "@/api/attendance";

const MID_MAX = 64;
const SESSION_KEY = "zhibo.attendance.open";

export interface OpenAttendance {
  activityId: string;
  userId: string;
  enterTime: string;
}

/** `yyyy-MM-dd HH:mm:ss`（Asia/Shanghai）——仅关页 leave / 再进补 leave 无推送时间时使用 */
export function formatShanghaiNow(): string {
  // sv-SE → `YYYY-MM-DD HH:mm:ss`；明确 Asia/Shanghai，避免本地时区偏差
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
}

/**
 * mid 用时间粒度：精确到分（去掉秒）。
 * 例：`2026-10-08 20:03:30` → `2026-10-08 20:03`。
 * 请求体 enterTime/leaveTime 仍传完整推送时间，仅 mid 截分。
 */
function midEventTime(eventTime: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(eventTime)) {
    return eventTime.slice(0, 16);
  }
  return eventTime;
}

/** mid：`{activityId}_{userId}_{time到分}`；超 64 → SHA-256 hex */
export async function newAttendanceMid(
  roomId: string,
  userId: string,
  eventTime: string,
): Promise<string> {
  const raw = `${roomId}_${userId}_${midEventTime(eventTime)}`;
  if (raw.length <= MID_MAX) return raw;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 关页同步路径：SubtleCrypto 异步来不及，用纯 JS SHA-256 */
export function newAttendanceMidSync(roomId: string, userId: string, eventTime: string): string {
  const raw = `${roomId}_${userId}_${midEventTime(eventTime)}`;
  if (raw.length <= MID_MAX) return raw;
  return sha256Hex(raw);
}

export function readOpenAttendance(): OpenAttendance | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OpenAttendance>;
    if (
      typeof parsed.activityId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.enterTime !== "string" ||
      !parsed.activityId ||
      !parsed.userId ||
      !parsed.enterTime
    ) {
      return null;
    }
    return {
      activityId: parsed.activityId,
      userId: parsed.userId,
      enterTime: parsed.enterTime,
    };
  } catch {
    return null;
  }
}

export function writeOpenAttendance(open: OpenAttendance): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(open));
  } catch {
    /* 隐私模式等忽略 */
  }
}

export function clearOpenAttendance(match?: Partial<OpenAttendance>): void {
  try {
    if (!match) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const cur = readOpenAttendance();
    if (!cur) return;
    if (match.activityId && cur.activityId !== match.activityId) return;
    if (match.userId && cur.userId !== match.userId) return;
    if (match.enterTime && cur.enterTime !== match.enterTime) return;
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 关页立刻发 leave：优先 sendBeacon，否则 fetch keepalive。
 * 勿用可被页面销毁取消的 axios/XHR。
 */
export function sendLeaveKeepalive(activityId: string, items: LeaveAttendanceItem[]): boolean {
  if (!activityId || !items.length) return false;
  const url = `${window.location.origin}/api/watch/${encodeURIComponent(activityId)}/attendance/leave`;
  const body = JSON.stringify({ items });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) {
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    void fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      credentials: "same-origin",
    });
    return true;
  } catch {
    return false;
  }
}

/** 纯 JS SHA-256 → hex（仅 unload mid，正常路径仍用 SubtleCrypto） */
function sha256Hex(message: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const withPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, bitLen >>> 0, false);
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}
