/** 小程序登录页（与 zhibo-wxmini `pages/login/login` / app.json 一致）。 */
const VIEWER_LOGIN_URL = "/pages/login/login";

/** 小程序打开远端文档（downloadFile + openDocument）。 */
const OPEN_DOCUMENT_URL = "/pages/file/open/open";

/** 小程序原生订单收银台（完整支付 UI）。 */
const ORDER_CHECKOUT_URL = "/pages/pay/checkout/checkout";

/** 小程序原生支付唤起页（仅 wx.requestPayment；H5 已 prepay 后的辅助入口）。 */
const REQUEST_PAYMENT_URL = "/pages/pay/request/request";

/** 跳转原生收银台所需参数（封面等可选；过长时会丢 coverImg）。 */
export type MiniOrderCheckoutPayload = {
  orderId: string;
  activityId?: string;
  coverImg?: string;
  riskGrade?: string;
  riskGradeName?: string;
};

/** JSAPI 支付凭证（wx.requestPayment 字段）。 */
export type MiniRequestPaymentPayload = {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
};

/** UTF-8 → base64url（query 紧凑传凭证，避开长度与特殊字符）。 */
function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * 微信 JS-SDK（含 `wx.miniProgram`）。
 * 对齐 admin-web TOS：放 `public/jweixin-1.3.2.js`，同源 script 注入，不走外网 CDN。
 */
const WX_JS_SDK_SRC = "/jweixin-1.3.2.js";

type MiniProgramApi = {
  navigateTo?: (opts: { url: string }) => void;
  redirectTo?: (opts: { url: string }) => void;
  reLaunch?: (opts: { url: string }) => void;
  getEnv?: (cb: (res: { miniprogram?: boolean }) => void) => void;
};

type WxGlobal = {
  miniProgram?: MiniProgramApi;
};

function getWx(): WxGlobal | null {
  try {
    return (window as unknown as { wx?: WxGlobal }).wx ?? null;
  } catch {
    return null;
  }
}

function getMiniProgram(): MiniProgramApi | null {
  return getWx()?.miniProgram ?? null;
}

/** 单次加载承诺：并发调用共用；失败后清空以便重试（对齐 admin-web loadTosSDK）。 */
let ensureWxJsSdkPromise: Promise<WxGlobal | null> | null = null;

/**
 * 确保微信 JS-SDK 已注入（`window.wx`）。
 * 已有 `window.wx` / 同 src script 不重复插入；非微信环境加载后也可能无 `miniProgram`。
 */
export function ensureWxJsSdk(): Promise<WxGlobal | null> {
  const existing = getWx();
  if (existing) return Promise.resolve(existing);
  if (ensureWxJsSdkPromise) return ensureWxJsSdkPromise;

  ensureWxJsSdkPromise = new Promise<WxGlobal | null>((resolve, reject) => {
    const finish = () => resolve(getWx());
    const fail = () => {
      ensureWxJsSdkPromise = null;
      reject(new Error("Failed to load WeChat JS-SDK"));
    };

    const tagged = document.querySelector<HTMLScriptElement>(
      `script[src="${WX_JS_SDK_SRC}"]`,
    );
    if (tagged) {
      if (tagged.dataset.loaded === "1" || getWx()) {
        finish();
        return;
      }
      if (tagged.dataset.loading === "1") {
        tagged.addEventListener("load", finish, { once: true });
        tagged.addEventListener("error", fail, { once: true });
        return;
      }
      tagged.addEventListener("load", finish, { once: true });
      tagged.addEventListener("error", fail, { once: true });
      if (getWx()) finish();
      return;
    }

    const script = document.createElement("script");
    script.src = WX_JS_SDK_SRC;
    script.dataset.loading = "1";
    script.onload = () => {
      delete script.dataset.loading;
      script.dataset.loaded = "1";
      finish();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return ensureWxJsSdkPromise;
}

/**
 * 同步粗判是否在小程序 web-view（不必等 JS-SDK）。
 * 对齐官方文档 https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html ：
 * - `window.__wxjs_environment === "miniprogram"`（建议 WeixinJSBridgeReady 后再读；此处作首屏粗判）
 * - UA 含 `miniProgram`（微信 ≥ 7.0.0）
 * 异步准判用 `wx.miniProgram.getEnv`（须先 ensureWxJsSdk）。
 * 禁止用 `wx.miniProgram.navigateTo` 是否存在：同源注入的 jweixin 在普通浏览器也会挂上该 API。
 * 细则见 zhibo-shared/docs/小程序web-view.md
 */
export function isLikelyMiniProgramWebView(): boolean {
  try {
    const w = window as unknown as { __wxjs_environment?: string };
    if (w.__wxjs_environment === "miniprogram") return true;
    return /miniProgram/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

async function navigateMiniProgram(url: string): Promise<boolean> {
  try {
    await ensureWxJsSdk();
  } catch (e) {
    console.warn("微信 JS-SDK 加载失败", e);
    return false;
  }

  const mp = getMiniProgram();
  if (!mp || typeof mp.navigateTo !== "function") return false;

  try {
    mp.navigateTo({ url });
    return true;
  } catch (e) {
    console.warn("小程序 navigateTo 失败", e);
    return false;
  }
}

/**
 * 从 web-view H5 跳小程序登录页（`navigateTo`）。
 * 成功发起跳转返回 true；SDK 加载失败 / 非小程序环境返回 false，由调用方 toast。
 */
export async function navigateToViewerLogin(): Promise<boolean> {
  return navigateMiniProgram(VIEWER_LOGIN_URL);
}

/**
 * 小程序内打开/保存文档（downloadFile + openDocument）。
 * H5 iframe / a[download] 在 web-view 里不可靠，预览与下载都走此页。
 */
export async function navigateToOpenDocument(opts: {
  url: string;
  name?: string;
  mode?: "preview" | "download";
}): Promise<boolean> {
  const fileUrl = (opts.url || "").trim();
  if (!fileUrl) return false;
  const q = [
    `url=${encodeURIComponent(fileUrl)}`,
    `name=${encodeURIComponent((opts.name || "文档").trim() || "文档")}`,
    `mode=${encodeURIComponent(opts.mode || "preview")}`,
  ].join("&");
  return navigateMiniProgram(`${OPEN_DOCUMENT_URL}?${q}`);
}

/**
 * 从 web-view H5 跳小程序原生订单收银台（完整支付 UI）。
 * query：`c` = base64url(JSON)：orderId 必填；activityId / coverImg / riskGrade / riskGradeName 可选。
 * URL 过长时丢弃 coverImg 再试（paid-detail 无封面）。
 * 成功发起跳转返回 true；SDK 失败 / 非小程序返回 false。
 */
export async function navigateToOrderCheckout(
  payload: MiniOrderCheckoutPayload,
): Promise<boolean> {
  const orderId = (payload.orderId || "").trim();
  if (!orderId) return false;

  const buildUrl = (includeCover: boolean): string => {
    const body: Record<string, string> = { orderId };
    const activityId = (payload.activityId || "").trim();
    const coverImg = (payload.coverImg || "").trim();
    const riskGrade = (payload.riskGrade || "").trim();
    const riskGradeName = (payload.riskGradeName || "").trim();
    if (activityId) body.activityId = activityId;
    if (includeCover && coverImg) body.coverImg = coverImg;
    if (riskGrade) body.riskGrade = riskGrade;
    if (riskGradeName) body.riskGradeName = riskGradeName;
    const c = encodeBase64UrlUtf8(JSON.stringify(body));
    return `${ORDER_CHECKOUT_URL}?c=${encodeURIComponent(c)}`;
  };

  let url = buildUrl(true);
  // 微信 navigateTo url 长度约 1024；预留余量
  if (url.length > 900) {
    url = buildUrl(false);
  }
  return navigateMiniProgram(url);
}

/**
 * 从 web-view H5 跳小程序原生支付唤起页（`wx.requestPayment`）。
 * query：`c` = base64url(JSON.stringify({ timeStamp, nonceStr, package, signType, paySign }))。
 * 完整收银台优先走 `navigateToOrderCheckout`；本函数供 H5 已 prepay 后的辅助唤起。
 * 成功发起跳转返回 true；SDK 失败 / 非小程序返回 false。
 */
export async function navigateToRequestPayment(
  payload: MiniRequestPaymentPayload,
): Promise<boolean> {
  const timeStamp = (payload.timeStamp || "").trim();
  const nonceStr = (payload.nonceStr || "").trim();
  const pkg = (payload.package || "").trim();
  const signType = (payload.signType || "").trim() || "MD5";
  const paySign = (payload.paySign || "").trim();
  if (!timeStamp || !nonceStr || !pkg || !paySign) return false;
  const c = encodeBase64UrlUtf8(
    JSON.stringify({
      timeStamp,
      nonceStr,
      package: pkg,
      signType,
      paySign,
    }),
  );
  return navigateMiniProgram(
    `${REQUEST_PAYMENT_URL}?c=${encodeURIComponent(c)}`,
  );
}
