import { createRouter, createWebHistory } from "vue-router";
import { getViewerAccessToken } from "@/utils/viewerAuth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "news-home",
      meta: { requiresViewer: true },
      component: () => import("@/views/news/NewsHomeView.vue"),
    },
    {
      path: "/news/:id",
      name: "news-detail",
      meta: { requiresViewer: true },
      component: () => import("@/views/news/NewsDetailView.vue"),
    },
    {
      path: "/rooms",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "viewer-login",
      component: () => import("@/views/login/ViewerLoginView.vue"),
    },
    {
      path: "/login/dev",
      name: "viewer-dev-login",
      component: () => import("@/views/login/DevPhoneLoginView.vue"),
    },
    {
      path: "/mine",
      name: "mine",
      meta: { requiresViewer: true },
      component: () => import("@/views/mine/MineView.vue"),
    },
    {
      path: "/profile",
      name: "profile",
      meta: { requiresViewer: true },
      component: () => import("@/views/mine/ProfileView.vue"),
    },
    {
      path: "/orders",
      name: "orders",
      meta: { requiresViewer: true },
      component: () => import("@/views/mine/OrdersView.vue"),
    },
    {
      path: "/learning",
      name: "learning",
      meta: { requiresViewer: true },
      component: () => import("@/views/learning/LearningView.vue"),
    },
    {
      path: "/learning/courses/:id",
      name: "learning-course",
      meta: { requiresViewer: true },
      component: () => import("@/views/learning/LearningCourseDetailView.vue"),
    },
    {
      path: "/bind-phone",
      name: "bind-phone",
      meta: { requiresViewer: true },
      component: () => import("@/views/mine/BindPhoneView.vue"),
    },
    {
      path: "/feedback",
      name: "feedback",
      meta: { requiresViewer: true },
      component: () => import("@/views/feedback/FeedbackComposeView.vue"),
    },
    {
      path: "/feedback/list",
      name: "feedback-list",
      meta: { requiresViewer: true },
      component: () => import("@/views/feedback/FeedbackListView.vue"),
    },
    {
      path: "/feedback/detail/:id",
      name: "feedback-detail",
      meta: { requiresViewer: true },
      component: () => import("@/views/feedback/FeedbackDetailView.vue"),
    },
    {
      path: "/agreements",
      name: "agreement-list",
      meta: { requiresViewer: true },
      component: () => import("@/views/agreement/AgreementListView.vue"),
    },
    {
      path: "/agreement/user",
      name: "agreement-user",
      component: () => import("@/views/agreement/AgreementDocView.vue"),
    },
    {
      path: "/agreement/stub",
      name: "agreement-stub",
      component: () => import("@/views/agreement/AgreementDocView.vue"),
    },
    {
      path: "/agreement/privacy",
      name: "agreement-privacy",
      component: () => import("@/views/agreement/AgreementDocView.vue"),
    },
    {
      path: "/watch/:id",
      name: "watch",
      component: () => import("@/views/watch/WatchView.vue"),
    },
    {
      path: "/watch/:id/replay",
      name: "watch-replay",
      component: () => import("@/views/watch/WatchReplayView.vue"),
    },
    {
      path: "/course/:id",
      name: "course-watch",
      component: () => import("@/views/course/CourseWatchView.vue"),
    },
    {
      path: "/course/:courseId/lesson/:lessonNodeId",
      name: "course-lesson",
      component: () => import("@/views/course/CourseLessonView.vue"),
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresViewer) return true;
  if (getViewerAccessToken()) return true;
  return {
    name: "viewer-login",
    query: { redirect: to.fullPath },
  };
});

export default router;
