import { createRouter, createWebHistory } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: DefaultLayout,
      children: [
        { path: "", redirect: "/activities" },
        {
          path: "activities",
          name: "activity-list",
          component: () => import("@/views/activity/ListView.vue"),
        },
        {
          path: "activities/create",
          name: "activity-create",
          component: () => import("@/views/activity/CreateView.vue"),
        },
        {
          path: "activities/:id/stats",
          name: "activity-stats",
          component: () => import("@/views/stats/StatsView.vue"),
        },
        {
          path: "activities/:id",
          name: "activity-detail",
          component: () => import("@/views/activity/DetailView.vue"),
        },
      ],
    },
  ],
});

export default router;
