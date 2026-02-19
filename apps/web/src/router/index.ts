import { createRouter, createWebHistory } from "vue-router";
import BetsView from "@/views/BetsView.vue";
import AuthView from "@/views/AuthView.vue";
import AppShellView from "@/views/AppShellView.vue";
import OverallStatsView from "@/views/OverallStatsView.vue";
import { useAuthStore } from "@/stores/auth";

const routes = [
  {
    path: "/",
    component: AppShellView,
    meta: { requiresAuth: true },
    children: [
      { path: "", redirect: "/bets" },
      { path: "bets", component: BetsView, meta: { requiresAuth: true } },
      { path: "overall-stats", component: OverallStatsView, meta: { requiresAuth: true } },
    ],
  },
  { path: "/auth", component: AuthView, meta: { guestOnly: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.init();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return "/auth";
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return "/bets";
  }

  return true;
});

export default router;
