import { createRouter, createWebHistory } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import { isLoggedIn } from "@/utils/authSession";
import {
  HOST_INVITE_PATH_PREFIX,
  LIVE_STUDIO_PATH_PREFIX,
  PASSCODE_HOST_PATH,
  PASSCODE_STUDIO_PATH,
} from "@/utils/liveLinks";

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
          path: "live-reports/new",
          name: "live-report-create",
          component: () => import("@/views/liveReport/LiveReportFormView.vue"),
        },
        {
          path: "live-reports",
          name: "live-report-list",
          component: () => import("@/views/liveReport/LiveReportListView.vue"),
        },
        {
          /** D62：动作在前、单业务 id 在末尾 */
          path: "live-reports/edit/:id",
          name: "live-report-edit",
          component: () => import("@/views/liveReport/LiveReportFormView.vue"),
        },
        {
          /** D62：动作在前、单业务 id 在末尾 */
          path: "live-reports/audit/:id",
          name: "live-report-audit",
          component: () => import("@/views/liveReport/LiveReportAuditView.vue"),
        },
        {
          path: "live-reports/:id",
          name: "live-report-detail",
          component: () => import("@/views/liveReport/LiveReportDetailView.vue"),
        },
        {
          path: "live/create",
          name: "live-create",
          component: () => import("@/views/live/LiveCreateView.vue"),
        },
        {
          path: "live",
          name: "live-manage",
          component: () => import("@/views/live/LiveManageView.vue"),
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
          path: "course/create",
          name: "course-create",
          component: () => import("@/views/course/CourseCreateView.vue"),
        },
        {
          path: "course",
          name: "course-manage",
          component: () => import("@/views/course/CourseManageView.vue"),
        },
        {
          path: "course/:id/audit",
          name: "course-audit",
          component: () => import("@/views/course/CourseAuditView.vue"),
        },
        {
          path: "course/:id/data",
          name: "course-data",
          component: () => import("@/views/course/CoursePlaceholderView.vue"),
        },
        {
          path: "course/:id",
          name: "course-detail",
          component: () => import("@/views/course/CoursePlaceholderView.vue"),
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
    /** 主播邀请页：邀请链接落地，独立壳。 */
    {
      path: `${HOST_INVITE_PATH_PREFIX}/:activityId`,
      name: "host-invite",
      component: () => import("@/views/live/HostInviteView.vue"),
    },
    /**
     * 口令开播 H5：链接预填口令/讲师名；公开页，凭口令进房（以后 App 同接口）。
     */
    {
      path: PASSCODE_HOST_PATH,
      name: "passcode-host",
      component: () => import("@/views/live/PasscodeHostView.vue"),
      meta: { public: true },
    },
    /**
     * 口令进房后的 iframe 开播壳：读 sessionStorage 的 hostUrl，不鉴权。
     */
    {
      path: PASSCODE_STUDIO_PATH,
      name: "live-studio-by-passcode",
      component: () => import("@/views/live/LiveStudioView.vue"),
      meta: { public: true },
    },
    /** 开播页：iframe 嵌微吼角色参会地址，独立壳（需摄像头/麦克风）。 */
    {
      path: `${LIVE_STUDIO_PATH_PREFIX}/:activityId`,
      name: "live-studio",
      component: () => import("@/views/live/LiveStudioView.vue"),
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
