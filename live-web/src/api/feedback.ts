import { get, post } from "./http";
import type { ViewerUploadResult } from "./viewerProfile";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface FeedbackImageRef {
  url: string;
  objectKey: string;
}

export interface FeedbackListItem {
  id: number;
  category: number;
  categoryLabel: string;
  content: string;
  imageCount: number;
  createdTime: string;
}

export interface FeedbackListData {
  total: number;
  page: number;
  pageSize: number;
  list: FeedbackListItem[];
}

export interface FeedbackDetail {
  id: number;
  category: number;
  categoryLabel: string;
  content: string;
  contactPhone: string;
  images: FeedbackImageRef[];
  createdTime: string;
}

function authHeaders(): Record<string, string> {
  const token = getViewerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asText(value: unknown): string {
  return value != null ? String(value) : "";
}

function asNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeImage(raw: unknown): FeedbackImageRef | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const url = asText(row.url).trim();
  const objectKey = asText(row.objectKey).trim();
  if (!url && !objectKey) return null;
  return { url, objectKey };
}

/** 意见反馈截图。objectKey 由调用方按 viewer/feedback/{viewerId}_{timestamp}_{rand}.{ext} 拼好。 */
export function uploadFeedbackImage(file: File, objectKey: string, contentType?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("objectKey", objectKey);
  if (contentType) form.append("contentType", contentType);
  return post<ViewerUploadResult>("/viewer/uploads/file?biz=2", form, {
    headers: authHeaders(),
  });
}

/** POST /viewer/feedback/submit。截图只带已上传的 url + objectKey，不传文件。 */
export function submitFeedback(payload: {
  category: number;
  content: string;
  contactPhone?: string;
  images?: FeedbackImageRef[];
}) {
  const data: {
    category: number;
    content: string;
    contactPhone?: string;
    images?: FeedbackImageRef[];
  } = {
    category: payload.category,
    content: payload.content,
  };
  const phone = payload.contactPhone?.trim();
  if (phone) data.contactPhone = phone;
  if (payload.images && payload.images.length) data.images = payload.images;
  return post<{ id: number }>("/viewer/feedback/submit", data, {
    headers: authHeaders(),
  });
}

/** GET /viewer/feedback/list */
export async function listFeedback(page = 1, pageSize = 20): Promise<FeedbackListData> {
  const data = await get<FeedbackListData>("/viewer/feedback/list", {
    headers: authHeaders(),
    params: { page, pageSize },
  });
  const rawList = Array.isArray(data?.list) ? data.list : [];
  return {
    total: asNum(data?.total),
    page: asNum(data?.page) || page,
    pageSize: asNum(data?.pageSize) || pageSize,
    list: rawList.map((item) => {
      const row = item as unknown as Record<string, unknown>;
      return {
        id: asNum(row.id),
        category: asNum(row.category),
        categoryLabel: asText(row.categoryLabel),
        content: asText(row.content),
        imageCount: asNum(row.imageCount),
        createdTime: asText(row.createdTime),
      };
    }),
  };
}

/** GET /viewer/feedback/detail/{id} */
export async function getFeedbackDetail(id: number | string): Promise<FeedbackDetail> {
  const data = await get<FeedbackDetail>(`/viewer/feedback/detail/${id}`, {
    headers: authHeaders(),
  });
  const row = (data ?? {}) as unknown as Record<string, unknown>;
  const images = Array.isArray(row.images)
    ? row.images.map(normalizeImage).filter((item): item is FeedbackImageRef => item != null)
    : [];
  return {
    id: asNum(row.id),
    category: asNum(row.category),
    categoryLabel: asText(row.categoryLabel),
    content: asText(row.content),
    contactPhone: asText(row.contactPhone).trim(),
    images,
    createdTime: asText(row.createdTime),
  };
}
