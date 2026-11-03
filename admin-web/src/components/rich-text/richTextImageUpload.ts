import { ElMessage } from "element-plus";
import { uploadFileToTos } from "@/utils/tosUpload";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/jpg"]);

export function richTextImageError(file: File): string | null {
  const extOk = /\.(jpe?g|png|gif)$/i.test(file.name);
  const mimeOk = !file.type || ALLOWED_MIME.has(file.type);
  if (!extOk || !mimeOk) return "仅支持 jpg、png、gif 格式";
  if (file.size > MAX_BYTES) return "每张图大小不超过 5M";
  return null;
}

/** 正文内图片直传 TOS，不登记为图片素材。objectKeyPrefix 须为 D60 已登记前缀。 */
export async function uploadRichTextImage(
  file: File,
  objectKeyPrefix: string,
): Promise<string> {
  const err = richTextImageError(file);
  if (err) throw new Error(err);
  const prefix = objectKeyPrefix.trim();
  if (!prefix) throw new Error("未配置图片上传路径");
  return uploadFileToTos(file, prefix);
}

export async function uploadRichTextImageOrToast(
  file: File,
  objectKeyPrefix: string,
): Promise<string | null> {
  try {
    return await uploadRichTextImage(file, objectKeyPrefix);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "图片上传失败";
    ElMessage.error(msg || "图片上传失败");
    return null;
  }
}
