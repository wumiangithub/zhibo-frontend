/** 须为 module，否则会覆盖 vue-router 真类型而非增强 RouteMeta */
export {};

declare module "vue-router" {
  interface RouteMeta {
    /** 观众 H5 壳：无 access 则去 /login */
    requiresViewer?: boolean;
  }
}
