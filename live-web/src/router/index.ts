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
      path: "/console/:id",
      name: "console",
      component: () => import("@/views/console/ConsoleView.vue"),
    },
  ],
});

export default router;
