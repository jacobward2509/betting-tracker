<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<template>
  <div v-if="show && bet" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
    <div class="flex min-h-full items-start justify-center p-4 md:items-center">
      <div
        class="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-gray-900"
      >
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3
            class="text-lg font-medium text-gray-800 dark:text-gray-100"
            :title="editTitleTooltip"
          >
            Edit Bet - {{ editTitleSelection }}
          </h3>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-xl dark:text-gray-400 dark:hover:text-gray-200">
            &times;
          </button>
        </div>

        <form @submit.prevent="submitEdit" class="p-4 space-y-4" data-test-id="edit-bet-form">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Date</label>
            <input
              v-model="date"
              type="date"
              :max="maxBetDate"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-date"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bet Type</label>
            <select
              v-model="betType"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-bet-type"
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
              data-test-id="edit-input-other-bet-type"
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
              :initial-legs="initialLegsForEditor"
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
              data-test-id="edit-input-fixture"
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
                list="edit-home-team-suggestions"
                class="block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="edit-input-home-team"
              />
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">vs</span>
              <input
                v-model="awayTeam"
                type="text"
                placeholder="Away Team"
                list="edit-away-team-suggestions"
                class="block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="edit-input-away-team"
              />
            </div>
            <datalist id="edit-home-team-suggestions">
              <option v-for="team in filteredHomeTeamSuggestions" :key="`edit-home-team-${team}`" :value="team" />
            </datalist>
            <datalist id="edit-away-team-suggestions">
              <option v-for="team in filteredAwayTeamSuggestions" :key="`edit-away-team-${team}`" :value="team" />
            </datalist>
          </div>

          <div v-if="isMarketBetType && hasFixtureSelected">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Market</label>
            <select
              v-model="selectedMarketId"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-player-prop-market"
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
              data-test-id="edit-input-player"
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
              list="edit-player-suggestions"
              placeholder="Player name"
              class="mt-2 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-player-manual"
            />
            <datalist id="edit-player-suggestions">
              <option v-for="name in filteredPlayerSuggestions" :key="`edit-player-${name}`" :value="name" />
            </datalist>
          </div>

          <div v-if="isMarketBetType && selectedMarket && selectedMarket.selections.length && !isYesOnlyMarket">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Selection</label>
            <select
              v-if="shouldCombineSelectionAndLine(selectedMarket)"
              v-model="combinedSelectionLine"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-player-prop-selection-line"
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
              data-test-id="edit-input-player-prop-selection"
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
                data-test-id="edit-input-bookmaker"
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
                data-test-id="edit-input-stake-type"
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
                v-model.number="stake"
                type="number"
                min="0"
                step="0.01"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="edit-input-stake"
              />
            </div>
            <template v-else>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Normal Stake (£)</label>
                <input
                  v-model.number="normalStake"
                  type="number"
                  min="0"
                  step="0.01"
                  class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Free Stake (£)</label>
                <input
                  v-model.number="freeStake"
                  type="number"
                  min="0"
                  step="0.01"
                  class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
            </template>

            <div :class="stakeType === 'Normal + Free' ? 'sm:col-span-2' : ''">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Odds</label>
              <div v-if="props.oddsFormat === 'fractional'" class="mt-1 flex items-center gap-2" data-test-id="edit-input-odds-fractional">
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
                v-model.trim="oddsInput"
                type="text"
                placeholder="e.g. 2.5"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
                data-test-id="edit-input-odds"
              />
            </div>
          </div>

          <div>
            <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <input
                v-model="isOddsBoost"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                data-test-id="edit-input-odds-boost-checkbox"
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
                data-test-id="edit-input-odds-boost-percent"
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
                data-test-id="edit-input-result"
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
                data-test-id="edit-input-cash-out-value"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 text-sm rounded border bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              :disabled="isSaving"
              data-test-id="cancel-edit-bet"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="isSaving"
              data-test-id="submit-edit-bet"
            >
              {{ isSaving ? "Saving..." : "Save Changes" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import api from "@/lib/api";
import BetLegsEditor from "@/components/BetLegsEditor.vue";
import { getCondensedSelection } from "@/utils/betSelection";
import {
  filterPlayersForMarket,
  shouldCombineSelectionAndLine,
} from "@/utils/marketOptions";
import { removeOddsBoost, type OddsFormat } from "@/utils/odds";
import { useBetForm, RESULT_FROM_API } from "@/composables/useBetForm";

const props = defineProps<{
  modelValue: boolean;
  bet: Record<string, any> | null;
  oddsFormat?: OddsFormat;
}>();

const emit = defineEmits(["update:modelValue", "bet-updated"]);

// Condenses the modal title for multi-leg bets (Accumulator / Bet Builder /
// Cross Match Bet Builder) the same way the Bets table does, so a bet with
// many legs doesn't blow out the header width -- the full text remains
// available via the title's native tooltip.
const editTitleCondensed = computed(() =>
  getCondensedSelection(props.bet?.betType, props.bet?.selection),
);
const editTitleSelection = computed(() => editTitleCondensed.value.display);
const editTitleTooltip = computed(() =>
  editTitleCondensed.value.isCondensed ? editTitleCondensed.value.full : undefined,
);

const show = ref(props.modelValue);
const isSaving = ref(false);

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
  isHydrating,
  syncOddsFields,
  isMarketBetType,
  isMultiLegBetType,
  isMultiDateBetType,
  legs,
  legsValid,
  legsEditorKey,
  initialLegsForEditor,
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
  fetchPlayersForFixture,
  filteredHomeTeamSuggestions,
  filteredAwayTeamSuggestions,
  filteredPlayerSuggestions,
  resolveFinalOdds,
  validateBetFields,
  buildBetPayload,
  alertSubmitError,
} = useBetForm({ oddsFormat: computed(() => props.oddsFormat) });

const resultReverseMapping = RESULT_FROM_API;

const hydrateFromBet = (bet: Record<string, any> | null) => {
  if (!bet) return;
  isHydrating.value = true;
  void nextTick().then(() => {
    isHydrating.value = false;
  });


  date.value = new Date(bet.placedAt).toISOString().slice(0, 10);
  bookie.value = String(bet.bookmaker || "");
  const stakeTypeValue = String(bet.stakeType || "").toUpperCase();
  stakeType.value =
    stakeTypeValue === "FREE"
      ? "Free"
      : stakeTypeValue === "NORMAL_PLUS_FREE"
        ? "Normal + Free"
        : "Normal";
  betType.value = String(bet.betType || "Player Prop");

  if (betType.value === "Other") {
    otherBetType.value = String(bet.selection || "").trim();
  } else {
    otherBetType.value = "";
  }

  stake.value = Number(bet.stake || 0);
  normalStake.value = bet.normalStake != null ? Number(bet.normalStake) : null;
  if (stakeType.value === "Normal + Free") {
    const total = Number(bet.stake || 0);
    const normal = Number(normalStake.value || 0);
    freeStake.value = Math.max(0, total - normal);
  } else {
    freeStake.value = null;
  }
  odds.value = Number(bet.odds || 1);
  const hydratedBoostPercent =
    bet.oddsBoostPercent != null ? Number(bet.oddsBoostPercent) : null;
  if (hydratedBoostPercent != null && hydratedBoostPercent > 0) {
    isOddsBoost.value = true;
    oddsBoostPercent.value = hydratedBoostPercent;
    const baseOdds = removeOddsBoost(Number(bet.odds || 1), hydratedBoostPercent);
    odds.value = baseOdds ?? Number(bet.odds || 1);
  } else {
    isOddsBoost.value = false;
    oddsBoostPercent.value = null;
  }
  syncOddsFields();
  result.value = resultReverseMapping[String(bet.result || "OPEN")] || "Open";
  cashOutValue.value = bet.cashOutValue != null ? Number(bet.cashOutValue) : null;

  if (isMultiLegBetType.value) {
    homeTeam.value = "";
    awayTeam.value = "";
    selectedFixtureId.value = "";
    selectedMarketId.value = "";
    selectedSelectionId.value = "";
    selectedLineValue.value = "";
    combinedSelectionLine.value = "";
    selectedPlayerId.value = "";
    manualPlayerName.value = "";

    const betLegs = Array.isArray(bet.legs) ? bet.legs : [];
    initialLegsForEditor.value = betLegs.map((leg: Record<string, any>) => ({
      fixtureId: String(leg.fixtureId || ""),
      marketId: leg.marketId,
      selectionId: leg.selectionId,
      lineValue: leg.lineValue,
      playerId: leg.playerId || null,
    }));
    void fetchMarkets();
    void fetchFixturesForLegs(date.value);
    legs.value = [];
    legsValid.value = false;
    // Remount BetLegsEditor so it re-reads the freshly-hydrated initialLegs.
    legsEditorKey.value += 1;
    return;
  }

  initialLegsForEditor.value = [];

  // Structured-catalog bets (fixtureId present) hydrate the Fixture/Market/
  // Selection/Player dropdowns directly from their ids. Legacy bets logged
  // before the structured catalog existed (no fixtureId) fall back to the
  // manual "Other / not listed" fixture entry, parsing team names from the
  // flat `fixture` string -- matching how Add Bet's own manual fallback
  // behaves. Their Market/Selection/Player fields are left unset since
  // there's no reliable way to map old free-text values back to catalog
  // ids; the user must pick them again to save with full structured
  // fidelity.
  if (bet.fixtureId) {
    selectedFixtureId.value = String(bet.fixtureId);
    homeTeam.value = "";
    awayTeam.value = "";
  } else {
    selectedFixtureId.value = "__manual__";
    const fixtureParts = String(bet.fixture || "").split(/\s+vs\s+/i);
    homeTeam.value = String(fixtureParts[0] || "").trim();
    awayTeam.value = String(fixtureParts[1] || "").trim();
  }

  if (isMarketBetType.value && bet.marketId) {
    selectedMarketId.value = Number(bet.marketId);
    selectedSelectionId.value = bet.selectionId != null ? Number(bet.selectionId) : "";
    selectedLineValue.value = bet.lineValue != null ? String(bet.lineValue) : "";
    combinedSelectionLine.value =
      selectedSelectionId.value !== "" && selectedLineValue.value
        ? `${selectedSelectionId.value}:${selectedLineValue.value}`
        : "";
    if (bet.playerId) {
      selectedPlayerId.value = String(bet.playerId);
      manualPlayerName.value = "";
    } else {
      selectedPlayerId.value = "";
      manualPlayerName.value = "";
    }
    // Populate the Player dropdown's options whenever there's a fixture to
    // fetch them for, not just when playerId happens to already be set --
    // watch(selectedFixtureId, ...) (which normally does this) is skipped
    // entirely during hydration (see isHydrating guard above it), so this is
    // now the only place that triggers the fetch for a hydrated bet.
    if (bet.fixtureId) void fetchPlayersForFixture(String(bet.fixtureId));
  } else {
    selectedMarketId.value = "";
    selectedSelectionId.value = "";
    selectedLineValue.value = "";
    combinedSelectionLine.value = "";
    selectedPlayerId.value = "";
    manualPlayerName.value = "";
  }

  void fetchMarkets();
  void fetchFixturesForLegs(date.value);
};

const closeModal = () => {
  emit("update:modelValue", false);
  show.value = false;
};

const submitEdit = async () => {
  if (!props.bet?.id || isSaving.value) return;

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

  try {
    isSaving.value = true;
    const payload = buildBetPayload(oddsResult.finalOdds);
    const res = await api.put(`/api/bets/${props.bet.id}`, payload);
    emit("bet-updated", res.data);
    closeModal();
  } catch (err: any) {
    alertSubmitError(err, "Failed to update bet.");
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  fetchBookmakers();
  fetchBetTypes();
  fetchMarkets();
  if (authStore.user?.id) {
    void suggestionsStore.preloadSuggestions(authStore.user.id);
  }
});

watch(
  () => props.modelValue,
  (val) => {
    show.value = val;
    if (val) hydrateFromBet(props.bet);
  },
);

watch(
  () => props.bet,
  (bet) => {
    if (show.value) hydrateFromBet(bet);
  },
  { deep: true },
);

// Edit-only addition on top of useBetForm's own shared betType watcher:
// when the user picks a *different* multi-leg bet type from the dropdown
// (rather than this firing as a side-effect of hydrateFromBet, which is
// skipped entirely while isHydrating), start that type's legs fresh instead
// of carrying over the previous type's legs.
watch(betType, (value) => {
  if (isHydrating.value) return;
  if (isMultiLegBetType.value) {
    initialLegsForEditor.value = [];
    legs.value = [];
    legsValid.value = false;
    legsEditorKey.value += 1;
    if (!markets.value.length) void fetchMarkets();
    // Always refetch (not just when `fixtures` is empty) since Bet Builder
    // needs only the single Date-field day while Accumulator/Cross Match Bet
    // Builder need the wider multi-day window — a bet-type change between
    // them means whatever's already cached in `fixtures` may be the wrong
    // shape for the newly-selected type.
    void fetchFixturesForLegs(date.value);
  }
});
</script>


