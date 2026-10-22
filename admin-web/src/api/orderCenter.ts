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

/** 业务员端商品列表项（订单中心；展示字段按对方响应尽量映射） */
export interface OrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  /** SPU 上架状态，见 ORDER_CENTER_PRODUCT_STATUS */
  status?: number;
  productWind?: number;
  /** 上架 SKU 数 */
  validSkuCount?: number;
  /** 带有效活动价的 SKU 数 */
  validActivityCount?: number;
  /** 以下字段对方列表未必有；有则展示 */
  productAlias?: string;
  categoryName?: string;
  belongDeptName?: string;
  salesDeptName?: string;
  teacherNames?: string;
  updateTime?: string;
}

export interface SalerProductListQuery {
  page?: number;
  pageSize?: number;
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
  return (raw || "http://fadada-notify.scqkxx.com").replace(/\/$/, "");
}

/** 把 JSON 里的大整数 id 先收成字符串，避免超过 2^53-1 丢精度 */
function stringifyBigIntIds(raw: string): string {
  return raw
    .replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"')
    .replace(/"skuId"\s*:\s*(\d+)/g, '"skuId":"$1"');
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

function countSkus(skuList: unknown): { validSku: number; validActivity: number } {
  if (!Array.isArray(skuList)) return { validSku: 0, validActivity: 0 };
  let validSku = 0;
  let validActivity = 0;
  for (const row of skuList) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const spec = o.specStatus;
    const onShelf = spec === 1 || spec === "1";
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
  const teachers = o.teacherNames;
  let teacherNames: string | undefined;
  if (Array.isArray(teachers)) {
    teacherNames = teachers.map((t) => String(t).trim()).filter(Boolean).join("、") || undefined;
  } else {
    teacherNames = asOptionalString(teachers);
  }
  return {
    spuId,
    productName,
    coverImg: typeof o.coverImg === "string" ? o.coverImg : undefined,
    status: normalizeProductStatus(o.status),
    productWind: typeof o.productWind === "number" ? o.productWind : undefined,
    validSkuCount: validSku,
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
      asOptionalString(o.belongDeptName) ??
      asOptionalString(o.deptName) ??
      asOptionalString(o.attributionDeptName),
    salesDeptName:
      asOptionalString(o.salesDeptName) ?? asOptionalString(o.sellDeptName),
    teacherNames,
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

  const url = `${orderCenterBase()}/order-center/api/live/saler/product/list`;
  let resp;
  try {
    resp = await axios.post(
      url,
      { page, pageSize },
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
