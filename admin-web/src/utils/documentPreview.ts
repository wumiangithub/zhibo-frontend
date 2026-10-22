import { ElMessage } from "element-plus";
import { isTosCdnConfigured, rewriteTosUrlToCdn } from "@/utils/tosUpload";

const OFFICE_EXT = /\.(docx?)$/i;
const PDF_EXT = /\.pdf$/i;

/** 新窗口打开文档预览；依赖 `VITE_APP_TOS_CDN_URL`（原生桶强制 attachment，无法在线看） */
export function previewDocument(url: string, fileName?: string): void {
  const raw = (url || "").trim();
  if (!raw) {
    ElMessage.warning("暂无预览地址");
    return;
  }
  if (!isTosCdnConfigured()) {
    ElMessage.warning("请配置TOS 自定义域名或CDN");
    return;
  }

  const accessUrl = rewriteTosUrlToCdn(raw);
  const name = (fileName || accessUrl.split("?")[0] || "").toLowerCase();

  if (PDF_EXT.test(name)) {
    window.open(accessUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (OFFICE_EXT.test(name)) {
    // CDN 公网可达后用 Office Online；桶侧 doc-preview 未开通时的兜底
    const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(accessUrl)}`;
    window.open(viewer, "_blank", "noopener,noreferrer");
    return;
  }

  ElMessage.warning("该文件类型暂不支持在线预览，请下载查看");
}
