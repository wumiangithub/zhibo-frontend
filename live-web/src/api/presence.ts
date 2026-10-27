import { post } from "./http";
import { getViewerAccessToken, isViewerLoggedIn } from "@/utils/viewerAuth";

/** 已登录观众进房时上报最近访问；失败静默。 */
export function pingViewerPresence(scene: "miniapp" | "live" = "live"): void {
  if (!isViewerLoggedIn()) return;
  const token = getViewerAccessToken();
  if (!token) return;
  void post<{ lastVisitTime: string }>(
    "/viewer/presence/ping",
    { scene },
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch((e) => {
    console.warn("访问心跳失败", e);
  });
}
