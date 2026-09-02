<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<!--
  Shared multi-leg editor for Accumulator, Bet Builder and Cross Match Bet
  Builder. Every leg is sourced exclusively from the structured catalog
  (Fixture -> Market -> Selection -> Line -> Player) — there is deliberately
  no manual/free-text fallback here, matching the plan to phase manual entry
  out entirely.

  Per-type rules enforced live in the UI (the API re-validates these too):
    - Accumulator: >= 2 distinct fixtures, exactly 1 leg per fixture.
    - Bet Builder: exactly 1 fixture, >= 2 legs.
    - Cross Match Bet Builder: >= 2 distinct fixtures, any legs (>=1) per
      fixture.
-->
<template>
  <div class="space-y-3">
    <div v-if="betType === 'Bet Builder'">
      <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">Fixture</label>
      <select
        v-model="sharedFixtureId"
        class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        required
        data-test-id="input-bet-builder-fixture"
      >
        <option disabled value="">
          {{ fixturesLoading ? "Loading fixtures..." : "Select fixture" }}
        </option>
        <option v-for="f in fixtures" :key="f.id" :value="f.id">
          {{ fixtureOptionLabel(f) }}
        </option>
      </select>
    </div>


    <div
      v-for="(leg, index) in legs"
      :key="leg.key"
      class="rounded border border-gray-200 p-3 dark:border-gray-700"
      :data-test-id="`bet-leg-${index}`"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Leg {{ index + 1 }}</span>
        <button
          v-if="legs.length > minLegs"
          type="button"
          class="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
          :data-test-id="`remove-bet-leg-${index}`"
          @click="removeLeg(index)"
        >
          Remove
        </button>
      </div>

      <div v-if="betType !== 'Bet Builder'" class="mt-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">Fixture</label>
        <select
          v-model="leg.fixtureId"
          class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          required
          :data-test-id="`input-bet-leg-fixture-${index}`"
          @change="onFixtureChange(index)"
        >
          <option disabled value="">
            {{ fixturesLoading ? "Loading fixtures..." : "Select fixture" }}
          </option>
          <option
            v-for="f in availableFixturesForLeg(index)"
            :key="f.id"
            :value="f.id"
          >
            {{ fixtureOptionLabel(f) }}
          </option>

        </select>
        <p v-if="fixtureConflictMessage(index)" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ fixtureConflictMessage(index) }}
        </p>
      </div>

      <div class="mt-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">Market</label>
        <select
          v-model="leg.marketId"
          class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"

          required
          :disabled="!leg.fixtureId"
          :data-test-id="`input-bet-leg-market-${index}`"
          @change="onMarketChange(index)"
        >
          <option disabled value="">Select market</option>
          <option v-for="m in markets" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </div>

      <div v-if="marketFor(leg)?.requiresPlayer" class="mt-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">Player</label>
        <select
          v-model="leg.playerId"
          class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          required
          :data-test-id="`input-bet-leg-player-${index}`"
        >
          <option disabled value="">
            {{ leg.playersLoading ? "Loading players..." : "Select player" }}
          </option>
          <optgroup v-if="leg.players.homeTeam" :label="leg.players.homeTeam">
            <option
              v-for="p in leg.players.players.filter((pl: any) => pl.teamName === leg.players.homeTeam)"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }}
            </option>
          </optgroup>
          <optgroup v-if="leg.players.awayTeam" :label="leg.players.awayTeam">
            <option
              v-for="p in leg.players.players.filter((pl: any) => pl.teamName === leg.players.awayTeam)"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }}
            </option>
          </optgroup>
        </select>
      </div>

      <div v-if="marketFor(leg) && marketFor(leg)!.selections.length && !isYesOnlyMarket(leg)" class="mt-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">Selection</label>
        <select
          v-if="shouldCombineSelectionAndLine(marketFor(leg))"
          :value="combinedValueFor(leg)"
          class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          required
          :data-test-id="`input-bet-leg-selection-line-${index}`"
          @change="onCombinedSelectionLineChange(index, ($event.target as HTMLSelectElement).value)"
        >
          <option disabled value="">Select selection</option>
          <option v-for="o in combinedOptionsFor(leg)" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select
          v-else
          v-model="leg.selectionId"
          class="mt-1 block w-full border rounded px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          required
          :data-test-id="`input-bet-leg-selection-${index}`"
        >
          <option disabled value="">Select selection</option>
          <option v-for="s in marketFor(leg)!.selections" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>

    </div>

    <button
      v-if="canAddLeg"
      type="button"
      class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
      data-test-id="add-bet-leg"
      @click="addLeg"
    >
      + Add leg
    </button>

    <p v-if="ruleMessage" class="text-xs text-gray-500 dark:text-gray-400">{{ ruleMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import api from "@/lib/api";
import {
  buildCombinedMarketOptions,
  encodeCombinedMarketOption,
  parseCombinedMarketOption,
  shouldCombineSelectionAndLine,
} from "@/utils/marketOptions";


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
type PlayerOption = { id: string; name: string; teamName: string };

type LegState = {
  key: number;
  fixtureId: string;
  marketId: number | "";
  selectionId: number | "";
  lineValue: string;
  playerId: string;
  players: { homeTeam: string; awayTeam: string; players: PlayerOption[] };
  playersLoading: boolean;
};

const props = defineProps<{
  betType: "Accumulator" | "Bet Builder" | "Cross Match Bet Builder";
  fixtures: FixtureOption[];
  fixturesLoading: boolean;
  markets: MarketOption[];
  initialLegs?: Array<{
    fixtureId: string;
    marketId: number | string;
    selectionId: number | string;
    lineValue?: number | string | null;
    playerId?: string | null;
  }>;
}>();

const emit = defineEmits(["update:modelValue", "validity-changed"]);

let keySeq = 0;
const nextKey = () => {
  keySeq += 1;
  return keySeq;
};

const createLeg = (seed?: {
  fixtureId?: string;
  marketId?: number | string;
  selectionId?: number | string;
  lineValue?: number | string | null;
  playerId?: string | null;
}): LegState => ({
  key: nextKey(),
  fixtureId: seed?.fixtureId ? String(seed.fixtureId) : "",
  marketId: seed?.marketId ? Number(seed.marketId) : "",
  selectionId: seed?.selectionId ? Number(seed.selectionId) : "",
  lineValue: seed?.lineValue !== null && seed?.lineValue !== undefined ? String(seed.lineValue) : "",
  playerId: seed?.playerId ? String(seed.playerId) : "",
  players: { homeTeam: "", awayTeam: "", players: [] },
  playersLoading: false,
});


const minLegs = computed(() => 2);

// Bet Builder is inherently single-fixture, so the fixture is chosen once
// via `sharedFixtureId` (rendered above the leg list) rather than per leg —
// every leg's `fixtureId` mirrors this value, kept in sync by the watcher
// below.
const sharedFixtureId = ref<string>("");

const buildInitialLegs = (): LegState[] => {
  if (props.initialLegs && props.initialLegs.length) {
    if (props.betType === "Bet Builder") {
      sharedFixtureId.value = String(props.initialLegs[0].fixtureId || "");
    }
    return props.initialLegs.map((leg) => createLeg(leg));
  }
  return [createLeg(), createLeg()];
};

const legs = ref<LegState[]>(buildInitialLegs());

watch(sharedFixtureId, (fixtureId) => {
  if (props.betType !== "Bet Builder") return;
  legs.value.forEach((leg) => {
    leg.fixtureId = fixtureId;
    leg.playerId = "";
    void fetchPlayersForLeg(leg);
  });
});


const marketFor = (leg: LegState): MarketOption | null =>
  props.markets.find((m) => m.id === leg.marketId) || null;

const isYesOnlyMarket = (leg: LegState): boolean => {
  const market = marketFor(leg);
  return Boolean(market && market.selections.length === 1 && market.selections[0]?.label === "Yes");
};

// UX-only combined "Selection + Line" dropdown (e.g. "Over 0.5") for a leg
// whose market has both — leg.selectionId/leg.lineValue remain the actual
// source of truth read by isValid()/buildPayload(); these just translate to
// and from the combined option value.
const combinedOptionsFor = (leg: LegState) => {
  const market = marketFor(leg);
  return market ? buildCombinedMarketOptions(market) : [];
};

const combinedValueFor = (leg: LegState): string =>
  leg.selectionId && leg.lineValue ? encodeCombinedMarketOption(leg.selectionId, leg.lineValue) : "";

const onCombinedSelectionLineChange = (index: number, value: string) => {
  const leg = legs.value[index];
  const parsed = value ? parseCombinedMarketOption(value) : null;
  leg.selectionId = parsed?.selectionId ?? "";
  leg.lineValue = parsed?.lineValue ?? "";
};

// Accumulator: a fixture already used on another leg can't be picked again.
// Cross Match Bet Builder: no restriction beyond what the fixtures list
// itself offers. (Bet Builder no longer uses a per-leg fixture picker at
// all — see the shared `sharedFixtureId` control above.)
const availableFixturesForLeg = (index: number): FixtureOption[] => {
  if (props.betType === "Accumulator") {
    const usedElsewhere = new Set(
      legs.value.filter((_, i) => i !== index).map((l) => l.fixtureId).filter(Boolean),
    );
    return props.fixtures.filter((f) => !usedElsewhere.has(f.id));
  }
  return props.fixtures;
};

// Fixture options can now span multiple days (Accumulator / Cross Match Bet
// Builder legs are no longer confined to a single day's fixtures — see
// AddBetModal/EditBetModal's from/to range fetch), so the option label
// includes the kickoff date whenever the fixture list spans more than one
// calendar day, keeping the dropdown scannable without a date prefix on
// every option in the common single-day case.
const fixtureDates = computed(() => new Set(props.fixtures.map((f) => f.kickoffAt.slice(0, 10))));
const fixtureOptionLabel = (fixture: FixtureOption): string => {
  const matchup = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  if (fixtureDates.value.size <= 1) return matchup;
  const kickoff = new Date(fixture.kickoffAt);
  if (!Number.isFinite(kickoff.getTime())) return matchup;
  const dateLabel = kickoff.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${dateLabel} — ${matchup}`;
};


const fixtureConflictMessage = (index: number): string => {
  const leg = legs.value[index];
  if (!leg?.fixtureId) return "";
  if (props.betType === "Accumulator") {
    const duplicate = legs.value.some((l, i) => i !== index && l.fixtureId === leg.fixtureId);
    if (duplicate) {
      return "This fixture is already used on another leg — an Accumulator allows only one selection per fixture.";
    }
  }
  return "";
};

const canAddLeg = computed(() => {
  if (props.betType === "Accumulator") return legs.value.length < props.fixtures.length;
  return true;
});

const addLeg = () => {
  const leg = createLeg(props.betType === "Bet Builder" ? { fixtureId: sharedFixtureId.value } : undefined);
  legs.value.push(leg);
  if (leg.fixtureId) void fetchPlayersForLeg(leg);
};



const removeLeg = (index: number) => {
  legs.value.splice(index, 1);
};

const fetchPlayersForLeg = async (leg: LegState) => {
  if (!leg.fixtureId) {
    leg.players = { homeTeam: "", awayTeam: "", players: [] };
    return;
  }
  leg.playersLoading = true;
  try {
    const res = await api.get(`/api/fixtures/${leg.fixtureId}/players`);
    leg.players = {
      homeTeam: res.data?.homeTeam || "",
      awayTeam: res.data?.awayTeam || "",
      players: Array.isArray(res.data?.players) ? res.data.players : [],
    };
  } catch (error) {
    console.error("Failed to fetch players for fixture:", error);
    leg.players = { homeTeam: "", awayTeam: "", players: [] };
  } finally {
    leg.playersLoading = false;
  }
};

const onFixtureChange = (index: number) => {
  const leg = legs.value[index];
  leg.playerId = "";
  void fetchPlayersForLeg(leg);
};

const onMarketChange = (index: number) => {
  const leg = legs.value[index];
  leg.selectionId = "";

  leg.lineValue = "";
  leg.playerId = "";
  const market = marketFor(leg);
  if (market && market.selections.length === 1 && market.selections[0]?.label === "Yes") {
    leg.selectionId = market.selections[0].id;
  }
};

const ruleMessage = computed(() => {
  if (props.betType === "Accumulator") {
    return "Accumulator: pick at least 2 different fixtures, one market/selection per fixture.";
  }
  if (props.betType === "Bet Builder") {
    return "Bet Builder: pick one fixture above, then add at least 2 legs from it.";
  }
  return "Cross Match Bet Builder: pick at least 2 different fixtures — any number of legs per fixture.";
});

const isValid = computed(() => {
  if (legs.value.length < minLegs.value) return false;

  const distinctFixtures = new Set(legs.value.map((l) => l.fixtureId).filter(Boolean));
  if (props.betType === "Accumulator" && distinctFixtures.size < 2) return false;
  if (props.betType === "Bet Builder" && distinctFixtures.size !== 1) return false;
  if (props.betType === "Cross Match Bet Builder" && distinctFixtures.size < 2) return false;

  return legs.value.every((leg) => {
    if (!leg.fixtureId || !leg.marketId) return false;
    const market = marketFor(leg);
    if (!market) return false;
    if (market.requiresPlayer && !leg.playerId) return false;
    if (market.selections.length && !isYesOnlyMarket(leg) && !leg.selectionId) return false;
    if (market.lines.length && !leg.lineValue) return false;
    return true;
  });
});

const buildPayload = () =>
  legs.value.map((leg) => ({
    fixtureId: leg.fixtureId,
    marketId: leg.marketId || null,
    selectionId: leg.selectionId || null,
    lineValue: leg.lineValue || null,
    playerId: leg.playerId || null,
  }));

watch(
  legs,
  () => {
    emit("update:modelValue", buildPayload());
    emit("validity-changed", isValid.value);
  },
  { deep: true },
);

watch(
  () => props.betType,
  () => {
    sharedFixtureId.value = "";
    legs.value = [createLeg(), createLeg()];
  },
);

onMounted(() => {
  // Hydrate the player dropdown for any leg that already has a fixture (edit
  // mode) so its currently-selected player is selectable/visible.
  legs.value.filter((leg) => leg.fixtureId).forEach((leg) => void fetchPlayersForLeg(leg));

  emit("update:modelValue", buildPayload());
  emit("validity-changed", isValid.value);
});

defineExpose({
  isValid,
  reset: () => {
    sharedFixtureId.value = "";
    legs.value = buildInitialLegs();
  },
});

</script>


