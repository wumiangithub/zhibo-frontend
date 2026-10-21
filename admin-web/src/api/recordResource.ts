import { get } from "./http";
import {
  listActivities,
  STATE_LABEL,
  type ActivityListItem,
} from "./activity";

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
