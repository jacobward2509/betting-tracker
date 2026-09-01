import { ref } from "vue";
import { defineStore } from "pinia";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme-preference";

const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
};

const readSystemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Single source of truth for the active theme. Both App.vue (which gates every
 * Tailwind `dark:` utility class in the app off this store's `theme` value) and
 * UserMenuVisualPreferences.vue (which lets the user change/save it) read from
 * and write to this store, so a saved preference is reflected everywhere
 * immediately instead of only after a page refresh.
 */
export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>("light");

  const applyThemeToDocument = (nextTheme: Theme) => {
    const isDark = nextTheme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  };

  const setTheme = (nextTheme: Theme) => {
    theme.value = nextTheme;
    applyThemeToDocument(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore storage write errors
    }
  };

  const init = () => {
    const initialTheme = readStoredTheme() ?? readSystemTheme();
    theme.value = initialTheme;
    applyThemeToDocument(initialTheme);
  };

  const sync = () => {
    theme.value = readStoredTheme() ?? readSystemTheme();
  };

  return { theme, init, sync, setTheme };
});
