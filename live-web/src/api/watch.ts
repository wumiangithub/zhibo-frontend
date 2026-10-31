import type { LiveProvider } from "@/live/types";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";
import { get } from "./http";

const GUEST_ID_KEY = "zhibo.guestId";
const NICKNAME_KEY = "zhibo.nickname";

export interface WatchData {
  id: string;
  title: string;
  state: number;
  type: number;
  nickname: string;
  guestId: string;
  embedUrl: string;
  provider?: LiveProvider;
}

/** 后端只下发签名/init 鉴权；脚本 CDN 由适配器按 provider 加载（D93） */
export interface SdkInitPayload {
  /** = String(viewerId) 回显；3.9.1 init 不要传 account（与 email 互斥） */
  account: string;
  /** 已签名 `{viewerId}@qkzb.com`，不要在前端改，否则签名失效 */
  email: string;
  username: string;
  webinarId: string;
  appKey: string;
  signedAt: string;
  signType?: number;
  sign: string;
}

/** 观看页壳（D95：`GET /watch/summary/{id}`） */
export interface WatchSummaryData {
  id: string;
  title: string;
  state: number;
  type: number;
  startTime?: string;
  endTime?: string;
  provider?: LiveProvider;
  /** 本站回放开关；结束态据此决定是否展示「查看回放」。缺省当开启。 */
  playbackEnabled?: boolean;
  playbackValidityType?: "forever" | "days" | string;
  playbackValidityDays?: number;
  /** 是否已超过回放有效期 */
  playbackExpired?: boolean;
  /** 是否允许倍速 */
  playbackSpeedAllow?: boolean;
  /** 是否允许快进/拖进度 */
  playbackFastForwardAllow?: boolean;
}

/** 观看 SDK 签名（D95：仅签名 + 身份回显） */
export interface WatchSdkSignData {
  id: string;
  nickname: string;
  /** 观众数字 id；与 sdk.email 一致 */
  viewerId: number;
  provider?: LiveProvider;
  sdk: SdkInitPayload;
}

/** @deprecated 用 WatchSummaryData / WatchSdkSignData；保留别名避免漏改 */
export type WatchSdkData = WatchSummaryData & Partial<WatchSdkSignData>;

/** 嵌入兜底 detail 仍可带 guestId；sdk-sign 只用 viewerId（D92） */
export interface WatchParams {
  guestId?: string;
  nickname?: string;
  viewerId?: number;
}

export interface WatchSdkSignParams {
  nickname?: string;
  /** 当前观众数字 id；必填（亦可靠 Authorization 观众 JWT） */
  viewerId?: number;
}

export interface WatchActivityItem {
  id: string;
  title: string;
  state: number;
  startTime: string;
  coverUrl?: string;
}

export interface WatchActivityListData {
  total: number;
  list: WatchActivityItem[];
}

export function getStoredGuestId(): string {
  return localStorage.getItem(GUEST_ID_KEY) ?? "";
}

export function storeGuestId(guestId: string) {
  if (guestId) localStorage.setItem(GUEST_ID_KEY, guestId);
}

export function getStoredNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

export function storeNickname(nickname: string) {
  if (nickname) localStorage.setItem(NICKNAME_KEY, nickname);
}

function watchAuthHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const viewer = getViewerAccessToken();
  if (viewer) headers.Authorization = `Bearer ${viewer}`;
  return headers;
}

export function getWatch(id: string, params: WatchParams = {}) {
  return get<WatchData>(`/watch/detail/${id}`, { params });
}

/** 观看页壳摘要（D95） */
export function getWatchSummary(id: string) {
  return get<WatchSummaryData>(`/watch/summary/${id}`, {
    headers: watchAuthHeaders(id),
  });
}

/** 观看 SDK 签名（D92/D95；仅签名字段） */
export function getWatchSdk(id: string, params: WatchSdkSignParams = {}) {
  return get<WatchSdkSignData>(`/watch/sdk-sign`, {
    params: { id, ...params },
    headers: watchAuthHeaders(id),
  });
}

export function listWatchActivities(page = 1, pageSize = 20) {
  return get<WatchActivityListData>("/watch/activities", { params: { page, pageSize } });
}
