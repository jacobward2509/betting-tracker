<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();

const mode = ref<"login" | "signup">("login");
const name = ref("");
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref("");
const configureNow = ref(false);
const signupBookmakers = ref([
  "Bet365",
  "Betfair",
  "BetUK",
  "Ladbrokes",
  "PaddyPower",
  "SkyBet",
  "WilliamHill",
]);
const enabledBookmakers = ref<string[]>([...signupBookmakers.value]);
const defaultBookmaker = ref(signupBookmakers.value[0] || "");
const defaultBetType = ref("Player Prop");
const defaultStake = ref(5);
const signupBetTypes = ["Accumulator", "Bet Builder", "Player Prop", "Superboost", "FT Result", "Other"];

const canConfigureSignup = computed(() => mode.value === "signup" && configureNow.value);

const toggleSignupBookmaker = (bookmaker: string) => {
  const exists = enabledBookmakers.value.includes(bookmaker);
  if (exists) {
    if (enabledBookmakers.value.length === 1) return;
    enabledBookmakers.value = enabledBookmakers.value.filter((value) => value !== bookmaker);
    if (!enabledBookmakers.value.includes(defaultBookmaker.value)) {
      defaultBookmaker.value = enabledBookmakers.value[0] || "";
    }
    return;
  }
  enabledBookmakers.value = [...enabledBookmakers.value, bookmaker];
};

const submit = async () => {
  if (isSubmitting.value) return;

  errorMessage.value = "";
  isSubmitting.value = true;
  try {
    if (mode.value === "signup") {
      if (canConfigureSignup.value) {
        if (!enabledBookmakers.value.length) {
          errorMessage.value = "Please keep at least one bookmaker enabled.";
          return;
        }
        if (!enabledBookmakers.value.includes(defaultBookmaker.value)) {
          errorMessage.value = "Default bookmaker must be one of your enabled bookmakers.";
          return;
        }
        if (!Number.isFinite(Number(defaultStake.value)) || Number(defaultStake.value) <= 0) {
          errorMessage.value = "Default stake must be a positive number.";
          return;
        }
      }
      await authStore.signup(
        name.value,
        email.value,
        password.value,
        canConfigureSignup.value
          ? {
              enabledBookmakers: enabledBookmakers.value,
              defaultBookmaker: defaultBookmaker.value,
              defaultBetType: defaultBetType.value,
              defaultStake: Number(defaultStake.value),
            }
          : undefined,
      );
    } else {
      await authStore.login(email.value, password.value);
    }
    await router.push("/");
  } catch (error: any) {
    errorMessage.value =
      error?.response?.data?.error || error?.message || "Authentication failed. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
    <div class="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {{ mode === "login" ? "Sign In" : "Create Account" }}
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ mode === "login" ? "Access your betting tracker." : "Start tracking your bets." }}
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'signup'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
          <input
            v-model.trim="name"
            type="text"
            required
            minlength="2"
            autocomplete="name"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div v-if="mode === 'signup'" class="rounded border border-gray-200 p-3 dark:border-gray-700">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-200">Betting Preferences (Optional)</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Configure defaults now, or skip and use platform defaults.
              </p>
            </div>
            <button
              type="button"
              class="text-xs font-medium text-blue-600 hover:text-blue-700"
              @click="configureNow = !configureNow"
            >
              {{ configureNow ? "Hide" : "Configure" }}
            </button>
          </div>

          <div v-if="canConfigureSignup" class="mt-3 space-y-3">
            <div>
              <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Enabled Bookmakers</p>
              <div class="grid grid-cols-2 gap-1.5">
                <label
                  v-for="bookmaker in signupBookmakers"
                  :key="bookmaker"
                  class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200"
                >
                  <input
                    type="checkbox"
                    :checked="enabledBookmakers.includes(bookmaker)"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    @change="toggleSignupBookmaker(bookmaker)"
                  />
                  <span>{{ bookmaker }}</span>
                </label>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
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
                  <option v-for="betType in signupBetTypes" :key="betType" :value="betType">
                    {{ betType }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400">Default Stake (£)</label>
              <input
                v-model.number="defaultStake"
                type="number"
                min="0.01"
                step="0.01"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            You can change these at any time from the user menu after signing in.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
          <input
            v-model.trim="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
          <div class="relative mt-1">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="8"
              autocomplete="current-password"
              class="block w-full rounded border border-gray-300 px-3 py-2 pr-10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="!showPassword"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="h-4 w-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z"
                />
                <circle cx="12" cy="12" r="3.25" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="h-4 w-4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10.58 10.58A3.25 3.25 0 0 0 12 15.25a3.25 3.25 0 0 0 3.68-4.67"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6.7 6.7C4.4 8.32 2.95 10.76 2.25 12c.93 1.86 4.2 7.5 9.75 7.5 1.95 0 3.65-.7 5.06-1.7"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M14.78 4.9A9.9 9.9 0 0 0 12 4.5c-6 0-9.75 7.5-9.75 7.5"
                />
              </svg>
            </button>
          </div>
          <p v-if="mode === 'signup'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Minimum 8 characters.
          </p>
        </div>

        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {{ isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account" }}
        </button>
      </form>

      <button
        type="button"
        class="mt-4 text-sm text-blue-600 hover:text-blue-700"
        @click="mode = mode === 'login' ? 'signup' : 'login'"
      >
        {{
          mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"
        }}
      </button>
    </div>
  </div>
</template>
