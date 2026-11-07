import axios from "axios";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";
import { ensureFreshAccess } from "@/utils/authRefresh";

/**
 * 订单中心商品（SPU）上架状态 `status`。
 * 契约：zhibo-shared/docs/订单中心对接.md §3.1
 */
export const ORDER_CENTER_PRODUCT_STATUS = {
  DRAFT: 0,
  STAGED: 1,
  SUBMITTED: 2,
  ON_SHELF: 3,
  OFF_SHELF: 4,
} as const;

export type OrderCenterProductStatus =
  (typeof ORDER_CENTER_PRODUCT_STATUS)[keyof typeof ORDER_CENTER_PRODUCT_STATUS];

export const ORDER_CENTER_PRODUCT_STATUS_LABEL: Record<OrderCenterProductStatus, string> = {
  [ORDER_CENTER_PRODUCT_STATUS.DRAFT]: "草稿",
  [ORDER_CENTER_PRODUCT_STATUS.STAGED]: "暂存",
  [ORDER_CENTER_PRODUCT_STATUS.SUBMITTED]: "已提交",
  [ORDER_CENTER_PRODUCT_STATUS.ON_SHELF]: "上架",
  [ORDER_CENTER_PRODUCT_STATUS.OFF_SHELF]: "下架",
};

/** 订单中心通用 id+名称（老师 / 部门） */
export interface OrderCenterIdName {
  id: string;
  name: string;
}

/** 业务员端商品列表/详情项（订单中心；展示字段按对方响应映射） */
export interface OrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  /** SPU 上架状态，见 ORDER_CENTER_PRODUCT_STATUS；列表接口过滤后恒为 3 */
  status?: number;
  productWind?: number;
  /** 上架 SKU 数 */
  validSkuCount?: number;
  /**
   * 订单中心是否返回了非空 `skuList`。
   * `false`：字段缺失或 `[]`，直播选品只展示、不可绑定。
   * 未经过列表/详情映射的本站快照不带此字段。
   */
  hasSkuList?: boolean;
  /** 带有效活动价的 SKU 数 */
  validActivityCount?: number;
  /** 商品简称（详情 productShortname；列表无此字段） */
  productAlias?: string;
  categoryName?: string;
  /** 归属部门名称（bmidName） */
  belongDeptName?: string;
  /** 售卖部门名称（sellDepartments[].name 顿号拼接） */
  salesDeptName?: string;
  /** 关联老师展示文案（优先 teachers[].name，兼容 teacherNames[]） */
  teacherNames?: string;
  /** 关联老师结构化（列表/详情新增） */
  teachers?: OrderCenterIdName[];
  /** 售卖部门结构化 */
  sellDepartments?: OrderCenterIdName[];
  /** 归属部门 ID（0=未配置） */
  bmid?: string;
  updateTime?: string;
}

export interface SalerProductListQuery {
  page?: number;
  pageSize?: number;
  /** 商品名称模糊搜索（对方去首尾空格；空串不过滤） */
  productName?: string;
}

export interface SalerProductListResult {
  list: OrderCenterProduct[];
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

/** 开发态走 Vite `/order-center` 代理；构建态可配绝对域名 */
function orderCenterBase(): string {
  if (import.meta.env.DEV) return "";
  const raw = import.meta.env.VITE_ORDER_CENTER_BASE_URL?.trim();
  return (raw || "http://oms-api.scqkxx.com").replace(/\/$/, "");
}

/** 把 JSON 里的大整数 id 先收成字符串，避免超过 2^53-1 丢精度 */
function stringifyBigIntIds(raw: string): string {
  return raw
    .replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"')
    .replace(/"skuId"\s*:\s*(\d+)/g, '"skuId":"$1"')
    .replace(/"orderId"\s*:\s*(\d+)/g, '"orderId":"$1"');
}

/**
 * 订单中心业务成功码（独立判断，不走本站 http 拦截器）。
 * 真实返回：`{ code: 0, message: "成功", data: { list } }`。
 */
function isOrderCenterSuccess(code: unknown): boolean {
  if (code == null || code === "") return false;
  const n = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(n)) return false;
  return n === 0 || n === 200;
}

function asOptionalString(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** 解析 `{ id, name }[]`；查不到名称的条目对方不返回 */
function mapIdNameList(raw: unknown): OrderCenterIdName[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: OrderCenterIdName[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out.length ? out : undefined;
}

function joinNames(items: OrderCenterIdName[] | undefined): string | undefined {
  if (!items?.length) return undefined;
  return items.map((t) => t.name).join("、") || undefined;
}

function countSkus(skuList: unknown): { validSku: number; validActivity: number } {
  if (!Array.isArray(skuList)) return { validSku: 0, validActivity: 0 };
  let validSku = 0;
  let validActivity = 0;
  for (const row of skuList) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    // 列表接口有 specStatus；详情/批量详情只返回上架 SKU，无该字段时按上架计
    const hasSpec = Object.prototype.hasOwnProperty.call(o, "specStatus");
    const spec = o.specStatus;
    const onShelf = !hasSpec || spec === 1 || spec === "1";
    if (onShelf) validSku += 1;
    const act =
      typeof o.activityStandardPrice === "number"
        ? o.activityStandardPrice
        : Number(o.activityStandardPrice);
    if (onShelf && Number.isFinite(act) && act > 0) validActivity += 1;
  }
  return { validSku, validActivity };
}

function mapProduct(row: unknown): OrderCenterProduct | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const spuId = o.spuId != null ? String(o.spuId) : "";
  const productName =
    typeof o.productName === "string" ? o.productName.trim() : String(o.productName ?? "").trim();
  if (!spuId || !productName) return null;
  const { validSku, validActivity } = countSkus(o.skuList);
  // 无 skuList 或 []：选品弹窗只展示、不可绑定（见 canBindOrderCenterProduct）
  const hasSkuList = Array.isArray(o.skuList) && o.skuList.length > 0;
  const teachers = mapIdNameList(o.teachers);
  // 兼容旧 teacherNames: string[]；新接口优先 teachers
  let teacherNames = joinNames(teachers);
  if (!teacherNames) {
    const legacy = o.teacherNames;
    if (Array.isArray(legacy)) {
      teacherNames =
        legacy.map((t) => String(t).trim()).filter(Boolean).join("、") || undefined;
    } else {
      teacherNames = asOptionalString(legacy);
    }
  }
  const sellDepartments = mapIdNameList(o.sellDepartments);
  const bmidRaw = o.bmid;
  const bmid =
    bmidRaw != null && bmidRaw !== "" && Number(bmidRaw) !== 0
      ? String(bmidRaw)
      : undefined;
  return {
    spuId,
    productName,
    coverImg: typeof o.coverImg === "string" ? o.coverImg : undefined,
    status: normalizeProductStatus(o.status),
    productWind: typeof o.productWind === "number" ? o.productWind : undefined,
    validSkuCount: validSku,
    hasSkuList,
    validActivityCount: validActivity,
    productAlias:
      asOptionalString(o.productAlias) ??
      asOptionalString(o.productShortname) ??
      asOptionalString(o.alias),
    categoryName:
      asOptionalString(o.categoryName) ??
      asOptionalString(o.category) ??
      asOptionalString(o.classifyName),
    belongDeptName:
      asOptionalString(o.bmidName) ??
      asOptionalString(o.belongDeptName) ??
      asOptionalString(o.deptName) ??
      asOptionalString(o.attributionDeptName),
    salesDeptName:
      joinNames(sellDepartments) ??
      asOptionalString(o.salesDeptName) ??
      asOptionalString(o.sellDeptName),
    teacherNames,
    teachers,
    sellDepartments,
    bmid,
    updateTime: asOptionalString(o.updateTime) ?? asOptionalString(o.updatedTime),
  };
}

function normalizeProductStatus(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4) return undefined;
  return n;
}

/** 商品上架状态文案（§3.1：0 草稿 / 1 暂存 / 2 已提交 / 3 上架 / 4 下架） */
export function orderCenterShelfLabel(status: number | string | undefined): string {
  const n = normalizeProductStatus(status);
  if (n == null) return "--";
  return ORDER_CENTER_PRODUCT_STATUS_LABEL[n as OrderCenterProductStatus] ?? "--";
}

/** 是否上架：仅 status === 3 */
export function isOrderCenterOnShelf(status: number | string | undefined): boolean {
  return normalizeProductStatus(status) === ORDER_CENTER_PRODUCT_STATUS.ON_SHELF;
}

/**
 * 直播选品是否允许绑定。
 * `hasSkuList === false`（skuList 缺失或 []）不可绑；未映射的本站快照不带该字段，保留已关联。
 */
export function canBindOrderCenterProduct(
  p: Pick<OrderCenterProduct, "hasSkuList">,
): boolean {
  if (p.hasSkuList === undefined) return true;
  return p.hasSkuList === true;
}

async function salerAccessToken(): Promise<string> {
  try {
    return await ensureFreshAccess();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "未登录，无法拉取商品列表");
  }
}

/**
 * 业务员端商品列表（分页；不经本站后端）。
 * 鉴权头 `Authorization-Live-Saler`。
 */
export async function listSalerProductsPage(
  query: SalerProductListQuery = {},
): Promise<SalerProductListResult> {
  const token = await salerAccessToken();
  const page = query.page != null && query.page > 0 ? query.page : 1;
  const pageSize =
    query.pageSize != null && query.pageSize > 0
      ? Math.min(query.pageSize, 50)
      : 10;
  const productName = query.productName?.trim() || undefined;

  const url = `${orderCenterBase()}/order-center/api/live/saler/product/list`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { page, pageSize, ...(productName ? { productName } : {}) },
      {
        headers: {
          "Authorization-Live-Saler": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        transformResponse: [
          (data: unknown) => {
            if (typeof data !== "string") return data;
            try {
              return JSON.parse(stringifyBigIntIds(data)) as OrderCenterListBody;
            } catch {
              return data;
            }
          },
        ],
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "拉取商品列表失败"));
  }

  const body = resp.data as OrderCenterListBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "拉取商品列表失败");
  }
  const rawList = body.data?.list ?? [];
  const list = rawList.map(mapProduct).filter((p): p is OrderCenterProduct => !!p);
  return {
    list,
    page: body.data?.page ?? page,
    size: body.data?.size ?? pageSize,
    total: body.data?.total ?? list.length,
  };
}

/**
 * 拉全量可售商品（新建页 / 基本信息下拉用；按页累加，上限 20 页 × 50）。
 */
export async function listSalerProducts(): Promise<OrderCenterProduct[]> {
  const all: OrderCenterProduct[] = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total && page <= 20) {
    const res = await listSalerProductsPage({ page, pageSize: 50 });
    all.push(...res.list);
    total = res.total;
    if (!res.list.length) break;
    page += 1;
  }
  return all;
}

interface OrderCenterBatchDetailBody {
  code?: number | string;
  msg?: string;
  message?: string;
  /** 键 = spuId 字符串；查不到的 id 不出现 */
  data?: Record<string, unknown>;
}

/** 本站存的是十进制字符串；对方 body 要 int64，安全整数内再转 number */
function toOrderCenterSpuIdNumber(spuId: string): number | null {
  const t = spuId.trim();
  if (!/^[1-9]\d{0,15}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

interface OrderCenterDetailBody {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: unknown;
}

/**
 * 业务员端商品详情（不经本站后端）。
 * `POST …/saler/product/detail`，body `{ spuId }`。
 * 裁剪版：基础信息 + 上架 SKU；含 teachers / bmidName / sellDepartments。
 */
export async function getSalerProductDetail(
  spuId: string,
): Promise<OrderCenterProduct | null> {
  const numericId = toOrderCenterSpuIdNumber(spuId);
  if (numericId == null) return null;

  const token = await salerAccessToken();
  const url = `${orderCenterBase()}/order-center/api/live/saler/product/detail`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { spuId: numericId },
      {
        headers: {
          "Authorization-Live-Saler": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        transformResponse: [
          (data: unknown) => {
            if (typeof data !== "string") return data;
            try {
              return JSON.parse(stringifyBigIntIds(data)) as OrderCenterDetailBody;
            } catch {
              return data;
            }
          },
        ],
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "拉取商品详情失败"));
  }

  const body = resp.data as OrderCenterDetailBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "拉取商品详情失败");
  }
  const mapped = mapProduct(body.data);
  if (!mapped) return null;
  // 详情只返回可售（有上架 SKU）商品，补齐上架态展示
  if (mapped.status == null) {
    mapped.status = ORDER_CENTER_PRODUCT_STATUS.ON_SHELF;
  }
  return mapped;
}

/**
 * 业务员端商品批量详情（不经本站后端）。
 * `POST …/saler/product/detail/batch`，body `{ spuIds }` 长度 1～20。
 * 查不到（下架/不存在/无可售规格）的 id 不出现在返回 map；整体仍成功。
 */
export async function batchGetSalerProductDetails(
  spuIds: string[],
): Promise<Record<string, OrderCenterProduct>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of spuIds) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (!unique.length) return {};

  const numericIds = unique
    .map(toOrderCenterSpuIdNumber)
    .filter((n): n is number => n != null)
    .slice(0, 20);
  if (!numericIds.length) return {};

  const token = await salerAccessToken();
  const url = `${orderCenterBase()}/order-center/api/live/saler/product/detail/batch`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { spuIds: numericIds },
      {
        headers: {
          "Authorization-Live-Saler": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        transformResponse: [
          (data: unknown) => {
            if (typeof data !== "string") return data;
            try {
              return JSON.parse(stringifyBigIntIds(data)) as OrderCenterBatchDetailBody;
            } catch {
              return data;
            }
          },
        ],
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "批量拉取商品详情失败"));
  }

  const body = resp.data as OrderCenterBatchDetailBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "批量拉取商品详情失败");
  }

  const rawMap = body.data;
  if (!rawMap || typeof rawMap !== "object") return {};

  const out: Record<string, OrderCenterProduct> = {};
  for (const [key, row] of Object.entries(rawMap)) {
    const mapped = mapProduct(row);
    if (!mapped) continue;
    // 批量详情只返回可售商品（有上架 SKU），补齐列表里的上架态展示
    if (mapped.status == null) {
      mapped.status = ORDER_CENTER_PRODUCT_STATUS.ON_SHELF;
    }
    out[mapped.spuId || String(key)] = mapped;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 业务员端订单列表（管理端「交易 → 全部订单」）
// ---------------------------------------------------------------------------

/**
 * 订单状态（对方 order_stats）。
 * 列表 Tab / 筛选用常见子集；详情文案见 ORDER_STATUS_LABEL。
 */
export const ORDER_STATUS = {
  ALL: 0,
  UNPAID: 1010,
  PAY_CONFIRMING: 1015,
  PARTIAL_PAID: 1020,
  PAID: 1030,
  CONFLICT: 1040,
  CONFLICT_CLEARED: 1041,
  SIGNED: 1050,
  CANCELLED: 1060,
  INSTALLMENT_REFUNDING: 1070,
  REFUNDING: 1071,
  PARTIAL_REFUND: 1080,
  REFUNDED: 1081,
} as const;

export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** 列表页状态文案（对齐原型：待付款/已付款/全部退款） */
export const ORDER_STATUS_LABEL: Record<number, string> = {
  [ORDER_STATUS.UNPAID]: "待付款",
  [ORDER_STATUS.PAY_CONFIRMING]: "支付待确认",
  [ORDER_STATUS.PARTIAL_PAID]: "部分支付",
  [ORDER_STATUS.PAID]: "已付款",
  [ORDER_STATUS.CONFLICT]: "撞单",
  [ORDER_STATUS.CONFLICT_CLEARED]: "撞单状态解除",
  [ORDER_STATUS.SIGNED]: "已签约",
  [ORDER_STATUS.CANCELLED]: "已取消",
  [ORDER_STATUS.INSTALLMENT_REFUNDING]: "分期退款中",
  [ORDER_STATUS.REFUNDING]: "退款中",
  [ORDER_STATUS.PARTIAL_REFUND]: "部分退款",
  [ORDER_STATUS.REFUNDED]: "全部退款",
};

/** 列表状态 Tab（筛选项，值 = 对方 orderStatus；0=不限） */
export const ORDER_STATUS_TABS: { key: number; label: string }[] = [
  { key: ORDER_STATUS.ALL, label: "全部" },
  { key: ORDER_STATUS.UNPAID, label: "待付款" },
  { key: ORDER_STATUS.PAID, label: "已付款" },
  { key: ORDER_STATUS.REFUNDING, label: "退款中" },
  { key: ORDER_STATUS.PARTIAL_REFUND, label: "部分退款" },
  { key: ORDER_STATUS.REFUNDED, label: "全部退款" },
];

/** 用户关键字下拉（UI 先做；当前接口统一传 userKeyWord） */
export type OrderUserKeywordType = "nickname" | "id" | "phone";

export interface SalerOrderListQuery {
  page?: number;
  pageSize?: number;
  /** 用户关键字（账号/姓名模糊；下拉类型暂不区分） */
  userKeyWord?: string;
  orderNo?: string;
  productName?: string;
  /** 0=不限；其余精确匹配对方 order_stats */
  orderStatus?: number;
}

export interface SalerOrderItem {
  orderId: string;
  orderNo: string;
  productName: string;
  customerAccount: string;
  customerName: string;
  orderStatus: number;
  /** 金额字符串（元，两位小数） */
  orderMoney: string;
  createTime: string;
  /** 以下字段对方列表暂未返回；有则展示，无则页面占位 -- */
  avatar?: string;
  nickname?: string;
  userId?: string;
  weComFriend?: boolean;
  coverImg?: string;
  validityLabel?: string;
  payTime?: string;
  payWayText?: string;
  serviceStatus?: string;
  serviceStatusText?: string;
}

export interface SalerOrderListResult {
  list: SalerOrderItem[];
  page: number;
  size: number;
  total: number;
}

interface OrderCenterOrderListBody {
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

function asOptionalBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false") return false;
  return undefined;
}

function mapOrderItem(row: unknown): SalerOrderItem | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const orderNo = asOptionalString(o.orderNo) ?? "";
  const orderId = asOptionalString(o.orderId) ?? orderNo;
  if (!orderId && !orderNo) return null;
  const statusRaw = o.orderStatus;
  const status =
    typeof statusRaw === "number"
      ? statusRaw
      : statusRaw != null && statusRaw !== ""
        ? Number(statusRaw)
        : 0;
  return {
    orderId: orderId || orderNo,
    orderNo: orderNo || orderId,
    productName: asOptionalString(o.productName) ?? "",
    customerAccount: asOptionalString(o.customerAccount) ?? "",
    customerName: asOptionalString(o.customerName) ?? "",
    orderStatus: Number.isFinite(status) ? status : 0,
    orderMoney: asOptionalString(o.orderMoney) ?? "",
    createTime: asOptionalString(o.createTime) ?? "",
    avatar: asOptionalString(o.avatar),
    nickname: asOptionalString(o.nickname),
    userId:
      asOptionalString(o.userId) ??
      asOptionalString(o.customerUserId) ??
      asOptionalString(o.uid),
    weComFriend: asOptionalBool(o.weComFriend) ?? asOptionalBool(o.isWeComFriend),
    coverImg: asOptionalString(o.coverImg) ?? asOptionalString(o.productCover),
    validityLabel:
      asOptionalString(o.validityLabel) ??
      (o.buyDays != null && Number.isFinite(Number(o.buyDays))
        ? `有效期：${Number(o.buyDays)}天`
        : undefined),
    payTime: asOptionalString(o.payTime) ?? asOptionalString(o.paymentTime),
    payWayText:
      asOptionalString(o.payWayText) ??
      asOptionalString(o.payMethodText) ??
      asOptionalString(o.payWay),
    serviceStatus: asOptionalString(o.serviceStatus),
    serviceStatusText:
      asOptionalString(o.serviceStatusText) ?? asOptionalString(o.serviceStatus),
  };
}

export function orderStatusLabel(status: number | string | undefined): string {
  if (status == null || status === "") return "--";
  const n = typeof status === "number" ? status : Number(status);
  if (!Number.isFinite(n) || n === 0) return "--";
  return ORDER_STATUS_LABEL[n] ?? `状态${n}`;
}

/** 状态圆点色：对齐原型灰/绿/红 */
export function orderStatusDotClass(status: number | undefined): string {
  if (status === ORDER_STATUS.PAID || status === ORDER_STATUS.SIGNED) return "dot--green";
  if (
    status === ORDER_STATUS.REFUNDING ||
    status === ORDER_STATUS.INSTALLMENT_REFUNDING ||
    status === ORDER_STATUS.PARTIAL_REFUND ||
    status === ORDER_STATUS.REFUNDED
  ) {
    return "dot--red";
  }
  return "dot--gray";
}

/**
 * 业务员端订单列表（分页；不经本站后端）。
 * 鉴权头 `Authorization-Live-Saler`。
 */
export async function listSalerOrders(
  query: SalerOrderListQuery = {},
): Promise<SalerOrderListResult> {
  const token = await salerAccessToken();
  const page = query.page != null && query.page > 0 ? query.page : 1;
  const pageSize =
    query.pageSize != null && query.pageSize > 0
      ? Math.min(query.pageSize, 100)
      : 10;
  const userKeyWord = query.userKeyWord?.trim() || undefined;
  const orderNo = query.orderNo?.trim() || undefined;
  const productName = query.productName?.trim() || undefined;
  const orderStatus =
    query.orderStatus != null && query.orderStatus > 0 ? query.orderStatus : 0;

  const url = `${orderCenterBase()}/order-center/api/live/saler/order/list`;
  let resp;
  try {
    resp = await axios.post(
      url,
      {
        page,
        pageSize,
        ...(userKeyWord ? { userKeyWord } : {}),
        ...(orderNo ? { orderNo } : {}),
        ...(productName ? { productName } : {}),
        orderStatus,
      },
      {
        headers: {
          "Authorization-Live-Saler": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        transformResponse: [
          (data: unknown) => {
            if (typeof data !== "string") return data;
            try {
              return JSON.parse(stringifyBigIntIds(data)) as OrderCenterOrderListBody;
            } catch {
              return data;
            }
          },
        ],
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "拉取订单列表失败"));
  }

  const body = resp.data as OrderCenterOrderListBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "拉取订单列表失败");
  }
  const rawList = body.data?.list ?? [];
  const list = rawList.map(mapOrderItem).filter((p): p is SalerOrderItem => !!p);
  return {
    list,
    page: body.data?.page ?? page,
    size: body.data?.size ?? pageSize,
    total: body.data?.total ?? list.length,
  };
}

/** 业务员端券池列表项（订单中心；中控台发券用） */
export interface OrderCenterCoupon {
  couponId: number;
  couponNo: string;
  couponName: string;
  couponAmount: string;
  couponStartDate: string;
  couponEndDate: string;
  allSku: boolean;
  deptNames: string[];
  skuNames: string[];
  createTime?: string;
}

export interface SalerCouponListQuery {
  page?: number;
  pageSize?: number;
  couponName?: string;
}

export interface SalerCouponListResult {
  list: OrderCenterCoupon[];
  page: number;
  size: number;
  total: number;
}

function mapStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (typeof row === "string" && row.trim()) out.push(row.trim());
    else if (typeof row === "number" && Number.isFinite(row)) out.push(String(row));
  }
  return out;
}

function mapCoupon(row: unknown): OrderCenterCoupon | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const couponIdRaw = o.id;
  const couponId =
    typeof couponIdRaw === "number"
      ? couponIdRaw
      : typeof couponIdRaw === "string"
        ? Number(couponIdRaw)
        : NaN;
  if (!Number.isFinite(couponId) || couponId <= 0) return null;
  const couponNo =
    typeof o.couponNo === "string" ? o.couponNo.trim() : String(o.couponNo ?? "").trim();
  const couponName =
    typeof o.couponName === "string" ? o.couponName.trim() : String(o.couponName ?? "").trim();
  const couponAmount =
    typeof o.couponAmount === "string"
      ? o.couponAmount.trim()
      : String(o.couponAmount ?? "").trim();
  if (!couponNo || !couponName || !couponAmount) return null;
  return {
    couponId,
    couponNo,
    couponName,
    couponAmount,
    couponStartDate:
      typeof o.couponStartDate === "string"
        ? o.couponStartDate.trim()
        : String(o.couponStartDate ?? "").trim(),
    couponEndDate:
      typeof o.couponEndDate === "string"
        ? o.couponEndDate.trim()
        : String(o.couponEndDate ?? "").trim(),
    allSku: o.allSku === true || o.allSku === 1 || o.allSku === "1",
    deptNames: mapStringList(o.deptNames),
    skuNames: mapStringList(o.skuNames),
    createTime: asOptionalString(o.createTime),
  };
}

/**
 * 业务员端券池列表（分页；不经本站后端）。
 * 鉴权头 `Authorization-Live-Saler`。契约：订单中心对接.md §5.4 / D113
 */
export async function listSalerCouponsPage(
  query: SalerCouponListQuery = {},
): Promise<SalerCouponListResult> {
  const token = await salerAccessToken();
  const page = query.page != null && query.page > 0 ? query.page : 1;
  const pageSize =
    query.pageSize != null && query.pageSize > 0
      ? Math.min(query.pageSize, 50)
      : 20;
  const couponName = query.couponName?.trim() || undefined;

  const url = `${orderCenterBase()}/order-center/api/live/saler/coupon/list`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { page, pageSize, ...(couponName ? { couponName } : {}) },
      {
        headers: {
          "Authorization-Live-Saler": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "拉取优惠券列表失败"));
  }

  const body = resp.data as OrderCenterListBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "拉取优惠券列表失败");
  }
  const rawList = body.data?.list ?? [];
  const list = rawList.map(mapCoupon).filter((p): p is OrderCenterCoupon => !!p);
  list.sort((a, b) => {
    const ta = a.createTime || "";
    const tb = b.createTime || "";
    return tb.localeCompare(ta);
  });
  return {
    list,
    page: body.data?.page ?? page,
    size: body.data?.size ?? pageSize,
    total: body.data?.total ?? list.length,
  };
}
