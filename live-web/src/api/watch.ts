import type { LiveProvider } from "@/live/types";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";
import { get } from "./http";

const NICKNAME_KEY = "zhibo.nickname";

/** 后端只下发签名/init 鉴权；脚本 CDN 由适配器按 provider 加载（D93） */
export interface SdkInitPayload {
  /** = String(uid) 回显；3.9.1 init 不要传 account（与 email 互斥） */
  account: string;
  /** 已签名 `{uid}@qkzb.com`，不要在前端改，否则签名失效 */
  email: string;
  username: string;
  /** 观众头像 URL；无头像为 ""。仅非空参与签名；init 原样传（空串即可） */
  head: string;
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
  /** 活动详情封面；无则省略 */
  coverUrl?: string;
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
  /** 用户中心 uid；与 sdk.email 一致 */
  uid: number;
  provider?: LiveProvider;
  sdk: SdkInitPayload;
}

/** @deprecated 用 WatchSummaryData / WatchSdkSignData；保留别名避免漏改 */
export type WatchSdkData = WatchSummaryData & Partial<WatchSdkSignData>;

export interface WatchSdkSignParams {
  /** 展示昵称；username 只从 Authorization 观众 JWT 取（D96/D118） */
  nickname?: string;
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
