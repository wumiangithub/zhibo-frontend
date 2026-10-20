import axios from "axios";
import { axiosErrorMessage } from "@/utils/axiosErrorMessage";
import { ensureFreshAccess } from "@/utils/authRefresh";

export interface OrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  status?: number | string;
}

interface OrderCenterListBody {
  /** 订单中心可能返回 number 或数字字符串 */
  code?: number | string;
  msg?: string;
  message?: string;
  data?: {
    list?: unknown[];
  };
}

/** 开发态走 Vite `/order-center` 代理；构建态可配绝对域名 */
function orderCenterBase(): string {
  if (import.meta.env.DEV) return "";
  const raw = import.meta.env.VITE_ORDER_CENTER_BASE_URL?.trim();
  return (raw || "http://fadada-notify.scqkxx.com").replace(/\/$/, "");
}

/** 把 JSON 里的大整数 spuId 先收成字符串，避免超过 2^53-1 丢精度 */
function stringifySpuIds(raw: string): string {
  return raw.replace(/"spuId"\s*:\s*(\d+)/g, '"spuId":"$1"');
}

/**
 * 订单中心业务成功码（独立判断，不走本站 http 拦截器）。
 * 真实返回：`{ code: 0, message: "成功", data: { list } }`。
 * 须用 `=== 0` / `=== 200`，禁止 `if (!code)`（0 会被当成失败，
 * 再 ElMessage.error(message) 就会红底弹出「成功」）。
 */
function isOrderCenterSuccess(code: unknown): boolean {
  if (code == null || code === "") return false;
  const n = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(n)) return false;
  // 联调确认成功为 0；兼容偶发 200
  return n === 0 || n === 200;
}

function mapProduct(row: unknown): OrderCenterProduct | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const spuId = o.spuId != null ? String(o.spuId) : "";
  const productName =
    typeof o.productName === "string" ? o.productName.trim() : String(o.productName ?? "").trim();
  if (!spuId || !productName) return null;
  return {
    spuId,
    productName,
    coverImg: typeof o.coverImg === "string" ? o.coverImg : undefined,
    status: o.status as number | string | undefined,
  };
}

/**
 * 业务员端商品列表（不经本站后端；开发态经 Vite `/order-center` 代理）。
 * 成功：`code === 0`（见 isOrderCenterSuccess），列表取 `data.list`。
 * 独立 axios + Authorization-Live-Saler；不混用 admin `http.ts`。
 */
export async function listSalerProducts(): Promise<OrderCenterProduct[]> {
  // 与本站 axios 同一套换票；只把新 access 给订单中心，不传 refresh
  let token: string;
  try {
    token = await ensureFreshAccess();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "未登录，无法拉取商品列表");
  }

  const url = `${orderCenterBase()}/order-center/api/live/saler/product/list`;
  let resp;
  try {
    resp = await axios.post(url, {}, {
      headers: {
        "Authorization-Live-Saler": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
      transformResponse: [
        (data: unknown) => {
          if (typeof data !== "string") return data;
          try {
            return JSON.parse(stringifySpuIds(data)) as OrderCenterListBody;
          } catch {
            return data;
          }
        },
      ],
    });
  } catch (e) {
    throw new Error(axiosErrorMessage(e, "拉取商品列表失败"));
  }

  const body = resp.data as OrderCenterListBody;
  if (!isOrderCenterSuccess(body?.code)) {
    throw new Error(body?.msg || body?.message || "拉取商品列表失败");
  }
  const list = body.data?.list ?? [];
  return list.map(mapProduct).filter((p): p is OrderCenterProduct => !!p);
}
