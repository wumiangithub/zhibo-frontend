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
      ],
    },
  ],
});

export default router;
