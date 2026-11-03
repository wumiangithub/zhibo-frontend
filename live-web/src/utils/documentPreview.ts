import { isTosCdnConfigured, rewriteTosUrlToCdn } from "@/utils/tosCdn";

const OFFICE_EXT = /\.(docx?)$/i;
const PDF_EXT = /\.pdf$/i;
const TXT_EXT = /\.txt$/i;

export type DocumentPreview = {
  /** iframe / 当前页可嵌 */
  embedUrl: string;
  /** 新窗口或整页跳转（Office Online 常禁嵌） */
  openUrl: string;
  kind: "pdf" | "txt" | "office" | "unknown";
  /** 未配 CDN 时无法在线预览 */
  cdnReady: boolean;
  /** 展示用扩展名大写，如 PDF / DOCX */
  extLabel: string;
};

/** 从文件名 / URL 取扩展名标签 */
export function documentExtLabel(fileNameOrUrl: string): string {
  const raw = (fileNameOrUrl || "").split("?")[0] || "";
  const m = raw.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

/**
 * 文档在线预览地址。
 * 原生桶强制 Content-Disposition: attachment，须改写到 CDN；
 * doc/docx 再包一层 Office Online。
 */
export function buildDocumentPreview(
  url: string,
  fileName?: string,
): DocumentPreview | null {
  const raw = (url || "").trim();
  if (!raw) return null;

  const cdnReady = isTosCdnConfigured();
  const accessUrl = cdnReady ? rewriteTosUrlToCdn(raw) : raw;
  const name = (fileName || accessUrl.split("?")[0] || "").toLowerCase();

  const extLabel = documentExtLabel(name);

  if (PDF_EXT.test(name)) {
    return {
      embedUrl: accessUrl,
      openUrl: accessUrl,
      kind: "pdf",
      cdnReady,
      extLabel,
    };
  }
  if (TXT_EXT.test(name)) {
    return {
      embedUrl: accessUrl,
      openUrl: accessUrl,
      kind: "txt",
      cdnReady,
      extLabel,
    };
  }
  if (OFFICE_EXT.test(name)) {
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(accessUrl)}`;
    const openViewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(accessUrl)}`;
    return {
      embedUrl: viewer,
      openUrl: openViewer,
      kind: "office",
      cdnReady,
      extLabel,
    };
  }

  return {
    embedUrl: accessUrl,
    openUrl: accessUrl,
    kind: "unknown",
    cdnReady,
    extLabel,
  };
}
