<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/lib/api";
import { decimalToFractionalOdds, type OddsFormat } from "@/utils/odds";
import {
  SELECTED_SEASON_STORAGE_KEY,
  getCurrentSeasonKey,
  getSeasonKeyFromDate,
  getSeasonLabel,
} from "@/utils/season";

type Bet = Record<string, any>;

const bets = ref<Bet[]>([]);
const isLoading = ref(true);
const oddsFormat = ref<OddsFormat>("decimal");
const selectedSeason = ref(getSeasonLabel(getCurrentSeasonKey()));
const isDailyExpanded = ref(false);
const DAILY_PREVIEW_ROWS = 10;

const getSeasonKeyFromLabel = (label: string) => {
  const trimmed = String(label || "").trim();
  const keyMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (keyMatch) return `${keyMatch[1]}-${keyMatch[2]}`;
  const labelMatch = trimmed.match(/^(\d{4})\s*\/\s*(\d{2})$/);
  if (!labelMatch) return "";
  const startYear = Number(labelMatch[1]);
  return `${startYear}-${startYear + 1}`;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeResult = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const normalizeStakeType = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const getRealizedReturn = (bet: Bet) => {
  const stake = toNumber(bet.stake);
  const odds = toNumber(bet.odds);
  const cashOutValue = toNumber(bet.cashOutValue);
  const result = normalizeResult(bet.result);
  const stakeType = normalizeStakeType(bet.stakeType);

  if (result === "WON" || result === "WIN") {
    // Match sheet logic:
    // non-free win => full return (stake * odds)
    // free win => winnings only ((stake * odds) - stake)
    return stakeType === "FREE" ? stake * odds - stake : stake * odds;
  }
  if (result === "LOST" || result === "LOSS") return 0;
  if (result === "VOID" || result === "CASHED_OUT" || result === "CASHEDOUT") return cashOutValue;
  return 0;
};

const getProfit = (bet: Bet) => {
  const value = Number(bet.profit);
  return Number.isFinite(value) ? value : 0;
};

const getStakeForTotals = (bet: Bet) => {
  const stakeType = normalizeStakeType(bet.stakeType);
  if (stakeType === "FREE") return 0;
  return toNumber(bet.stake);
};

const formatCurrency = (value: number) => `£ ${value.toFixed(2)}`;
const formatRoi = (value: number) => `${value.toFixed(2)}%`;
const formatRatio = (wins: number, betsCount: number) =>
  betsCount > 0 ? `${((wins / betsCount) * 100).toFixed(2)}%` : "0.00%";

const signedClass = (value: number) =>
  value > 0 ? "text-green-700" : value < 0 ? "text-red-700" : "text-gray-900 dark:text-white";

const displayOdds = (value: number) => {
  if (oddsFormat.value === "fractional") return decimalToFractionalOdds(value);
  return toNumber(value).toFixed(2);
};

const syncOddsPreference = () => {
  try {
    const stored = localStorage.getItem("odds-format-preference");
    if (stored === "decimal" || stored === "fractional") {
      oddsFormat.value = stored;
    }
  } catch {
    oddsFormat.value = "decimal";
  }
};

const onOddsPreferenceUpdated = () => {
  syncOddsPreference();
};

const seasonOptions = computed(() => {
  const keys = new Set<string>([getCurrentSeasonKey()]);
  for (const bet of bets.value) {
    const seasonKey = getSeasonKeyFromDate(String(bet.placedAt || ""));
    if (seasonKey) keys.add(seasonKey);
  }
  return Array.from(keys)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => getSeasonLabel(key));
});

const scopedBets = computed(() => {
  const seasonKey = getSeasonKeyFromLabel(selectedSeason.value);
  if (!seasonKey) return bets.value;
  return bets.value.filter((bet) => getSeasonKeyFromDate(String(bet.placedAt || "")) === seasonKey);
});

const overall = computed(() => {
  const betsCount = scopedBets.value.length;
  const wins = scopedBets.value.filter((bet) => {
    const result = normalizeResult(bet.result);
    return result === "WON" || result === "WIN" || result === "VOID" || result === "CASHED_OUT";
  }).length;

  const totalStake = scopedBets.value.reduce((sum, bet) => sum + getStakeForTotals(bet), 0);
  const totalReturns = scopedBets.value.reduce((sum, bet) => sum + getRealizedReturn(bet), 0);
  const totalProfit = scopedBets.value.reduce((sum, bet) => sum + getProfit(bet), 0);
  const averageStake = betsCount ? totalStake / betsCount : 0;
  const averageOdds = betsCount
    ? scopedBets.value.reduce((sum, bet) => sum + toNumber(bet.odds), 0) / betsCount
    : 0;
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  return {
    betsCount,
    wins,
    winRatio: formatRatio(wins, betsCount),
    totalStake,
    totalReturns,
    averageStake,
    averageOdds,
    totalProfit,
    roi,
  };
});

const monthlyRows = computed(() => {
  const map = new Map<
    string,
    {
      label: string;
      betsCount: number;
      totalStake: number;
      totalReturns: number;
      totalProfit: number;
      oddsTotal: number;
    }
  >();

  for (const bet of scopedBets.value) {
    const date = new Date(bet.placedAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const current = map.get(key) || {
      label,
      betsCount: 0,
      totalStake: 0,
      totalReturns: 0,
      totalProfit: 0,
      oddsTotal: 0,
    };

    current.betsCount += 1;
    current.totalStake += getStakeForTotals(bet);
    current.totalReturns += getRealizedReturn(bet);
    current.totalProfit += getProfit(bet);
    current.oddsTotal += toNumber(bet.odds);
    map.set(key, current);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => ({
      ...value,
      roi: value.totalStake > 0 ? (value.totalProfit / value.totalStake) * 100 : 0,
      averageOdds: value.betsCount > 0 ? value.oddsTotal / value.betsCount : 0,
    }));
});

const dailyRows = computed(() => {
  const map = new Map<
    string,
    {
      date: string;
      betsCount: number;
      totalStake: number;
      totalReturns: number;
      totalProfit: number;
      oddsTotal: number;
    }
  >();

  for (const bet of scopedBets.value) {
    const date = String(bet.placedAt || "").slice(0, 10);
    const current = map.get(date) || {
      date,
      betsCount: 0,
      totalStake: 0,
      totalReturns: 0,
      totalProfit: 0,
      oddsTotal: 0,
    };

    current.betsCount += 1;
    current.totalStake += getStakeForTotals(bet);
    current.totalReturns += getRealizedReturn(bet);
    current.totalProfit += getProfit(bet);
    current.oddsTotal += toNumber(bet.odds);
    map.set(date, current);
  }

  return [...map.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((value) => ({
      ...value,
      roi: value.totalStake > 0 ? (value.totalProfit / value.totalStake) * 100 : 0,
      averageOdds: value.betsCount > 0 ? value.oddsTotal / value.betsCount : 0,
    }));
});

const hasMoreDailyRows = computed(() => dailyRows.value.length > DAILY_PREVIEW_ROWS);

const visibleDailyRows = computed(() => {
  if (isDailyExpanded.value) return dailyRows.value;
  return dailyRows.value.slice(0, DAILY_PREVIEW_ROWS);
});

const nextHiddenDailyRow = computed(() => {
  if (!hasMoreDailyRows.value || isDailyExpanded.value) return null;
  return dailyRows.value[DAILY_PREVIEW_ROWS] || null;
});

const bookmakerRows = computed(() => {
  const map = new Map<
    string,
    {
      bookmaker: string;
      betsCount: number;
      totalStake: number;
      totalReturns: number;
      totalProfit: number;
      oddsTotal: number;
    }
  >();

  for (const bet of scopedBets.value) {
    const bookmaker = String(bet.bookmaker || "-");
    const current = map.get(bookmaker) || {
      bookmaker,
      betsCount: 0,
      totalStake: 0,
      totalReturns: 0,
      totalProfit: 0,
      oddsTotal: 0,
    };

    current.betsCount += 1;
    current.totalStake += getStakeForTotals(bet);
    current.totalReturns += getRealizedReturn(bet);
    current.totalProfit += getProfit(bet);
    current.oddsTotal += toNumber(bet.odds);
    map.set(bookmaker, current);
  }

  return [...map.values()].map((value) => ({
    ...value,
    roi: value.totalStake > 0 ? (value.totalProfit / value.totalStake) * 100 : 0,
    averageOdds: value.betsCount > 0 ? value.oddsTotal / value.betsCount : 0,
  }));
});

onMounted(async () => {
  try {
    const storedSeason = localStorage.getItem(SELECTED_SEASON_STORAGE_KEY);
    if (storedSeason) {
      selectedSeason.value = String(storedSeason);
    }
  } catch {
    selectedSeason.value = getSeasonLabel(getCurrentSeasonKey());
  }

  syncOddsPreference();
  window.addEventListener("odds-format-updated", onOddsPreferenceUpdated);
  window.addEventListener("storage", onOddsPreferenceUpdated);

  try {
    const res = await api.get("/api/bets");
    bets.value = Array.isArray(res.data) ? res.data : [];
  } catch {
    bets.value = [];
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("odds-format-updated", onOddsPreferenceUpdated);
  window.removeEventListener("storage", onOddsPreferenceUpdated);
});

watch(selectedSeason, (season) => {
  try {
    localStorage.setItem(SELECTED_SEASON_STORAGE_KEY, season);
  } catch {
    // ignore localStorage write errors
  }
});
</script>

<template>
  <div class="p-4 space-y-5">
    <div v-if="isLoading" class="text-sm text-gray-600 dark:text-gray-400">Loading stats...</div>
    <div class="flex justify-end">
      <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <label for="stats-season">Season</label>
        <select
          id="stats-season"
          v-model="selectedSeason"
          class="border border-gray-300 rounded-md px-2 py-1 bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option v-for="season in seasonOptions" :key="season" :value="season">
            {{ season }}
          </option>
        </select>
      </div>
    </div>

    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Overall</h2>
      <div class="mt-3 hidden overflow-x-auto md:block">
        <table class="w-full whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
          <thead class="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-3 py-2">No. of Bets</th>
              <th class="px-3 py-2">No. of Wins</th>
              <th class="px-3 py-2">Win Ratio</th>
              <th class="px-3 py-2">Total Stake (£)</th>
              <th class="px-3 py-2">Total Returns</th>
              <th class="px-3 py-2">Average Stake</th>
              <th class="px-3 py-2">Average Odds</th>
              <th class="px-3 py-2">Total P/L</th>
              <th class="px-3 py-2">Total ROI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-3 py-2">{{ overall.betsCount }}</td>
              <td class="px-3 py-2">{{ overall.wins }}</td>
              <td class="px-3 py-2">{{ overall.winRatio }}</td>
              <td class="px-3 py-2">{{ formatCurrency(overall.totalStake) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(overall.totalReturns) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(overall.averageStake) }}</td>
              <td class="px-3 py-2">{{ displayOdds(overall.averageOdds) }}</td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(overall.totalProfit)">
                {{ formatCurrency(overall.totalProfit) }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(overall.roi)">
                {{ formatRoi(overall.roi) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 md:hidden">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">No. of Bets</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ overall.betsCount }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">No. of Wins</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ overall.wins }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Win Ratio</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ overall.winRatio }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Average Odds</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ displayOdds(overall.averageOdds) }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Total Stake</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(overall.totalStake) }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Total Returns</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(overall.totalReturns) }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Average Stake</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(overall.averageStake) }}</p>
          </div>
          <div class="rounded bg-gray-50 p-2 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Total ROI</p>
            <p class="font-semibold" :class="signedClass(overall.roi)">{{ formatRoi(overall.roi) }}</p>
          </div>
        </div>
        <div class="mt-2 rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
          <p class="text-gray-500 dark:text-gray-400">Total P/L</p>
          <p class="font-semibold" :class="signedClass(overall.totalProfit)">
            {{ formatCurrency(overall.totalProfit) }}
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Monthly</h2>
      <div class="mt-3 hidden overflow-x-auto md:block">
        <table class="w-full whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
          <thead class="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-3 py-2">Month</th>
              <th class="px-3 py-2">No. of Bets</th>
              <th class="px-3 py-2">Total Stake</th>
              <th class="px-3 py-2">Total Returns</th>
              <th class="px-3 py-2">P/L (£)</th>
              <th class="px-3 py-2">ROI</th>
              <th class="px-3 py-2">Average Odds</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in monthlyRows" :key="row.label">
              <td class="px-3 py-2">{{ row.label }}</td>
              <td class="px-3 py-2">{{ row.betsCount }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalStake) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalReturns) }}</td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.totalProfit)">
                {{ formatCurrency(row.totalProfit) }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.roi)">
                {{ formatRoi(row.roi) }}
              </td>
              <td class="px-3 py-2">{{ displayOdds(row.averageOdds) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 space-y-2 md:hidden">
        <div
          v-for="row in monthlyRows"
          :key="`mobile-monthly-${row.label}`"
          class="rounded border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.label }}</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-gray-500 dark:text-gray-400">No. of Bets</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ row.betsCount }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Average Odds</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ displayOdds(row.averageOdds) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Stake</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalStake) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Returns</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalReturns) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">P/L</p>
              <p class="font-semibold" :class="signedClass(row.totalProfit)">{{ formatCurrency(row.totalProfit) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">ROI</p>
              <p class="font-semibold" :class="signedClass(row.roi)">{{ formatRoi(row.roi) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Daily</h2>
      <div class="mt-3 hidden overflow-x-auto md:block">
        <table class="w-full whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
          <thead class="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">No. of Bets</th>
              <th class="px-3 py-2">Total Stake (£)</th>
              <th class="px-3 py-2">Total Returns (£)</th>
              <th class="px-3 py-2">P/L (£)</th>
              <th class="px-3 py-2">ROI</th>
              <th class="px-3 py-2">Daily Odds Average</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleDailyRows" :key="row.date">
              <td class="px-3 py-2">{{ row.date }}</td>
              <td class="px-3 py-2">{{ row.betsCount }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalStake) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalReturns) }}</td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.totalProfit)">
                {{ formatCurrency(row.totalProfit) }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.roi)">
                {{ formatRoi(row.roi) }}
              </td>
              <td class="px-3 py-2">{{ displayOdds(row.averageOdds) }}</td>
            </tr>
            <tr v-if="nextHiddenDailyRow" class="opacity-55 blur-[1px] select-none pointer-events-none">
              <td class="px-3 py-2">{{ nextHiddenDailyRow.date }}</td>
              <td class="px-3 py-2">{{ nextHiddenDailyRow.betsCount }}</td>
              <td class="px-3 py-2">{{ formatCurrency(nextHiddenDailyRow.totalStake) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(nextHiddenDailyRow.totalReturns) }}</td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(nextHiddenDailyRow.totalProfit)">
                {{ formatCurrency(nextHiddenDailyRow.totalProfit) }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(nextHiddenDailyRow.roi)">
                {{ formatRoi(nextHiddenDailyRow.roi) }}
              </td>
              <td class="px-3 py-2">{{ displayOdds(nextHiddenDailyRow.averageOdds) }}</td>
            </tr>
            <tr v-if="hasMoreDailyRows && !isDailyExpanded">
              <td colspan="7" class="px-3 pb-2 pt-1">
                <button
                  type="button"
                  class="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
                  @click="isDailyExpanded = true"
                >
                  Click to see more
                </button>
              </td>
            </tr>
            <tr v-if="hasMoreDailyRows && isDailyExpanded">
              <td colspan="7" class="px-3 py-2">
                <button
                  type="button"
                  class="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
                  @click="isDailyExpanded = false"
                >
                  Show fewer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 space-y-2 md:hidden">
        <div
          v-for="row in visibleDailyRows"
          :key="`mobile-daily-${row.date}`"
          class="rounded border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.date }}</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-gray-500 dark:text-gray-400">No. of Bets</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ row.betsCount }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Daily Odds Avg</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ displayOdds(row.averageOdds) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Stake</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalStake) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Returns</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalReturns) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">P/L</p>
              <p class="font-semibold" :class="signedClass(row.totalProfit)">{{ formatCurrency(row.totalProfit) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">ROI</p>
              <p class="font-semibold" :class="signedClass(row.roi)">{{ formatRoi(row.roi) }}</p>
            </div>
          </div>
        </div>
        <div
          v-if="nextHiddenDailyRow"
          class="rounded border border-gray-200 bg-gray-50 p-3 text-xs opacity-55 blur-[1px] select-none pointer-events-none dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ nextHiddenDailyRow.date }}</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-gray-500 dark:text-gray-400">No. of Bets</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ nextHiddenDailyRow.betsCount }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Daily Odds Avg</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ displayOdds(nextHiddenDailyRow.averageOdds) }}</p>
            </div>
          </div>
        </div>
        <div v-if="hasMoreDailyRows && !isDailyExpanded" class="pt-1 text-center">
          <button
            type="button"
            class="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
            @click="isDailyExpanded = true"
          >
            Click to see more
          </button>
        </div>
        <div v-if="hasMoreDailyRows && isDailyExpanded" class="pt-1 text-center">
          <button
            type="button"
            class="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
            @click="isDailyExpanded = false"
          >
            Show fewer
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Bookmaker</h2>
      <div class="mt-3 hidden overflow-x-auto md:block">
        <table class="w-full whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
          <thead class="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-3 py-2">Bookie</th>
              <th class="px-3 py-2">No. of Bets</th>
              <th class="px-3 py-2">Total Stake (£)</th>
              <th class="px-3 py-2">Total Returns (£)</th>
              <th class="px-3 py-2">P/L (£)</th>
              <th class="px-3 py-2">ROI</th>
              <th class="px-3 py-2">Average Odds</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in bookmakerRows" :key="row.bookmaker">
              <td class="px-3 py-2">{{ row.bookmaker }}</td>
              <td class="px-3 py-2">{{ row.betsCount }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalStake) }}</td>
              <td class="px-3 py-2">{{ formatCurrency(row.totalReturns) }}</td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.totalProfit)">
                {{ formatCurrency(row.totalProfit) }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="signedClass(row.roi)">
                {{ formatRoi(row.roi) }}
              </td>
              <td class="px-3 py-2">{{ displayOdds(row.averageOdds) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 space-y-2 md:hidden">
        <div
          v-for="row in bookmakerRows"
          :key="`mobile-bookie-${row.bookmaker}`"
          class="rounded border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.bookmaker }}</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-gray-500 dark:text-gray-400">No. of Bets</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ row.betsCount }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Average Odds</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ displayOdds(row.averageOdds) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Stake</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalStake) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Total Returns</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(row.totalReturns) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">P/L</p>
              <p class="font-semibold" :class="signedClass(row.totalProfit)">{{ formatCurrency(row.totalProfit) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">ROI</p>
              <p class="font-semibold" :class="signedClass(row.roi)">{{ formatRoi(row.roi) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
