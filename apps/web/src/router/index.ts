import { createRouter, createWebHistory } from "vue-router";
import BetsView from "@/views/BetsView.vue";
import SignInView from "@/views/SignInView.vue";
import SignUpView from "@/views/SignUpView.vue";
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
  { path: "/sign-in", component: SignInView, meta: { guestOnly: true } },
  { path: "/sign-up", component: SignUpView, meta: { guestOnly: true } },
  { path: "/auth", redirect: "/sign-in" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.init();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return "/sign-in";
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return "/bets";
  }

  return true;
});

export default router;

