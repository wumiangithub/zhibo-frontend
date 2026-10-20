/** 素材中心 UI 常量（列表/分组数据走 API） */

import {
  MaterialAudit,
  MATERIAL_AUDIT_LABEL,
  type MaterialAuditStatus,
  type MaterialCenterType,
  type MaterialType,
} from "@/api/materials";

export type { MaterialType };
export type { MaterialGroup } from "@/api/materials";

/** 与 D55 / {@link MaterialAudit} 一致：0 待审 / 1 通过 / 2 驳回 */
export type AuditStatus = MaterialAuditStatus;

export const TYPE_TABS: { key: MaterialType; label: string }[] = [
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "document", label: "文档" },
];

/** 素材中心主列表 Tab。选择弹窗仍只用 {@link TYPE_TABS}。 */
export const CENTER_TYPE_TABS: { key: MaterialCenterType; label: string }[] = [
  ...TYPE_TABS,
  { key: "article", label: "文章" },
];

export const AUDIT_OPTIONS: { value: "" | AuditStatus; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: MaterialAudit.PASSED, label: MATERIAL_AUDIT_LABEL[MaterialAudit.PASSED] },
  { value: MaterialAudit.REJECTED, label: MATERIAL_AUDIT_LABEL[MaterialAudit.REJECTED] },
  { value: MaterialAudit.PENDING, label: MATERIAL_AUDIT_LABEL[MaterialAudit.PENDING] },
];

export const ALL_GROUP_LABEL: Record<MaterialCenterType, string> = {
  image: "全部图片",
  video: "全部视频",
  document: "全部文档",
  article: "全部文章",
};

export const UPLOAD_ACCEPT: Record<MaterialType, string> = {
  image: ".png,.jpg,.bmp,.gif,.jpeg",
  video: ".mp4,.avi,.wmv,.mov,.flv,.rmvb,.3gp,.m4v,.mkv,.webm",
  document: ".pptx,.ppt,.docx,.doc,.xls,.xlsx,.pdf,.csv,.xlsm,.txt,.zip,.vtt",
};

export const UPLOAD_DRAG_TEXT: Record<MaterialType, { prefix: string; link: string }> = {
  image: { prefix: "将图片拖拽至此处，或点击", link: "选择图片" },
  video: { prefix: "将文件拖拽至此处，或点击", link: "选择文件" },
  document: { prefix: "将文件拖拽至此处，或点击", link: "选择文件" },
};

export const UPLOAD_HINTS: Record<MaterialType, string[]> = {
  image: [
    "支持上传25.00MB以内的png、jpg、bmp、gif、jpeg格式图片",
    "图像长度、宽度<3万像素和长宽像素相乘<2.5亿像素",
    "一次最多上传100个文件",
  ],
  video: [
    "支持上传5.00GB以内的mp4、avi、wmv、mov、flv、rmvb、3gp、m4v、mkv、webm格式视频",
    "一次最多上传100个文件",
    "当前最大支持1080高清转码",
  ],
  document: [
    "支持上传1.00GB以内的pptx、ppt、docx、doc、xls、xlsx、pdf、csv、xlsm、txt、zip格式文档,10.00MB以内的vtt格式文档",
    "一次最多上传100个文件",
  ],
};

export const UPLOAD_TITLE: Record<MaterialType, string> = {
  image: "上传图片",
  video: "上传视频",
  document: "上传文档",
};

export const UPLOAD_BTN: Record<MaterialType, string> = {
  image: "上传图片",
  video: "上传视频",
  document: "上传文档",
};

export const NAME_FILTER_LABEL: Record<MaterialCenterType, string> = {
  image: "图片名称",
  video: "视频名称",
  document: "文档名称",
  article: "文章名称",
};

export const COL_ASSET_LABEL: Record<MaterialCenterType, string> = {
  image: "图片",
  video: "视频",
  document: "文档",
  article: "文章",
};

export const COL_STATUS_LABEL: Record<MaterialCenterType, string> = {
  image: "图片状态",
  video: "视频状态",
  document: "文档状态",
  article: "图文状态",
};

/** 上传弹窗只接受文件类。文章 Tab 不会进选择弹窗。 */
export function asFileMaterialType(type: MaterialCenterType): MaterialType {
  return type === "article" ? "image" : type;
}
