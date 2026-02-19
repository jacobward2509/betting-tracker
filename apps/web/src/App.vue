<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";

const THEME_STORAGE_KEY = "theme-preference";
const theme = ref<"light" | "dark">("light");

const applyTheme = (nextTheme: "light" | "dark") => {
  const isDark = nextTheme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);
};

const saveThemePreference = (nextTheme: "light" | "dark") => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // ignore storage write errors
  }
};

const readThemePreference = (): "light" | "dark" | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
};

const setTheme = (nextTheme: "light" | "dark") => {
  theme.value = nextTheme;
  applyTheme(nextTheme);
  saveThemePreference(nextTheme);
};

onMounted(() => {
  const stored = readThemePreference();
  const initialTheme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(initialTheme);
});
</script>

<template>
  <div
    :class="{ dark: theme === 'dark' }"
    class="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100"
  >
    <RouterView />
  </div>
</template>
