/** 素材上传列表：大小 / 速度文案 / 对象 key / 尺寸·时长 meta */

import { buildTosObjectKey, resolveTosAccessUrl } from "@/utils/tosUpload";

export type MaterialObjectKind = "image" | "video" | "document";

/** TOS 对象 key：`material/{image|video|document}/{timestamp}_{filename}` */
export function buildMaterialObjectKey(type: MaterialObjectKind, fileName: string): string {
  return buildTosObjectKey(`material/${type}/`, fileName);
}

/** 登记用可访问 URL：有 CDN 拼 CDN+key，否则 Location（同 resolveTosAccessUrl） */
export function resolveMaterialAccessUrl(location: string | undefined, objectKey: string): string {
  return resolveTosAccessUrl(location, objectKey);
}

export function formatUploadSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export function formatUploadSpeed(bps: number): string {
  if (!bps || bps <= 0) return "—";
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(2)}KB/S`;
  return `${(bps / (1024 * 1024)).toFixed(2)}MB/S`;
}

/** 视频时长：mm:ss；≥1 小时为 h:mm:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** 最大公约数，用于最简整数比 */
function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * 裁剪/常见展示比例。像素取整后宽高常无法精确整除目标比，
 * 相对误差 ≤ {@link ASPECT_SNAP_TOLERANCE} 时吸附到这些标准比。
 */
const COMMON_ASPECTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [4, 3],
  [3, 4],
  [16, 9],
  [9, 16],
  [25, 8],
  [3, 2],
  [2, 3],
  [5, 4],
  [4, 5],
  [21, 9],
];

/** 相对误差阈值：约 1%（1256×706 ≈ 16:9 误差约 0.07%） */
const ASPECT_SNAP_TOLERANCE = 0.01;

/** 宽高 → 展示用比例；接近标准比时吸附，否则最简整数比 */
export function formatAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "";
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return "";

  const actual = w / h;
  let best: { label: string; err: number } | null = null;
  for (const [aw, ah] of COMMON_ASPECTS) {
    const target = aw / ah;
    const err = Math.abs(actual - target) / target;
    if (err > ASPECT_SNAP_TOLERANCE) continue;
    if (!best || err < best.err) {
      best = { label: `${aw}:${ah}`, err };
    }
  }
  if (best) return best.label;

  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

/**
 * 图片尺寸 meta，如 `1920*1080 (16:9)`。
 * 契约 `meta` ≤128：超长时回退为仅 `宽*高`。
 */
export function formatImageMeta(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "";
  const w = Math.round(width);
  const h = Math.round(height);
  const ratio = formatAspectRatio(w, h);
  const withRatio = `${w}*${h} (${ratio})`;
  if (withRatio.length <= 128) return withRatio;
  return `${w}*${h}`;
}

/**
 * 列表展示用：从 `宽*高` 重新算比例（含吸附）；无 meta 为 `--`。
 * 已入库的错误约分（如 `628:353`）也会按宽高纠正为标准比。
 */
export function formatImageMetaDisplay(meta: string | undefined | null): string {
  const m = meta?.trim();
  if (!m) return "--";
  const match = /^(\d+)\s*\*\s*(\d+)(?:\s*\([^)]*\))?$/.exec(m);
  if (!match) return m;
  const w = Number(match[1]);
  const h = Number(match[2]);
  const ratio = formatAspectRatio(w, h);
  return ratio ? `${w}*${h} (${ratio})` : `${w}*${h}`;
}
