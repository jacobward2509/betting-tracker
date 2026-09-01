<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import { useThemeStore } from "@/stores/theme";

const themeStore = useThemeStore();

onMounted(() => {
  themeStore.init();
});
</script>

<template>
  <div
    :class="{ dark: themeStore.theme === 'dark' }"
    class="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100"
  >
    <RouterView />
  </div>
</template>
