/** 小程序登录页（与 zhibo-wxmini `pages/login/login` / app.json 一致）。 */
const VIEWER_LOGIN_URL = "/pages/login/login";

/** 小程序打开远端文档（downloadFile + openDocument）。 */
const OPEN_DOCUMENT_URL = "/pages/file/open";

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

/** 粗判是否在小程序 web-view（不必等 JS-SDK）。 */
export function isLikelyMiniProgramWebView(): boolean {
  try {
    const w = window as unknown as {
      __wxjs_environment?: string;
      wx?: { miniProgram?: { navigateTo?: unknown } };
    };
    if (w.__wxjs_environment === "miniprogram") return true;
    if (typeof w.wx?.miniProgram?.navigateTo === "function") return true;
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
