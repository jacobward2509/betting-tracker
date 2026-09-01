<script setup lang="ts">
import { ref, computed } from "vue";
import api from "@/lib/api";
import { formatBookmakerLabel } from "@/utils/bookmaker";

const ODDS_FORMAT_STORAGE_KEY = "odds-format-preference";

const showBetPreferences = ref(false);
const isLoadingBetPreferences = ref(false);
const isSavingBetPreferences = ref(false);
const availableBookmakers = ref<string[]>([]);
const enabledBookmakers = ref<string[]>([]);
const defaultBookmaker = ref("");
const defaultBetType = ref("Player Prop");
const defaultStake = ref(5);
const savedEnabledBookmakers = ref<string[]>([]);
const savedDefaultBookmaker = ref("");
const savedDefaultBetType = ref("Player Prop");
const savedDefaultStake = ref(5);
const oddsFormat = ref<"decimal" | "fractional">("decimal");
const oddsFormatDraft = ref<"decimal" | "fractional">("decimal");
const betPreferencesError = ref("");

const predefinedBetTypes = ["Accumulator", "Bet Builder", "Player Prop", "Superboost", "FT Result", "Other"];

const getBookmakerLabel = (bookmaker: string) => formatBookmakerLabel(bookmaker);

const slugifyBookmaker = (bookmaker: string) =>
  String(bookmaker || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const syncOddsFormat = () => {
  try {
    const storedOdds = localStorage.getItem(ODDS_FORMAT_STORAGE_KEY);
    oddsFormat.value = storedOdds === "decimal" || storedOdds === "fractional" ? storedOdds : "decimal";
  } catch {
    oddsFormat.value = "decimal";
  }
  oddsFormatDraft.value = oddsFormat.value;
};

// Applies sane fallbacks for bet-preference fields when the API config
// couldn't be loaded (or partially loaded), used by both the success and
// error paths of loadBetPreferences so the fallback rules can't drift apart.
const applyBetPreferencesFallback = () => {
  defaultBetType.value = defaultBetType.value || "Player Prop";
  if (!Number.isFinite(Number(defaultStake.value)) || Number(defaultStake.value) <= 0) {
    defaultStake.value = 5;
  }
  savedEnabledBookmakers.value = [...enabledBookmakers.value];
  savedDefaultBookmaker.value = defaultBookmaker.value;
  savedDefaultBetType.value = defaultBetType.value;
  savedDefaultStake.value = defaultStake.value;
};

const loadBetPreferences = async () => {
  if (isLoadingBetPreferences.value) return;
  syncOddsFormat();
  betPreferencesError.value = "";
  try {
    isLoadingBetPreferences.value = true;
    const res = await api.get("/api/user/config");
    const data = res.data || {};
    availableBookmakers.value = Array.isArray(data.bookmakers)
      ? data.bookmakers.map((item: { bookmaker: string }) => String(item.bookmaker))
      : [];
    enabledBookmakers.value = Array.isArray(data.enabledBookmakers)
      ? data.enabledBookmakers.map((value: string) => String(value))
      : [...availableBookmakers.value];
    savedEnabledBookmakers.value = [...enabledBookmakers.value];
    defaultBookmaker.value = String(data?.defaults?.bookmaker || enabledBookmakers.value[0] || "");
    savedDefaultBookmaker.value = defaultBookmaker.value;
    defaultBetType.value = String(data?.defaults?.betType || "Player Prop");
    savedDefaultBetType.value = defaultBetType.value;
    defaultStake.value = Number(data?.defaults?.stake ?? 5);
    savedDefaultStake.value = defaultStake.value;
  } catch {
    // Keep menu usable even if config cannot be loaded yet.
    if (!availableBookmakers.value.length) {
      availableBookmakers.value = [];
      enabledBookmakers.value = [];
      defaultBookmaker.value = "";
    }
    applyBetPreferencesFallback();
  } finally {
    isLoadingBetPreferences.value = false;
  }
};

const sorted = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b));
const isDirty = computed(() => {
  if (defaultBookmaker.value !== savedDefaultBookmaker.value) return true;
  if (defaultBetType.value !== savedDefaultBetType.value) return true;
  if (Number(defaultStake.value) !== Number(savedDefaultStake.value)) return true;
  if (oddsFormatDraft.value !== oddsFormat.value) return true;
  const current = sorted(enabledBookmakers.value);
  const saved = sorted(savedEnabledBookmakers.value);
  return current.join("|") !== saved.join("|");
});

const toggleBookmakerEnabled = (bookmaker: string) => {
  betPreferencesError.value = "";
  const exists = enabledBookmakers.value.includes(bookmaker);
  if (exists) {
    if (enabledBookmakers.value.length === 1) {
      betPreferencesError.value = "At least one bookmaker must remain enabled.";
      return;
    }
    enabledBookmakers.value = enabledBookmakers.value.filter((value) => value !== bookmaker);
    if (!enabledBookmakers.value.includes(defaultBookmaker.value)) {
      defaultBookmaker.value = enabledBookmakers.value[0] || "";
    }
    return;
  }
  enabledBookmakers.value = [...enabledBookmakers.value, bookmaker];
};

const saveOddsPreference = () => {
  oddsFormat.value = oddsFormatDraft.value;
  try {
    localStorage.setItem(ODDS_FORMAT_STORAGE_KEY, oddsFormat.value);
  } catch {
    // ignore storage write errors
  }
  window.dispatchEvent(new CustomEvent("odds-format-updated", { detail: oddsFormat.value }));
};

const save = async () => {
  if (isSavingBetPreferences.value) return;
  betPreferencesError.value = "";
  if (!enabledBookmakers.value.length) {
    betPreferencesError.value = "At least one bookmaker must be enabled.";
    return;
  }
  if (!defaultBookmaker.value || !enabledBookmakers.value.includes(defaultBookmaker.value)) {
    betPreferencesError.value = "Default bookmaker must be one of your enabled bookmakers.";
    return;
  }
  if (!defaultBetType.value.trim()) {
    betPreferencesError.value = "Default bet type is required.";
    return;
  }
  if (!Number.isFinite(Number(defaultStake.value)) || Number(defaultStake.value) <= 0) {
    betPreferencesError.value = "Default stake must be a positive number.";
    return;
  }

  try {
    isSavingBetPreferences.value = true;
    await api.put("/api/user/config", {
      enabledBookmakers: enabledBookmakers.value,
      defaultBookmaker: defaultBookmaker.value,
      defaultBetType: defaultBetType.value,
      defaultStake: Number(defaultStake.value),
    });
    saveOddsPreference();
    savedEnabledBookmakers.value = [...enabledBookmakers.value];
    savedDefaultBookmaker.value = defaultBookmaker.value;
    savedDefaultBetType.value = defaultBetType.value;
    savedDefaultStake.value = Number(defaultStake.value);
    window.dispatchEvent(new Event("user-config-updated"));
    showBetPreferences.value = false;
  } catch (error: any) {
    betPreferencesError.value = error?.response?.data?.error || "Failed to save bet preferences.";
  } finally {
    isSavingBetPreferences.value = false;
  }
};

defineExpose({ loadBetPreferences, isDirty });
</script>

<template>
  <div class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">Bet Preferences</p>
      <button
        type="button"
        data-test-id="user-menu-bet-preferences-toggle"
        class="text-xs font-medium text-blue-600 hover:text-blue-700"
        @click="
          showBetPreferences = !showBetPreferences;
          betPreferencesError = '';
        "
      >
        {{ showBetPreferences ? "Hide" : "Configure" }}
      </button>
    </div>

    <div v-if="showBetPreferences" class="mt-2 space-y-3">
      <p v-if="isLoadingBetPreferences" class="text-xs text-gray-500 dark:text-gray-400">
        Loading preferences...
      </p>

      <template v-else>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400">Odds Display</label>
          <select
            v-model="oddsFormatDraft"
            data-test-id="user-menu-odds-format-select"
            class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="decimal">Decimal</option>
            <option value="fractional">Fractional</option>
          </select>
        </div>


        <div>
          <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Enabled Bookmakers</p>
          <div class="grid grid-cols-2 gap-1.5">
            <label
              v-for="bookmaker in availableBookmakers"
              :key="bookmaker"
              class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200"
            >
              <input
                type="checkbox"
                :checked="enabledBookmakers.includes(bookmaker)"
                :disabled="enabledBookmakers.length === 1 && enabledBookmakers.includes(bookmaker)"
                :data-test-id="`user-menu-bookmaker-checkbox-${slugifyBookmaker(bookmaker)}`"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                @change="toggleBookmakerEnabled(bookmaker)"
              />
              <span>{{ getBookmakerLabel(bookmaker) }}</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400">Default Bookmaker</label>
          <select
            v-model="defaultBookmaker"
            data-test-id="user-menu-default-bookmaker-select"
            class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option v-for="bookmaker in enabledBookmakers" :key="bookmaker" :value="bookmaker">
              {{ getBookmakerLabel(bookmaker) }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400">Default Bet Type</label>
          <select
            v-model="defaultBetType"
            data-test-id="user-menu-default-bet-type-select"
            class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option v-for="betType in predefinedBetTypes" :key="betType" :value="betType">
              {{ betType }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400">Default Stake (£)</label>
          <input
            v-model.number="defaultStake"
            type="number"
            min="0.01"
            step="0.01"
            data-test-id="user-menu-default-stake-input"
            class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <p
          v-if="betPreferencesError"
          class="text-xs text-red-600"
          data-test-id="user-menu-bet-preferences-error"
        >
          {{ betPreferencesError }}
        </p>

        <button
          type="button"
          data-test-id="user-menu-save-bet-preferences-button"
          class="w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          :disabled="isSavingBetPreferences || !isDirty"
          @click="save"
        >
          {{ isSavingBetPreferences ? "Saving..." : "Save Preferences" }}
        </button>
      </template>
    </div>
  </div>
</template>
