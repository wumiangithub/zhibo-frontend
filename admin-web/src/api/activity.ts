import { get, post, put, del } from "./http";
import type { AxiosRequestConfig } from "axios";
import axios from "./http";

export type LiveProvider = "vhall" | "aliyun" | "tencent";

export const PROVIDER_LABEL: Record<LiveProvider, string> = {
  vhall: "微吼",
  aliyun: "阿里云",
  tencent: "腾讯云",
};

export const TYPE_LABEL: Record<number, string> = {
  1: "音频",
  2: "视频",
  3: "互动",
  4: "录播",
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

/** 本站活动 UUID */
export type ActivityId = string;

export interface ActivityListItem {
  id: ActivityId;
  provider?: LiveProvider;
  title: string;
  startTime: string;
  coverUrl?: string;
  state: number;
  type: number;
  viewerStyle?: string;
  shareLink?: string;
  createdAt?: string;
}

export interface ActivityDetail extends ActivityListItem {
  provider: LiveProvider;
  providerRoomId?: string;
  /** @deprecated 仅 vhall 兼容，优先用 providerRoomId */
  vhallWebinarId?: string;
  introduction?: string;
  endTime?: string;
  verify?: number;
  pv?: number;
  fullEmbedShareLink?: string;
  ultraLowLatency?: boolean;
  virtualAvatar?: boolean;
  warmupType?: string;
  warmupUrl?: string;
  promoCoverUrl?: string;
  detailHtml?: string;
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
  provider?: LiveProvider;
}

export interface CreateActivityPayload {
  provider: LiveProvider;
  title: string;
  startTime: string;
  type: number;
  recordId?: string;
  introduction?: string;
  endTime?: string;
  viewerStyle?: string;
  ultraLowLatency?: boolean;
  virtualAvatar?: boolean;
  coverUrl?: string;
  warmupType?: string;
  warmupUrl?: string;
  promoCoverUrl?: string;
  detailHtml?: string;
}

export function createActivity(payload: CreateActivityPayload) {
  return post<{ id: ActivityId }>("/activities", payload);
}

export function listActivities(query: ListQuery = {}) {
  return get<ActivityListData>("/activities", { params: query });
}

export function getActivity(id: ActivityId) {
  return get<ActivityDetail>(`/activities/${id}`);
}

export function getHostUrl(id: ActivityId) {
  return get<{ provider: LiveProvider; hostUrl: string }>(`/activities/${id}/host`);
}

export function getEmbedUrl(id: ActivityId) {
  return get<{ embedUrl: string }>(`/activities/${id}/embed`);
}

export interface StatsOverview {
  id: ActivityId;
  title: string;
  state: number;
  type: number;
  pv: number;
  onlineCount: number;
}

export interface TrendPoint {
  time: string;
  count: number;
}

export interface OnlineTrendData {
  id: ActivityId;
  startTime: string;
  endTime: string;
  points: TrendPoint[];
}

export function getStats(id: ActivityId) {
  return get<StatsOverview>(`/activities/${id}/stats`);
}

export function getOnlineTrend(id: ActivityId, startTime: string, endTime: string) {
  return get<OnlineTrendData>(`/activities/${id}/stats/online`, {
    params: { startTime, endTime },
  });
}

export interface UpdateActivityPayload {
  title?: string;
  startTime?: string;
  introduction?: string;
  endTime?: string;
  viewerStyle?: string;
  ultraLowLatency?: boolean;
  virtualAvatar?: boolean;
  coverUrl?: string;
  warmupType?: string;
  warmupUrl?: string;
  promoCoverUrl?: string;
  detailHtml?: string;
}

export function updateActivity(id: ActivityId, payload: UpdateActivityPayload) {
  return put<{ id: ActivityId }>(`/activities/${id}`, payload);
}

export function endActivity(id: ActivityId) {
  return post<{ id: ActivityId; state: number }>(`/activities/${id}/end`);
}

export function deleteActivity(id: ActivityId) {
  return del<{ id: ActivityId }>(`/activities/${id}`);
}

/** 图片上传代理 → 微吼，返回可落库的 URL */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const config: AxiosRequestConfig = { timeout: 60000 };
  const data = (await axios.post("/uploads/image", form, config)) as unknown as { url: string };
  if (!data?.url) throw new Error("上传成功但未返回图片地址");
  return data.url;
}
