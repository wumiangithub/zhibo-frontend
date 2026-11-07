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

/** 开发态走 Vite `/order-center` 代理；构建态读 VITE_ORDER_CENTER_BASE_URL（须写在对应 .env.*） */
function orderCenterBase(): string {
  if (import.meta.env.DEV) return "";
  return String(import.meta.env.VITE_ORDER_CENTER_BASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
}

function isOrderCenterSuccess(code: unknown): boolean {
  if (code == null || code === "") return false;
  const n = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(n)) return false;
  return n === 0 || n === 200;
}

function stringifyBigIntIds(raw: string): string {
  return raw
    .replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"')
    .replace(/"orderId"\s*:\s*(\d+)/g, '"orderId":"$1"')
    .replace(/"orderNo"\s*:\s*(\d+)/g, '"orderNo":"$1"');
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

/** 订单状态：待支付（对方 order_stats） */
export const ORDER_STATUS_UNPAID = 1010;
/** 订单状态：已支付 / 已付款 */
export const ORDER_STATUS_PAID = 1030;

export interface ViewerOrderItem {
  orderNo: string;
  productName: string;
  customerAccount: string;
  customerName: string;
  orderStatus: number;
  /** 金额字符串，原样展示 */
  orderMoney: string;
  createTime: string;
  coverImg: string;
  serviceDay: number | string | null;
  validityLabel: string;
}

export interface ViewerOrderListResult {
  list: ViewerOrderItem[];
  page: number;
  size: number;
  total: number;
}

export function orderStatusLabel(status: number): string {
  if (status === ORDER_STATUS_PAID) return "已付款";
  if (status === ORDER_STATUS_UNPAID) return "待支付";
  return status ? `状态${status}` : "";
}

export function isPaidOrder(status: number): boolean {
  return status === ORDER_STATUS_PAID;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function normalizeOrderItem(raw: unknown): ViewerOrderItem {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = Number(r.orderStatus);
  const serviceDay = r.serviceDay;
  return {
    orderNo: asText(r.orderNo),
    productName: asText(r.productName),
    customerAccount: asText(r.customerAccount),
    customerName: asText(r.customerName),
    orderStatus: Number.isFinite(status) ? status : 0,
    orderMoney: r.orderMoney != null ? String(r.orderMoney) : "",
    createTime: asText(r.createTime),
    coverImg: asText(r.coverImg),
    serviceDay:
      serviceDay == null || serviceDay === ""
        ? null
        : typeof serviceDay === "number" || typeof serviceDay === "string"
          ? serviceDay
          : String(serviceDay),
    validityLabel: asText(r.validityLabel),
  };
}

function asPageNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 观众端我的订单列表。
 * POST /order-center/api/live/viewer/order/list
 * 头 Authorization-Live-Viewers；page 从 1 起，pageSize 1～100。
 * 不按状态筛选；页面只展示 orderStatus=1030。
 */
export async function listMyOrders(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<ViewerOrderListResult> {
  const token = getViewerAccessToken();
  if (!token) {
    throw new Error("请先登录");
  }

  const page = opts?.page != null && opts.page >= 1 ? Math.floor(opts.page) : 1;
  const pageSize =
    opts?.pageSize != null && opts.pageSize >= 1
      ? Math.min(100, Math.floor(opts.pageSize))
      : 20;

  const url = `${orderCenterBase()}/order-center/api/live/viewer/order/list`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { page, pageSize },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization-Live-Viewers": `Bearer ${token}`,
        },
        responseType: "text",
        transformResponse: [(data) => data],
        timeout: 20000,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "网络异常"));
  }

  let body: OrderCenterListBody;
  try {
    const text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? {});
    body = JSON.parse(stringifyBigIntIds(text)) as OrderCenterListBody;
  } catch {
    if (resp.status === 401) throw new Error("登录状态已失效");
    throw new Error("订单中心响应无法解析");
  }

  const code = body.code;
  const authFailed =
    resp.status === 401 ||
    code === 401 ||
    code === "401" ||
    code === 16 ||
    code === "16";
  if (authFailed) {
    throw new Error(body.message || body.msg || "登录状态已失效");
  }
  if (!isOrderCenterSuccess(code)) {
    throw new Error(body.message || body.msg || "请求失败");
  }

  const data = body.data ?? {};
  const list = (data.list ?? []).map(normalizeOrderItem);
  return {
    list,
    page: asPageNumber(data.page, page),
    size: asPageNumber(data.size, pageSize),
    total: asPageNumber(data.total, list.length),
  };
}

export interface ReceiveViewerCouponInput {
  /** 订单中心券池 id（oms coupon.rs_mainkey_id） */
  couponId: number;
  /** 具体从哪里领，如直播间名称 */
  receiveName?: string;
  employeeId?: number;
  employeeName?: string;
  deptId?: number;
  deptName?: string;
}

export interface ReceiveViewerCouponResult {
  couponUserId?: number;
  couponId?: number;
  couponName?: string;
  couponAmount?: string;
  message?: string;
}

interface OrderCenterReceiveBody {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * 观众端领取优惠券。
 * POST /order-center/api/live/viewer/coupon/receive
 * 头 Authorization-Live-Viewers；body 必填 couponId；username/receiveType 由对方登录态覆盖，勿传。
 */
export async function receiveViewerCoupon(
  input: ReceiveViewerCouponInput,
): Promise<ReceiveViewerCouponResult> {
  const token = getViewerAccessToken();
  if (!token) {
    throw new Error("请先登录后再领取");
  }

  const couponId = Number(input.couponId);
  if (!Number.isInteger(couponId) || couponId <= 0) {
    throw new Error("优惠券无效");
  }

  const body: Record<string, unknown> = { couponId };
  const receiveName = input.receiveName?.trim();
  if (receiveName) body.receiveName = receiveName;
  if (input.employeeId != null && Number.isFinite(input.employeeId) && input.employeeId >= 0) {
    body.employeeId = Math.floor(input.employeeId);
  }
  const employeeName = input.employeeName?.trim();
  if (employeeName) body.employeeName = employeeName;
  if (input.deptId != null && Number.isFinite(input.deptId) && input.deptId >= 0) {
    body.deptId = Math.floor(input.deptId);
  }
  const deptName = input.deptName?.trim();
  if (deptName) body.deptName = deptName;

  const url = `${orderCenterBase()}/order-center/api/live/viewer/coupon/receive`;
  let resp;
  try {
    resp = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "Authorization-Live-Viewers": `Bearer ${token}`,
      },
      responseType: "text",
      transformResponse: [(data) => data],
      timeout: 20000,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
    });
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "网络异常"));
  }

  let parsed: OrderCenterReceiveBody;
  try {
    const text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? {});
    parsed = JSON.parse(text) as OrderCenterReceiveBody;
  } catch {
    if (resp.status === 401) throw new Error("登录状态已失效，请重新登录");
    throw new Error("订单中心响应无法解析");
  }

  const code = parsed.code;
  const authFailed =
    resp.status === 401 ||
    code === 401 ||
    code === "401" ||
    code === 16 ||
    code === "16";
  if (authFailed) {
    throw new Error(parsed.message || parsed.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(code)) {
    throw new Error(parsed.message || parsed.msg || "领取失败");
  }

  const data = parsed.data ?? {};
  return {
    couponUserId: typeof data.couponUserId === "number" ? data.couponUserId : undefined,
    couponId: typeof data.couponId === "number" ? data.couponId : couponId,
    couponName: typeof data.couponName === "string" ? data.couponName : undefined,
    couponAmount: typeof data.couponAmount === "string" ? data.couponAmount : undefined,
    message: parsed.message || parsed.msg || "领取成功",
  };
}
