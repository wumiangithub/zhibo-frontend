import { get, post, put, del } from "./http";
import { resolveCreatedTime, type CreatedTimeFields } from "@/utils/createdTime";

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
  fileSize?: number;
  mimeType?: string;
  thumbUrl?: string;
  /** 视频时长展示文案（来自素材 meta）；非视频省略 */
  durationText?: string;
  /**
   * 课程课件学员权限：1 预览及下载 / 2 仅预览 / 3 仅下载。
   * 直播课件可不传。
   */
  accessPermission?: number;
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
  introduction?: string;
  endTime?: string;
  verify?: number;
  pv?: number;
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

export type ActivitySortKey = "startTime";

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
  /** 仅 startTime；不传则后端按 createdTime 降序 */
  sort?: ActivitySortKey;
  order?: "asc" | "desc";
}

export interface CreateActivityPayload {
  provider: LiveProvider;
  title: string;
  startTime: string;
  type: number;
  /** 录播选「直播回放」：微吼回放列表 id（JSON number） */
  recordId?: number;
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

/**
 * 角色参会地址（微吼 page_url）。本站开播页 iframe 用 hostUrl。
 * @param role 1 主播 / 2 嘉宾 / 3 助理；省略后端按主播
 */
export function getHostUrl(id: ActivityId, role?: number) {
  return get<{ provider: LiveProvider; hostUrl: string; role?: number }>(
    `/activities/host/${encodeURIComponent(id)}`,
    { params: role != null ? { role } : undefined },
  );
}

/** 管理端：查本场口令开播口令（旧数据无码则后端补发）。 */
export function getActivityPasscode(id: ActivityId) {
  return get<{ passcode: string }>(
    `/activities/passcode/${encodeURIComponent(id)}`,
  );
}

/** 管理端：重置口令，旧码立刻失效。 */
export function resetActivityPasscode(id: ActivityId) {
  return post<{ passcode: string }>(
    `/activities/passcode/reset/${encodeURIComponent(id)}`,
  );
}

export interface PasscodeEnterResult {
  activityId: string;
  provider: LiveProvider;
  hostUrl: string;
  role: number;
  nickname: string;
}

/**
 * 公开：凭口令换主播参会地址。H5 / 以后 App 共用。
 * 不依赖管理端登录；401 时不要踢去登录页。
 */
export function enterByPasscode(passcode: string, nickname?: string) {
  return post<PasscodeEnterResult>(
    "/outside/host/passcode/enter",
    {
      passcode,
      nickname: nickname?.trim() || undefined,
    },
    { skipAuthRefresh: true },
  );
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
    `/activities/start/${encodeURIComponent(id)}`,
  );
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

/** 用户运营 · 评论管理：微吼聊天审核页 URL（D34） */
export function fetchActivityChatFilterPageUrl(
  id: ActivityId,
  query?: { email?: string; name?: string },
) {
  const params: Record<string, string> = {};
  const email = query?.email?.trim();
  const name = query?.name?.trim();
  if (email) params.email = email;
  if (name) params.name = name;
  return get<{ pageUrl: string }>(`/activities/chat-filter/${encodeURIComponent(id)}`, {
    params: Object.keys(params).length ? params : undefined,
  });
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
  /** 微吼 create-demand 的 record_id（JSON number） */
  id: number;
  title: string;
  duration?: string;
  createdTime?: string;
  coverUrl?: string;
  /** 体积（KB） */
  storage?: string;
  /** 本库状态 INT：1 pending_package / 2 packaging / 3 downloading / 4 ready / 5 failed；仅云侧未入库时可无 */
  status?: number;
  /** 仅本库 ready 时为本站 TOS/CDN（与 tosUrl 同值，兼容旧字段） */
  downloadUrl?: string;
  /** 本库有 tos_url 时返回；有值可直接下载 */
  tosUrl?: string;
}

export async function listActivityRecords(id: ActivityId) {
  const data = await get<{ total: number; list: (ActivityRecordItem & CreatedTimeFields)[] }>(
    `/activities/records/${encodeURIComponent(id)}`,
  );
  return {
    total: data.total ?? 0,
    list: (data.list ?? []).map((item) => ({
      ...item,
      createdTime: resolveCreatedTime(item) || undefined,
    })),
  };
}

/** D88 download：packStatus 0 未开始 / 1 可下载（本站 TOS）/ 2 处理中 / 3 失败 */
export interface ActivityRecordDownload {
  recordId: number;
  /** 本站 TOS/CDN；有值时与 tosUrl 同值（兼容） */
  downloadUrl?: string;
  /** 本站 TOS/CDN；有值时前端直接走下载封装 */
  tosUrl?: string;
  packStatus?: number;
  progress?: number;
  /** 本站内存任务开始下载时间 yyyy-MM-dd HH:mm:ss；packStatus=2 且任务在跑时有 */
  downloadStartedTime?: string;
}

/** GET /activities/records/{id}/download/{recordId} */
export function getActivityRecordDownload(activityId: ActivityId, recordId: number) {
  return get<ActivityRecordDownload>(
    `/activities/records/${encodeURIComponent(activityId)}/download/${recordId}`,
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

/** 开播成员一行。role：1 主播 / 2 嘉宾 / 3 助理（与微吼 type 一致，D66） */
export interface ActivityMemberItem {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  /** 员工微信头像，实时查员工表；空则不返回 */
  headimgurl?: string;
  departmentName?: string;
  /** 1 主播 / 2 嘉宾 / 3 助理 */
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
  /** 1 主播 / 2 嘉宾 / 3 助理 */
  role: number;
  nickname?: string;
  avatarUrl?: string;
  tag?: string;
}

/** POST /api/v1/activities/members/add/{id} —— 只新增这些人，不改已有成员 */
export function addActivityMembers(id: ActivityId, members: ActivityMemberBinding[]) {
  return post<ActivityMemberListData>(`/activities/members/add/${encodeURIComponent(id)}`, {
    members,
  });
}

/** DELETE /api/v1/activities/members/delete/{id} —— 按员工 id 删除，其余不动 */
export function deleteActivityMembers(id: ActivityId, ids: number[]) {
  return del<ActivityMemberListData>(`/activities/members/delete/${encodeURIComponent(id)}`, {
    data: { ids },
  });
}

/** PUT /api/v1/activities/members/update/{id} —— 只改这一名成员的昵称、头像、标签 */
export function updateActivityMember(
  id: ActivityId,
  body: { id: number; nickname?: string; avatarUrl?: string; tag?: string },
) {
  return put<ActivityMemberListData>(`/activities/members/update/${encodeURIComponent(id)}`, body);
}

export interface AcceptActivityMemberResult {
  id: number;
  userName: string;
  /** 1 主播 / 2 嘉宾 / 3 助理 */
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
