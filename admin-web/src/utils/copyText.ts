import { ElMessage } from "element-plus";

const DEFAULT_SUCCESS = "已复制";
const FAIL_MESSAGE = "复制失败，请手动复制";

/**
 * 复制文本。优先 Clipboard API，失败则用隐藏 textarea + execCommand。
 * 空字符串不提示成功，调用方自行判断并提示「暂无」。
 */
export async function copyText(shareText: string, tipText?: string): Promise<void> {
  if (!shareText) return;
  const successTip = tipText || DEFAULT_SUCCESS;
  try {
    await navigator.clipboard.writeText(shareText);
    ElMessage.success(successTip);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = shareText;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      ElMessage.success(successTip);
    } catch {
      ElMessage.error(FAIL_MESSAGE);
    }
    document.body.removeChild(textArea);
  }
}
