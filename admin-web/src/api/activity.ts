import { get, post, put, del } from "./http";

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
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  /** 头像 URL，可选 */
  avatar?: string;
}

/** 主播与归属人同形 */
export type ActivityHost = ActivityOwner;

export interface ActivityProduct {
  spuId: string;
  productName: string;
}

export interface ActivityCourseware {
  id: string;
  name: string;
  type: string;
  url: string;
}

export type AccessValidityType = "long" | "days";
export type PlaybackValidityType = "forever" | "days";

/** 活动就绪：1 就绪 / 0 转码中 / 2 失败 */
export const ActivityReady = {
  PENDING: 0,
  OK: 1,
  FAIL: 2,
} as const;

export type ActivityReadyStatus = (typeof ActivityReady)[keyof typeof ActivityReady];

export function activityReadyLabel(ready?: number | null): string {
  if (ready === ActivityReady.PENDING) return "转码中";
  if (ready === ActivityReady.FAIL) return "转码失败";
  return "已转码";
}

export interface ActivityListItem {
  id: ActivityId;
  provider?: LiveProvider;
  title: string;
  startTime: string;
  coverUrl?: string;
  state: number;
  type: number;
  /** 1 就绪（默认）/ 0 转码中 / 2 失败 */
  ready?: number;
  /** 录播素材 UUID */
  recordMaterialId?: string;
  viewerStyle?: string;
  shareLink?: string;
  createdTime?: string;
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
  /** type=4：是否定时；非录播可空 */
  isTiming?: boolean;
  virtualAvatar?: boolean;
  warmupType?: string;
  warmupUrl?: string;
  promoCoverUrl?: string;
  detailHtml?: string;
  autoList?: boolean;
  /** 绑定的直播报备 ID；未绑定不返回 */
  reportId?: string;
  reportTitle?: string;
  hosts?: ActivityHost[];
  coursewares?: ActivityCourseware[];
  sellAlone?: boolean;
  price?: number | string;
  linePrice?: number | string;
  /** 加密售卖：管理端详情回显明文 6 位 */
  password?: string;
  accessValidityType?: AccessValidityType;
  accessValidityDays?: number;
  playbackEnabled?: boolean;
  playbackValidityType?: PlaybackValidityType;
  playbackValidityDays?: number;
  playbackSpeedAllow?: boolean;
  playbackFastForwardAllow?: boolean;
}

export interface ActivityListData {
  total: number;
  list: ActivityListItem[];
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  /** 单值状态筛选；与 states 同时传时以后端 states 为准 */
  state?: number;
  /** 多选状态，逗号分隔如 `3,5`；录播「选择直播」用 */
  states?: string;
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
  /** 录播选「直播回放」：微吼回放列表 id */
  recordId?: string;
  /** 录播选「素材视频」：本站视频素材 UUID（库 record_material_id；与详情回显同名） */
  recordMaterialId?: string;
  /** type=4：是否定时 → 微吼 is_timing；默认 true；省略按 true */
  isTiming?: boolean;
  introduction?: string;
  endTime?: string;
  viewerStyle?: string;
  /** 创建默认 true；界面只读，创建请求仍传该字段 */
  ultraLowLatency?: boolean;
  coverUrl?: string;
  detailHtml?: string;
  /** 是否自动上架（审核通过后）；替代 listed */
  autoList: boolean;
  /** 主播员工 id（rs_mainkey_id），1～20 */
  hostIds: number[];
  /** 绑定已通过直播报备 UUID；创建必填 */
  reportId: string;
  ownerIds?: number[];
  products?: ActivityProduct[];
  /** 课件素材 UUID，最多 100 */
  coursewareMaterialIds?: string[];
}

export function createActivity(payload: CreateActivityPayload) {
  return post<{ id: ActivityId }>("/activities/create", payload);
}

export function listActivities(query: ListQuery = {}) {
  return get<ActivityListData>("/activities/list", { params: query });
}

export function getActivity(id: ActivityId) {
  return get<ActivityDetail>(`/activities/detail/${id}`);
}

export function getHostUrl(id: ActivityId) {
  return get<{ provider: LiveProvider; hostUrl: string }>(`/activities/host/${id}`);
}

export interface PushStreamInfo {
  streamAddress: string;
  streamCode: string;
  expireTime?: string;
}

/** 仅 rtmp。srt / 口令开播不要调。 */
export function getPushStream(id: ActivityId) {
  return get<PushStreamInfo>(`/activities/push-stream/${encodeURIComponent(id)}`);
}

/** 是否有推流：0 无，1 有。仅 rtmp。 */
export function getStreamStatus(id: ActivityId) {
  return get<{ status: number }>(
    `/activities/stream-status/${encodeURIComponent(id)}`,
  );
}

/** 第三方推流真正开播。不是结束直播，也不是网页主持人开播。 */
export function startActivityLive(id: ActivityId) {
  return post<{ id: ActivityId; state: number }>(
    `/activities/live/start/${encodeURIComponent(id)}`,
  );
}

export function getEmbedUrl(id: ActivityId) {
  return get<{ embedUrl: string }>(`/activities/embed/${id}`);
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
  return get<StatsOverview>(`/activities/stats/${id}`);
}

export function getOnlineTrend(id: ActivityId, startTime: string, endTime: string) {
  return get<OnlineTrendData>(`/activities/stats/online/${id}`, {
    params: { startTime, endTime },
  });
}

export interface UpdateActivityPayload {
  title?: string;
  startTime?: string;
  introduction?: string;
  endTime?: string;
  coverUrl?: string;
  detailHtml?: string;
  autoList?: boolean;
  hostIds?: number[];
  ownerIds?: number[];
  products?: ActivityProduct[];
  coursewareMaterialIds?: string[];
  /** 仅录播：替换素材视频，ready→0（与创建/详情同名 recordMaterialId） */
  recordMaterialId?: string;
}

export function updateActivity(id: ActivityId, payload: UpdateActivityPayload) {
  return put<{ id: ActivityId }>(`/activities/update/${id}`, payload);
}

export interface UpdatePlaybackPayload {
  playbackEnabled: boolean;
  playbackValidityType?: PlaybackValidityType;
  playbackValidityDays?: number;
  playbackSpeedAllow?: boolean;
  playbackFastForwardAllow?: boolean;
}

export function updateActivityPlayback(id: ActivityId, payload: UpdatePlaybackPayload) {
  return put<{ id: ActivityId }>(`/activities/playback/${id}`, payload);
}

export interface UpdateSalesPayload {
  sellAlone: boolean;
  sellType: SellType;
  price?: number | string;
  linePrice?: number | string;
  password?: string;
  accessValidityType?: AccessValidityType;
  accessValidityDays?: number;
}

export function updateActivitySales(id: ActivityId, payload: UpdateSalesPayload) {
  return put<{ id: ActivityId; sellType: SellType; validityLabel: string }>(
    `/activities/sales/${id}`,
    payload,
  );
}

export interface ActivityRecordItem {
  id: string;
  title: string;
  duration?: string;
  createdTime?: string;
  coverUrl?: string;
  /** 本轮可能无下载直链 */
  downloadUrl?: string;
}

export function listActivityRecords(id: ActivityId) {
  return get<{ total: number; list: ActivityRecordItem[] }>(
    `/activities/records/${encodeURIComponent(id)}`,
  );
}

export function endActivity(id: ActivityId) {
  return post<{ id: ActivityId; state: number }>(`/activities/end/${id}`);
}

export function deleteActivity(id: ActivityId) {
  return del<{ id: ActivityId }>(`/activities/delete/${id}`);
}

export function setActivityShelf(id: ActivityId, listed: boolean) {
  return post<{ id: ActivityId; shelfStatus: ShelfStatus }>(`/activities/shelf/${id}`, {
    listed,
  });
}

export type AuditAction = "submit" | "audit";

export interface AuditRecord {
  id: string;
  action?: AuditAction;
  result?: AuditResult;
  reason?: string;
  /** 操作人员工 id（rs_mainkey_id） */
  operatorId: number;
  operatorName: string;
  /** 操作人部门展示名；无则省略 */
  departmentName?: string;
  createdTime: string;
}

export function listActivityAudits(id: ActivityId) {
  return get<{ list: AuditRecord[] }>(`/activities/audits/${id}`);
}

/** 接口未带 submit 时，展示层按创建时间补一条「发起申请」（倒序末尾）。 */
export function ensureActivitySubmitAudit(rows: AuditRecord[], createdTime?: string): AuditRecord[] {
  const hasSubmit = rows.some((r) => r.action === "submit" || (!r.action && !r.result));
  if (hasSubmit) return rows;
  return [
    ...rows,
    {
      id: "synthetic-submit",
      action: "submit",
      operatorId: 0,
      operatorName: "系统",
      createdTime: createdTime ?? "",
    },
  ];
}

export function submitActivityAudit(
  id: ActivityId,
  payload: { result: AuditResult; reason?: string },
) {
  return post<{ id: ActivityId; riskStatus: RiskStatus; shelfStatus: ShelfStatus }>(
    `/activities/audit/${id}`,
    payload,
  );
}

export interface EmployeeItem {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  /** 头像 URL，可选 */
  avatar?: string;
  /** 所在部门展示名；接口未返回则不下发 */
  departmentName?: string;
}

export function listEmployees(keyword?: string) {
  return get<{ list: EmployeeItem[] }>("/employees", {
    params: keyword?.trim() ? { keyword: keyword.trim() } : undefined,
  });
}

/** 开播成员一行。role：1 主播 / 2 助理 / 3 嘉宾（D57） */
export interface ActivityMemberItem {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  departmentName?: string;
  /** 1 主播 / 2 助理 / 3 嘉宾 */
  role: number;
  nickname?: string;
  avatarUrl?: string;
  tag?: string;
}

export interface ActivityMemberListData {
  list: ActivityMemberItem[];
}

/** GET /api/v1/activities/members/list/{id} */
export function listActivityMembers(id: ActivityId) {
  return get<ActivityMemberListData>(`/activities/members/list/${encodeURIComponent(id)}`);
}

export interface ActivityMemberBinding {
  id: number;
  /** 1 主播 / 2 助理 / 3 嘉宾 */
  role: number;
  nickname?: string;
  avatarUrl?: string;
  tag?: string;
}

/** PUT /api/v1/activities/members/save/{id} —— 全量覆盖主播/助理/嘉宾 */
export function replaceActivityMembers(id: ActivityId, members: ActivityMemberBinding[]) {
  return put<ActivityMemberListData>(`/activities/members/save/${encodeURIComponent(id)}`, {
    members,
  });
}

export interface AcceptActivityMemberResult {
  id: number;
  userName: string;
  /** 1 主播 / 2 助理 / 3 嘉宾 */
  role: number;
  alreadyMember: boolean;
  inviterName?: string;
}

/** POST /api/v1/activities/members/accept/{id} —— 当前登录人加入邀约角色 */
export function acceptActivityMember(
  id: ActivityId,
  body: { role: number; inviterId: number },
) {
  return post<AcceptActivityMemberResult>(
    `/activities/members/accept/${encodeURIComponent(id)}`,
    body,
  );
}

/**
 * @deprecated D60：禁止新用。请改用 `@/utils/tosUpload` 的 `uploadFileToTos` + 功能前缀（见 API约定 tos-sts「对象 key 目录」）。
 * 微吼代理 `POST /api/v1/uploads/image` 已废弃。
 */
export async function uploadImage(file: File): Promise<string> {
  void file;
  throw new Error(
    "uploadImage（微吼）已废弃（D60）。请使用 uploadFileToTos 与已登记的 TOS 对象 key 前缀",
  );
}

export function sellTagText(item: Pick<ActivityListItem, "sellType" | "validityLabel">) {
  const sell = item.sellType ? SELL_TYPE_LABEL[item.sellType] : "";
  const validity = item.validityLabel?.trim() || "长期有效";
  if (sell) return `${sell} / ${validity}`;
  return validity;
}
