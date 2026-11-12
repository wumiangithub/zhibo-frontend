import type { ViewerPrepayResult } from "@/api/orderCenter";
import {
  isLikelyMiniProgramWebView,
  navigateToRequestPayment,
  type MiniRequestPaymentPayload,
} from "@/utils/miniProgram";

const REDIRECT_KEYS = [
  "mweb_url",
  "h5_url",
  "payUrl",
  "pay_url",
  "url",
  "redirectUrl",
  "redirect_url",
] as const;

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function pickFlatRedirectUrl(obj: Record<string, unknown>): string {
  for (const key of REDIRECT_KEYS) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * 从对象取 wx.requestPayment 字段（扁平或本层即凭证）。
 */
function pickJsapiFromObject(
  obj: Record<string, unknown>,
): MiniRequestPaymentPayload | null {
  const timeStamp = pickStr(obj, ["timeStamp", "timestamp"]);
  const nonceStr = pickStr(obj, ["nonceStr", "noncestr"]);
  const pkg = pickStr(obj, ["package"]);
  const signType = pickStr(obj, ["signType", "signtype"]) || "MD5";
  const paySign = pickStr(obj, ["paySign", "paysign"]);
  if (!timeStamp || !nonceStr || !pkg || !paySign) return null;
  return { timeStamp, nonceStr, package: pkg, signType, paySign };
}

/**
 * 从 prepay credential JSON 取小程序 / JSAPI 支付字段。
 * 支持 Ping++ 嵌套 `{ "wx_lite": { "timeStamp": "...", ... } }`、
 * 再嵌一层 `wx_lite`、以及根级扁平字段。
 */
export function pickViewerPayJsapiParams(
  cred: Record<string, unknown>,
  channel = "",
): MiniRequestPaymentPayload | null {
  const candidates: Record<string, unknown>[] = [cred];
  const ch = channel.trim();
  const nestKeys = ch
    ? [ch, "wx_lite", "wx", "wx_pub", "credential"]
    : ["wx_lite", "wx", "wx_pub", "credential"];

  for (const key of nestKeys) {
    const nested = cred[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestObj = nested as Record<string, unknown>;
      candidates.push(nestObj);
      const deeper = nestObj[key];
      if (deeper && typeof deeper === "object" && !Array.isArray(deeper)) {
        candidates.push(deeper as Record<string, unknown>);
      }
    }
  }

  for (const obj of candidates) {
    const hit = pickJsapiFromObject(obj);
    if (hit) return hit;
  }
  return null;
}

/**
 * 从 prepay credential JSON 取 WAP 跳转 URL。
 * 支持 Ping++ 嵌套形如 `{ "wx_wap": { "object": "credential", "wx_wap": "https://..." } }`，
 * 以及扁平 `mweb_url` / `h5_url` / `payUrl` / `url` 等。
 */
export function pickViewerPayRedirectUrl(
  cred: Record<string, unknown>,
  channel = "",
): string {
  const ch = channel.trim();
  if (ch) {
    const nested = cred[ch];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestObj = nested as Record<string, unknown>;
      const byChannelKey = nestObj[ch];
      if (typeof byChannelKey === "string" && byChannelKey.trim()) {
        return byChannelKey.trim();
      }
      const fromNestedFlat = pickFlatRedirectUrl(nestObj);
      if (fromNestedFlat) return fromNestedFlat;
      for (const v of Object.values(nestObj)) {
        if (typeof v === "string" && v.trim() && isHttpUrl(v.trim())) {
          return v.trim();
        }
      }
    }
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  }

  return pickFlatRedirectUrl(cred);
}

export interface InvokeViewerPayOptions {
  /**
   * 为 true 时不立刻 `location.href`，只返回 `redirectUrl`，
   * 供微信内支付宝「复制链接」等场景。
   */
  deferRedirect?: boolean;
}

export interface InvokeViewerPayOutcome {
  invoked: boolean;
  stub?: string;
  redirectUrl?: string;
  deferred?: boolean;
}

/**
 * 按 prepay 返回的 channel + credential 唤起支付。
 * - WAP（wx_wap / alipay_wap 等）：credential 内跳转 URL → `location.href`（可 defer）
 * - wx_lite（小程序 web-view）：解析 JSAPI 字段 → `navigateTo` `/pages/pay/request/request`
 * - wx_pub：chooseWXPay 仍待接入（当前抛明确错误）
 */
export async function invokeViewerPayCredential(
  result: ViewerPrepayResult,
  opts?: InvokeViewerPayOptions,
): Promise<InvokeViewerPayOutcome> {
  const channel = (result.channel || "").trim();
  const raw = result.credential?.trim();
  if (!raw) {
    throw new Error("未返回支付凭证");
  }

  let cred: Record<string, unknown>;
  try {
    cred = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("支付凭证无法解析");
  }

  const redirect = pickViewerPayRedirectUrl(cred, channel);
  if (
    redirect &&
    (channel.includes("wap") || channel === "alipay" || channel === "wx")
  ) {
    if (opts?.deferRedirect) {
      return { invoked: false, deferred: true, redirectUrl: redirect };
    }
    window.location.href = redirect;
    return { invoked: true, redirectUrl: redirect };
  }

  if (channel === "wx_lite") {
    const jsapi = pickViewerPayJsapiParams(cred, channel);
    if (!jsapi) {
      throw new Error("支付凭证缺少微信小程序支付参数");
    }
    if (!isLikelyMiniProgramWebView()) {
      throw new Error("请在微信小程序内完成支付");
    }
    const ok = await navigateToRequestPayment(jsapi);
    if (!ok) {
      throw new Error("无法打开小程序支付页");
    }
    return { invoked: true };
  }

  if (channel === "wx_pub") {
    return {
      invoked: false,
      stub: "微信公众号 JSAPI 支付唤起待接入（credential 已返回）",
    };
  }

  if (redirect) {
    if (opts?.deferRedirect) {
      return { invoked: false, deferred: true, redirectUrl: redirect };
    }
    window.location.href = redirect;
    return { invoked: true, redirectUrl: redirect };
  }

  throw new Error(`暂不支持支付渠道：${channel || "未知"}`);
}
