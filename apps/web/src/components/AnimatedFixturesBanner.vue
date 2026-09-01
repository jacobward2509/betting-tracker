<script setup lang="ts">
import { onMounted, ref } from "vue";
import api from "@/lib/api";
import { formatLeagueLabel } from "@/utils/league";

type Fixture = {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
};

const fixtures = ref<Fixture[]>([]);

const formatKickoffTime = (value: string): string => {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const loadFixtures = async () => {
  try {
    // Pass the viewer's own UTC offset (Date.getTimezoneOffset() sign
    // convention: positive = behind UTC, negative = ahead) so "today" is
    // resolved against their local calendar day rather than the server's
    // UTC clock — otherwise an evening UTC kickoff the server still counts
    // as "today" could already be "tomorrow" for a viewer further east.
    const response = await api.get<Fixture[]>("/api/fixtures/today", {
      params: { tzOffsetMinutes: new Date().getTimezoneOffset() },
    });
    fixtures.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    // Fail silently — the banner is a non-critical enhancement on the auth
    // pages, so a fetch failure should never surface an error to the user.
    fixtures.value = [];
  }
};

onMounted(loadFixtures);
</script>

<template>
  <div
    v-if="fixtures.length > 0"
    class="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-gray-200 bg-white/95 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
    data-test-id="fixtures-banner"
  >
    <div class="fixtures-marquee flex w-max items-center gap-8 whitespace-nowrap">
      <template v-for="pass in [0, 1]" :key="pass">
        <div
          v-for="fixture in fixtures"
          :key="`${pass}-${fixture.id}`"
          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
          data-test-id="fixture-row"
        >
          <span
            class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
            data-test-id="fixture-league-badge"
          >
            {{ formatLeagueLabel(fixture.league) }}
          </span>
          <span class="font-medium" data-test-id="fixture-matchup">{{ fixture.homeTeam }} v {{ fixture.awayTeam }}</span>
          <span class="text-gray-400 dark:text-gray-500" data-test-id="fixture-kickoff-time">{{ formatKickoffTime(fixture.kickoffAt) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fixtures-marquee {
  animation: fixtures-scroll 40s linear infinite;
}

@keyframes fixtures-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
</style>
