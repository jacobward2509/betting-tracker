<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();

const editingDisplayName = ref(false);
const displayNameInput = ref("");
const isSavingDisplayName = ref(false);
const displayNameError = ref("");

const reset = () => {
  editingDisplayName.value = false;
  displayNameInput.value = authStore.user?.name || "";
  displayNameError.value = "";
};

reset();

const startEditingDisplayName = () => {
  editingDisplayName.value = true;
  displayNameInput.value = authStore.user?.name || "";
  displayNameError.value = "";
};

const cancelEditingDisplayName = () => {
  editingDisplayName.value = false;
  displayNameInput.value = authStore.user?.name || "";
  displayNameError.value = "";
};

const saveDisplayName = async () => {
  if (isSavingDisplayName.value) return;
  const nextName = displayNameInput.value.trim();
  if (nextName.length < 2) {
    displayNameError.value = "Name must be at least 2 characters long.";
    return;
  }

  try {
    isSavingDisplayName.value = true;
    await authStore.updateProfile(nextName);
    editingDisplayName.value = false;
    displayNameError.value = "";
  } catch (error: any) {
    displayNameError.value = error?.response?.data?.error || "Failed to update name.";
  } finally {
    isSavingDisplayName.value = false;
  }
};

defineExpose({ reset });
</script>


<template>
  <div>
    <p class="text-xs text-gray-500 dark:text-gray-400">Display Name</p>

    <div v-if="editingDisplayName" class="mt-1 flex items-center gap-2">
      <input
        v-model.trim="displayNameInput"
        type="text"
        minlength="2"
        data-test-id="user-menu-display-name-input"
        :class="[
          'block w-full rounded border px-2 py-1.5 text-sm dark:bg-gray-800 dark:text-gray-100',
          displayNameError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700',
        ]"
        :aria-invalid="Boolean(displayNameError)"
        @input="displayNameError = ''"
      />
      <button
        type="button"
        data-test-id="user-menu-save-display-name-button"
        class="rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
        :disabled="isSavingDisplayName"
        @click="saveDisplayName"
      >
        Save
      </button>
      <button
        type="button"
        data-test-id="user-menu-cancel-display-name-button"
        class="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        :disabled="isSavingDisplayName"
        @click="cancelEditingDisplayName"
      >
        Cancel
      </button>
    </div>
    <p
      v-if="editingDisplayName && displayNameError"
      class="mt-1 text-xs text-red-600"
      data-test-id="user-menu-display-name-error"
    >
      {{ displayNameError }}
    </p>


    <div v-else class="mt-1 flex items-center justify-between gap-2">
      <p data-test-id="user-menu-display-name" class="text-sm text-gray-900 dark:text-gray-100">
        {{ authStore.user?.name }}
      </p>
      <button
        type="button"
        data-test-id="user-menu-edit-display-name-button"
        class="text-xs font-medium text-blue-600 hover:text-blue-700"
        @click="startEditingDisplayName"
      >
        Edit
      </button>
    </div>
  </div>
</template>
