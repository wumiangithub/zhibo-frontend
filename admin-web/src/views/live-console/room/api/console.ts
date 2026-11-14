/**
 * 中控台单场 API（admin JWT；D110）。
 * 对照 live-web 观看：`/watch/summary` + `/watch/sdk-sign`；名单/走势/审核页原 watch 路径已删。
 */
import type { LiveProvider } from "../live/types";
import { apiV1 } from "@/api/apiBase";
import { get, post, put } from "@/api/http";
import { getAccessToken } from "@/utils/authSession";
import axios from "axios";

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
  /** 活动详情封面；无则省略（对齐观看 summary / ConsoleSummaryResponse） */
  coverUrl?: string;
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

/** 中控台 SDK 签名（employeeId 对照观看 uid） */
export interface ConsoleSdkSignData {
  id: string;
  nickname: string;
  /** 员工数字 id；与 sdk.email `z{id}@qkzb.com` 对应 */
  employeeId: number;
  provider?: LiveProvider;
  sdk: SdkInitPayload;
}

/** 适配器仍用此名；形状与观看 sdk-sign 对齐（无观看 uid） */
export type WatchSdkSignData = ConsoleSdkSignData;

/** 默认勿传 nickname；省略则服务端按本场成员 → 员工姓名解析（D110） */
export interface ConsoleSdkSignParams {
  nickname?: string;
}

export type AttendeeTab = "all" | "online" | "offline";

/** 左侧名单：学员 / 助教 */
export type AttendeeKind = "student" | "assistant";

export interface AttendeeItem {
  /** 邮箱本地部分：观众 username / e{员工id} / z{员工id} */
  username: string;
  nickname?: string;
  avatarUrl?: string;
  enterTime: string;
  leaveTime?: string;
  online: boolean;
  /** 助教侧角标：讲师 / 嘉宾 / 助教 / 中控 */
  roleLabel?: string;
  /** 学员跟进人（仅邀请人）；无则省略，UI 展示「暂未分配」 */
  followerName?: string;
  /** 本场聊天+提问条数；学员侧有 */
  commentCount?: number;
}

export interface AttendeeListData {
  activityState: number;
  total: number;
  studentTotal: number;
  assistantTotal: number;
  allTotal: number;
  onlineTotal: number;
  offlineTotal: number;
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

/** 左侧名单关键字类型（与观众明细一致） */
export type AttendeeKeywordType = "nickname" | "username" | "phone";

/** 学员跟进人：all / none / 员工 id 字符串 */
export type AttendeeFollowerFilter = "all" | "none" | string;

/** 学员行为筛选 */
export type AttendeeBehavior =
  | "all"
  | "comment"
  | "coupon"
  | "productClick"
  | "pendingPay"
  | "purchase";

export function listAttendees(
  id: string,
  query: {
    tab: AttendeeTab;
    page: number;
    pageSize?: number;
    keywordType?: AttendeeKeywordType;
    keyword?: string;
    kind?: AttendeeKind;
    followerFilter?: AttendeeFollowerFilter;
    behavior?: AttendeeBehavior;
  },
) {
  const params: Record<string, string | number> = {
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize ?? 20,
    kind: query.kind ?? "student",
    followerFilter: query.followerFilter ?? "all",
    behavior: query.behavior ?? "all",
  };
  const keywordType = query.keywordType?.trim();
  if (keywordType) params.keywordType = keywordType;
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

/** 省略 email/name → 服务端用当前员工 e{id}@qkzb.com / 姓名；勿传 console sdk 的 z{id} */
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

/** D113 发券落库响应（成功后再 sendCustomEvent） */
export interface ConsoleSendCouponBody {
  couponId: number;
  couponNo: string;
  couponName: string;
  couponAmount: string;
  couponStartDate: string;
  couponEndDate: string;
  allSku?: boolean;
  deptNames?: string[];
  skuNames?: string[];
}

export interface ConsoleSendCouponResult {
  commentId: number;
  couponId: number;
  couponNo: string;
  couponName: string;
  couponAmount: string;
  couponStartDate: string;
  couponEndDate: string;
  employeeId: number;
  nickname: string;
  deptId?: number;
  deptName?: string;
  commentTime: string;
}

export interface ConsoleCouponHistoryItem {
  id: number;
  senderName: string;
  timestamp: number;
  couponId: number;
  couponName: string;
  couponAmount: string;
  couponStartDate?: string;
  couponEndDate?: string;
  employeeId?: number;
  deptId?: number;
  deptName?: string;
}

export interface ConsoleCouponHistoryData {
  list: ConsoleCouponHistoryItem[];
}

export function sendConsoleCoupon(activityId: string, body: ConsoleSendCouponBody) {
  return post<ConsoleSendCouponResult>(
    `/activities/console/coupons/send/${encodeURIComponent(activityId)}`,
    body,
  );
}

export function listConsoleCouponHistory(activityId: string) {
  return get<ConsoleCouponHistoryData>(
    `/activities/console/coupon-history/${encodeURIComponent(activityId)}`,
  );
}

/** 中控台底部观众明细（D123） */
export type AudienceDetailKeywordType = "nickname" | "username" | "phone";
export type AudienceDetailOnlineStatus = "all" | "online" | "offline";

export interface ConsoleAudienceDetailItem {
  username: string;
  nickname: string;
  avatarUrl?: string;
  phoneMasked?: string;
  followerName?: string;
  followerEmployeeId?: number;
  firstEnterTime: string;
  latestEnterTime: string;
  liveWatchDurationSec: number;
  replayWatchDurationSec: number;
  totalWatchDurationSec: number;
  leaveTime?: string;
  enterCount: number;
  online: boolean;
  productClickCount: number;
  pendingPayCount: number;
  purchaseCount: number;
  totalPurchaseCount: number;
  totalPurchaseAmount: string;
  commentCount: number;
  couponReceiveCount: number;
}

export interface ConsoleAudienceDetailListData {
  page: number;
  pageSize: number;
  total: number;
  list: ConsoleAudienceDetailItem[];
}

export type ConsoleAudienceDetailQuery = {
  page?: number;
  pageSize?: number;
  keywordType?: AudienceDetailKeywordType;
  keyword?: string;
  onlineStatus?: AudienceDetailOnlineStatus;
  followerKeyword?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function listConsoleAudienceDetails(activityId: string, query: ConsoleAudienceDetailQuery = {}) {
  return get<ConsoleAudienceDetailListData>(
    `/activities/console/audience-details/${encodeURIComponent(activityId)}`,
    { params: query },
  );
}

/** 中控台「观看数据」成交三项汇总 */
export interface ConsoleWatchTradeData {
  id: string;
  /** 两位小数字符串，如 "26800.00" */
  dealAmount: string;
  dealUserCount: number;
  dealProductCount: number;
}

export function getConsoleWatchTrade(activityId: string) {
  return get<ConsoleWatchTradeData>(
    `/activities/console/watch-trade/${encodeURIComponent(activityId)}`,
  );
}

/** 中控台「交易数据」左侧 KPI */
export interface ConsoleTradeStatsData {
  id: string;
  dealUserCount: number;
  dealProductCount: number;
  productClickUserCount: number;
  /** 一位小数，不含 %，如 "30.0" */
  dealConversionRate: string;
  /** 两位小数金额字符串 */
  avgOrderAmount: string;
  unpaidUserCount: number;
}

export function getConsoleTradeStats(activityId: string) {
  return get<ConsoleTradeStatsData>(
    `/activities/console/trade-stats/${encodeURIComponent(activityId)}`,
  );
}

export interface ConsoleTradeTrendPoint {
  time: string;
  dealAmount: string;
  soldCount: number;
}

export interface ConsoleTradeTrendData {
  id: string;
  startTime: string;
  endTime: string;
  bucketSeconds: number;
  points: ConsoleTradeTrendPoint[];
}

export function fetchTradeTrend(
  id: string,
  params: { startTime: string; endTime: string; bucketSeconds?: number },
) {
  return get<ConsoleTradeTrendData>(
    `/activities/console/trade-trend/${encodeURIComponent(id)}`,
    { params },
  );
}

/** 中控台「商品」列表行（本站绑定；展示字段由订单中心批量详情补齐） */
export interface ConsoleProductItem {
  spuId: string;
  productName: string;
  visible: boolean;
  sortOrder: number;
  soldCount: number;
}

export interface ConsoleProductListData {
  id: string;
  cartEnabled: boolean;
  list: ConsoleProductItem[];
}

export function listConsoleProducts(activityId: string) {
  return get<ConsoleProductListData>(
    `/activities/console/products/${encodeURIComponent(activityId)}`,
  );
}

export function setConsoleProductVisible(
  activityId: string,
  body: { spuId: string; visible: boolean },
) {
  return put<{ id: string; spuId: string; visible: boolean }>(
    `/activities/console/products/visible/${encodeURIComponent(activityId)}`,
    body,
  );
}

export function setConsoleCartEnabled(activityId: string, enabled: boolean) {
  return put<{ id: string; cartEnabled: boolean }>(
    `/activities/console/cart/${encodeURIComponent(activityId)}`,
    { enabled },
  );
}

async function blobErrorMessage(blob: Blob): Promise<string> {
  const text = await blob.text();
  try {
    const body = JSON.parse(text) as { msg?: string };
    if (body?.msg) return body.msg;
  } catch {
    // not json
  }
  return "导出失败";
}

export async function exportConsoleAudienceDetails(
  activityId: string,
  query: Omit<ConsoleAudienceDetailQuery, "page" | "pageSize"> = {},
) {
  const token = getAccessToken();
  const url = apiV1(`/activities/console/audience-details/export/${encodeURIComponent(activityId)}`);
  try {
    const resp = await axios.get(url, {
      responseType: "blob",
      params: query,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 60000,
    });
    const blob = resp.data as Blob;
    if (blob.type && blob.type.includes("application/json")) {
      throw new Error(await blobErrorMessage(blob));
    }
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "audience-details.csv";
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      throw new Error(await blobErrorMessage(e.response.data));
    }
    throw e;
  }
}
