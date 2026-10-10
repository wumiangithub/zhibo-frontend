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
}

export interface WatchParams {
  guestId?: string;
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
  return get<WatchData>(`/watch/${id}`, { params });
}

export function getWatchSdk(id: string, params: WatchParams = {}) {
  return get<WatchSdkData>(`/watch/${id}/sdk`, { params });
}

export function listWatchActivities(page = 1, pageSize = 20) {
  return get<WatchActivityListData>("/watch/activities", { params: { page, pageSize } });
}
