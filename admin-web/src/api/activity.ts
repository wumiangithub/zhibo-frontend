import { get, post, put, del } from "./http";
import type { AxiosRequestConfig } from "axios";
import axios from "./http";

export type LiveProvider = "vhall" | "aliyun" | "tencent";

export type ShelfStatus = "pending" | "on" | "off" | "banned";
export type RiskStatus = "pending" | "passed" | "rejected";
export type SellType = "free" | "paid" | "encrypted" | "specified";
export type AuditResult = "passed" | "rejected";

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

/** 列表/筛选用完整文案 */
export const LIVE_TYPE_LABEL: Record<number, string> = {
  1: "音频直播",
  2: "视频直播",
  3: "互动直播",
  4: "录播直播",
};

export const STATE_LABEL: Record<number, string> = {
  1: "直播",
  2: "预告",
  3: "结束",
  4: "点播",
  5: "回放",
};

/** 列表展示：直播中 / 预告 / 已结束 / 点播 / 回放 */
export const LIVE_STATE_LABEL: Record<number, string> = {
  1: "直播中",
  2: "预告",
  3: "已结束",
  4: "点播",
  5: "回放",
};

export const SHELF_STATUS_LABEL: Record<ShelfStatus, string> = {
  pending: "待上架",
  on: "已上架",
  off: "已下架",
  banned: "强制封禁",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  pending: "待审核",
  passed: "已通过",
  rejected: "已驳回",
};

export const SELL_TYPE_LABEL: Record<SellType, string> = {
  free: "免费",
  paid: "付费",
  encrypted: "加密",
  specified: "指定学员",
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

export interface ActivityOwner {
  id: string;
  userName: string;
}

export interface ActivityProduct {
  spuId: string;
  productName: string;
}

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
  shelfStatus?: ShelfStatus;
  riskStatus?: RiskStatus;
  sellType?: SellType;
  validityLabel?: string;
  canBroadcast?: boolean;
  owners?: ActivityOwner[];
  products?: ActivityProduct[];
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
  shelfStatus?: ShelfStatus;
  startFrom?: string;
  startTo?: string;
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
  listed: boolean;
  sellType: SellType;
  ownerIds?: string[];
  products?: ActivityProduct[];
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

export function setActivityShelf(id: ActivityId, listed: boolean) {
  return post<{ id: ActivityId; shelfStatus: ShelfStatus }>(`/activities/${id}/shelf`, {
    listed,
  });
}

export interface AuditRecord {
  id: string;
  result: AuditResult;
  reason?: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export function listActivityAudits(id: ActivityId) {
  return get<{ list: AuditRecord[] }>(`/activities/${id}/audits`);
}

export function submitActivityAudit(
  id: ActivityId,
  payload: { result: AuditResult; reason?: string },
) {
  return post<{ id: ActivityId; riskStatus: RiskStatus; shelfStatus: ShelfStatus }>(
    `/activities/${id}/audit`,
    payload,
  );
}

export interface EmployeeItem {
  id: string;
  userName: string;
}

export function listEmployees(keyword?: string) {
  return get<{ list: EmployeeItem[] }>("/employees", {
    params: keyword?.trim() ? { keyword: keyword.trim() } : undefined,
  });
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

export function sellTagText(item: Pick<ActivityListItem, "sellType" | "validityLabel">) {
  const sell = item.sellType ? SELL_TYPE_LABEL[item.sellType] : "";
  const validity = item.validityLabel?.trim() || "长期有效";
  if (sell) return `${sell} / ${validity}`;
  return validity;
}
