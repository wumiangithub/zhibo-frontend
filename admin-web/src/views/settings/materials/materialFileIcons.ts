/** 素材上传文件类型图标（assets/images/folderIco） */

import icon3d from "@/assets/images/folderIco/3d.svg";
import aeIcon from "@/assets/images/folderIco/ae.svg";
import aiIcon from "@/assets/images/folderIco/ai.svg";
import audioIcon from "@/assets/images/folderIco/audio.svg";
import docIcon from "@/assets/images/folderIco/doc.svg";
import folderIcon from "@/assets/images/folderIco/folder.svg";
import pdfIcon from "@/assets/images/folderIco/pdf.svg";
import pptIcon from "@/assets/images/folderIco/ppt.svg";
import prIcon from "@/assets/images/folderIco/pr.svg";
import psdIcon from "@/assets/images/folderIco/psd.svg";
import textIcon from "@/assets/images/folderIco/text.svg";
import xlsIcon from "@/assets/images/folderIco/xls.svg";
import zipIcon from "@/assets/images/folderIco/zip.svg";

const EXT_ICON: Record<string, string> = {
  // 文档上传 accept
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
  // 参考工程其它扩展（有资源则映射）
  mp3: audioIcon,
  wav: audioIcon,
  aac: audioIcon,
  flac: audioIcon,
  audio: audioIcon,
  fbx: icon3d,
  obj: icon3d,
  "3d": icon3d,
  psd: psdIcon,
  ai: aiIcon,
  aep: aeIcon,
  prproj: prIcon,
  text: textIcon,
  folder: folderIcon,
};

/** 按文件名扩展名取图标 URL；未知类型回落 folder */
export function getMaterialFileIcon(filename: string): string {
  const i = filename.lastIndexOf(".");
  const ext = i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
  return EXT_ICON[ext] ?? folderIcon;
}
