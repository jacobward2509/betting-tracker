// Shared reactive state, fetchers, validation, and payload-building for the
// Add Bet and Edit Bet forms (AddBetModal.vue / EditBetModal.vue). Both
// modals used to carry ~90% identical <script setup> blocks — this
// composable is the single source of truth for that shared behavior so a
// bet-type rule change (or bug fix) only ever needs to be made once. Each
// modal keeps only what's genuinely different: Add's "Add another?" repeat
// flow and user-default prefill vs. Edit's hydrate-from-existing-bet flow
// and title condensation.
import { computed, ref, watch, type Ref } from "vue";
import api from "@/lib/api";
import {
  buildCombinedMarketOptions,
  parseCombinedMarketOption,
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

export type MarketSelectionOption = { id: number; label: string; sortOrder: number };
export type MarketLineOption = { id: number; value: string; sortOrder: number };
export type MarketOption = {
  id: number;
  name: string;
  category: "MATCH" | "PLAYER";
  requiresPlayer: boolean;
  selections: MarketSelectionOption[];
  lines: MarketLineOption[];
};
export type FixtureOption = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  league: string;
};
export type PlayerOption = { id: string; name: string; teamName: string; position?: string | null };

export const FALLBACK_BET_TYPES = [
  "Accumulator",
  "Bet Builder",
  "Cross Match Bet Builder",
  "Match",
  "Player Prop",
  "Superboost",
  "Other",
];

export const STAKE_TYPE_TO_API: Record<string, string> = {
  Normal: "NORMAL",
  Free: "FREE",
  "Normal + Free": "NORMAL_PLUS_FREE",
};

export const RESULT_TO_API: Record<string, string> = {
  Open: "OPEN",
  Win: "WON",
  Loss: "LOST",
  "Cashed Out": "VOID",
};

export const RESULT_FROM_API: Record<string, string> = {
  OPEN: "Open",
  WON: "Win",
  LOST: "Loss",
  VOID: "Cashed Out",
};

// Add Bet only allows logging a bet up to 7 days in advance of today,
// matching the server-side cap enforced by GET /api/fixtures. Edit Bet is
// capped the same way for consistency.
export const MAX_BET_LOOKAHEAD_DAYS = 7;

// Multi-leg bet types (Accumulator / Cross Match Bet Builder) can draw legs
// from fixtures spanning several days (e.g. a Saturday + Sunday fixture in
// the same bet), so their fixture list is fetched as a window centered on
// the bet's Date field (+/- these many days) rather than that single day.
export const FIXTURE_RANGE_LOOKBACK_DAYS = 7;
export const FIXTURE_RANGE_LOOKAHEAD_DAYS = 7;

export type UseBetFormOptions = {
  /** Reactive odds display format ("decimal" | "fractional"), typically `computed(() => props.oddsFormat)`. */
  oddsFormat: Ref<OddsFormat | undefined>;
};

export const useBetForm = (options: UseBetFormOptions) => {
  const authStore = useAuthStore();
  const suggestionsStore = useSuggestionsStore();

  const getCurrentOddsFormat = (): OddsFormat => options.oddsFormat.value || "decimal";

  // --- Reference data -------------------------------------------------
  const bookmakers = ref<{ id: string; bookmakers: string }[]>([]);
  const betTypes = ref<{ id: number | string; betTypes: string }[]>([]);
  const markets = ref<MarketOption[]>([]);
  const playerMarkets = computed(() => markets.value.filter((m) => m.category === "PLAYER"));
  const matchMarkets = computed(() => markets.value.filter((m) => m.category === "MATCH"));

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
      FALLBACK_BET_TYPES.forEach((type, idx) => {
        if (!existing.has(type)) {
          merged.push({ id: `fallback-${idx}`, betTypes: type });
        }
      });
      betTypes.value = merged;
    } catch (error) {
      console.error("Failed to fetch bet types:", error);
      betTypes.value = FALLBACK_BET_TYPES.map((type, idx) => ({ id: `fallback-${idx}`, betTypes: type }));
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

  // --- Form fields ------------------------------------------------------
  const date = ref(new Date().toISOString().slice(0, 10));
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
  const stake = ref(5);

  const odds = ref(2);
  const oddsInput = ref("2");
  const oddsNumerator = ref(1);
  const oddsDenominator = ref(1);
  const isOddsBoost = ref(false);
  const oddsBoostPercent = ref<number | null>(null);
  const result = ref("Open");
  const cashOutValue = ref<number | null>(null);
  const normalStake = ref<number | null>(null);
  const freeStake = ref<number | null>(null);

  // True only while hydrateFromBet() is actively restoring an existing
  // bet's fields (Edit Bet). Reset-on-change watchers below check this so
  // hydration can set selectedFixtureId/selectedMarketId/etc. without those
  // same watchers immediately wiping out the values it just set. Always
  // false for Add Bet, which never calls hydrateFromBet.
  const isHydrating = ref(false);

  const syncOddsFields = () => {
    const currentOdds = Number(odds.value);
    oddsInput.value = formatOddsForDisplay(currentOdds, "decimal");

    const fractional = decimalToFractionalOdds(currentOdds);
    const [num, den] = fractional.split("/");
    oddsNumerator.value = Math.max(0, Number(num) || 0);
    oddsDenominator.value = Math.max(1, Number(den) || 1);
  };

  // --- Bet-type classification ------------------------------------------
  // Bet types that are backed by the structured Market catalog rather than
  // being their own standalone concept — "Player Prop" surfaces PLAYER
  // markets, "Match" surfaces MATCH markets, both sharing the same
  // Market/Selection/Line UI below.
  const isMarketBetType = computed(() => betType.value === "Player Prop" || betType.value === "Match");
  // Multi-leg bet types (Accumulator / Bet Builder / Cross Match Bet Builder)
  // are edited entirely via the shared BetLegsEditor component rather than
  // the single fixture/market/selection fields used for Match/Player Prop.
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

  const legs = ref<Record<string, any>[]>([]);
  const legsValid = ref(false);
  const legsEditorKey = ref(0);
  const initialLegsForEditor = ref<
    Array<{ fixtureId: string; marketId: number | string; selectionId: number | string; lineValue?: number | string | null; playerId?: string | null }>
  >([]);

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
  // Gates the Market field so it isn't shown before a fixture exists to
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

  // Multi-leg bet types (Accumulator / Cross Match Bet Builder) can draw legs
  // from fixtures spanning several days, so their fixture list is fetched as
  // a window centered on the bet's Date field rather than that single day,
  // via the from/to range form of GET /api/fixtures. The future edge is
  // still capped at maxBetDate, matching the API's own
  // MAX_FIXTURE_LOOKAHEAD_DAYS cap.
  const fetchFixturesAroundDate = async (centerDateValue: string) => {
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
    to.setUTCDate(to.getUTCDate() + FIXTURE_RANGE_LOOKAHEAD_DAYS);
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

  // --- Team/player suggestions (from suggestionsStore, based on the user's
  // own betting history) -------------------------------------------------
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

  // --- Odds parsing/validation, shared by both submit handlers ----------
  // Parses oddsInput/oddsNumerator/oddsDenominator (whichever the current
  // display format uses) into decimal odds, applying the odds-boost if
  // enabled. Returns an error message to alert() on failure, or the final
  // decimal odds ready to submit. Also writes the parsed base odds.value
  // back so syncOddsFields() stays consistent with what was just validated.
  const resolveFinalOdds = (): { error: string } | { finalOdds: number } => {
    const parsedOddsRaw =
      getCurrentOddsFormat() === "fractional"
        ? Number(oddsNumerator.value) / Number(oddsDenominator.value) + 1
        : parseOddsInput(oddsInput.value, getCurrentOddsFormat());
    const parsedOdds = parsedOddsRaw == null ? null : normalizeOddsPrecision(Number(parsedOddsRaw));

    if (
      getCurrentOddsFormat() === "fractional" &&
      (!Number.isInteger(Number(oddsNumerator.value)) ||
        !Number.isInteger(Number(oddsDenominator.value)) ||
        Number(oddsNumerator.value) < 0 ||
        Number(oddsDenominator.value) <= 0)
    ) {
      return { error: "Please enter valid fractional odds." };
    }

    if (parsedOdds == null || parsedOdds < 1) {
      return {
        error:
          getCurrentOddsFormat() === "fractional"
            ? "Please enter valid fractional odds."
            : "Please enter valid decimal odds (minimum 1).",
      };
    }
    odds.value = parsedOdds;

    if (isOddsBoost.value && (oddsBoostPercent.value == null || Number(oddsBoostPercent.value) <= 0)) {
      return { error: "Please enter a valid Odds Boost percentage." };
    }
    const finalOdds = isOddsBoost.value
      ? applyOddsBoost(odds.value, Number(oddsBoostPercent.value))
      : odds.value;
    if (finalOdds == null) {
      return { error: "Please enter valid odds." };
    }
    return { finalOdds };
  };

  // Validates every non-odds field required before submit. Returns an error
  // message on failure, or null when the form is valid. Shared by both
  // Add Bet and Edit Bet's submit handlers.
  const validateBetFields = (): string | null => {
    if (result.value === "Cashed Out" && (cashOutValue.value == null || cashOutValue.value < 0)) {
      return "Please enter a valid Cash Out value.";
    }
    const isNormalPlusFree = stakeType.value === "Normal + Free";
    if (isNormalPlusFree) {
      const normalStakeValue = Number(normalStake.value);
      const freeStakeValue = Number(freeStake.value);
      if (
        !Number.isFinite(normalStakeValue) ||
        !Number.isFinite(freeStakeValue) ||
        normalStakeValue < 0 ||
        freeStakeValue < 0
      ) {
        return "Normal Stake and Free Stake must be valid numbers.";
      }
    }
    if (!isMultiLegBetType.value && (!currentHomeTeam.value || !currentAwayTeam.value)) {
      return "A fixture (or Home/Away team) is required.";
    }
    if (isMultiLegBetType.value && !legsValid.value) {
      return `Please complete all legs for ${betType.value}.`;
    }
    if (isMarketBetType.value) {
      if (!selectedMarketId.value) {
        return `A market is required for ${betType.value}.`;
      }
      const market = selectedMarket.value;
      if (market?.requiresPlayer && !currentPlayerName.value) {
        return "Player is required for this market.";
      }
      if (market && market.selections.length && !isYesOnlyMarket.value && !selectedSelectionId.value) {
        return "A selection is required for this market.";
      }
      if (market && market.lines.length && !selectedLineValue.value) {
        return "A line is required for this market.";
      }
    }
    if (betType.value === "Other" && !otherBetType.value.trim()) {
      return "Bet Type is required for Other.";
    }
    return null;
  };

  // Builds the payload shape POST /api/bets and PUT /api/bets/:id both
  // expect, given already-validated finalOdds.
  const buildBetPayload = (finalOdds: number) => {
    const isNormalPlusFree = stakeType.value === "Normal + Free";
    const totalStake = isNormalPlusFree
      ? Number(normalStake.value || 0) + Number(freeStake.value || 0)
      : Number(stake.value);
    const isManualFixture = selectedFixtureId.value === "__manual__" || !selectedFixtureId.value;
    const generatedDescription = getGeneratedDescription();

    return {
      fixture:
        isMultiLegBetType.value ? betType.value : `${currentHomeTeam.value} vs ${currentAwayTeam.value}`,
      selection: generatedDescription,
      bookmaker: bookie.value,
      stakeType: STAKE_TYPE_TO_API[stakeType.value] || "NORMAL",
      normalStake: isNormalPlusFree ? Number(normalStake.value) : null,
      betType: betType.value,
      playerPropMarket: isMarketBetType.value ? selectedMarket.value?.name || null : null,
      stake: totalStake,
      odds: Number(finalOdds),
      oddsBoostPercent: isOddsBoost.value ? Number(oddsBoostPercent.value) : null,
      potentialReturn: totalStake * Number(finalOdds),
      result: RESULT_TO_API[result.value],
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
  };

  // Standard axios error -> alert() mapping shared by both submit handlers.
  const alertSubmitError = (err: any, fallbackMessage: string) => {
    if (err.response?.data?.errors) {
      err.response.data.errors.forEach((e: any) => alert(`${e.field}: ${e.message}`));
    } else if (err.code === "ERR_NETWORK") {
      alert("Cannot reach the API. Please check if the server is running.");
    } else {
      alert(err.message || fallbackMessage);
    }
  };

  // --- Shared reset-on-change watchers -----------------------------------
  // Each watcher below is guarded by isHydrating so Edit Bet's
  // hydrateFromBet() can set these same refs while restoring an existing
  // bet without the watcher immediately resetting them again. Add Bet never
  // sets isHydrating, so these always run unconditionally there.
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
    () => options.oddsFormat.value,
    () => {
      syncOddsFields();
    },
  );

  return {
    authStore,
    suggestionsStore,
    bookmakers,
    betTypes,
    markets,
    playerMarkets,
    matchMarkets,
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
    getCurrentOddsFormat,
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
    fetchFixturesForDate,
    fetchFixturesAroundDate,
    fetchFixturesForLegs,
    fetchPlayersForFixture,
    filteredHomeTeamSuggestions,
    filteredAwayTeamSuggestions,
    filteredPlayerSuggestions,
    currentHomeTeam,
    currentAwayTeam,
    currentPlayerName,
    getGeneratedDescription,
    resolveFinalOdds,
    validateBetFields,
    buildBetPayload,
    alertSubmitError,
  };
};


