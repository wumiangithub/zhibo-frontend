/**
 * 对齐官方 demo `Chat/config.js`：把微吼聊天 image_urls / img_urls 收成可展示 URL。
 * @see D:\local-project\vhlive_sdk_js_demo-master\src\Widget\Layout\Tool\Chat\config.js
 */
const IMG_HOST = "//t-alistatic01.e.vhall.com/upload";

export function normalizeVhallChatImageUrl(url: string): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (raw.indexOf("webinars") === 0) {
    return raw.replace("webinars", `${IMG_HOST}/webinars`);
  }
  if (raw.indexOf("http") < 0 && raw.indexOf("https") < 0 && raw.indexOf("//") < 0) {
    return `//${raw}`;
  }
  return raw;
}

/** 从消息各形态字段抽出图片 URL 列表（去空、规范化）。 */
export function collectVhallChatImageUrls(...sources: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (typeof item !== "string") continue;
      const src = normalizeVhallChatImageUrl(item);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push(src);
    }
  }
  return out;
}
