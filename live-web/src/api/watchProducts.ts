import { get } from "./http";

export interface WatchProductItem {
  spuId: string;
  productName: string;
}

export interface WatchProductListData {
  /** 本场绑定 spu 快照（供小黄车调订单中心 by-ids） */
  list: WatchProductItem[];
}

/** 本场绑定商品快照（小黄车元数据）。 */
export function listWatchProducts(activityId: string) {
  return get<WatchProductListData>(`/watch/products/${activityId}`);
}
