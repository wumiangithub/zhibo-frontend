import { post, put } from "./http";
import type { ViewerAuthUser } from "./viewerAuth";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface ViewerUploadResult {
  objectKey: string;
  url: string;
  location?: string;
}

function authHeaders(): Record<string, string> {
  const token = getViewerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 保存昵称；换头像时 avatarUrl 与 avatarObjectKey 必须一起带上。成功 data 即 user。 */
export function updateViewerProfile(body: {
  nickname: string;
  avatarUrl?: string;
  avatarObjectKey?: string;
}) {
  return put<ViewerAuthUser>("/viewer/profile/update", body, {
    headers: authHeaders(),
  });
}

/** 中转上传。objectKey 由调用方按 viewer/avatar/{viewerId}.{ext} 拼好。 */
export function uploadViewerFile(file: File, objectKey: string, contentType?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("objectKey", objectKey);
  if (contentType) form.append("contentType", contentType);
  return post<ViewerUploadResult>("/viewer/uploads/file?biz=1", form, {
    headers: authHeaders(),
  });
}
