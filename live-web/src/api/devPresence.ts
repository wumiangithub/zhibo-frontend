import { post } from "@/api/http";

export interface DevPresenceBody {
  type: "Join" | "Leave";
  email: string;
  socketId: string;
  nickname?: string;
}

const DEV_SOCKET_PREFIX = "zhibo.devPresenceSocket.";

/** 同一次模拟连接的上线/离线共用；刷新本页内保持。 */
export function getOrCreateDevSocketId(activityId: string): string {
  const key = `${DEV_SOCKET_PREFIX}${activityId}`;
  try {
    const existing = sessionStorage.getItem(key)?.trim() ?? "";
    if (existing && existing.length <= 64) return existing;
    const created = crypto.randomUUID().replace(/-/g, "");
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

/** 本地开发：组装并走微吼上下线回调。仅 spring profile=local 可用。 */
export function simulateDevPresence(activityId: string, body: DevPresenceBody) {
  return post<{ mid: string }>(`/watch/dev/presence/${activityId}`, body);
}
