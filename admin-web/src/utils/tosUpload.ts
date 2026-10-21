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

/** 可访问 URL：优先 TOS Location，否则拼 CDN + objectKey */
export function resolveTosAccessUrl(location: string | undefined, objectKey: string): string {
  if (location && /^https?:\/\//i.test(location)) return location;
  const base = String(import.meta.env.VITE_APP_TOS_CDN_URL || "").replace(/\/$/, "");
  const key = objectKey.replace(/^\//, "");
  if (!base) return location || key;
  return `${base}/${key}`;
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
