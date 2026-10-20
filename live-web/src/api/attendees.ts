import { get } from "./http";

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

/** live-service：`GET /api/v1/watch/attendees/{id}`（T15.9；D62） */
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
  return get<AttendeeListData>(`/watch/attendees/${id}`, { params });
}
