/** 清掉残留在 body 的底 sheet（Transition+Teleport 路由切换时可能留 mask） */
export function purgeOrphanUiSheets() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".ui-sheet-root").forEach((el) => el.remove());
}
