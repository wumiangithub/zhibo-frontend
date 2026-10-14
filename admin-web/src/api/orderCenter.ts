import axios from "axios";
import { ensureFreshAccess } from "@/utils/authRefresh";

export interface OrderCenterProduct {
  spuId: string;
  productName: string;
  coverImg?: string;
  status?: number | string;
}

interface OrderCenterListBody {
  code?: number;
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
 * 成功码为 200；头 Authorization-Live-Saler: Bearer <管理端 JWT>。
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
  const resp = await axios.post(url, {}, {
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

  const body = resp.data as OrderCenterListBody;
  if (body?.code !== 200) {
    throw new Error(body?.msg || body?.message || "拉取商品列表失败");
  }
  const list = body.data?.list ?? [];
  return list.map(mapProduct).filter((p): p is OrderCenterProduct => !!p);
}
