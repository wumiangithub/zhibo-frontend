import { get, post } from "./http";

export const TYPE_LABEL: Record<number, string> = {
  1: "音频",
  2: "视频",
  3: "互动",
};

export const STATE_LABEL: Record<number, string> = {
  1: "直播",
  2: "预告",
  3: "结束",
  4: "点播",
  5: "回放",
};

export const VERIFY_LABEL: Record<number, string> = {
  0: "无验证",
  1: "密码",
  2: "白名单",
  3: "付费",
  4: "F码",
  6: "付费+F码",
};

export interface ActivityListItem {
  id: number;
  title: string;
  startTime: string;
  coverUrl?: string;
  state: number;
  type: number;
  shareLink?: string;
  createdAt?: string;
}

export interface ActivityDetail extends ActivityListItem {
  introduction?: string;
  endTime?: string;
  verify?: number;
  pv?: number;
  fullEmbedShareLink?: string;
}

export interface ActivityListData {
  total: number;
  list: ActivityListItem[];
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  state?: number;
}

export interface CreateActivityPayload {
  title: string;
  startTime: string;
  type: number;
}

export function createActivity(payload: CreateActivityPayload) {
  return post<{ id: number }>("/activities", payload);
}

export function listActivities(query: ListQuery = {}) {
  return get<ActivityListData>("/activities", { params: query });
}

export function getActivity(id: number) {
  return get<ActivityDetail>(`/activities/${id}`);
}

export function getHostUrl(id: number) {
  return get<{ hostUrl: string }>(`/activities/${id}/host`);
}

export function getEmbedUrl(id: number) {
  return get<{ embedUrl: string }>(`/activities/${id}/embed`);
}
