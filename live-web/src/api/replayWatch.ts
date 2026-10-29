import { get, post } from "./http";
import { getViewerAccessToken, isViewerLoggedIn } from "@/utils/viewerAuth";

export interface WatchRecordItem {
  id: number;
}

export interface WatchRecordListData {
  list: WatchRecordItem[];
}

export interface ReplayStartResult {
  socketId: string;
}

export interface ReplayHeartbeatResult {
  lastReportTime: string;
}

function viewerAuthHeader(): { Authorization: string } | Record<string, never> {
  const token = getViewerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function listWatchRecords(activityId: string) {
  return get<WatchRecordListData>(`/watch/records/${activityId}`);
}

export function startReplayWatch(activityId: string, recordId: number) {
  return post<ReplayStartResult>(
    `/watch/replay/start/${activityId}`,
    { recordId },
    { headers: viewerAuthHeader() },
  );
}

export function heartbeatReplayWatch(activityId: string, socketId: string) {
  return post<ReplayHeartbeatResult>(
    `/watch/replay/heartbeat/${activityId}`,
    { socketId },
    { headers: viewerAuthHeader() },
  );
}

/**
 * 关页心跳。用 fetch keepalive 带观众 access，不要 sendBeacon（带不了 Authorization）。
 */
export function heartbeatReplayWatchKeepalive(activityId: string, socketId: string): void {
  if (!isViewerLoggedIn()) return;
  const token = getViewerAccessToken();
  if (!token || !socketId) return;
  try {
    void fetch(`/api/v1/watch/replay/heartbeat/${activityId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ socketId }),
      keepalive: true,
    });
  } catch {
    /* 关页失败停在上一次成功心跳 */
  }
}
