/** 与 admin-web tosUpload 对齐：原生桶强制 attachment，预览须走 CDN。 */

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
 * 把已落库的原生桶 URL 改写成 CDN。
 * 非 TOS 原生前缀则原样返回。
 */
export function rewriteTosUrlToCdn(url: string): string {
  const cdn = tosCdnBase();
  const native = tosNativeBase();
  if (!cdn || !url) return url;
  if (native && url.startsWith(native)) return `${cdn}${url.slice(native.length)}`;
  return url;
}
