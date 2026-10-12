import { get } from "./http";

/** GET /api/uploads/tos-sts 响应 data，字段对齐 upload.js / tosConfig */
export interface TosStsConfig {
  region: string;
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  /** ISO-8601 UTC，带 Z */
  expiredTime: string;
}

/** 拉取火山 TOS 临时上传凭证 */
export function fetchTosSts() {
  return get<TosStsConfig>("/uploads/tos-sts");
}
