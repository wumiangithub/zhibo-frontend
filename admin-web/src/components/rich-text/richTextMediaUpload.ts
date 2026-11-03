import { ElMessage } from "element-plus";
import { uploadFileToTos } from "@/utils/tosUpload";
import {
  richTextImageError,
  uploadRichTextImage,
} from "./richTextImageUpload";
import type { RichTextMediaKind } from "./richTextMediaEmbed";

function audioError(file: File): string | null {
  const ok = /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name) || /^audio\//i.test(file.type);
  if (!ok) return "仅支持 mp3、wav、aac、m4a、ogg 格式";
  return null;
}

function videoError(file: File): string | null {
  const ok = /\.(mp4|webm|mov|m4v)$/i.test(file.name) || /^video\//i.test(file.type);
  if (!ok) return "仅支持 mp4、webm、mov、m4v 格式";
  return null;
}

function documentError(file: File): string | null {
  const ok =
    /\.(pdf|docx?|pptx?|xlsx?|txt|zip|csv)$/i.test(file.name) ||
    /^(application|text)\//i.test(file.type);
  if (!ok) return "仅支持常见文档格式（pdf/doc/ppt/xls/txt/zip 等）";
  return null;
}

export function richTextMediaError(kind: RichTextMediaKind, file: File): string | null {
  switch (kind) {
    case "image":
      return richTextImageError(file);
    case "audio":
      return audioError(file);
    case "video":
      return videoError(file);
    case "document":
      return documentError(file);
  }
}

/** 正文内媒体直传 TOS，不登记为素材中心条目。objectKeyPrefix 须为 D60 已登记前缀。 */
export async function uploadRichTextMedia(
  kind: RichTextMediaKind,
  file: File,
  objectKeyPrefix: string,
): Promise<string> {
  if (kind === "image") return uploadRichTextImage(file, objectKeyPrefix);
  const err = richTextMediaError(kind, file);
  if (err) throw new Error(err);
  const prefix = objectKeyPrefix.trim();
  if (!prefix) throw new Error("未配置上传路径");
  return uploadFileToTos(file, prefix);
}

export async function uploadRichTextMediaOrToast(
  kind: RichTextMediaKind,
  file: File,
  objectKeyPrefix: string,
): Promise<string | null> {
  try {
    return await uploadRichTextMedia(kind, file, objectKeyPrefix);
  } catch (err: unknown) {
    const fallback =
      kind === "image"
        ? "图片上传失败"
        : kind === "audio"
          ? "音频上传失败"
          : kind === "video"
            ? "视频上传失败"
            : "文档上传失败";
    const msg = err instanceof Error ? err.message : fallback;
    ElMessage.error(msg || fallback);
    return null;
  }
}
