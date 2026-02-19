<script setup lang="ts">
import { RouterView } from "vue-router";
import TopBanner from "@/components/TopBanner.vue";
import TabNav from "@/components/TabNav.vue";
</script>

<template>
  <div>
    <TopBanner />
    <TabNav />
    <RouterView />
  </div>
</template>
