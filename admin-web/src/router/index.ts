import { createRouter, createWebHistory } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import { isLoggedIn } from "@/utils/authSession";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/login/LoginView.vue"),
      meta: { public: true },
    },
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
          path: "live/:id/audit",
          name: "live-audit",
          component: () => import("@/views/live/LiveAuditView.vue"),
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

router.beforeEach((to) => {
  const publicRoute = to.meta.public === true;
  if (publicRoute) {
    if (to.name === "login" && isLoggedIn()) {
      const redirect = typeof to.query.redirect === "string" ? to.query.redirect : "/";
      return redirect || "/";
    }
    return true;
  }
  if (!isLoggedIn()) {
    return {
      path: "/login",
      query: { redirect: to.fullPath },
    };
  }
  return true;
});

export default router;
