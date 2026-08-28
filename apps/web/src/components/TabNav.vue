<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const activeClasses = "border-blue-600 text-blue-600 dark:text-blue-400";
const inactiveClasses =
  "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";

const betsClasses = computed(() => (route.path === "/bets" ? activeClasses : inactiveClasses));
const overallStatsClasses = computed(() =>
  route.path === "/overall-stats" ? activeClasses : inactiveClasses,
);
</script>

<template>
  <nav
    class="w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    data-test-id="tab-nav"
  >
    <div class="flex w-full">
      <RouterLink
        to="/bets"
        data-test-id="tab-nav-bets"
        class="flex-1 px-4 py-3 text-center text-sm font-medium border-b-2 transition"
        :class="betsClasses"
      >
        Bets
      </RouterLink>
      <RouterLink
        to="/overall-stats"
        data-test-id="tab-nav-overall-stats"
        class="flex-1 px-4 py-3 text-center text-sm font-medium border-b-2 transition"
        :class="overallStatsClasses"
      >
        Overall Stats
      </RouterLink>
    </div>
  </nav>
</template>

