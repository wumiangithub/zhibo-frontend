import { ApiError } from "@/api/http";
import { refreshViewerSession } from "@/api/viewerAuth";
import router from "@/router";
import {
  isLikelyMiniProgramWebView,
  navigateToViewerLogin as navigateToMiniProgramLogin,
} from "@/utils/miniProgram";
import {
  clearViewerSession,
  getViewerAccessToken,
  getViewerRefreshToken,
  saveViewerSession,
} from "@/utils/viewerAuth";

/** 登录成功后的站内回跳；登录页自身一律回首页。 */
export function safeViewerRedirect(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

/**
 * 跳观众登录：小程序 web-view 内走小程序登录页；纯 H5 立刻走本站 `/login`。
 * 纯浏览器不先等微信 JS-SDK（CDN 卡住会一直停在观看页）。
 */
export async function goViewerLogin(redirect?: string): Promise<boolean> {
  if (isLikelyMiniProgramWebView()) {
    const ok = await navigateToMiniProgramLogin();
    if (ok) return true;
  }

  const current =
    redirect?.trim() ||
    router.currentRoute.value.fullPath ||
    "/";
  await router.replace({
    name: "viewer-login",
    query: { redirect: current },
  });
  return true;
}

/** 后端把「无/无效 JWT」打成业务错误时的文案（sdk-sign 常为 400「请先登录」）。 */
export function isViewerLoginRequiredError(e: unknown): boolean {
  const msg =
    e instanceof ApiError || e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : "";
  if (!msg) return false;
  if (msg.includes("请先登录")) return true;
  if (msg === "未登录") return true;
  if (msg.includes("登录状态已失效")) return true;
  if (e instanceof ApiError && e.code === 401) return true;
  return false;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * 有 refresh 则静默换票并写回 localStorage。
 * @returns true 已换到新 access；false 无票或刷新失败（不会清本地）。
 */
export async function tryRefreshViewerSession(): Promise<boolean> {
  const refreshToken = getViewerRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const data = await refreshViewerSession(
        getViewerAccessToken(),
        refreshToken,
      );
      saveViewerSession(data);
      return !!getViewerAccessToken();
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * 观看/业务侧判定需要登录时：先尝试 refresh；失败则清本地并跳登录页（带 redirect）。
 * @returns `"refreshed"` 可重试业务；`"redirected"` 已去登录。
 */
export async function recoverViewerAuth(
  redirect?: string,
): Promise<"refreshed" | "redirected"> {
  const ok = await tryRefreshViewerSession();
  if (ok) return "refreshed";
  clearViewerSession();
  await goViewerLogin(redirect);
  return "redirected";
}
