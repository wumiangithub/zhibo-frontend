import axios from "axios";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";
import { getViewerAccessToken } from "@/utils/viewerAuth";

/** 观众端商品列表项（字段按对方响应宽松映射）。 */
export interface ViewerOrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  /** 展示价文案（有则用） */
  priceText?: string;
}

export interface ViewerProductListByIdsResult {
  list: ViewerOrderCenterProduct[];
  page: number;
  size: number;
  total: number;
}

interface OrderCenterListBody {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: {
    list?: unknown[];
    page?: number;
    size?: number;
    total?: number;
  };
}

function orderCenterBase(): string {
  if (import.meta.env.DEV) return "";
  const raw = import.meta.env.VITE_ORDER_CENTER_BASE_URL?.trim();
  return (raw || "http://fadada-notify.scqkxx.com").replace(/\/$/, "");
}

function isOrderCenterSuccess(code: unknown): boolean {
  if (code == null || code === "") return false;
  const n = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(n)) return false;
  return n === 0 || n === 200;
}

function stringifyBigIntIds(raw: string): string {
  return raw.replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"');
}

function pickPriceFromSkuList(skuList: unknown): string | undefined {
  if (!Array.isArray(skuList) || !skuList.length) return undefined;
  let best: number | undefined;
  for (const row of skuList) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const hasSpec = Object.prototype.hasOwnProperty.call(o, "specStatus");
    const onShelf = !hasSpec || o.specStatus === 1 || o.specStatus === "1";
    if (!onShelf) continue;
    for (const key of ["activityStandardPrice", "standardPrice", "activityUpgradePrice", "upgradePrice"] as const) {
      const v = o[key];
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n > 0 && (best == null || n < best)) {
        best = n;
      }
    }
  }
  return best != null ? `¥${best}` : undefined;
}

function mapProduct(row: unknown): ViewerOrderCenterProduct | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const spuId = o.spuId != null ? String(o.spuId) : "";
  const productName =
    typeof o.productName === "string" ? o.productName.trim() : String(o.productName ?? "").trim();
  if (!spuId || !productName) return null;

  let priceText: string | undefined;
  const priceCandidates = [o.price, o.salePrice, o.standardPrice, o.minPrice, o.activityStandardPrice];
  for (const p of priceCandidates) {
    if (typeof p === "number" && Number.isFinite(p) && p > 0) {
      priceText = `¥${p}`;
      break;
    }
    if (typeof p === "string" && p.trim()) {
      priceText = p.trim().startsWith("¥") ? p.trim() : `¥${p.trim()}`;
      break;
    }
  }
  if (!priceText) {
    priceText = pickPriceFromSkuList(o.skuList);
  }

  return {
    spuId,
    productName,
    coverImg: typeof o.coverImg === "string" && o.coverImg ? o.coverImg : undefined,
    priceText,
  };
}

/**
 * 订单中心观众端：按本场绑定 spuIds 批量取上架商品。
 * POST /order-center/api/live/viewer/product/list/by-ids
 * 头 Authorization-Live-Viewers；body 必填 spuIds（1～20）。
 * 返回与旧 viewer/product/list 同构；下架/不存在的 id 不出现在 list。
 */
export async function listViewerProductsByIds(
  spuIds: Array<string | number>,
): Promise<ViewerProductListByIdsResult> {
  const token = getViewerAccessToken();
  if (!token) {
    throw new Error("请先登录后再查看商品");
  }

  const ids = [
    ...new Set(
      spuIds
        .map((id) => Number(id))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, 20);

  if (!ids.length) {
    return { list: [], page: 1, size: 0, total: 0 };
  }

  const url = `${orderCenterBase()}/order-center/api/live/viewer/product/list/by-ids`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { spuIds: ids },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization-Live-Viewers": `Bearer ${token}`,
        },
        responseType: "text",
        transformResponse: [(data) => data],
        timeout: 20000,
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e));
  }

  if (resp.status === 401) {
    throw new Error("登录已失效，请重新登录后再查看商品");
  }

  let body: OrderCenterListBody;
  try {
    const text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? {});
    body = JSON.parse(stringifyBigIntIds(text)) as OrderCenterListBody;
  } catch {
    throw new Error("订单中心响应无法解析");
  }

  if (!isOrderCenterSuccess(body.code)) {
    throw new Error(body.message || body.msg || "拉取商品失败");
  }

  const data = body.data ?? {};
  const list = (data.list ?? [])
    .map(mapProduct)
    .filter((p): p is ViewerOrderCenterProduct => p != null);

  return {
    list,
    page: typeof data.page === "number" ? data.page : 1,
    size: typeof data.size === "number" ? data.size : list.length,
    total: typeof data.total === "number" ? data.total : list.length,
  };
}

/**
 * 按本场绑定 spuIds 拉订单中心上架商品，并按绑定顺序输出。
 * 缺名/未返回的 id 由调用方回退本站快照。
 */
export async function listViewerProductsForBoundSpus(
  boundSpuIds: string[],
): Promise<ViewerOrderCenterProduct[]> {
  const ordered = boundSpuIds.map(String).filter(Boolean);
  if (!ordered.length) return [];

  const res = await listViewerProductsByIds(ordered);
  const found = new Map(res.list.map((p) => [p.spuId, p]));

  return ordered
    .map((id) => found.get(String(id)))
    .filter((p): p is ViewerOrderCenterProduct => !!p);
}
