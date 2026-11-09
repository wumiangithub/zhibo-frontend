import axios from "axios";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";
import {
  getViewerAccessToken,
  getViewerOrderCenterUsername,
} from "@/utils/viewerAuth";
import { tryRefreshViewerSession } from "@/utils/viewerLogin";

/** 观众端商品列表项（字段按对方响应宽松映射）。 */
export interface ViewerOrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  /** 展示价文案（有则用），如 `¥ 5980` */
  priceText?: string;
  /** 有效期展示，如 `有效期:180天` */
  validityText?: string;
  /** 封面角标，缺省「课程」 */
  typeLabel?: string;
}

export interface ViewerProductListByIdsResult {
  list: ViewerOrderCenterProduct[];
  page: number;
  size: number;
  total: number;
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

/** HTTP 401 或业务码 16/401：观众票过期或无效 */
function isOrderCenterAuthExpired(httpStatus: number, code: unknown): boolean {
  return (
    httpStatus === 401 ||
    code === 401 ||
    code === "401" ||
    code === 16 ||
    code === "16"
  );
}

function stringifyBigIntIds(raw: string): string {
  return raw
    .replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"')
    .replace(/"skuId"\s*:\s*(\d+)/g, '"skuId":"$1"')
    .replace(/"orderId"\s*:\s*(\d+)/g, '"orderId":"$1"')
    .replace(/"orderNo"\s*:\s*(\d+)/g, '"orderNo":"$1"')
    .replace(/"couponUserId"\s*:\s*(\d+)/g, '"couponUserId":"$1"');
}

interface OrderCenterEnvelope<T = unknown> {
  httpStatus: number;
  code?: number | string;
  msg?: string;
  message?: string;
  data?: T;
}

/**
 * 观众端订单中心 POST。
 * 鉴权过期（HTTP 401 / code 16）时静默 `tryRefreshViewerSession` 一次再重试；
 * 第二次仍过期则把结果交还调用方抛错，**不会**再刷票，避免死循环。
 */
async function postViewerOrderCenter<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeout?: number; loginRequiredMessage?: string },
): Promise<OrderCenterEnvelope<T>> {
  const timeout = opts?.timeout ?? 20000;
  const loginRequiredMessage = opts?.loginRequiredMessage ?? "请先登录后再操作";

  const once = async (): Promise<OrderCenterEnvelope<T>> => {
    const token = getViewerAccessToken();
    if (!token) throw new Error(loginRequiredMessage);

    const url = `${orderCenterBase()}${path.startsWith("/") ? path : `/${path}`}`;
    let resp;
    try {
      resp = await axios.post(url, body, {
        headers: {
          "Content-Type": "application/json",
          "Authorization-Live-Viewers": `Bearer ${token}`,
        },
        responseType: "text",
        transformResponse: [(data) => data],
        timeout,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      });
    } catch (e) {
      throw new Error(axiosErrorMessage(e, "网络异常"));
    }

    let parsed: {
      code?: number | string;
      msg?: string;
      message?: string;
      data?: T;
    };
    try {
      const text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? {});
      parsed = JSON.parse(stringifyBigIntIds(text));
    } catch {
      if (resp.status === 401) {
        return {
          httpStatus: 401,
          code: 401,
          message: "登录状态已失效，请重新登录",
        };
      }
      throw new Error("订单中心响应无法解析");
    }

    return {
      httpStatus: resp.status,
      code: parsed.code,
      msg: parsed.msg,
      message: parsed.message,
      data: parsed.data,
    };
  };

  let result = await once();
  if (isOrderCenterAuthExpired(result.httpStatus, result.code)) {
    const refreshed = await tryRefreshViewerSession();
    if (refreshed) {
      // 只用新票再打一次；仍过期则不再 refresh
      result = await once();
    }
  }
  return result;
}

/** 观众端下单途径：直播间（可用券 / 创建订单） */
export const VIEWER_ORDER_SOURCE_LIVE = 1;

function formatPriceText(n: number): string {
  return `¥ ${n}`;
}

function normalizePriceText(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("¥")) {
    const rest = t.slice(1).trim();
    return rest ? `¥ ${rest}` : t;
  }
  return `¥ ${t}`;
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
  return best != null ? formatPriceText(best) : undefined;
}

function pickDays(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** 从 SPU / 上架 SKU 取有效期天数或对方已给文案 */
function pickValidityText(o: Record<string, unknown>): string | undefined {
  const label =
    (typeof o.validityLabel === "string" && o.validityLabel.trim()) ||
    (typeof o.serviceLabel === "string" && o.serviceLabel.trim()) ||
    "";
  if (label) {
    if (/^有效期[:：]/.test(label)) return label.replace(/^有效期：/, "有效期:");
    if (/^\d+天/.test(label)) return `有效期:${label}`;
    return label.includes("有效期") ? label : `有效期:${label}`;
  }

  const dayKeys = ["buyDays", "serviceDay", "validDays", "validityDays"] as const;
  for (const key of dayKeys) {
    const d = pickDays(o[key]);
    if (d != null) return `有效期:${d}天`;
  }

  const skuList = o.skuList;
  if (!Array.isArray(skuList)) return undefined;
  for (const row of skuList) {
    if (!row || typeof row !== "object") continue;
    const s = row as Record<string, unknown>;
    const hasSpec = Object.prototype.hasOwnProperty.call(s, "specStatus");
    const onShelf = !hasSpec || s.specStatus === 1 || s.specStatus === "1";
    if (!onShelf) continue;
    for (const key of dayKeys) {
      const d = pickDays(s[key]);
      if (d != null) return `有效期:${d}天`;
    }
  }
  return undefined;
}

function pickTypeLabel(o: Record<string, unknown>): string | undefined {
  for (const key of ["typeName", "productTypeName", "categoryName", "goodsTypeName"] as const) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
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
      priceText = formatPriceText(p);
      break;
    }
    if (typeof p === "string" && p.trim()) {
      priceText = normalizePriceText(p);
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
    validityText: pickValidityText(o),
    typeLabel: pickTypeLabel(o),
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

  const env = await postViewerOrderCenter<{
    list?: unknown[];
    page?: number;
    size?: number;
    total?: number;
  }>("/order-center/api/live/viewer/product/list/by-ids", { spuIds: ids }, {
    loginRequiredMessage: "请先登录后再查看商品",
  });

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录已失效，请重新登录后再查看商品");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "拉取商品失败");
  }

  const data = env.data ?? {};
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
 * 仅含 by-ids 实际返回的项；绑定但未返回（下架/不存在）的 id 不在此列表，
 * 由调用方（小黄车 merge）用本站快照补行并标 offShelf。
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
  const page = opts?.page != null && opts.page >= 1 ? Math.floor(opts.page) : 1;
  const pageSize =
    opts?.pageSize != null && opts.pageSize >= 1
      ? Math.min(100, Math.floor(opts.pageSize))
      : 20;

  const env = await postViewerOrderCenter<{
    list?: unknown[];
    page?: number;
    size?: number;
    total?: number;
  }>("/order-center/api/live/viewer/order/list", { page, pageSize }, {
    loginRequiredMessage: "请先登录",
  });

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "请求失败");
  }

  const data = env.data ?? {};
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

/**
 * 观众端领取优惠券。
 * POST /order-center/api/live/viewer/coupon/receive
 * 头 Authorization-Live-Viewers；body 必填 couponId；username/receiveType 由对方登录态覆盖，勿传。
 */
export async function receiveViewerCoupon(
  input: ReceiveViewerCouponInput,
): Promise<ReceiveViewerCouponResult> {
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

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/coupon/receive",
    body,
    { loginRequiredMessage: "请先登录后再领取" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "领取失败");
  }

  const data = env.data ?? {};
  return {
    couponUserId: typeof data.couponUserId === "number" ? data.couponUserId : undefined,
    couponId: typeof data.couponId === "number" ? data.couponId : couponId,
    couponName: typeof data.couponName === "string" ? data.couponName : undefined,
    couponAmount: typeof data.couponAmount === "string" ? data.couponAmount : undefined,
    message: env.message || env.msg || "领取成功",
  };
}

export interface ViewerProductSku {
  skuId: string;
  skuName: string;
  /** 展示用实付价（活动价>0 用活动价，否则标准价） */
  payPrice: number;
  standardPrice: number;
  activityStandardPrice: number;
  serviceDay: number | null;
}

export interface ViewerProductDetail {
  spuId: string;
  productName: string;
  coverImg?: string;
  /** 默认选中的 SKU（优先有活动价的上架规格） */
  sku: ViewerProductSku | null;
  skuList: ViewerProductSku[];
  validityText?: string;
}

function mapViewerSku(row: unknown): ViewerProductSku | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const skuId = o.skuId != null ? String(o.skuId) : "";
  if (!skuId) return null;
  const standardPrice = Number(o.standardPrice);
  const activityStandardPrice = Number(o.activityStandardPrice);
  const std = Number.isFinite(standardPrice) && standardPrice > 0 ? standardPrice : 0;
  const act =
    Number.isFinite(activityStandardPrice) && activityStandardPrice > 0 ? activityStandardPrice : 0;
  const payPrice = act > 0 ? act : std;
  const serviceDay = pickDays(o.serviceDay) ?? null;
  return {
    skuId,
    skuName: typeof o.skuName === "string" ? o.skuName.trim() : "",
    payPrice,
    standardPrice: std,
    activityStandardPrice: act,
    serviceDay,
  };
}

/**
 * 观众端商品详情（含上架 SKU）。
 * POST /order-center/api/live/viewer/product/detail
 */
export async function getViewerProductDetail(spuId: string | number): Promise<ViewerProductDetail> {
  const id = Number(spuId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("商品无效");

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/product/detail",
    { spuId: id },
    { loginRequiredMessage: "请先登录后再购买" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "拉取商品详情失败");
  }

  const data = env.data ?? {};
  const productName =
    typeof data.productName === "string" ? data.productName.trim() : String(data.productName ?? "").trim();
  const skuList = (Array.isArray(data.skuList) ? data.skuList : [])
    .map(mapViewerSku)
    .filter((s): s is ViewerProductSku => s != null && s.payPrice > 0);

  // 优先活动价更低的规格
  let sku: ViewerProductSku | null = null;
  for (const s of skuList) {
    if (!sku || s.payPrice < sku.payPrice) sku = s;
  }

  const validityText =
    pickValidityText(data) ||
    (sku?.serviceDay != null ? `有效期:${sku.serviceDay}天` : undefined);

  return {
    spuId: data.spuId != null ? String(data.spuId) : String(id),
    productName: productName || "未命名商品",
    coverImg: typeof data.coverImg === "string" && data.coverImg ? data.coverImg : undefined,
    sku,
    skuList,
    validityText,
  };
}

export interface SelectableCouponItem {
  couponUserId: string;
  couponId: string;
  couponNo: string;
  couponName: string;
  /** 金额元，两位小数字符串 */
  couponAmount: string;
  validPeriodText: string;
  expireTime: string;
}

/**
 * 观众端当前 SKU 可用券（本人已领取未用未过期）。
 * POST /order-center/api/live/viewer/coupon/selectable
 * Body：skuId + orderSource（直播间=1）
 */
export async function listSelectableCoupons(input: {
  skuId: string | number;
  orderSource?: number;
}): Promise<SelectableCouponItem[]> {
  const skuId = Number(input.skuId);
  if (!Number.isInteger(skuId) || skuId <= 0) throw new Error("商品规格无效");
  const orderSource =
    input.orderSource != null && Number.isFinite(input.orderSource)
      ? Math.floor(input.orderSource)
      : VIEWER_ORDER_SOURCE_LIVE;

  const env = await postViewerOrderCenter<{ coupons?: unknown[] } | unknown[]>(
    "/order-center/api/live/viewer/coupon/selectable",
    { skuId, orderSource },
    { loginRequiredMessage: "请先登录后再选券" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "拉取可用券失败");
  }

  const raw = env.data;
  const coupons = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { coupons?: unknown[] }).coupons)
      ? (raw as { coupons: unknown[] }).coupons
      : [];

  return coupons
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const couponUserId = o.couponUserId != null ? String(o.couponUserId) : "";
      const couponId = o.id != null ? String(o.id) : o.couponId != null ? String(o.couponId) : "";
      if (!couponUserId || !couponId) return null;
      return {
        couponUserId,
        couponId,
        couponNo: typeof o.couponNo === "string" ? o.couponNo : "",
        couponName: typeof o.couponName === "string" ? o.couponName.trim() : "优惠券",
        couponAmount:
          o.couponAmount != null && String(o.couponAmount).trim()
            ? String(o.couponAmount).trim()
            : "0.00",
        validPeriodText: typeof o.validPeriodText === "string" ? o.validPeriodText : "",
        expireTime: typeof o.expireTime === "string" ? o.expireTime : "",
      } satisfies SelectableCouponItem;
    })
    .filter((c): c is SelectableCouponItem => c != null);
}

/** 作答方式：1 单选 / 2 多选 / 3 手填 */
export const RISK_INPUT_SINGLE = 1;
export const RISK_INPUT_MULTI = 2;
export const RISK_INPUT_TEXT = 3;

export interface RiskQuestionOption {
  optionCode: string;
  optionText: string;
}

export interface RiskQuestion {
  questionNo: number;
  questionText: string;
  inputType: number;
  options: RiskQuestionOption[];
}

export interface RiskAnswerItem {
  questionNo: number;
  optionCodes: string[];
}

export interface RiskSubmitResult {
  score: number;
  riskGrade: string;
  riskGradeName: string;
}

export interface ViewerRiskStatus {
  riskResultId: string;
  riskLevelId: number;
  riskLevelName: string;
  riskScore: number;
  riskEvaluationTime: string;
  riskEvaluationExpiredTime: string;
  /** 风测是否在有效期内 */
  riskValid: boolean;
  /** 是否满足当前商品风测要求 */
  riskMatchProduct: boolean;
  productRiskLevelId: number;
}

function readBool(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  return null;
}

/**
 * 观众端风测状态（下单前）。
 * POST /order-center/api/live/viewer/risk/status
 * Body：sku_id（规格主键）
 */
export async function getViewerRiskStatus(
  skuId: string | number,
): Promise<ViewerRiskStatus> {
  const id = Number(skuId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("商品规格无效");

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/risk/status",
    { sku_id: id },
    { loginRequiredMessage: "请先登录后再下单" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "查询风测状态失败");
  }

  const data = env.data ?? {};
  const riskValid = readBool(data.risk_valid ?? data.riskValid);
  const riskMatchProduct = readBool(
    data.risk_match_product ?? data.riskMatchProduct,
  );
  if (riskValid == null || riskMatchProduct == null) {
    throw new Error("风测状态返回不完整");
  }

  const levelId = Number(data.risk_level_id ?? data.riskLevelId);
  const score = Number(data.risk_score ?? data.riskScore);
  const productLevel = Number(
    data.product_risk_level_id ?? data.productRiskLevelId,
  );
  const resultId = data.risk_result_id ?? data.riskResultId;

  return {
    riskResultId: resultId != null ? String(resultId) : "0",
    riskLevelId: Number.isFinite(levelId) ? Math.floor(levelId) : 0,
    riskLevelName: String(
      data.risk_level_name ?? data.riskLevelName ?? "",
    ).trim(),
    riskScore: Number.isFinite(score) ? Math.floor(score) : 0,
    riskEvaluationTime: String(
      data.risk_evaluation_time ?? data.riskEvaluationTime ?? "",
    ).trim(),
    riskEvaluationExpiredTime: String(
      data.risk_evaluation_expired_time ??
        data.riskEvaluationExpiredTime ??
        "",
    ).trim(),
    riskValid,
    riskMatchProduct,
    productRiskLevelId: Number.isFinite(productLevel)
      ? Math.floor(productLevel)
      : 0,
  };
}

/**
 * 观众端风测问卷。
 * POST /order-center/api/live/viewer/risk/questions（无 body）
 */
export async function listRiskQuestions(): Promise<RiskQuestion[]> {
  const env = await postViewerOrderCenter<{ questions?: unknown[] } | unknown[]>(
    "/order-center/api/live/viewer/risk/questions",
    {},
    { loginRequiredMessage: "请先登录后再测评" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "拉取风测问卷失败");
  }

  const raw = env.data;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown[] }).questions)
      ? (raw as { questions: unknown[] }).questions
      : [];

  return list
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const questionNo = Number(o.questionNo);
      if (!Number.isInteger(questionNo) || questionNo <= 0) return null;
      const inputType = Number(o.inputType);
      const options = (Array.isArray(o.options) ? o.options : [])
        .map((opt) => {
          if (!opt || typeof opt !== "object") return null;
          const p = opt as Record<string, unknown>;
          const optionCode = typeof p.optionCode === "string" ? p.optionCode.trim() : "";
          const optionText = typeof p.optionText === "string" ? p.optionText.trim() : "";
          if (!optionCode) return null;
          return { optionCode, optionText: optionText || optionCode } satisfies RiskQuestionOption;
        })
        .filter((x): x is RiskQuestionOption => x != null);
      return {
        questionNo,
        questionText: typeof o.questionText === "string" ? o.questionText.trim() : "",
        inputType: Number.isFinite(inputType) ? Math.floor(inputType) : RISK_INPUT_SINGLE,
        options,
      } satisfies RiskQuestion;
    })
    .filter((q): q is RiskQuestion => q != null)
    .sort((a, b) => a.questionNo - b.questionNo);
}

/**
 * 观众端提交风测结果。
 * POST /order-center/api/live/viewer/risk/submit
 * Body：username（JWT claim）+ answers；orderId / signUrl 可选。
 */
export async function submitRiskTest(input: {
  answers: RiskAnswerItem[];
  orderId?: string;
  signUrl?: string;
}): Promise<RiskSubmitResult> {
  const username = getViewerOrderCenterUsername();
  if (!username) throw new Error("登录状态异常，请重新登录后再测评");

  const answers = (input.answers ?? [])
    .map((a) => ({
      questionNo: Math.floor(Number(a.questionNo)),
      optionCodes: (a.optionCodes ?? []).map((c) => String(c).trim()).filter(Boolean),
    }))
    .filter((a) => Number.isInteger(a.questionNo) && a.questionNo > 0 && a.optionCodes.length > 0);

  if (answers.length === 0) throw new Error("请完成全部题目后再提交");

  const body: Record<string, unknown> = { username, answers };
  const orderId = input.orderId?.trim();
  if (orderId) body.orderId = orderId;
  const signUrl = input.signUrl?.trim();
  if (signUrl) body.signUrl = signUrl;

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/risk/submit",
    body,
    { timeout: 30000, loginRequiredMessage: "请先登录后再提交测评" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "提交风测失败");
  }

  const data = env.data ?? {};
  const score = Number(data.score);
  return {
    score: Number.isFinite(score) ? Math.floor(score) : 0,
    riskGrade: typeof data.riskGrade === "string" ? data.riskGrade : "",
    riskGradeName: typeof data.riskGradeName === "string" ? data.riskGradeName : "",
  };
}

export interface CreateViewerOrderInput {
  productId: string | number;
  productSkuId: string | number;
  customerName: string;
  orderSource?: number;
  couponId?: string | number;
  salesmanId?: string;
  remark?: string;
}

export interface CreateViewerOrderResult {
  orderId: string;
  orderNo: string;
}

/**
 * 观众端创建订单。
 * POST /order-center/api/live/viewer/order/create
 */
export async function createViewerOrder(
  input: CreateViewerOrderInput,
): Promise<CreateViewerOrderResult> {
  const productId = Number(input.productId);
  const productSkuId = Number(input.productSkuId);
  if (!Number.isInteger(productId) || productId <= 0) throw new Error("商品无效");
  if (!Number.isInteger(productSkuId) || productSkuId <= 0) throw new Error("商品规格无效");
  const customerName = input.customerName?.trim();
  if (!customerName) throw new Error("请先填写昵称后再下单");

  const body: Record<string, unknown> = {
    productId,
    productSkuId,
    customerName,
    orderSource:
      input.orderSource != null && Number.isFinite(input.orderSource)
        ? Math.floor(input.orderSource)
        : VIEWER_ORDER_SOURCE_LIVE,
  };
  const salesmanId = input.salesmanId?.trim();
  if (salesmanId) body.salesmanId = salesmanId;
  if (input.couponId != null && String(input.couponId).trim()) {
    const couponId = Number(input.couponId);
    if (Number.isInteger(couponId) && couponId > 0) body.couponId = couponId;
  }
  const remark = input.remark?.trim();
  if (remark) body.remark = remark;

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/order/create",
    body,
    { timeout: 30000, loginRequiredMessage: "请先登录后再下单" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "创建订单失败");
  }

  const data = env.data ?? {};
  const orderId = data.orderId != null ? String(data.orderId) : "";
  const orderNo = typeof data.orderNo === "string" ? data.orderNo : String(data.orderNo ?? "");
  if (!orderId) throw new Error("创建订单成功但未返回订单号");
  return { orderId, orderNo };
}

export interface ViewerOrderPaidDetail {
  orderNo: string;
  createTime: string;
  productName: string;
  orderMoney: string;
  paidMoney: string;
  serviceDays: string;
  customerRiskLevel: string;
  customerRiskScore: number | null;
  customerRiskValid: boolean | null;
  customerRiskMatchProduct: boolean | null;
  salesmanId: string;
}

/**
 * 观众端订单详情（支付页）。
 * POST /order-center/api/live/viewer/order/paid-detail
 * Body：id = 订单主键
 */
export async function getViewerOrderPaidDetail(
  orderId: string | number,
): Promise<ViewerOrderPaidDetail> {
  const id = String(orderId ?? "").trim();
  if (!id) throw new Error("订单无效");

  const env = await postViewerOrderCenter<Record<string, unknown>>(
    "/order-center/api/live/viewer/order/paid-detail",
    { id },
    { loginRequiredMessage: "请先登录后再查看订单" },
  );

  if (isOrderCenterAuthExpired(env.httpStatus, env.code)) {
    throw new Error(env.message || env.msg || "登录状态已失效，请重新登录");
  }
  if (!isOrderCenterSuccess(env.code)) {
    throw new Error(env.message || env.msg || "拉取订单详情失败");
  }

  const data = env.data ?? {};
  const score = Number(data.customerRiskScore);
  return {
    orderNo: data.orderNo != null ? String(data.orderNo) : "",
    createTime: typeof data.createTime === "string" ? data.createTime : "",
    productName: typeof data.productName === "string" ? data.productName.trim() : "",
    orderMoney: data.orderMoney != null ? String(data.orderMoney) : "",
    paidMoney: data.paidMoney != null ? String(data.paidMoney) : "",
    serviceDays: data.serviceDays != null ? String(data.serviceDays) : "",
    customerRiskLevel: typeof data.customerRiskLevel === "string" ? data.customerRiskLevel : "",
    customerRiskScore: Number.isFinite(score) ? Math.floor(score) : null,
    customerRiskValid: typeof data.customerRiskValid === "boolean" ? data.customerRiskValid : null,
    customerRiskMatchProduct:
      typeof data.customerRiskMatchProduct === "boolean" ? data.customerRiskMatchProduct : null,
    salesmanId: data.salesmanId != null ? String(data.salesmanId) : "",
  };
}
