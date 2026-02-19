<script setup lang="ts">
import { computed, ref } from "vue";

type Filters = {
  fixture: string;
  date: string;
  bookie: string;
  stakeType: string;
  result: string;
};

const props = defineProps<{
  filters: Filters;
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
    fixture: "",
    date: "",
    bookie: "",
    stakeType: "",
    result: "",
  });
};
</script>

<template>
  <div class="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div class="flex items-center justify-between gap-2 p-3">
      <button
        @click="isExpanded = !isExpanded"
        class="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white"
      >
        <span>{{ isExpanded ? "▼" : "▶" }}</span>
        <span>Filters</span>
        <span
          v-if="hasActiveFilters"
          class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          {{ activeFilterCount }} active
        </span>
      </button>

      <div class="flex items-center gap-2">
        <button
          v-if="hasActiveFilters"
          @click="clearFilters"
          class="bg-red-600 hover:bg-red-700 text-white border border-gray-300 px-3 py-1.5 text-sm rounded-md dark:border-gray-700"
        >
          Clear
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="border-t border-gray-100 p-3 pt-4 dark:border-gray-800">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >Fixture</label
          >
          <input
            :value="filters.fixture"
            @input="updateFilter('fixture', ($event.target as HTMLInputElement).value)"
            placeholder="Search fixture"
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
            class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Bookies</option>
            <option v-for="option in bookieOptions" :key="option" :value="option">
              {{ option }}
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
