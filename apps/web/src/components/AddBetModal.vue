<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
    <div class="flex min-h-full items-start justify-center p-4 md:items-center">
      <div
        class="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-gray-900"
      >
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-800 dark:text-gray-100">Add New Bet</h3>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-xl dark:text-gray-400 dark:hover:text-gray-200">
            &times;
          </button>
        </div>

        <form @submit.prevent="submitBet" class="p-4 space-y-4" data-test-id="add-bet-form">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Date</label>
            <input
              type="date"
              v-model="date"
              :max="maxBetDate"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-date"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bet Type</label>
            <select
              v-model="betType"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-bet-type"
            >
              <option disabled value="">Select bet type</option>
              <option v-for="b in betTypes" :key="b.id" :value="b.betTypes">
                {{ b.betTypes }}
              </option>
            </select>
          </div>

          <div v-if="betType === 'Other'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bet Type</label>
            <input
              v-model="otherBetType"
              type="text"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-other-bet-type"
            />
          </div>

          <div v-if="isMultiLegBetType">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Legs</label>
            <BetLegsEditor
              :key="legsEditorKey"
              class="mt-1"

              :bet-type="betType as 'Accumulator' | 'Bet Builder' | 'Cross Match Bet Builder'"
              :fixtures="fixtures"
              :fixtures-loading="fixturesLoading"
              :markets="markets"
              @update:model-value="legs = $event"
              @validity-changed="legsValid = $event"
            />
          </div>

          <div v-if="betType !== 'Accumulator' && !isMultiLegBetType">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Fixture</label>
            <select
              v-model="selectedFixtureId"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-fixture"
            >
              <option disabled value="">
                {{ fixturesLoading ? "Loading fixtures..." : "Select fixture" }}
              </option>
              <optgroup v-for="group in fixturesByLeague" :key="group.league" :label="group.label">
                <option v-for="f in group.fixtures" :key="f.id" :value="f.id">
                  {{ f.homeTeam }} vs {{ f.awayTeam }}
                </option>
              </optgroup>
              <option value="__manual__">Other / not listed</option>
            </select>

            <div v-if="selectedFixtureId === '__manual__'" class="mt-2 flex items-center gap-2">
              <input
                v-model="homeTeam"
                type="text"
                placeholder="Home Team"
                list="add-home-team-suggestions"
                class="block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-home-team"
              />
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">vs</span>
              <input
                v-model="awayTeam"
                type="text"
                placeholder="Away Team"
                list="add-away-team-suggestions"
                class="block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-away-team"
              />
            </div>
            <datalist id="add-home-team-suggestions">
              <option v-for="team in filteredHomeTeamSuggestions" :key="`add-home-team-${team}`" :value="team" />
            </datalist>
            <datalist id="add-away-team-suggestions">
              <option v-for="team in filteredAwayTeamSuggestions" :key="`add-away-team-${team}`" :value="team" />
            </datalist>
          </div>

          <div v-if="isMarketBetType && hasFixtureSelected">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Market</label>
            <select
              v-model="selectedMarketId"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-player-prop-market"
            >
              <option disabled value="">Select market</option>
              <option v-for="market in currentMarketOptions" :key="market.id" :value="market.id">
                {{ market.name }}
              </option>
            </select>
          </div>


          <div v-if="isMarketBetType && selectedMarket && selectedMarket.requiresPlayer">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Player</label>
            <select
              v-model="selectedPlayerId"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-player"
            >
              <option disabled value="">
                {{ playersLoading ? "Loading players..." : "Select player" }}
              </option>
              <optgroup v-if="fixturePlayers.homeTeam" :label="fixturePlayers.homeTeam">
                <option
                  v-for="p in filterPlayersForMarket(
                    fixturePlayers.players.filter((pl) => pl.teamName === fixturePlayers.homeTeam),
                    selectedMarket,
                  )"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}
                </option>
              </optgroup>
              <optgroup v-if="fixturePlayers.awayTeam" :label="fixturePlayers.awayTeam">
                <option
                  v-for="p in filterPlayersForMarket(
                    fixturePlayers.players.filter((pl) => pl.teamName === fixturePlayers.awayTeam),
                    selectedMarket,
                  )"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}
                </option>
              </optgroup>

              <option value="__manual__">Other / not listed</option>

            </select>

            <input
              v-if="selectedPlayerId === '__manual__'"
              v-model="manualPlayerName"
              type="text"
              list="add-player-suggestions"
              placeholder="Player name"
              class="mt-2 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-player-manual"
            />
            <datalist id="add-player-suggestions">
              <option v-for="name in filteredPlayerSuggestions" :key="`add-player-${name}`" :value="name" />
            </datalist>
          </div>

          <div v-if="isMarketBetType && selectedMarket && selectedMarket.selections.length && !isYesOnlyMarket">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Selection</label>
            <select
              v-if="shouldCombineSelectionAndLine(selectedMarket)"
              v-model="combinedSelectionLine"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-player-prop-selection-line"
            >
              <option disabled value="">Select selection</option>
              <option v-for="o in combinedSelectionLineOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
            <select
              v-else
              v-model="selectedSelectionId"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="input-player-prop-selection"
            >
              <option disabled value="">Select selection</option>
              <option v-for="s in selectedMarket.selections" :key="s.id" :value="s.id">
                {{ s.label }}
              </option>
            </select>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bookmaker</label>
              <select
                v-model="bookie"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-bookmaker"
              >
                <option disabled value="">Select bookie</option>

                <option v-for="b in bookmakers" :key="b.id" :value="b.bookmakers">
                  {{ b.bookmakers }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Stake Type</label>
              <select
                v-model="stakeType"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-stake-type"
              >
                <option disabled value="">Select stake type</option>
                <option>Normal</option>
                <option>Free</option>
                <option>Normal + Free</option>
              </select>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div v-if="stakeType !== 'Normal + Free'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Stake (£)</label>
              <input
                type="number"
                v-model.number="stake"
                min="0"
                step="0.01"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-stake"
              />
            </div>
            <template v-else>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Normal Stake (£)</label>
                <input
                  type="number"
                  v-model.number="normalStake"
                  min="0"
                  step="0.01"
                  class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Free Stake (£)</label>
                <input
                  type="number"
                  v-model.number="freeStake"
                  min="0"
                  step="0.01"
                  class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
            </template>

            <div :class="stakeType === 'Normal + Free' ? 'sm:col-span-2' : ''">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Odds</label>
              <div
                v-if="props.oddsFormat === 'fractional'"
                class="mt-1 flex items-center gap-2"
                data-test-id="input-odds-fractional"
              >
                <input
                  v-model.number="oddsNumerator"
                  type="number"
                  min="0"
                  step="1"
                  class="block w-20 border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">/</span>
                <input
                  v-model.number="oddsDenominator"
                  type="number"
                  min="1"
                  step="1"
                  class="block w-20 border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <input
                v-else
                type="text"
                v-model.trim="oddsInput"
                placeholder="e.g. 2.5"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-odds"
              />
            </div>
          </div>

          <div>
            <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <input
                v-model="isOddsBoost"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                data-test-id="input-odds-boost-checkbox"
              />
              Odds Boost?
            </label>
            <div v-if="isOddsBoost" class="mt-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Boost (%)</label>
              <input
                v-model.number="oddsBoostPercent"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 25"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-odds-boost-percent"
              />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div :class="result === 'Cashed Out' ? '' : 'sm:col-span-2'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Result</label>
              <select
                v-model="result"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-result"
              >
                <option>Open</option>
                <option>Win</option>
                <option>Loss</option>
                <option>Cashed Out</option>
              </select>
            </div>

            <div v-if="result === 'Cashed Out'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Cash Out Value (£)</label>
              <input
                v-model.number="cashOutValue"
                type="number"
                min="0"
                step="0.01"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="input-cash-out-value"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              @click="closeModal"
            class="px-4 py-2 text-sm rounded border bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              data-test-id="cancel-add-bet"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              data-test-id="submit-add-bet"
            >
              Add Bet
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showAddAnotherPrompt"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div class="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
        <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          Add another?
        </h4>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Bet added successfully. Would you like to add another bet on the same fixture?
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded border bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            @click="handleAddAnotherChoice(false)"
          >
            No
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            @click="handleAddAnotherChoice(true)"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/lib/api";
import BetLegsEditor from "@/components/BetLegsEditor.vue";
import {
  filterPlayersForMarket,
  shouldCombineSelectionAndLine,
} from "@/utils/marketOptions";
import { type OddsFormat } from "@/utils/odds";
import { useBetForm } from "@/composables/useBetForm";

const props = defineProps<{
  modelValue: boolean;
  oddsFormat?: OddsFormat;
}>();
const emit = defineEmits(["update:modelValue", "bet-added"]);

const show = ref(props.modelValue);
watch(
  () => props.modelValue,
  (val) => (show.value = val),
);

const userDefaultBookmaker = ref("");
const userDefaultBetType = ref("Player Prop");
const userDefaultStake = ref(5);

const {
  authStore,
  suggestionsStore,
  bookmakers,
  betTypes,
  markets,
  fetchBookmakers,
  fetchBetTypes,
  fetchMarkets,
  date,
  maxBetDate,
  bookie,
  stakeType,
  betType,
  homeTeam,
  awayTeam,
  otherBetType,
  stake,
  odds,
  oddsInput,
  oddsNumerator,
  oddsDenominator,
  isOddsBoost,
  oddsBoostPercent,
  result,
  cashOutValue,
  normalStake,
  freeStake,
  syncOddsFields,
  isMarketBetType,
  isMultiLegBetType,
  legs,
  legsValid,
  legsEditorKey,
  currentMarketOptions,
  selectedMarketId,
  selectedMarket,
  isYesOnlyMarket,
  selectedSelectionId,
  selectedLineValue,
  combinedSelectionLine,
  combinedSelectionLineOptions,
  fixtures,
  fixturesLoading,
  selectedFixtureId,
  fixturesByLeague,
  hasFixtureSelected,
  fixturePlayers,
  playersLoading,
  selectedPlayerId,
  manualPlayerName,
  fetchFixturesForLegs,
  filteredHomeTeamSuggestions,
  filteredAwayTeamSuggestions,
  filteredPlayerSuggestions,
  currentHomeTeam,
  currentAwayTeam,
  resolveFinalOdds,
  validateBetFields,
  buildBetPayload,
  alertSubmitError,
} = useBetForm({ oddsFormat: computed(() => props.oddsFormat) });

const showAddAnotherPrompt = ref(false);
const pendingAddAnotherRepeat = ref(false);


const fetchUserConfig = async () => {
  try {
    const res = await api.get("/api/user/config");
    const defaults = res.data?.defaults || {};
    userDefaultBookmaker.value = String(defaults.bookmaker || "");
    userDefaultBetType.value = String(defaults.betType || "Player Prop");
    const parsedStake = Number(defaults.stake);
    userDefaultStake.value = Number.isFinite(parsedStake) && parsedStake > 0 ? parsedStake : 5;
  } catch (error) {
    console.error("Failed to fetch user config:", error);
  }
};

const applyUserDefaults = () => {
  stakeType.value = "Normal";
  betType.value = userDefaultBetType.value || "Player Prop";
  stake.value = userDefaultStake.value;
  if (userDefaultBookmaker.value) {
    bookie.value = userDefaultBookmaker.value;
  }
};

const onUserConfigUpdated = async () => {
  await Promise.all([fetchBookmakers(), fetchUserConfig()]);
  applyUserDefaults();
};

onMounted(() => {
  fetchBookmakers();
  fetchBetTypes();
  fetchMarkets();
  fetchFixturesForLegs(date.value);
  if (authStore.user?.id) {
    void suggestionsStore.preloadSuggestions(authStore.user.id);
  }
  fetchUserConfig().then(() => {
    applyUserDefaults();
  });
  window.addEventListener("user-config-updated", onUserConfigUpdated);
});

onBeforeUnmount(() => {
  window.removeEventListener("user-config-updated", onUserConfigUpdated);
});

const resetForm = (formOptions?: { keepFixture?: boolean; keepBetType?: boolean }) => {
  const keepFixture = Boolean(formOptions?.keepFixture);
  const keepBetType = Boolean(formOptions?.keepBetType);
  const preservedFixtureId = selectedFixtureId.value;
  const preservedHomeTeam = homeTeam.value.trim();
  const preservedAwayTeam = awayTeam.value.trim();
  const preservedBetType = betType.value;

  bookie.value = userDefaultBookmaker.value || "";
  stakeType.value = "Normal";
  betType.value = keepBetType ? preservedBetType : userDefaultBetType.value || "Player Prop";
  const keepingFixture = keepFixture && !isMultiLegBetType.value;

  selectedFixtureId.value = keepingFixture ? preservedFixtureId : "";
  homeTeam.value = keepingFixture ? preservedHomeTeam : "";
  awayTeam.value = keepingFixture ? preservedAwayTeam : "";
  otherBetType.value = "";
  selectedMarketId.value = "";
  selectedSelectionId.value = "";
  selectedLineValue.value = "";
  combinedSelectionLine.value = "";
  selectedPlayerId.value = "";
  manualPlayerName.value = "";
  legs.value = [];
  legsValid.value = false;
  legsEditorKey.value += 1;
  cashOutValue.value = null;

  normalStake.value = null;
  freeStake.value = null;
  result.value = "Open";
  stake.value = userDefaultStake.value;
  odds.value = 2;
  isOddsBoost.value = false;
  oddsBoostPercent.value = null;
  syncOddsFields();
};

const closeModal = () => {
  showAddAnotherPrompt.value = false;
  pendingAddAnotherRepeat.value = false;
  show.value = false;
  emit("update:modelValue", false);
  resetForm();
};

const handleAddAnotherChoice = (repeat: boolean) => {
  showAddAnotherPrompt.value = false;
  if (repeat && pendingAddAnotherRepeat.value) {
    resetForm({ keepFixture: true, keepBetType: true });
    pendingAddAnotherRepeat.value = false;
    return;
  }
  pendingAddAnotherRepeat.value = false;
  closeModal();
};

const submitBet = async () => {
  try {
    const oddsResult = resolveFinalOdds();
    if ("error" in oddsResult) {
      alert(oddsResult.error);
      return;
    }

    const fieldError = validateBetFields();
    if (fieldError) {
      alert(fieldError);
      return;
    }

    const payload = buildBetPayload(oddsResult.finalOdds);
    const res = await api.post("/api/bets", payload);

    emit("bet-added", res.data); // send back created bet

    const hasFixture = Boolean(currentHomeTeam.value && currentAwayTeam.value);
    const canRepeatFixture = !isMultiLegBetType.value && hasFixture;

    if (canRepeatFixture) {
      pendingAddAnotherRepeat.value = true;
      showAddAnotherPrompt.value = true;
      return;
    }

    closeModal();
  } catch (err: any) {
    alertSubmitError(err, "Unknown error occurred");
  }
};

syncOddsFields();
</script>
