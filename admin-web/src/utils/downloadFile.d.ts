/** 下载工具类型（实现见 downloadFile.js） */

export interface DownloadFileItem {
  fileUrl: string;
  fileName: string;
}

export interface DownloadFilesOptions {
  startIndex?: number;
  useStream?: boolean;
  useLink?: boolean;
}

export interface DownloadFilesResult {
  success: boolean;
  successCount: number;
  failedFiles: DownloadFileItem[];
}

export function downloadFiles(
  fileList: DownloadFileItem[],
  options?: DownloadFilesOptions,
): Promise<DownloadFilesResult>;
