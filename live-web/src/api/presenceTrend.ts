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

/** live-service：`GET /api/watch/{id}/presence-trend`（T15.15 / T15.16） */
export function fetchPresenceTrend(
  id: string,
  query: { startTime: string; endTime: string; bucketSeconds?: number },
) {
  return get<PresenceTrendData>(`/watch/${id}/presence-trend`, {
    params: {
      startTime: query.startTime,
      endTime: query.endTime,
      bucketSeconds: query.bucketSeconds ?? 60,
    },
  });
}
