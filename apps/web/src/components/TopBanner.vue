<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

const authStore = useAuthStore();
const router = useRouter();

const showUserMenu = ref(false);
const editingDisplayName = ref(false);
const displayNameInput = ref("");
const isSavingDisplayName = ref(false);
const showBetPreferences = ref(false);
const showVisualPreferences = ref(false);
const isLoadingBetPreferences = ref(false);
const isSavingBetPreferences = ref(false);
const isSavingVisualPreferences = ref(false);
const availableBookmakers = ref<string[]>([]);
const enabledBookmakers = ref<string[]>([]);
const defaultBookmaker = ref("");
const defaultBetType = ref("Player Prop");
const defaultStake = ref(5);
const savedEnabledBookmakers = ref<string[]>([]);
const savedDefaultBookmaker = ref("");
const savedDefaultBetType = ref("Player Prop");
const savedDefaultStake = ref(5);
const theme = ref<"light" | "dark">("light");
const oddsFormat = ref<"decimal" | "fractional">("decimal");
const themeDraft = ref<"light" | "dark">("light");
const oddsFormatDraft = ref<"decimal" | "fractional">("decimal");

const predefinedBetTypes = ["Accumulator", "Bet Builder", "Player Prop", "Superboost", "FT Result", "Other"];
const THEME_STORAGE_KEY = "theme-preference";
const ODDS_FORMAT_STORAGE_KEY = "odds-format-preference";

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
  if (showUserMenu.value) {
    editingDisplayName.value = false;
    displayNameInput.value = authStore.user?.name || "";
    loadBetPreferences();
    syncUiPreferences();
  }
};

const applyTheme = (nextTheme: "light" | "dark") => {
  const isDark = nextTheme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);
};

const syncUiPreferences = () => {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    theme.value =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  } catch {
    theme.value = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  try {
    const storedOdds = localStorage.getItem(ODDS_FORMAT_STORAGE_KEY);
    oddsFormat.value = storedOdds === "decimal" || storedOdds === "fractional" ? storedOdds : "decimal";
  } catch {
    oddsFormat.value = "decimal";
  }
  themeDraft.value = theme.value;
  oddsFormatDraft.value = oddsFormat.value;
};

const saveVisualPreferences = async () => {
  if (isSavingVisualPreferences.value) return;
  try {
    isSavingVisualPreferences.value = true;
    theme.value = themeDraft.value;
    applyTheme(theme.value);
    localStorage.setItem(THEME_STORAGE_KEY, theme.value);
  } catch {
    // ignore storage write errors
  } finally {
    isSavingVisualPreferences.value = false;
  }
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

const loadBetPreferences = async () => {
  if (isLoadingBetPreferences.value) return;
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
    defaultBetType.value = defaultBetType.value || "Player Prop";
    if (!Number.isFinite(Number(defaultStake.value)) || Number(defaultStake.value) <= 0) {
      defaultStake.value = 5;
    }
    savedEnabledBookmakers.value = [...enabledBookmakers.value];
    savedDefaultBookmaker.value = defaultBookmaker.value;
    savedDefaultBetType.value = defaultBetType.value;
    savedDefaultStake.value = defaultStake.value;
  } finally {
    isLoadingBetPreferences.value = false;
  }
};

const sorted = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b));
const isBetPreferencesDirty = computed(() => {
  if (defaultBookmaker.value !== savedDefaultBookmaker.value) return true;
  if (defaultBetType.value !== savedDefaultBetType.value) return true;
  if (Number(defaultStake.value) !== Number(savedDefaultStake.value)) return true;
  if (oddsFormatDraft.value !== oddsFormat.value) return true;
  const current = sorted(enabledBookmakers.value);
  const saved = sorted(savedEnabledBookmakers.value);
  return current.join("|") !== saved.join("|");
});
const isVisualPreferencesDirty = computed(() => themeDraft.value !== theme.value);
const hasUnsavedChanges = computed(
  () => isBetPreferencesDirty.value || isVisualPreferencesDirty.value,
);

const toggleBookmakerEnabled = (bookmaker: string) => {
  const exists = enabledBookmakers.value.includes(bookmaker);
  if (exists) {
    if (enabledBookmakers.value.length === 1) {
      alert("At least one bookmaker must remain enabled.");
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

const saveBetPreferences = async () => {
  if (isSavingBetPreferences.value) return;
  if (!enabledBookmakers.value.length) {
    alert("At least one bookmaker must be enabled.");
    return;
  }
  if (!defaultBookmaker.value || !enabledBookmakers.value.includes(defaultBookmaker.value)) {
    alert("Default bookmaker must be one of your enabled bookmakers.");
    return;
  }
  if (!defaultBetType.value.trim()) {
    alert("Default bet type is required.");
    return;
  }
  if (!Number.isFinite(Number(defaultStake.value)) || Number(defaultStake.value) <= 0) {
    alert("Default stake must be a positive number.");
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
    alert(error?.response?.data?.error || "Failed to save bet preferences.");
  } finally {
    isSavingBetPreferences.value = false;
  }
};

const startEditingDisplayName = () => {
  editingDisplayName.value = true;
  displayNameInput.value = authStore.user?.name || "";
};

const cancelEditingDisplayName = () => {
  editingDisplayName.value = false;
  displayNameInput.value = authStore.user?.name || "";
};

const saveDisplayName = async () => {
  if (isSavingDisplayName.value) return;
  const nextName = displayNameInput.value.trim();
  if (nextName.length < 2) {
    alert("Name must be at least 2 characters long.");
    return;
  }

  try {
    isSavingDisplayName.value = true;
    await authStore.updateProfile(nextName);
    editingDisplayName.value = false;
  } catch (error: any) {
    alert(error?.response?.data?.error || "Failed to update name.");
  } finally {
    isSavingDisplayName.value = false;
  }
};

const logout = async () => {
  await authStore.logout();
  router.push("/auth");
};
</script>

<template>
  <header class="bg-white px-4 py-4 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
    <div class="relative flex items-start justify-between gap-3">
      <div class="max-w-[760px] pr-24 xl:pr-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Bets Tracker</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The go-to site to track your betting Profit and Loss across all bookmakers.
        </p>
      </div>

      <div class="absolute right-0 top-0 shrink-0 xl:static">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          @click="toggleUserMenu"
        >
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white"
          >
            {{ String(authStore.user?.name || authStore.user?.email || "U").charAt(0).toUpperCase() }}
          </span>
          <span>{{ authStore.user?.name || "User" }}</span>
        </button>

        <div
          v-if="showUserMenu"
          class="absolute right-0 z-20 mt-2 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ authStore.user?.email }}
          </p>
          <p
            v-if="hasUnsavedChanges"
            class="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
          >
            You have unsaved changes. If you close this menu without saving, they will be lost.
          </p>

          <div class="mt-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Display Name</p>

            <div v-if="editingDisplayName" class="mt-1 flex items-center gap-2">
              <input
                v-model.trim="displayNameInput"
                type="text"
                minlength="2"
                class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                class="rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                :disabled="isSavingDisplayName"
                @click="saveDisplayName"
              >
                Save
              </button>
              <button
                type="button"
                class="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                :disabled="isSavingDisplayName"
                @click="cancelEditingDisplayName"
              >
                Cancel
              </button>
            </div>

            <div v-else class="mt-1 flex items-center justify-between gap-2">
              <p class="text-sm text-gray-900 dark:text-gray-100">{{ authStore.user?.name }}</p>
              <button
                type="button"
                class="text-xs font-medium text-blue-600 hover:text-blue-700"
                @click="startEditingDisplayName"
              >
                Edit
              </button>
            </div>
          </div>

          <div class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-gray-500 dark:text-gray-400">Visual Preference</p>
              <button
                type="button"
                class="text-xs font-medium text-blue-600 hover:text-blue-700"
                @click="showVisualPreferences = !showVisualPreferences"
              >
                {{ showVisualPreferences ? "Hide" : "Configure" }}
              </button>
            </div>

            <div v-if="showVisualPreferences" class="mt-2">
              <label class="block text-xs text-gray-500 dark:text-gray-400">Theme</label>
              <select
                v-model="themeDraft"
                class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <button
                type="button"
                class="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                :disabled="isSavingVisualPreferences || !isVisualPreferencesDirty"
                @click="saveVisualPreferences"
              >
                {{ isSavingVisualPreferences ? "Saving..." : "Save Visual Preferences" }}
              </button>
            </div>
          </div>

          <div class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-gray-500 dark:text-gray-400">Bet Preferences</p>
              <button
                type="button"
                class="text-xs font-medium text-blue-600 hover:text-blue-700"
                @click="showBetPreferences = !showBetPreferences"
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
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        @change="toggleBookmakerEnabled(bookmaker)"
                      />
                      <span>{{ bookmaker }}</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400">Default Bookmaker</label>
                  <select
                    v-model="defaultBookmaker"
                    class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option v-for="bookmaker in enabledBookmakers" :key="bookmaker" :value="bookmaker">
                      {{ bookmaker }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400">Default Bet Type</label>
                  <select
                    v-model="defaultBetType"
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
                    class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <button
                  type="button"
                  class="w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  :disabled="isSavingBetPreferences || !isBetPreferencesDirty"
                  @click="saveBetPreferences"
                >
                  {{ isSavingBetPreferences ? "Saving..." : "Save Preferences" }}
                </button>
              </template>
            </div>
          </div>

          <button
            type="button"
            class="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            @click="logout"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
