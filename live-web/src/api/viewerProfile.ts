import { post, put } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface ViewerUploadResult {
  objectKey: string;
  url: string;
  location?: string;
}

/** 资料更新成功 data：只回昵称与头像。 */
export interface ViewerProfileUpdateResult {
  nickname?: string;
  avatarUrl?: string;
}

function authHeaders(): Record<string, string> {
  const token = getViewerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 保存昵称；换头像时 avatarUrl 与 avatarObjectKey 必须一起带上（objectKey 仅服务端校验，不落库）。成功 data 只含 nickname / avatarUrl。 */
export function updateViewerProfile(body: {
  nickname: string;
  avatarUrl?: string;
  avatarObjectKey?: string;
}) {
  return put<ViewerProfileUpdateResult>("/viewer/profile/update", body, {
    headers: authHeaders(),
  });
}

/** 中转上传。objectKey 由调用方按 viewer/avatar/{uid}.{ext} 拼好。 */
export function uploadViewerFile(file: File, objectKey: string, contentType?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("objectKey", objectKey);
  if (contentType) form.append("contentType", contentType);
  return post<ViewerUploadResult>("/viewer/uploads/file?biz=1", form, {
    headers: authHeaders(),
  });
}
