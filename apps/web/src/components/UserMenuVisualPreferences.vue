<script setup lang="ts">
import { ref, computed } from "vue";

const THEME_STORAGE_KEY = "theme-preference";

const theme = ref<"light" | "dark">("light");
const themeDraft = ref<"light" | "dark">("light");
const showVisualPreferences = ref(false);
const isSavingVisualPreferences = ref(false);

const applyTheme = (nextTheme: "light" | "dark") => {
  const isDark = nextTheme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);
};

const sync = () => {
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
  themeDraft.value = theme.value;
};

sync();

const isDirty = computed(() => themeDraft.value !== theme.value);

const save = async () => {
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

defineExpose({ sync, isDirty });
</script>

<template>
  <div class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">Visual Preference</p>
      <button
        type="button"
        data-test-id="user-menu-visual-preferences-toggle"
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
        data-test-id="user-menu-theme-select"
        class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <button
        type="button"
        data-test-id="user-menu-save-visual-preferences-button"
        class="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        :disabled="isSavingVisualPreferences || !isDirty"
        @click="save"
      >
        {{ isSavingVisualPreferences ? "Saving..." : "Save Visual Preferences" }}
      </button>
    </div>
  </div>
</template>
