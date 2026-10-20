import { get } from "./http";

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

/** live-service：`GET /api/v1/watch/presence-trend/{id}`（T15.15 / T15.16；D62） */
export function fetchPresenceTrend(
  id: string,
  query: { startTime: string; endTime: string; bucketSeconds?: number },
) {
  return get<PresenceTrendData>(`/watch/presence-trend/${id}`, {
    params: {
      startTime: query.startTime,
      endTime: query.endTime,
      bucketSeconds: query.bucketSeconds ?? 60,
    },
  });
}
