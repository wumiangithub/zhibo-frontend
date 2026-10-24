/** 素材列表展示用上传时间；契约字段 uploadedTime（← 库 created_time） */
export type UploadedTimeFields = {
  uploadedTime?: string | null;
  /** D59 前旧名，兼容未升级响应 */
  uploadedAt?: string | null;
  createdTime?: string | null;
  createdAt?: string | null;
};

/**
 * 取上传/入库时间：优先 `uploadedTime`，兼容旧 `uploadedAt` 与误用的 `createdTime`/`createdAt`。
 */
export function resolveUploadedTime(row: UploadedTimeFields | null | undefined): string {
  if (!row) return "";
  const v = row.uploadedTime || row.uploadedAt || row.createdTime || row.createdAt || "";
  return typeof v === "string" ? v.trim() : "";
}
