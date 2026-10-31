import { get, post } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export type WatchAccessState =
  | "ok"
  | "need_password"
  | "need_login"
  | "forbidden"
  | "expired";

export interface WatchAccessData {
  id: string;
  sellAlone: boolean;
  sellType: string;
  accessState: WatchAccessState;
  accessExpired: boolean;
  accessValidityType?: string;
  accessValidityDays?: number;
}

export interface VerifyPasswordResult {
  accessToken: string;
  expiresIn: number;
}

function authHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const viewer = getViewerAccessToken();
  if (viewer) {
    headers.Authorization = `Bearer ${viewer}`;
  }
  return headers;
}

export function getWatchAccess(activityId: string) {
  return get<WatchAccessData>(`/watch/access/${activityId}`, {
    headers: authHeaders(activityId),
  });
}

export function verifyWatchPassword(activityId: string, password: string) {
  return post<VerifyPasswordResult>(
    `/watch/access/verify-password/${activityId}`,
    { password },
  );
}
