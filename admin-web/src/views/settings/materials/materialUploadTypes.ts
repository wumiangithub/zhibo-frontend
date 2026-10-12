/** 素材上传弹窗 / 文件表格共用行类型 */

export type FileTableStatus =
  | "waiting"
  | "uploading"
  | "success"
  | "error"
  | "cancelled";

/** 表格列所需字段（视频 / 文档列表） */
export interface FileTableItem {
  uid: number;
  name: string;
  file: File;
  status: FileTableStatus;
  percent: number;
  speedBps: number;
}

/** 弹窗内完整项（含图片预览等） */
export interface UploadItem extends FileTableItem {
  previewUrl: string;
  resultUrl?: string;
  objectKey?: string;
}

/** TOS 成功后可登记的条目 */
export interface MaterialRegisterItem {
  name: string;
  url: string;
  objectKey: string;
  fileSize: number;
  mimeType?: string;
}
