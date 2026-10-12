/** 火山 TOS 上传工具类型（实现见 upload.js） */

export interface TosUploadConfig {
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  bucketName: string;
}

export interface TosUploadResult {
  Location?: string;
  fileSize?: number;
  /** 用户取消上传时为 true */
  cancelled?: boolean;
  [key: string]: unknown;
}

export function handleUpload(params: TosUploadConfig & {
  name: string;
  file: File;
  fileSize: number;
  /** percent 0-100；loadedBytes 为已上传字节（分片完成后） */
  onProgress?: (percent: number, loadedBytes?: number) => void;
  /** 返回 true 则中止当前上传并 abort 分片 */
  shouldCancel?: () => boolean;
}): Promise<TosUploadResult | null>;

export function batchHandleUpload(
  files: FileList | File[],
  tosConfig: TosUploadConfig,
  onFileProgress?: (fileName: string, percent: number) => void,
  onBatchProgress?: (percent: number, completedCount: number, totalCount: number) => void,
  /** 自定义对象 key；素材中心用 buildMaterialObjectKey，默认仍为 upload/{timestamp}_{filename} */
  buildObjectKey?: (file: File) => string,
): Promise<Array<TosUploadResult | null>>;
