<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import UserMenuDisplayName from "@/components/UserMenuDisplayName.vue";
import UserMenuVisualPreferences from "@/components/UserMenuVisualPreferences.vue";
import UserMenuBetPreferences from "@/components/UserMenuBetPreferences.vue";

const authStore = useAuthStore();
const router = useRouter();

const showUserMenu = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);
const userMenuToggleRef = ref<HTMLElement | null>(null);
const displayNameRef = ref<InstanceType<typeof UserMenuDisplayName> | null>(null);
const visualPreferencesRef = ref<InstanceType<typeof UserMenuVisualPreferences> | null>(null);
const betPreferencesRef = ref<InstanceType<typeof UserMenuBetPreferences> | null>(null);

const toggleUserMenu = async () => {
  showUserMenu.value = !showUserMenu.value;
  if (showUserMenu.value) {
    // The dropdown (and the child components below) is behind v-if, so it
    // doesn't exist in the DOM — and displayNameRef/betPreferencesRef/
    // visualPreferencesRef are still null — until Vue flushes this state
    // change. Without awaiting nextTick() here, the optional-chained calls
    // below are silent no-ops on the very click that opens the menu, so the
    // panels only ever show their components' hardcoded initial ref()
    // values instead of the user's actual saved preferences.
    await nextTick();
    displayNameRef.value?.reset();
    betPreferencesRef.value?.loadBetPreferences();
    visualPreferencesRef.value?.sync();
  }
};

const closeUserMenu = () => {
  showUserMenu.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (!showUserMenu.value) return;
  const target = event.target as Node;
  if (userMenuRef.value?.contains(target)) return;
  if (userMenuToggleRef.value?.contains(target)) return;
  closeUserMenu();
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});

const hasUnsavedChanges = () =>
  Boolean(betPreferencesRef.value?.isDirty) || Boolean(visualPreferencesRef.value?.isDirty);

const logout = async () => {
  await authStore.logout();
  router.push("/sign-in");
};
</script>

<template>
  <header
    class="bg-white px-4 py-4 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800"
    data-test-id="top-banner"
  >
    <div class="relative flex items-start justify-between gap-3">
      <div class="max-w-[760px] pr-24 xl:pr-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Bets Tracker</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The go-to site to track your betting Profit and Loss across all bookmakers.
        </p>
      </div>

      <div class="absolute right-0 top-0 shrink-0 xl:static">
        <button
          ref="userMenuToggleRef"
          type="button"
          data-test-id="user-menu-toggle-button"
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
          ref="userMenuRef"
          data-test-id="user-menu-dropdown"
          class="absolute right-0 z-20 mt-2 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ authStore.user?.email }}
          </p>
          <p
            v-if="hasUnsavedChanges()"
            class="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
          >
            You have unsaved changes. If you close this menu without saving, they will be lost.
          </p>

          <div class="mt-3">
            <UserMenuDisplayName ref="displayNameRef" />
          </div>

          <UserMenuVisualPreferences ref="visualPreferencesRef" />

          <UserMenuBetPreferences ref="betPreferencesRef" />

          <button
            type="button"
            data-test-id="user-menu-sign-out-button"
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
