import type { LiveProvider } from "@/live/types";
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

export interface SdkInitPayload {
  scriptUrl: string;
  jqueryUrl?: string | null;
  /** 本站 guestId 回显；3.9.1 init 不要传 account（与 email 互斥） */
  account: string;
  /** 已签名。有 viewerId 时为 `{id}@qkzb.com`，不要在前端改，否则签名失效 */
  email: string;
  username: string;
  webinarId: string;
  appKey: string;
  signedAt: string;
  signType?: number;
  sign: string;
}

export interface WatchSdkData {
  id: string;
  title: string;
  state: number;
  type: number;
  nickname: string;
  guestId: string;
  startTime?: string;
  endTime?: string;
  /** 直播服务商；缺省按微吼处理 */
  provider?: LiveProvider;
  sdk: SdkInitPayload;
  embedUrl: string;
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

export interface WatchParams {
  guestId?: string;
  nickname?: string;
  /** 当前观众数字 id。有值时后端把微吼 email 签成 `{id}@qkzb.com` */
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

export function getWatch(id: string, params: WatchParams = {}) {
  return get<WatchData>(`/watch/detail/${id}`, { params });
}

export function getWatchSdk(id: string, params: WatchParams = {}) {
  return get<WatchSdkData>(`/watch/sdk/${id}`, { params });
}

export function listWatchActivities(page = 1, pageSize = 20) {
  return get<WatchActivityListData>("/watch/activities", { params: { page, pageSize } });
}
