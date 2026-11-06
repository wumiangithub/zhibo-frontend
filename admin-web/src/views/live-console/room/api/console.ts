/**
 * 中控台单场 API（admin JWT；D110）。
 * 对照 live-web 观看：`/watch/summary` + `/watch/sdk-sign`；名单/走势/审核页原 watch 路径已删。
 */
import type { LiveProvider } from "../live/types";
import { get } from "@/api/http";

/** 后端只下发签名/init 鉴权；脚本 CDN 由适配器按 provider 加载 */
export interface SdkInitPayload {
  /** = `z{employeeId}` 回显；3.9.1 init 不要传 account（与 email 互斥） */
  account: string;
  /** 已签名 `z{employeeId}@qkzb.com`，不要在前端改，否则签名失效 */
  email: string;
  username: string;
  /** 头像 URL；无头像为 ""。仅非空参与签名；init 原样传（空串即可） */
  head: string;
  webinarId: string;
  appKey: string;
  signedAt: string;
  signType?: number;
  sign: string;
}

/** 中控台页壳（对齐观看 summary） */
export interface ConsoleSummaryData {
  id: string;
  title: string;
  state: number;
  type: number;
  startTime?: string;
  endTime?: string;
  provider?: LiveProvider;
  playbackEnabled?: boolean;
  playbackValidityType?: "forever" | "days" | string;
  playbackValidityDays?: number;
  playbackExpired?: boolean;
  playbackSpeedAllow?: boolean;
  playbackFastForwardAllow?: boolean;
}

/** 对照观看页类型名，便于 copy 组件少改 */
export type WatchSummaryData = ConsoleSummaryData;

/** 中控台 SDK 签名（employeeId 对照观看 viewerId） */
export interface ConsoleSdkSignData {
  id: string;
  nickname: string;
  /** 员工数字 id；与 sdk.email `z{id}@qkzb.com` 对应 */
  employeeId: number;
  provider?: LiveProvider;
  sdk: SdkInitPayload;
}

/** 适配器仍用此名；形状与观看 sdk-sign 对齐（无 viewerId） */
export type WatchSdkSignData = ConsoleSdkSignData;

/** 默认勿传 nickname；省略则服务端按本场成员 → 员工姓名解析（D110） */
export interface ConsoleSdkSignParams {
  nickname?: string;
}

export type AttendeeTab = "all" | "online" | "offline";

export interface AttendeeItem {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  enterTime: string;
  leaveTime?: string;
  online: boolean;
}

export interface AttendeeListData {
  activityState: number;
  total: number;
  page: number;
  pageSize: number;
  list: AttendeeItem[];
}

export interface PresenceTrendPoint {
  time: string;
  online: number;
  enter: number;
  leave: number;
}

export interface PresenceTrendData {
  id: string;
  startTime: string;
  endTime: string;
  bucketSeconds: number;
  points: PresenceTrendPoint[];
}

export interface ChatFilterData {
  pageUrl: string;
}

export function getConsoleSummary(id: string) {
  return get<ConsoleSummaryData>(`/activities/console/summary/${encodeURIComponent(id)}`);
}

export function getConsoleSdkSign(id: string, params: ConsoleSdkSignParams = {}) {
  const query: Record<string, string> = { id };
  const nickname = params.nickname?.trim();
  if (nickname) query.nickname = nickname;
  return get<ConsoleSdkSignData>("/activities/console/sdk-sign", { params: query });
}

export function listAttendees(
  id: string,
  query: { tab: AttendeeTab; page: number; pageSize?: number; keyword?: string },
) {
  const params: Record<string, string | number> = {
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize ?? 20,
  };
  const keyword = query.keyword?.trim();
  if (keyword) params.keyword = keyword;
  return get<AttendeeListData>(`/activities/attendees/${encodeURIComponent(id)}`, { params });
}

export function fetchPresenceTrend(
  id: string,
  query: { startTime: string; endTime: string; bucketSeconds?: number },
) {
  return get<PresenceTrendData>(`/activities/presence-trend/${encodeURIComponent(id)}`, {
    params: {
      startTime: query.startTime,
      endTime: query.endTime,
      bucketSeconds: query.bucketSeconds ?? 60,
    },
  });
}

/** 省略 email/name → 服务端用当前员工 e{id}@qkzb.com / 姓名 */
export function fetchChatFilterPageUrl(
  id: string,
  query?: { email?: string; name?: string },
) {
  const params: Record<string, string> = {};
  const email = query?.email?.trim();
  const name = query?.name?.trim();
  if (email) params.email = email;
  if (name) params.name = name;
  return get<ChatFilterData>(`/activities/chat-filter/${encodeURIComponent(id)}`, {
    params: Object.keys(params).length ? params : undefined,
  });
}
