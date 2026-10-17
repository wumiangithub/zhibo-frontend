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
          path: "live-reports",
          name: "live-report-list",
          component: () => import("@/views/liveReport/LiveReportListView.vue"),
        },
        {
          path: "live-reports/new",
          name: "live-report-create",
          component: () => import("@/views/liveReport/LiveReportFormView.vue"),
        },
        {
          path: "live-reports/:id/edit",
          name: "live-report-edit",
          component: () => import("@/views/liveReport/LiveReportFormView.vue"),
        },
        {
          path: "live-reports/:id/audit",
          name: "live-report-audit",
          component: () => import("@/views/liveReport/LiveReportAuditView.vue"),
        },
        {
          path: "live-reports/:id",
          name: "live-report-detail",
          component: () => import("@/views/liveReport/LiveReportDetailView.vue"),
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
        {
          path: "settings/materials/articles/new",
          name: "settings-article-create",
          component: () => import("@/views/settings/materials/ArticleCreateView.vue"),
        },
        {
          path: "settings/materials/articles/:id",
          name: "settings-article-edit",
          component: () => import("@/views/settings/materials/ArticleCreateView.vue"),
        },
        {
          path: "settings/employees",
          name: "settings-employees",
          component: () => import("@/views/settings/employees/EmployeeOrgView.vue"),
        },
        {
          path: "settings/roles",
          name: "settings-roles",
          component: () => import("@/views/settings/roles/RoleManageView.vue"),
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
