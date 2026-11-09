import type { RouteLocationRaw, Router } from "vue-router";

/**
 * 是否有可回退的站内历史。
 * Vue Router `createWebHistory` 在站内 push 时会写 `history.state.back`；
 * 邀请链接冷开 / 新标签直达时通常没有。此时 `history.length > 1` 仍常为真
 *（浏览器其它站点记录），不能用来判断「有上一页」。
 */
export function hasInAppHistoryBack(
  opts?: { excludePathPrefixes?: string[] },
): boolean {
  const back = window.history.state?.back;
  if (typeof back !== "string" || !back) return false;
  const excludes = opts?.excludePathPrefixes ?? ["/login"];
  return !excludes.some(
    (prefix) =>
      back === prefix ||
      back.startsWith(`${prefix}/`) ||
      back.startsWith(`${prefix}?`),
  );
}

/** 有站内上一页则 `router.back()`，否则 `replace` 到 fallback。 */
export function backOrReplace(
  router: Router,
  fallback: RouteLocationRaw,
  opts?: { excludePathPrefixes?: string[] },
): void {
  if (hasInAppHistoryBack(opts)) {
    router.back();
    return;
  }
  void router.replace(fallback);
}

/** 有站内上一页则返回，否则进资讯首页（`news-home` / `/`）。 */
export function backOrHome(router: Router): void {
  backOrReplace(router, { name: "news-home" });
}
