import { createRouter, createWebHistory } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: DefaultLayout,
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/views/dashboard/DashboardView.vue"),
        },
        {
          path: "live",
          name: "live-manage",
          component: () => import("@/views/live/LiveManageView.vue"),
        },
        {
          path: "live/create",
          name: "live-create",
          component: () => import("@/views/live/LiveCreateView.vue"),
        },
        {
          path: "live/:id",
          name: "live-detail",
          component: () => import("@/views/live/LiveDetailView.vue"),
        },
        {
          path: "settings/materials",
          name: "settings-materials",
          component: () => import("@/views/settings/materials/MaterialCenterView.vue"),
        },
      ],
    },
    /** 直播中控台列表：侧栏新窗口打开，独立壳，不套 DefaultLayout */
    {
      path: "/live-console",
      component: () => import("@/layouts/LiveConsoleLayout.vue"),
      children: [
        {
          path: "",
          name: "live-console-list",
          component: () => import("@/views/live/LiveConsoleListView.vue"),
        },
      ],
    },
  ],
});

export default router;
