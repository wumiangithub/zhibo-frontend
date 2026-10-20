import { get } from "./http";
import {
  listActivities,
  STATE_LABEL,
  type ActivityListItem,
} from "./activity";

/** 素材分组 */
export interface MaterialGroup {
  id: string;
  name: string;
  count: number;
}

/** 素材库视频 */
export interface MaterialVideoItem {
  id: string;
  title: string;
  /** 提交 create-demand 时优先用此字段 */
  recordId?: string;
  coverUrl?: string;
  duration?: string;
  size?: string;
  status?: string;
  citePlaces?: string;
  protection?: string;
  createdTime?: string;
  groupId?: string;
}

export interface MaterialVideoListData {
  total: number;
  list: MaterialVideoItem[];
  /** 可选：与列表一并返回的分组 */
  groups?: MaterialGroup[];
  /** 容量提示，如「已用 1.2G / 共 10G」 */
  capacityTip?: string;
}

export interface MaterialVideoQuery {
  page?: number;
  pageSize?: number;
  groupId?: string;
  keyword?: string;
}

/** 选择直播弹窗用的列表项（来自本站活动列表，已筛 provider=vhall） */
export interface VhallLiveItem {
  id: string;
  title: string;
  coverUrl?: string;
  startTime?: string;
  endTime?: string;
  state?: number;
  stateLabel?: string;
}

export interface VhallLiveListData {
  total: number;
  list: VhallLiveItem[];
}

export interface VhallLiveQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

/** 某场活动下的回放记录 */
export interface VhallPlaybackItem {
  id: string;
  title: string;
  duration?: string;
  createdTime?: string;
  coverUrl?: string;
}

export interface VhallPlaybackListData {
  total: number;
  list: VhallPlaybackItem[];
}

function mapActivityToLive(item: ActivityListItem): VhallLiveItem {
  return {
    id: item.id,
    title: item.title,
    coverUrl: item.coverUrl,
    startTime: item.startTime,
    state: item.state,
    stateLabel: STATE_LABEL[item.state] ?? String(item.state),
  };
}

/** GET /api/v1/materials/groups/list */
export function listMaterialGroups() {
  return get<MaterialGroup[]>("/materials/groups/list");
}

/** GET /api/v1/materials/videos */
export function listMaterialVideos(query: MaterialVideoQuery = {}) {
  return get<MaterialVideoListData>("/materials/videos", {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      groupId: query.groupId || undefined,
      keyword: query.keyword || undefined,
    },
  });
}

/**
 * 选择直播列表：复用本站活动列表，固定筛 provider=vhall。
 * 即 GET /api/v1/activities/list?provider=vhall&page&pageSize&keyword
 */
export async function listVhallLives(query: VhallLiveQuery = {}): Promise<VhallLiveListData> {
  const data = await listActivities({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    keyword: query.keyword,
    provider: "vhall",
  });
  return {
    total: data.total ?? 0,
    list: (data.list ?? []).map(mapActivityToLive),
  };
}

/**
 * 某场本站活动（微吼）下的回放记录。
 * GET /api/v1/activities/records/{id} → list[].id 为 create-demand 的 record_id
 */
export function listVhallLiveRecords(activityId: string) {
  return get<VhallPlaybackListData>(
    `/activities/records/${encodeURIComponent(activityId)}`,
  );
}
