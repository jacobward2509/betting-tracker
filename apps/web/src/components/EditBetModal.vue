<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<template>
  <div v-if="show && bet" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
    <div class="flex min-h-full items-start justify-center p-4 md:items-center">
      <div
        class="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-gray-900"
      >
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-800 dark:text-gray-100">Edit Bet - {{ bet.selection }}</h3>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-xl dark:text-gray-400 dark:hover:text-gray-200">
            &times;
          </button>
        </div>

        <form @submit.prevent="submitEdit" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Date</label>
            <input
              v-model="date"
              type="date"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bet Type</label>
            <select
              v-model="betType"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option disabled value="">Select bet type</option>
              <option v-for="b in betTypes" :key="b.id" :value="b.betTypes">
                {{ b.betTypes }}
              </option>
            </select>
          </div>

          <div v-if="betType === 'FT Result'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">FT Result</label>
            <select
              v-model="ftResultOutcome"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              data-test-id="edit-input-ft-result-outcome"
            >
              <option>Home Win</option>
              <option>Draw</option>
              <option>Away Win</option>
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

          <div v-if="betType === 'Player Prop'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Player</label>
            <input
              v-model="player"
              type="text"
              list="edit-player-suggestions"
              class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
            <datalist id="edit-player-suggestions">
              <option v-for="name in filteredPlayerSuggestions" :key="`edit-player-${name}`" :value="name" />
            </datalist>
          </div>

          <div v-if="betType === 'Player Prop'" class="grid gap-3 sm:grid-cols-2">
            <div :class="requiresHalfStepLine(playerPropMarket) ? '' : 'sm:col-span-2'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Player Prop Market</label>
              <select
                v-model="playerPropMarket"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                :required="betType === 'Player Prop'"
              >
                <option disabled value="">Select market</option>
                <option
                  v-for="market in playerPropMarkets"
                  :key="market.id"
                  :value="market.markets"
                >
                  {{ market.markets }}
                </option>
              </select>
            </div>
            <div v-if="requiresHalfStepLine(playerPropMarket)">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Value</label>
              <div class="mt-1 flex items-center gap-2">
                <input
                  v-model.number="playerPropLineWhole"
                  type="number"
                  min="0"
                  step="1"
                  class="block w-20 border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <input
                  value=".5"
                  readonly
                  class="block w-16 border rounded px-3 py-2 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
          </div>

          <div v-if="betType !== 'Accumulator'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Fixture</label>
            <div class="mt-1 flex items-center gap-2">
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

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Bookmaker</label>
              <select
                v-model="bookie"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
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
              >
                <option disabled value="">Select stake type</option>
                <option>Normal</option>
                <option>Free</option>
              </select>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Stake (£)</label>
              <input
                v-model.number="stake"
                type="number"
                min="0"
                step="0.01"
                class="mt-1 block w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Odds</label>
              <div v-if="props.oddsFormat === 'fractional'" class="mt-1 flex items-center gap-2">
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
              />
            </div>
          </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 text-sm rounded border bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              :disabled="isSaving"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="isSaving"
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
import { computed, onMounted, ref, watch } from "vue";
import api from "@/lib/api";
import {
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
  bet: Record<string, any> | null;
  oddsFormat?: OddsFormat;
}>();

const emit = defineEmits(["update:modelValue", "bet-updated"]);

const show = ref(props.modelValue);
const isSaving = ref(false);
const bookmakers = ref<{ id: string; bookmakers: string }[]>([]);
const betTypes = ref<{ id: number | string; betTypes: string }[]>([]);
const playerPropMarkets = ref<{ id: number; markets: string }[]>([]);
const fallbackBetTypes = ["Accumulator", "Bet Builder", "Player Prop", "Superboost", "FT Result", "Other"];
const authStore = useAuthStore();
const suggestionsStore = useSuggestionsStore();

const date = ref(new Date().toISOString().slice(0, 10));
const fixture = ref("");
const bookie = ref("");
const stakeType = ref("Normal");
const betType = ref("Player Prop");
const ftResultOutcome = ref<"Home Win" | "Draw" | "Away Win">("Home Win");
const homeTeam = ref("");
const awayTeam = ref("");
const otherBetType = ref("");
const player = ref("");
const playerPropMarket = ref("");
const playerPropLineWhole = ref(0);
const stake = ref(0);
const odds = ref(1);
const oddsInput = ref("1");
const oddsNumerator = ref(1);
const oddsDenominator = ref(1);
const result = ref("Open");
const cashOutValue = ref<number | null>(null);

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

const parsePlayerPropSelection = (selection: string, market: string) => {
  const text = String(selection || "").trim();
  const normalizedMarket = String(market || "").trim();

  if (!text || !normalizedMarket) return { playerName: "", whole: 0 };

  const idx = text.toLowerCase().indexOf(normalizedMarket.toLowerCase());
  if (idx < 0) {
    // Fallback for imported legacy formats like:
    // "Sael Kumbedi O0.5 fouls won" / "Player U1.5 shots"
    const ouLineMatch = text.match(/^(.*?)\s+[OU]\s*(\d+(?:\.\d+)?)\s+(.+)$/i);
    if (ouLineMatch) {
      const playerName = ouLineMatch[1].trim();
      const lineValue = Number(ouLineMatch[2]);
      const whole = Number.isFinite(lineValue) ? Math.floor(lineValue) : 0;
      return { playerName, whole };
    }

    return { playerName: text, whole: 0 };
  }

  const playerName = text.slice(0, idx).trim();
  const suffix = text.slice(idx + normalizedMarket.length).trim();
  const match = suffix.match(/^(\d+)\.5$/);
  return { playerName, whole: match ? Number(match[1]) : 0 };
};

const getGeneratedDescription = () => {
  if (betType.value === "Accumulator") return "Accumulator";
  if (betType.value === "Bet Builder") return "Bet Builder";
  if (betType.value === "Superboost") return "Superboost";
  if (betType.value === "FT Result") {
    if (ftResultOutcome.value === "Draw") return "Draw";
    if (ftResultOutcome.value === "Home Win") return `${homeTeam.value.trim()} FT Result`;
    return `${awayTeam.value.trim()} FT Result`;
  }
  if (betType.value === "Other") return otherBetType.value.trim();

  const playerName = player.value.trim();
  const market = playerPropMarket.value.trim();
  const line = requiresHalfStepLine(market) ? `${Number(playerPropLineWhole.value)}.5` : "";
  return [playerName, market, line].filter(Boolean).join(" ");
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

const fetchPlayerPropMarkets = async () => {
  try {
    const res = await api.get("/api/player-prop-markets");
    playerPropMarkets.value = res.data;
  } catch (error) {
    console.error("Failed to fetch player prop markets:", error);
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
  const normalized = String(player.value || "")
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

  date.value = new Date(bet.placedAt).toISOString().slice(0, 10);
  fixture.value = String(bet.fixture || "");
  bookie.value = String(bet.bookmaker || "");
  stakeType.value = String(bet.stakeType || "").toUpperCase() === "FREE" ? "Free" : "Normal";
  betType.value = String(bet.betType || "Player Prop");
  playerPropMarket.value = String(bet.playerPropMarket || "");
  if (betType.value === "Player Prop") {
    const parsed = parsePlayerPropSelection(String(bet.selection || ""), playerPropMarket.value);
    player.value = parsed.playerName;
    playerPropLineWhole.value = parsed.whole;
  } else {
    player.value = "";
    playerPropLineWhole.value = 0;
  }
  if (betType.value !== "Accumulator") {
    const fixtureParts = String(bet.fixture || "").split(/\s+vs\s+/i);
    homeTeam.value = String(fixtureParts[0] || "").trim();
    awayTeam.value = String(fixtureParts[1] || "").trim();
  } else {
    homeTeam.value = "";
    awayTeam.value = "";
  }
  if (betType.value === "FT Result") {
    const selection = String(bet.selection || "").trim();
    if (/^draw$/i.test(selection)) {
      ftResultOutcome.value = "Draw";
    } else if (
      homeTeam.value &&
      selection.localeCompare(`${homeTeam.value} FT Result`, undefined, { sensitivity: "accent" }) === 0
    ) {
      ftResultOutcome.value = "Home Win";
    } else if (
      awayTeam.value &&
      selection.localeCompare(`${awayTeam.value} FT Result`, undefined, { sensitivity: "accent" }) === 0
    ) {
      ftResultOutcome.value = "Away Win";
    } else {
      ftResultOutcome.value = "Home Win";
    }
  } else {
    ftResultOutcome.value = "Home Win";
  }
  if (betType.value === "Other") {
    otherBetType.value = String(bet.selection || "").trim();
  } else {
    otherBetType.value = "";
  }
  stake.value = Number(bet.stake || 0);
  odds.value = Number(bet.odds || 1);
  syncOddsFields();
  result.value = resultReverseMapping[String(bet.result || "OPEN")] || "Open";
  cashOutValue.value = bet.cashOutValue != null ? Number(bet.cashOutValue) : null;
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

  if (result.value === "Cashed Out" && (cashOutValue.value == null || cashOutValue.value < 0)) {
    alert("Please enter a valid Cash Out value.");
    return;
  }
  if (betType.value !== "Accumulator" && (!homeTeam.value.trim() || !awayTeam.value.trim())) {
    alert("Home Team and Away Team are required.");
    return;
  }
  if (betType.value === "Player Prop" && !player.value.trim()) {
    alert("Player is required for Player Prop.");
    return;
  }
  if (betType.value === "Other" && !otherBetType.value.trim()) {
    alert("Bet Type is required for Other.");
    return;
  }

  const generatedDescription = getGeneratedDescription();

  try {
    isSaving.value = true;

    const payload = {
      fixture:
        betType.value === "Accumulator"
          ? "Accumulator"
          : `${homeTeam.value.trim()} vs ${awayTeam.value.trim()}`,
      selection: generatedDescription,
      bookmaker: bookie.value,
      stakeType: stakeTypeMapping[stakeType.value] || "NORMAL",
      betType: betType.value,
      playerPropMarket: betType.value === "Player Prop" ? playerPropMarket.value : null,
      stake: Number(stake.value),
      odds: Number(odds.value),
      potentialReturn: Number(stake.value) * Number(odds.value),
      result: resultMapping[result.value],
      placedAt: new Date(date.value).toISOString(),
      cashOutValue: result.value === "Cashed Out" ? Number(cashOutValue.value) : null,
    };

    const res = await api.put(`/api/bets/${props.bet.id}`, payload);
    emit("bet-updated", res.data);
    closeModal();
  } catch (err: any) {
    if (err.code === "ERR_NETWORK") {
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
  fetchPlayerPropMarkets();
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

watch(betType, (value) => {
  if (value !== "Player Prop") {
    player.value = "";
    playerPropMarket.value = "";
    playerPropLineWhole.value = 0;
  }
  if (value !== "FT Result") {
    ftResultOutcome.value = "Home Win";
  }
  if (value === "Accumulator") {
    homeTeam.value = "";
    awayTeam.value = "";
  }
  if (value !== "Other") {
    otherBetType.value = "";
  }
});

watch(
  () => props.oddsFormat,
  () => {
    syncOddsFields();
  },
);
</script>
