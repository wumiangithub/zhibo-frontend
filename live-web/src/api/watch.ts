import { get } from "./http";

const GUEST_ID_KEY = "zhibo.guestId";

export interface WatchData {
  id: number;
  title: string;
  state: number;
  type: number;
  nickname: string;
  guestId: string;
  embedUrl: string;
}

export interface WatchParams {
  guestId?: string;
  nickname?: string;
}

export function getStoredGuestId(): string {
  return localStorage.getItem(GUEST_ID_KEY) ?? "";
}

export function storeGuestId(guestId: string) {
  if (guestId) localStorage.setItem(GUEST_ID_KEY, guestId);
}

export function getWatch(id: number, params: WatchParams = {}) {
  return get<WatchData>(`/watch/${id}`, { params });
}
