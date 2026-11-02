import router from "@/router";
import { navigateToViewerLogin as navigateToMiniProgramLogin } from "@/utils/miniProgram";

function isLikelyMiniProgramWebView(): boolean {
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
