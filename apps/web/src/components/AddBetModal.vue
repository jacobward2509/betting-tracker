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
  buildCombinedMarketOptions,
  filterPlayersForMarket,
  parseCombinedMarketOption,
  shouldCombineSelectionAndLine,
} from "@/utils/marketOptions";
import { groupFixturesByLeague } from "@/utils/fixtureGrouping";


import {
  applyOddsBoost,
  decimalToFractionalOdds,
  formatOddsForDisplay,
  normalizeOddsPrecision,
  parseOddsInput,
  type OddsFormat,
} from "@/utils/odds";
import { useAuthStore } from "@/stores/auth";
import { useSuggestionsStore } from "@/stores/suggestions";

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

const bookie = ref("");
const bookmakers = ref<{ id: string; bookmakers: string }[]>([]);
const betTypes = ref<{ id: number | string; betTypes: string }[]>([]);
const fallbackBetTypes = [
  "Accumulator",
  "Bet Builder",
  "Cross Match Bet Builder",
  "Match",
  "Player Prop",
  "Superboost",
  "Other",
];

const userDefaultBookmaker = ref("");
const userDefaultBetType = ref("Player Prop");
const userDefaultStake = ref(5);
const authStore = useAuthStore();
const suggestionsStore = useSuggestionsStore();

type MarketSelectionOption = { id: number; label: string; sortOrder: number };
type MarketLineOption = { id: number; value: string; sortOrder: number };
type MarketOption = {
  id: number;
  name: string;
  category: "MATCH" | "PLAYER";
  requiresPlayer: boolean;
  selections: MarketSelectionOption[];
  lines: MarketLineOption[];
};
type FixtureOption = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  league: string;
};
type PlayerOption = { id: string; name: string; teamName: string; position?: string | null };


const markets = ref<MarketOption[]>([]);
const playerMarkets = computed(() => markets.value.filter((m) => m.category === "PLAYER"));
const matchMarkets = computed(() => markets.value.filter((m) => m.category === "MATCH"));
// Bet types that are backed by the structured Market catalog rather than
// being their own standalone concept — "Player Prop" surfaces PLAYER
// markets, "Match" surfaces MATCH markets, both sharing the same
// Market/Selection/Line UI below.
const isMarketBetType = computed(() => betType.value === "Player Prop" || betType.value === "Match");
// Multi-leg bet types (Accumulator / Bet Builder / Cross Match Bet Builder)
// are edited entirely via the shared BetLegsEditor component below rather
// than the single fixture/market/selection fields used for Match/Player Prop.
const isMultiLegBetType = computed(
  () => betType.value === "Accumulator" || betType.value === "Bet Builder" || betType.value === "Cross Match Bet Builder",
);
// Of the three multi-leg bet types, only Accumulator and Cross Match Bet
// Builder can have legs spread across several different days (e.g. a
// Saturday + Sunday fixture in the same bet), so only those two need the
// wider multi-day fixture window below. Bet Builder is always a single
// fixture, so it only ever needs fixtures from the bet’s own Date field.
const isMultiDateBetType = computed(
  () => betType.value === "Accumulator" || betType.value === "Cross Match Bet Builder",
);
const legs = ref<Record<string, any>[]>([]);
const legsValid = ref(false);
const legsEditorKey = ref(0);


const currentMarketOptions = computed(() =>
  betType.value === "Match" ? matchMarkets.value : playerMarkets.value,
);
const selectedMarketId = ref<number | "">("");
const selectedMarket = computed(
  () => markets.value.find((m) => m.id === selectedMarketId.value) || null,
);
// Markets seeded with a single "Yes" selection (e.g. Anytime Goalscorer,
// Player to be Carded) don't need the user to pick anything — Yes is the
// only possible outcome, so the Selection field is hidden entirely and the
// selection is auto-applied (see the selectedMarketId watcher below).
const isYesOnlyMarket = computed(
  () =>
    selectedMarket.value?.selections.length === 1 &&
    selectedMarket.value?.selections[0]?.label === "Yes",
);
const selectedSelectionId = ref<number | "">("");
const selectedLineValue = ref<string>("");
// UX-only combined "Selection + Line" dropdown (e.g. "Over 0.5") for markets
// that have both — selectedSelectionId/selectedLineValue above remain the
// actual source of truth submitted to the API; this just keeps them in
// sync when the combined control is used instead of two separate ones.
const combinedSelectionLine = ref<string>("");
const combinedSelectionLineOptions = computed(() =>
  selectedMarket.value ? buildCombinedMarketOptions(selectedMarket.value) : [],
);
watch(combinedSelectionLine, (value) => {
  const parsed = value ? parseCombinedMarketOption(value) : null;
  selectedSelectionId.value = parsed?.selectionId ?? "";
  selectedLineValue.value = parsed?.lineValue ?? "";
});


const fixtures = ref<FixtureOption[]>([]);
const fixturesLoading = ref(false);
const selectedFixtureId = ref<string>("");

// Fixtures grouped into <optgroup> sections by league priority — see
// groupFixturesByLeague in @/utils/fixtureGrouping for ordering details.
const fixturesByLeague = computed(() => groupFixturesByLeague(fixtures.value));

// True once a fixture has actually been chosen — either a listed fixture or
// the manual "Other / not listed" entry with both team names filled in.
// Gates the Market field below so it isn't shown before a fixture exists to
// scope the market to.
const hasFixtureSelected = computed(() => {
  if (!selectedFixtureId.value) return false;
  if (selectedFixtureId.value === "__manual__") {
    return Boolean(homeTeam.value.trim() && awayTeam.value.trim());
  }
  return true;
});


const fixturePlayers = ref<{ homeTeam: string; awayTeam: string; players: PlayerOption[] }>({
  homeTeam: "",
  awayTeam: "",
  players: [],
});
const playersLoading = ref(false);
const selectedPlayerId = ref<string>("");
const manualPlayerName = ref("");

const fetchBookmakers = async () => {
  try {
    const res = await api.get("/api/bookmakers");
    bookmakers.value = res.data;
  } catch (error) {
    console.error("Failed to fetch bookmakers:", error);
  }
};

const fetchBetTypes = async () => {
  try {
    const res = await api.get("/api/bet-types");
    const fromApi = Array.isArray(res.data) ? res.data : [];
    const existing = new Set(fromApi.map((item: { betTypes: string }) => item.betTypes));
    const merged = [...fromApi];
    fallbackBetTypes.forEach((type, idx) => {
      if (!existing.has(type)) {
        merged.push({ id: `fallback-${idx}`, betTypes: type });
      }
    });
    betTypes.value = merged;
  } catch (error) {
    console.error("Failed to fetch bet types:", error);
    betTypes.value = fallbackBetTypes.map((type, idx) => ({ id: `fallback-${idx}`, betTypes: type }));
  }
};

const fetchMarkets = async () => {
  try {
    const res = await api.get("/api/markets");
    markets.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error("Failed to fetch markets:", error);
  }
};

const fetchFixturesForDate = async (dateValue: string) => {
  if (!dateValue) {
    fixtures.value = [];
    return;
  }
  fixturesLoading.value = true;
  try {
    const res = await api.get("/api/fixtures", { params: { date: dateValue } });
    fixtures.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error("Failed to fetch fixtures:", error);
    fixtures.value = [];
  } finally {
    fixturesLoading.value = false;
  }
};

// Multi-leg bet types (Accumulator / Cross Match Bet Builder) can draw legs
// from fixtures spanning several days (e.g. a Saturday + Sunday fixture in
// the same bet), so their fixture list is fetched as a window centered on
// the bet's Date field (+/- 7 days) rather than that single day, via the
// from/to range form of GET /api/fixtures. The future edge is still capped
// at maxBetDate, matching the API's own MAX_FIXTURE_LOOKAHEAD_DAYS cap.
const FIXTURE_RANGE_LOOKBACK_DAYS = 7;
const fetchFixturesForRangeAround = async (centerDateValue: string) => {
  if (!centerDateValue) {
    fixtures.value = [];
    return;
  }
  const center = new Date(`${centerDateValue}T00:00:00Z`);
  if (!Number.isFinite(center.getTime())) {
    fixtures.value = [];
    return;
  }
  const from = new Date(center);
  from.setUTCDate(from.getUTCDate() - FIXTURE_RANGE_LOOKBACK_DAYS);
  const to = new Date(center);
  to.setUTCDate(to.getUTCDate() + FIXTURE_RANGE_LOOKBACK_DAYS);
  const maxFuture = new Date(`${maxBetDate.value}T00:00:00Z`);
  const cappedTo = to.getTime() > maxFuture.getTime() ? maxFuture : to;

  fixturesLoading.value = true;
  try {
    const res = await api.get("/api/fixtures", {
      params: { from: from.toISOString().slice(0, 10), to: cappedTo.toISOString().slice(0, 10) },
    });
    fixtures.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error("Failed to fetch fixtures:", error);
    fixtures.value = [];
  } finally {
    fixturesLoading.value = false;
  }
};

const fetchFixturesForLegs = async (dateValue: string) =>
  isMultiDateBetType.value ? fetchFixturesForRangeAround(dateValue) : fetchFixturesForDate(dateValue);

const fetchPlayersForFixture = async (fixtureId: string) => {
  if (!fixtureId || fixtureId === "__manual__") {
    fixturePlayers.value = { homeTeam: "", awayTeam: "", players: [] };
    return;
  }
  playersLoading.value = true;
  try {
    const res = await api.get(`/api/fixtures/${fixtureId}/players`);
    fixturePlayers.value = {
      homeTeam: res.data?.homeTeam || "",
      awayTeam: res.data?.awayTeam || "",
      players: Array.isArray(res.data?.players) ? res.data.players : [],
    };
  } catch (error) {
    console.error("Failed to fetch players for fixture:", error);
    fixturePlayers.value = { homeTeam: "", awayTeam: "", players: [] };
  } finally {
    playersLoading.value = false;
  }
};

const buildFilteredTeamSuggestions = (term: string) => {
  const normalized = String(term || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return [];
  return suggestionsStore.teams
    .filter((team) =>
      team
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(normalized),
    )
    .slice(0, 12);
};

const filteredHomeTeamSuggestions = computed(() => buildFilteredTeamSuggestions(homeTeam.value));
const filteredAwayTeamSuggestions = computed(() => buildFilteredTeamSuggestions(awayTeam.value));
const filteredPlayerSuggestions = computed(() => {
  const normalized = String(manualPlayerName.value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return suggestionsStore.players
    .filter((name) => {
      const normalizedName = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return tokens.every((token) => normalizedName.includes(token));
    })
    .slice(0, 12);
});

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

const date = ref(new Date().toISOString().substr(0, 10));
// Add Bet only allows logging a bet up to 7 days in advance of today,
// matching the server-side cap enforced by GET /api/fixtures.
const MAX_BET_LOOKAHEAD_DAYS = 7;
const maxBetDate = computed(() => {
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + MAX_BET_LOOKAHEAD_DAYS);
  return max.toISOString().substr(0, 10);
});
const result = ref("Open");
const fixture = ref("");
const stakeType = ref("Normal");
const betType = ref("Player Prop");
const homeTeam = ref("");
const awayTeam = ref("");
const otherBetType = ref("");
const stake = ref(5);
const odds = ref(2);
const oddsInput = ref("2");
const oddsNumerator = ref(1);
const oddsDenominator = ref(1);
const isOddsBoost = ref(false);
const oddsBoostPercent = ref<number | null>(null);
const cashOutValue = ref<number | null>(null);
const normalStake = ref<number | null>(null);
const freeStake = ref<number | null>(null);
const showAddAnotherPrompt = ref(false);
const pendingAddAnotherRepeat = ref(false);

const getCurrentOddsFormat = (): OddsFormat => props.oddsFormat || "decimal";

const syncOddsFields = () => {
  const currentOdds = Number(odds.value);
  oddsInput.value = formatOddsForDisplay(currentOdds, "decimal");

  const fractional = decimalToFractionalOdds(currentOdds);
  const [num, den] = fractional.split("/");
  oddsNumerator.value = Math.max(0, Number(num) || 0);
  oddsDenominator.value = Math.max(1, Number(den) || 1);
};

const resetForm = (options?: { keepFixture?: boolean; keepBetType?: boolean }) => {
  const keepFixture = Boolean(options?.keepFixture);
  const keepBetType = Boolean(options?.keepBetType);
  const preservedFixtureId = selectedFixtureId.value;
  const preservedHomeTeam = homeTeam.value.trim();
  const preservedAwayTeam = awayTeam.value.trim();
  const preservedBetType = betType.value;

  fixture.value = "";
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

const stakeTypeMapping: Record<string, string> = {
  Normal: "NORMAL",
  Free: "FREE",
  "Normal + Free": "NORMAL_PLUS_FREE",
};

const resultMapping: Record<string, string> = {
  Open: "OPEN",
  Win: "WON",
  Loss: "LOST",
  "Cashed Out": "VOID",
};

const halfStepMarkets = new Set([
  "Shots Over",
  "Shots Under",
  "SOT Over",
  "SOT Under",
  "Fouls Committed Over",
  "Fouls Won Over",
  "Tackles Over",
]);

const requiresHalfStepLine = (market: string) => halfStepMarkets.has(String(market || ""));

// The currently-selected fixture's team names, whether picked from the
// dropdown or entered manually via "Other / not listed".
const currentHomeTeam = computed(() =>
  selectedFixtureId.value && selectedFixtureId.value !== "__manual__"
    ? fixtures.value.find((f) => f.id === selectedFixtureId.value)?.homeTeam || ""
    : homeTeam.value.trim(),
);
const currentAwayTeam = computed(() =>
  selectedFixtureId.value && selectedFixtureId.value !== "__manual__"
    ? fixtures.value.find((f) => f.id === selectedFixtureId.value)?.awayTeam || ""
    : awayTeam.value.trim(),
);

const currentPlayerName = computed(() => {
  if (selectedPlayerId.value === "__manual__") return manualPlayerName.value.trim();
  return fixturePlayers.value.players.find((p) => p.id === selectedPlayerId.value)?.name || "";
});

const getGeneratedDescription = () => {
  if (isMultiLegBetType.value) return betType.value; // server derives the real summary from `legs`
  if (betType.value === "Superboost") return "Superboost";
  if (betType.value === "Other") return otherBetType.value.trim();

  const market = selectedMarket.value;
  const selectionLabel = isYesOnlyMarket.value
    ? ""
    : market?.selections.find((s) => s.id === selectedSelectionId.value)?.label || "";
  const line = selectedLineValue.value ? String(selectedLineValue.value) : "";
  const playerName = market?.requiresPlayer ? currentPlayerName.value : "";
  return [playerName, market?.name, selectionLabel, line].filter(Boolean).join(" ");
};



const submitBet = async () => {
  try {
    const parsedOddsRaw =
      getCurrentOddsFormat() === "fractional"
        ? Number(oddsNumerator.value) / Number(oddsDenominator.value) + 1
        : parseOddsInput(oddsInput.value, getCurrentOddsFormat());
    const parsedOdds =
      parsedOddsRaw == null ? null : normalizeOddsPrecision(Number(parsedOddsRaw));

    if (
      getCurrentOddsFormat() === "fractional" &&
      (!Number.isInteger(Number(oddsNumerator.value)) ||
        !Number.isInteger(Number(oddsDenominator.value)) ||
        Number(oddsNumerator.value) < 0 ||
        Number(oddsDenominator.value) <= 0)
    ) {
      alert("Please enter valid fractional odds.");
      return;
    }

    if (parsedOdds == null || parsedOdds < 1) {
      alert(
        getCurrentOddsFormat() === "fractional"
          ? "Please enter valid fractional odds."
          : "Please enter valid decimal odds (minimum 1).",
      );
      return;
    }
    odds.value = parsedOdds;

    if (isOddsBoost.value && (oddsBoostPercent.value == null || Number(oddsBoostPercent.value) <= 0)) {
      alert("Please enter a valid Odds Boost percentage.");
      return;
    }
    const finalOdds = isOddsBoost.value
      ? applyOddsBoost(odds.value, Number(oddsBoostPercent.value))
      : odds.value;
    if (finalOdds == null) {
      alert("Please enter valid odds.");
      return;
    }

    if (result.value === "Cashed Out" && (cashOutValue.value == null || cashOutValue.value < 0)) {
      alert("Please enter a valid Cash Out value.");
      return;
    }
    const isNormalPlusFree = stakeType.value === "Normal + Free";
    const totalStake = isNormalPlusFree
      ? Number(normalStake.value || 0) + Number(freeStake.value || 0)
      : Number(stake.value);

    if (isNormalPlusFree) {
      const normalStakeValue = Number(normalStake.value);
      const freeStakeValue = Number(freeStake.value);
      if (
        !Number.isFinite(normalStakeValue) ||
        !Number.isFinite(freeStakeValue) ||
        normalStakeValue < 0 ||
        freeStakeValue < 0
      ) {
        alert("Normal Stake and Free Stake must be valid numbers.");
        return;
      }
    }
    if (!isMultiLegBetType.value && (!currentHomeTeam.value || !currentAwayTeam.value)) {
      alert("A fixture (or Home/Away team) is required.");
      return;
    }
    if (isMultiLegBetType.value && !legsValid.value) {
      alert(`Please complete all legs for ${betType.value}.`);
      return;
    }
    if (isMarketBetType.value) {
      if (!selectedMarketId.value) {
        alert(`A market is required for ${betType.value}.`);
        return;
      }
      const market = selectedMarket.value;
      if (market?.requiresPlayer && !currentPlayerName.value) {
        alert("Player is required for this market.");
        return;
      }
      if (market && market.selections.length && !isYesOnlyMarket.value && !selectedSelectionId.value) {
        alert("A selection is required for this market.");
        return;
      }
      if (market && market.lines.length && !selectedLineValue.value) {
        alert("A line is required for this market.");
        return;
      }
    }
    if (betType.value === "Other" && !otherBetType.value.trim()) {
      alert("Bet Type is required for Other.");
      return;
    }

    const generatedDescription = getGeneratedDescription();
    const isManualFixture = selectedFixtureId.value === "__manual__" || !selectedFixtureId.value;

    const payload = {
      fixture:
        isMultiLegBetType.value ? betType.value : `${currentHomeTeam.value} vs ${currentAwayTeam.value}`,
      selection: generatedDescription,
      bookmaker: bookie.value,
      stakeType: stakeTypeMapping[stakeType.value] || "NORMAL",
      normalStake: isNormalPlusFree ? Number(normalStake.value) : null,
      betType: betType.value,
      playerPropMarket: isMarketBetType.value ? selectedMarket.value?.name || null : null,
      stake: totalStake,
      odds: Number(finalOdds),
      oddsBoostPercent: isOddsBoost.value ? Number(oddsBoostPercent.value) : null,
      potentialReturn: totalStake * Number(finalOdds),
      result: resultMapping[result.value],
      cashOutValue: result.value === "Cashed Out" ? Number(cashOutValue.value) : null,
      placedAt: new Date(date.value).toISOString(),
      fixtureId: !isMultiLegBetType.value && !isManualFixture ? selectedFixtureId.value : null,
      marketId: isMarketBetType.value ? selectedMarketId.value || null : null,
      selectionId: isMarketBetType.value ? selectedSelectionId.value || null : null,
      lineValue:
        isMarketBetType.value && selectedLineValue.value ? Number(selectedLineValue.value) : null,
      playerId:
        isMarketBetType.value && selectedPlayerId.value && selectedPlayerId.value !== "__manual__"
          ? selectedPlayerId.value
          : null,
      legs: isMultiLegBetType.value ? legs.value : undefined,
    };


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
    if (err.response?.data?.errors) {
      err.response.data.errors.forEach((e: any) => alert(`${e.field}: ${e.message}`));
    } else if (err.code === "ERR_NETWORK") {
      alert("Cannot reach the API. Please check if the server is running.");
    } else {
      alert(err.message || "Unknown error occurred");
    }
  }
};

watch(result, (value) => {
  if (value !== "Cashed Out") cashOutValue.value = null;
});

watch(stakeType, (value) => {
  if (value !== "Normal + Free") {
    normalStake.value = null;
    freeStake.value = null;
  }
});

watch(date, (value) => {
  selectedFixtureId.value = "";
  fetchFixturesForLegs(value);
});

watch(selectedFixtureId, (value) => {
  selectedPlayerId.value = "";
  manualPlayerName.value = "";
  if (value && value !== "__manual__") {
    homeTeam.value = "";
    awayTeam.value = "";
    fetchPlayersForFixture(value);
  } else {
    fixturePlayers.value = { homeTeam: "", awayTeam: "", players: [] };
  }
});

watch(selectedMarketId, () => {
  selectedLineValue.value = "";
  selectedPlayerId.value = "";
  manualPlayerName.value = "";
  combinedSelectionLine.value = "";
  // "Yes"-only markets (e.g. Anytime Goalscorer) have exactly one possible
  // selection, so it's auto-applied rather than asking the user to pick it.
  if (isYesOnlyMarket.value && selectedMarket.value) {
    selectedSelectionId.value = selectedMarket.value.selections[0].id;
  } else {
    selectedSelectionId.value = "";
  }

});

watch(betType, (value) => {
  if (value !== "Player Prop" && value !== "Match") {
    selectedMarketId.value = "";
    selectedSelectionId.value = "";
    selectedLineValue.value = "";
    combinedSelectionLine.value = "";
    selectedPlayerId.value = "";
    manualPlayerName.value = "";
  }
  if (isMultiLegBetType.value) {
    homeTeam.value = "";
    awayTeam.value = "";
    selectedFixtureId.value = "";
  }

  if (value !== "Other") {
    otherBetType.value = "";
  }
});

// Accumulator/Cross Match Bet Builder need a multi-day fixture window while
// every other bet type (including Bet Builder) needs only the single
// Date-field day — refetch whenever a bet-type change crosses that boundary
// in either direction.
watch(isMultiDateBetType, () => {
  fetchFixturesForLegs(date.value);
});



watch(
  () => props.oddsFormat,
  () => {
    syncOddsFields();
  },
);

syncOddsFields();
</script>
