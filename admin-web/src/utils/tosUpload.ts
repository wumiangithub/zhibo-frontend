import { useMaterialsStore } from "@/stores/materials";
import { handleUpload } from "@/utils/upload";

/**
 * TOS 对象 key 功能前缀（权威表见 zhibo-shared API约定 tos-sts「对象 key 目录」/ D60）。
 * 新功能须先登记前缀再编码；禁止自创或业务塞进 `upload/`。
 */
export const TosObjectKeyPrefix = {
  MATERIAL_IMAGE: "material/image/",
  MATERIAL_VIDEO: "material/video/",
  MATERIAL_DOCUMENT: "material/document/",
  MATERIAL_ARTICLE: "material/article/",
  /** 报备材料扁平目录；对象名见直播报备契约 `{前缀}_{NN}_{真实文件名}` */
  LIVE_REPORT_ATTACHMENT: "live-report/attachment/",
  ACTIVITY_MEMBER_AVATAR: "activity/member-avatar/",
  ACTIVITY_COVER: "activity/cover/",
  ACTIVITY_WARMUP: "activity/warmup/",
  ACTIVITY_PROMO: "activity/promo/",
  /** 仅本地调试，禁止业务使用 */
  DEBUG_UPLOAD: "upload/",
} as const;

export type TosObjectKeyPrefixValue =
  (typeof TosObjectKeyPrefix)[keyof typeof TosObjectKeyPrefix];

function tosCdnBase(): string {
  return String(import.meta.env.VITE_APP_TOS_CDN_URL || "").replace(/\/$/, "");
}

function tosNativeBase(): string {
  return String(import.meta.env.VITE_APP_TOS_NATIVE_URL || "").replace(/\/$/, "");
}

/** 是否已配置独立 CDN / 自定义域名（与原生桶域名不同才算） */
export function isTosCdnConfigured(): boolean {
  const cdn = tosCdnBase();
  const native = tosNativeBase();
  return Boolean(cdn) && cdn !== native;
}

/**
 * 把已落库的原生桶 URL 改写成 CDN（历史数据 / Location 回写）。
 * 非 TOS 原生前缀则原样返回。
 */
export function rewriteTosUrlToCdn(url: string): string {
  const cdn = tosCdnBase();
  const native = tosNativeBase();
  if (!cdn || !url) return url;
  if (native && url.startsWith(native)) return `${cdn}${url.slice(native.length)}`;
  return url;
}

/**
 * 可访问 URL：有 CDN 时一律拼 CDN + objectKey（不落原生 Location）。
 * 未配 CDN 时退回 TOS Location / objectKey。
 */
export function resolveTosAccessUrl(location: string | undefined, objectKey: string): string {
  const base = tosCdnBase();
  const key = objectKey.replace(/^\//, "");
  if (base) return `${base}/${key}`;
  if (location && /^https?:\/\//i.test(location)) return location;
  return location || key;
}

/** `{prefix}{timestamp}_{filename}`；prefix 无尾斜杠时自动补 `/` */
export function buildTosObjectKey(prefix: string, fileName: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const name = fileName.replace(/^.*[/\\]/, "") || "file";
  return `${p}${Date.now()}_${name}`;
}

/**
 * STS → 浏览器直传 TOS → CDN/可访问 URL。
 * @param objectKeyPrefix 须为 API约定「对象 key 目录」已登记前缀
 */
export async function uploadFileToTos(
  file: File,
  objectKeyPrefix: string,
): Promise<string> {
  const config = await useMaterialsStore().ensureTosConfig();
  const objectKey = buildTosObjectKey(objectKeyPrefix, file.name);
  const result = await handleUpload({
    ...config,
    name: objectKey,
    file,
    fileSize: file.size,
  });
  if (!result || result.cancelled) throw new Error("上传已取消或失败");
  const url = resolveTosAccessUrl(
    typeof result.Location === "string" ? result.Location : undefined,
    objectKey,
  );
  if (!/^https?:\/\//i.test(url)) throw new Error("上传成功但未得到可访问地址");
  return url;
}
