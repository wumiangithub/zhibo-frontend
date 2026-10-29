import { loadScript } from "@/utils/sdk";

/** 小程序登录页（与 zhibo-wxmini `pages/login/login` / app.json 一致）。 */
const VIEWER_LOGIN_URL = "/pages/login/login";

/** 微信 JS-SDK（含 `wx.miniProgram`，web-view 内跳转小程序页）。 */
const WX_JS_SDK_URL = "https://res.wx.qq.com/open/js/jweixin-1.3.2.js";

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
let ensureWxJsSdkPromise: Promise<void> | null = null;

/**
 * 确保微信 JS-SDK 已注入（`window.wx`）。
 * 已有 `wx.miniProgram` 则直接 resolve；脚本用 `loadScript` 去重（script 标签 / loading 标记）。
 */
export function ensureWxJsSdk(): Promise<void> {
  if (getMiniProgram()) return Promise.resolve();
  if (ensureWxJsSdkPromise) return ensureWxJsSdkPromise;

  ensureWxJsSdkPromise = loadScript(WX_JS_SDK_URL)
    .then(() => {
      /* 脚本 onload；非微信环境可能仍无 wx，由调用方判断 */
    })
    .catch((err) => {
      ensureWxJsSdkPromise = null;
      throw err;
    });

  return ensureWxJsSdkPromise;
}

/**
 * 从 web-view H5 跳小程序登录页（`navigateTo`）。
 * 成功发起跳转返回 true；SDK 加载失败 / 非小程序环境返回 false，由调用方 toast。
 */
export async function navigateToViewerLogin(): Promise<boolean> {
  try {
    await ensureWxJsSdk();
  } catch (e) {
    console.warn("微信 JS-SDK 加载失败", e);
    return false;
  }

  const mp = getMiniProgram();
  if (!mp || typeof mp.navigateTo !== "function") return false;

  try {
    mp.navigateTo({ url: VIEWER_LOGIN_URL });
    return true;
  } catch (e) {
    console.warn("跳转小程序登录失败", e);
    return false;
  }
}
