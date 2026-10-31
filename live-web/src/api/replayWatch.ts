import { get, post } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken, isViewerLoggedIn } from "@/utils/viewerAuth";

export interface WatchRecordItem {
  id: number;
  title?: string;
  duration?: string;
  coverUrl?: string;
  /** 本站 TOS/CDN；直接作 video src */
  tosUrl?: string;
  createdTime?: string;
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

function watchGateHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function listWatchRecords(activityId: string) {
  return get<WatchRecordListData>(`/watch/records/${activityId}`, {
    headers: watchGateHeaders(activityId),
  });
}

export function startReplayWatch(activityId: string, recordId: number) {
  return post<ReplayStartResult>(
    `/watch/replay/start/${activityId}`,
    { recordId },
    { headers: watchGateHeaders(activityId) },
  );
}

export function heartbeatReplayWatch(activityId: string, socketId: string) {
  return post<ReplayHeartbeatResult>(
    `/watch/replay/heartbeat/${activityId}`,
    { socketId },
    { headers: watchGateHeaders(activityId) },
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
        ...watchGateHeaders(activityId),
      },
      body: JSON.stringify({ socketId }),
      keepalive: true,
    });
  } catch {
    /* 关页失败停在上一次成功心跳 */
  }
}
