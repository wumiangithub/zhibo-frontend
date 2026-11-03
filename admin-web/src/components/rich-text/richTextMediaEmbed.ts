/** 富文本内嵌素材 HTML（本地上传 / 素材库共用） */

export type RichTextMediaKind = "image" | "audio" | "video" | "document";

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 各类型本地上传 accept */
export const RICH_TEXT_MEDIA_ACCEPT: Record<RichTextMediaKind, string> = {
  image: ".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif",
  audio: ".mp3,.wav,.aac,.m4a,.ogg,audio/*",
  video: ".mp4,.webm,.mov,.m4v,video/mp4,video/webm",
  document: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.csv",
};

export function buildRichTextMediaHtml(
  kind: RichTextMediaKind,
  url: string,
  name = "",
): string {
  const src = escapeAttr(url);
  const label = escapeText(name || url);
  switch (kind) {
    case "image":
      return `<p><img src="${src}" alt="${label}" style="max-width:100%;height:auto;" /></p>`;
    case "audio":
      return `<p><audio src="${src}" controls="true" style="max-width:100%;">您的浏览器不支持音频播放</audio></p>`;
    case "video":
      return `<div data-w-e-type="video" data-w-e-is-void><video poster="" controls="true" width="auto" height="auto"><source src="${src}" type="video/mp4"/></video></div>`;
    case "document":
      return `<p><a href="${src}" target="_blank" rel="noopener noreferrer">${label || "文档"}</a></p>`;
  }
}
