/** 素材上传列表：大小 / 速度文案 */

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export function formatUploadSpeed(bps: number): string {
  if (!bps || bps <= 0) return "—";
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(2)}KB/S`;
  return `${(bps / (1024 * 1024)).toFixed(2)}MB/S`;
}
