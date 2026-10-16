import { ElMessage } from "element-plus";
import { useMaterialsStore } from "@/stores/materials";
import { handleUpload } from "@/utils/upload";
import { resolveMaterialAccessUrl } from "./materialUploadFormat";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/jpg"]);

export function articleImageError(file: File): string | null {
  const extOk = /\.(jpe?g|png|gif)$/i.test(file.name);
  const mimeOk = !file.type || ALLOWED_MIME.has(file.type);
  if (!extOk || !mimeOk) return "仅支持 jpg、png、gif 格式";
  if (file.size > MAX_BYTES) return "每张图大小不超过 5M";
  return null;
}

/** 正文内图片直传 TOS，不登记为图片素材。 */
export async function uploadArticleImage(file: File): Promise<string> {
  const err = articleImageError(file);
  if (err) throw new Error(err);
  const config = await useMaterialsStore().ensureTosConfig();
  const objectKey = `material/article/${Date.now()}_${file.name}`;
  const result = await handleUpload({
    ...config,
    name: objectKey,
    file,
    fileSize: file.size,
  });
  if (!result || result.cancelled) throw new Error("图片上传已取消");
  const url = resolveMaterialAccessUrl(
    typeof result.Location === "string" ? result.Location : undefined,
    objectKey,
  );
  if (!/^https?:\/\//i.test(url)) throw new Error("图片上传失败");
  return url;
}

export async function uploadArticleImageOrToast(file: File): Promise<string | null> {
  try {
    return await uploadArticleImage(file);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "图片上传失败";
    ElMessage.error(msg || "图片上传失败");
    return null;
  }
}
