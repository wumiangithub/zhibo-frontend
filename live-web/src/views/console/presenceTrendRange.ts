/** `yyyy-MM-dd HH:mm:ss` → Date；非法返回 null */
export function parsePresenceTime(raw?: string): Date | null {
  const text = raw?.trim() ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatPresenceTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const PRESENCE_TREND_DAY_MS = 24 * 60 * 60 * 1000;

/** 已结束 / 回放（与 useWatchSession 一致） */
function isSessionEnded(state?: number): boolean {
  return state === 3 || state === 4 || state === 5;
}

/**
 * 默认范围：直播开始 → 直播结束；未结束（或无 endTime / 结束时间在未来）则结束端用当前时间。
 * 契约：跨度必须 ≤1 天；超一天取结束侧最近 24h；缺 start 用当天 00:00。
 */
export function resolvePresenceTrendRange(opts: {
  startTime?: string;
  endTime?: string;
  /** session.state：未结束时结束端强制用 now */
  state?: number;
  now?: Date;
}): { startTime: string; endTime: string } {
  const now = opts.now ?? new Date();
  let start = parsePresenceTime(opts.startTime);
  let end = parsePresenceTime(opts.endTime);

  if (!isSessionEnded(opts.state) || !end || end.getTime() > now.getTime()) {
    end = now;
  }
  if (!start) {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0);
  }
  if (end.getTime() <= start.getTime()) {
    start = new Date(end.getTime() - 60 * 60 * 1000);
  }
  if (end.getTime() - start.getTime() > PRESENCE_TREND_DAY_MS) {
    start = new Date(end.getTime() - PRESENCE_TREND_DAY_MS);
  }
  return {
    startTime: formatPresenceTime(start),
    endTime: formatPresenceTime(end),
  };
}

/** 用户选择的范围：非法 / 跨度 >1 天时裁剪并标记 clamped */
export function clampPresenceTrendRange(
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string; clamped: boolean } {
  let start = parsePresenceTime(startTime);
  let end = parsePresenceTime(endTime);
  if (!start || !end) {
    const fallback = resolvePresenceTrendRange({});
    return { ...fallback, clamped: true };
  }
  let clamped = false;
  if (end.getTime() <= start.getTime()) {
    start = new Date(end.getTime() - 60 * 60 * 1000);
    clamped = true;
  }
  if (end.getTime() - start.getTime() > PRESENCE_TREND_DAY_MS) {
    start = new Date(end.getTime() - PRESENCE_TREND_DAY_MS);
    clamped = true;
  }
  return {
    startTime: formatPresenceTime(start),
    endTime: formatPresenceTime(end),
    clamped,
  };
}
