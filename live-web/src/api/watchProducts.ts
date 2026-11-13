import { get, post } from "./http";
import { activityAccessHeader } from "@/utils/activityAccess";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface WatchProductItem {
  spuId: string;
  productName: string;
}

export interface WatchProductListData {
  /** 本场绑定 spu 快照（供小黄车调订单中心 by-ids） */
  list: WatchProductItem[];
}

function authHeaders(activityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...activityAccessHeader(activityId),
  };
  const token = getViewerAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 本场绑定商品快照（小黄车元数据）；须过观看门禁（D115）。 */
export function listWatchProducts(activityId: string) {
  return get<WatchProductListData>(`/watch/products/${activityId}`, {
    headers: authHeaders(activityId),
  });
}

/** 小黄车「去抢购」点击埋点；失败由调用方吞掉，不挡下单。 */
export function reportWatchProductClick(activityId: string, spuId: string) {
  return post<{ ok: boolean }>(
    `/watch/products/click/${activityId}`,
    { spuId },
    { headers: authHeaders(activityId) },
  );
}
