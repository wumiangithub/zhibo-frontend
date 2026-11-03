/** 文档类型图标（对齐 admin 素材中心 folderIco） */

import articleIcon from "@/assets/images/folderIco/article.svg";
import docIcon from "@/assets/images/folderIco/doc.svg";
import folderIcon from "@/assets/images/folderIco/folder.svg";
import pdfIcon from "@/assets/images/folderIco/pdf.svg";
import pptIcon from "@/assets/images/folderIco/ppt.svg";
import textIcon from "@/assets/images/folderIco/text.svg";
import xlsIcon from "@/assets/images/folderIco/xls.svg";
import zipIcon from "@/assets/images/folderIco/zip.svg";

const EXT_ICON: Record<string, string> = {
  pdf: pdfIcon,
  doc: docIcon,
  docx: docIcon,
  xls: xlsIcon,
  xlsx: xlsIcon,
  xlsm: xlsIcon,
  csv: textIcon,
  txt: textIcon,
  vtt: textIcon,
  ppt: pptIcon,
  pptx: pptIcon,
  zip: zipIcon,
  text: textIcon,
  folder: folderIcon,
  /** 富文本文章素材（非文件扩展名；调用 getMaterialFileIcon("article")） */
  article: articleIcon,
};

/** 按文件名扩展名取图标 URL；也支持裸名键（如 `article`）；未知回落 folder */
export function getMaterialFileIcon(filename: string): string {
  const key = filename.trim().toLowerCase();
  if (EXT_ICON[key]) return EXT_ICON[key];
  const i = key.lastIndexOf(".");
  const ext = i >= 0 ? key.slice(i + 1) : "";
  return EXT_ICON[ext] ?? folderIcon;
}
