import { get } from "./http";
import {
  listActivities,
  STATE_LABEL,
  type ActivityListItem,
} from "./activity";
import { resolveCreatedTime, type CreatedTimeFields } from "@/utils/createdTime";

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
  /** 直播状态多选（1～5），传给 activities/list 的 states */
  states?: number[];
}

/** 某场活动下的回放记录；id = create-demand 的 record_id（JSON number） */
export interface VhallPlaybackItem {
  id: number;
  title: string;
  duration?: string;
  createdTime?: string;
  coverUrl?: string;
  /** 体积（KB），微吼 storage */
  storage?: string;
  /** 到期时间，微吼 save_time */
  saveTime?: string;
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

/**
 * 选择直播列表：复用本站活动列表，固定筛 provider=vhall。
 * 即 GET /api/v1/activities/list?provider=vhall&page&pageSize&keyword
 */
export async function listVhallLives(query: VhallLiveQuery = {}): Promise<VhallLiveListData> {
  const states =
    query.states && query.states.length > 0
      ? [...new Set(query.states.filter((s) => s >= 1 && s <= 5))].join(",")
      : undefined;
  const data = await listActivities({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    keyword: query.keyword,
    states,
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
 * 时间字段：优先 createdTime，兼容未映射的 createdAt（微吼原名 created_at）
 */
export async function listVhallLiveRecords(activityId: string): Promise<VhallPlaybackListData> {
  const data = await get<{ total: number; list: (VhallPlaybackItem & CreatedTimeFields)[] }>(
    `/activities/records/${encodeURIComponent(activityId)}`,
  );
  return {
    total: data.total ?? 0,
    list: (data.list ?? []).map((item) => ({
      ...item,
      createdTime: resolveCreatedTime(item) || undefined,
    })),
  };
}
