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
  removeOddsBoost,
  type OddsFormat,
} from "@/utils/odds";
import { useAuthStore } from "@/stores/auth";
import { useSuggestionsStore } from "@/stores/suggestions";

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
const bookmakers = ref<{ id: string; bookmakers: string }[]>([]);
const betTypes = ref<{ id: number | string; betTypes: string }[]>([]);

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
type FixtureOption = { id: string; homeTeam: string; awayTeam: string; kickoffAt: string; league: string };
type PlayerOption = { id: string; name: string; teamName: string; position?: string | null };

const markets = ref<MarketOption[]>([]);
const playerMarkets = computed(() => markets.value.filter((m) => m.category === "PLAYER"));
const matchMarkets = computed(() => markets.value.filter((m) => m.category === "MATCH"));
// Bet types that are backed by the structured Market catalog rather than
// being their own standalone concept — "Player Prop" surfaces PLAYER
// markets, "Match" surfaces MATCH markets, both sharing the same
// Market/Selection/Line UI below.
const isMarketBetType = computed(() => betType.value === "Player Prop" || betType.value === "Match");
const legs = ref<Record<string, any>[]>([]);
const legsValid = ref(false);
const legsEditorKey = ref(0);
const initialLegsForEditor = ref<
  Array<{ fixtureId: string; marketId: number | string; selectionId: number | string; lineValue?: number | string | null; playerId?: string | null }>
>([]);
const isMultiLegBetType = computed(
  () => betType.value === "Accumulator" || betType.value === "Bet Builder" || betType.value === "Cross Match Bet Builder",
);
// Of the three multi-leg bet types, only Accumulator and Cross Match Bet
// Builder can have legs spread across several different days (e.g. a
// Saturday + Sunday fixture in the same bet), so only those two need the
// wider multi-day fixture window below. Bet Builder is always a single
// fixture, so it only ever needs fixtures from the bet's own Date field.
const isMultiDateBetType = computed(
  () => betType.value === "Accumulator" || betType.value === "Cross Match Bet Builder",
);
const isHydrating = ref(false);

const selectedMarketId = ref<number | "">("");
const selectedMarket = computed(
  () => markets.value.find((m) => m.id === selectedMarketId.value) || null,
);
const currentMarketOptions = computed(() =>
  betType.value === "Match" ? matchMarkets.value : playerMarkets.value,
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

const fetchMarkets = async () => {
  try {
    const res = await api.get("/api/markets");
    markets.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error("Failed to fetch markets:", error);
  }
};

// Bet Builder is always a single fixture, so its legs only ever need
// fixtures from the bet's own Date field — no multi-day window.
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

// Fixture dropdown for legs spans a wide date window (not just "today")
// since an Accumulator/Cross Match Bet Builder being edited may reference
// fixtures from any recently-placed date. Uses the from/to range form of
// GET /api/fixtures, centered on the bet's own Date field so that legs
// originally spread across a weekend (e.g. Sat + Sun kickoffs) remain
// selectable when re-editing. Bet Builder never uses this — see
// fetchFixturesForDate above.
const FIXTURE_RANGE_LOOKBACK_DAYS = 7;
const FIXTURE_RANGE_LOOKAHEAD_DAYS = 7;
const fetchFixturesAroundDate = async (dateValue: string) => {
  if (!dateValue) {
    fixtures.value = [];
    return;
  }
  const center = new Date(`${dateValue}T00:00:00Z`);
  if (!Number.isFinite(center.getTime())) {
    fixtures.value = [];
    return;
  }
  const from = new Date(center);
  from.setUTCDate(from.getUTCDate() - FIXTURE_RANGE_LOOKBACK_DAYS);
  const to = new Date(center);
  to.setUTCDate(to.getUTCDate() + FIXTURE_RANGE_LOOKAHEAD_DAYS);
  // Cap the future edge to the same 7-day-ahead limit GET /api/fixtures
  // enforces server-side (Add Bet never allows logging further ahead than
  // that, so a bet being edited can never legitimately need fixtures beyond
  // it either).
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
  isMultiDateBetType.value ? fetchFixturesAroundDate(dateValue) : fetchFixturesForDate(dateValue);

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

const fallbackBetTypes = [
  "Accumulator",
  "Bet Builder",
  "Cross Match Bet Builder",
  "Match",
  "Player Prop",
  "Superboost",
  "Other",
];

const authStore = useAuthStore();
const suggestionsStore = useSuggestionsStore();

const date = ref(new Date().toISOString().slice(0, 10));
// Edit Bet is capped at the same 7-day-ahead lookahead as Add Bet, matching
// the server-side cap enforced by GET /api/fixtures.
const MAX_BET_LOOKAHEAD_DAYS = 7;
const maxBetDate = computed(() => {
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + MAX_BET_LOOKAHEAD_DAYS);
  return max.toISOString().slice(0, 10);
});
const bookie = ref("");
const stakeType = ref("Normal");
const betType = ref("Player Prop");
const homeTeam = ref("");
const awayTeam = ref("");
const otherBetType = ref("");
const stake = ref(0);

const odds = ref(1);
const oddsInput = ref("1");
const oddsNumerator = ref(1);
const oddsDenominator = ref(1);
const isOddsBoost = ref(false);
const oddsBoostPercent = ref<number | null>(null);
const result = ref("Open");
const cashOutValue = ref<number | null>(null);
const normalStake = ref<number | null>(null);
const freeStake = ref<number | null>(null);

const getCurrentOddsFormat = (): OddsFormat => props.oddsFormat || "decimal";

const syncOddsFields = () => {
  const currentOdds = Number(odds.value);
  oddsInput.value = formatOddsForDisplay(currentOdds, "decimal");

  const fractional = decimalToFractionalOdds(currentOdds);
  const [num, den] = fractional.split("/");
  oddsNumerator.value = Math.max(0, Number(num) || 0);
  oddsDenominator.value = Math.max(1, Number(den) || 1);
};

const resultMapping: Record<string, string> = {
  Open: "OPEN",
  Win: "WON",
  Loss: "LOST",
  "Cashed Out": "VOID",
};

const resultReverseMapping: Record<string, string> = {
  OPEN: "Open",
  WON: "Win",
  LOST: "Loss",
  VOID: "Cashed Out",
};

const stakeTypeMapping: Record<string, string> = {
  Normal: "NORMAL",
  Free: "FREE",
  "Normal + Free": "NORMAL_PLUS_FREE",
};

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

  try {
    isSaving.value = true;

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
      placedAt: new Date(date.value).toISOString(),
      cashOutValue: result.value === "Cashed Out" ? Number(cashOutValue.value) : null,
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

    const res = await api.put(`/api/bets/${props.bet.id}`, payload);
    emit("bet-updated", res.data);
    closeModal();
  } catch (err: any) {
    if (err.response?.data?.errors) {
      err.response.data.errors.forEach((e: any) => alert(`${e.field}: ${e.message}`));
    } else if (err.code === "ERR_NETWORK") {
      alert("Cannot reach the API. Please check if the server is running.");
    } else {
      alert(err.message || "Failed to update bet.");
    }
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
  if (isHydrating.value) return;
  selectedFixtureId.value = "";
  fetchFixturesForLegs(value);
});

// Guarded by isHydrating the same way every other reset-on-change watcher in
// this file is (see watch(date, ...) / watch(betType, ...) below) -- without
// it, hydrateFromBet() setting selectedFixtureId/selectedMarketId to restore
// an existing bet's Fixture/Market selection would immediately have this
// watcher's reset logic fire straight after and wipe out the
// selectedPlayerId/selectedSelectionId/combinedSelectionLine values
// hydrateFromBet had *also* just set moments earlier in the same call --
// intermittently, since the outcome depended on watcher-queue timing versus
// the isHydrating flag's own nextTick() reset. That's what caused Player and
// Selection to sometimes come back blank on Edit even though the bet's data
// was fully intact.
watch(selectedFixtureId, (value) => {
  if (isHydrating.value) return;
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
  if (isHydrating.value) return;
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
  if (!isHydrating.value) {
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
  }

  if (!isHydrating.value && isMultiLegBetType.value) {
    // User picked a different multi-leg bet type from the dropdown (rather
    // than this firing as a side-effect of hydrateFromBet) — start that
    // type's legs fresh instead of carrying over the previous type's legs.
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
  if (value !== "Other") {
    otherBetType.value = "";
  }
});

// Accumulator/Cross Match Bet Builder need a multi-day fixture window while
// every other bet type (including Bet Builder) needs only the single
// Date-field day — refetch whenever a bet-type change crosses that boundary
// in either direction.
watch(isMultiDateBetType, () => {
  if (isHydrating.value) return;
  fetchFixturesForLegs(date.value);
});

watch(
  () => props.oddsFormat,
  () => {
    syncOddsFields();
  },
);
</script>

