import { post } from "./http";

export type DevPresenceType = "Join" | "Leave";

export interface DevPresenceItemResult {
  username: string;
  ok: boolean;
  mid?: string;
  error?: string;
}

export interface DevPresenceResult {
  ok: number;
  failed: number;
  items: DevPresenceItemResult[];
}

/** 仅 spring profile=local：管理端模拟观众上下线灌数。 */
export function simulateDevPresence(
  activityId: string,
  body: { type: DevPresenceType; usernames: string[] },
) {
  return post<DevPresenceResult>(
    `/activities/dev/presence/${encodeURIComponent(activityId)}`,
    body,
  );
}
