/** 本站契约字段；微吼 / 旧接口偶发仍给 createdAt */
export type CreatedTimeFields = {
  createdTime?: string | null;
  createdAt?: string | null;
};

/**
 * 取生成/创建时间：优先本站 `createdTime`，兼容未映射的 `createdAt`。
 * 微吼原始字段为 `created_at`，正常应由后端映成 `createdTime`（D59）。
 */
export function resolveCreatedTime(row: CreatedTimeFields | null | undefined): string {
  if (!row) return "";
  const v = row.createdTime || row.createdAt || "";
  return typeof v === "string" ? v.trim() : "";
}
