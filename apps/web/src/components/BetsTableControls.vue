<script setup lang="ts">
import { computed, ref } from "vue";
import { formatBookmakerLabel } from "@/utils/bookmaker";

type Filters = {
  season: string;
  fixture: string;
  date: string;
  bookie: string;
  stakeType: string;
  result: string;
};

const props = defineProps<{
  filters: Filters;
  seasonOptions: string[];
  bookieOptions: string[];
  stakeTypeOptions: string[];
  resultOptions: string[];
}>();

const emit = defineEmits<{
  (e: "update:filters", value: Filters): void;
}>();

const isExpanded = ref(false);

const activeFilterCount = computed(() => {
  let count = 0;
  if (props.filters.fixture.trim()) count += 1;
  if (props.filters.date.trim()) count += 1;
  if (props.filters.bookie.trim()) count += 1;
  if (props.filters.stakeType.trim()) count += 1;
  if (props.filters.result.trim()) count += 1;
  return count;
});

const hasActiveFilters = computed(() => activeFilterCount.value > 0);

const updateFilter = (key: keyof Filters, value: string) => {
  emit("update:filters", {
    ...props.filters,
    [key]: value,
  });
};

const clearFilters = () => {
  emit("update:filters", {
    season: "",
    fixture: "",
    date: "",
    bookie: "",
    stakeType: "",
    result: "",
  });
};

const getBookmakerLabel = (bookmaker: string) => formatBookmakerLabel(bookmaker);
</script>

<template>
  <div class="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div class="flex items-center justify-between gap-2 p-3">
      <button
        @click="isExpanded = !isExpanded"
        data-test-id="bets-filters-toggle-button"
        class="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white"
      >
        <span>{{ isExpanded ? "▼" : "▶" }}</span>
        <span>Filters</span>
        <span
          v-if="hasActiveFilters"
          data-test-id="bets-filters-active-badge"
          class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          {{ activeFilterCount }} active
        </span>
      </button>

      <div class="flex items-center gap-2">
        <button
          v-if="hasActiveFilters"
          @click="clearFilters"
          data-test-id="bets-filters-clear-button"
          class="bg-red-600 hover:bg-red-700 text-white border border-gray-300 px-3 py-1.5 text-sm rounded-md dark:border-gray-700"
        >
          Clear
        </button>
      </div>
    </div>

    <div
      v-if="isExpanded"
      data-test-id="bets-filters-panel-body"
      class="border-t border-gray-100 p-3 pt-4 dark:border-gray-800"
    >

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Season</label
          >
          <select
            :value="filters.season"
            @change="updateFilter('season', ($event.target as HTMLSelectElement).value)"
            data-test-id="bets-filter-season-select"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option v-for="option in seasonOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Fixture</label
          >
          <input
            :value="filters.fixture"
            @input="updateFilter('fixture', ($event.target as HTMLInputElement).value)"
            placeholder="Search fixture"
            data-test-id="bets-filter-fixture-input"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Date</label
          >
          <input
            :value="filters.date"
            @input="updateFilter('date', ($event.target as HTMLInputElement).value)"
            type="date"
            data-test-id="bets-filter-date-input"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Bookie</label
          >
          <select
            :value="filters.bookie"
            @change="updateFilter('bookie', ($event.target as HTMLSelectElement).value)"
            data-test-id="bets-filter-bookie-select"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Bookies</option>
            <option v-for="option in bookieOptions" :key="option" :value="option">
              {{ getBookmakerLabel(option) }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Stake Type</label
          >
          <select
            :value="filters.stakeType"
            @change="updateFilter('stakeType', ($event.target as HTMLSelectElement).value)"
            data-test-id="bets-filter-stake-type-select"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Stake Types</option>
            <option v-for="option in stakeTypeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Result</label
          >
          <select
            :value="filters.result"
            @change="updateFilter('result', ($event.target as HTMLSelectElement).value)"
            data-test-id="bets-filter-result-select"
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Results</option>
            <option v-for="option in resultOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
