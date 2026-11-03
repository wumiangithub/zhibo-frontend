import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "viewer-login",
      component: () => import("@/views/login/ViewerLoginView.vue"),
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
    {
      path: "/console/:id",
      name: "console",
      component: () => import("@/views/console/ConsoleView.vue"),
    },
  ],
});

export default router;
