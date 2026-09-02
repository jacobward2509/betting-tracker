<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import AddBetModal from "@/components/AddBetModal.vue";
import EditBetModal from "@/components/EditBetModal.vue";
import BetsTableControls from "@/components/BetsTableControls.vue";
import { formatOddsForDisplay, type OddsFormat } from "@/utils/odds";
import { formatBookmakerLabel } from "@/utils/bookmaker";
import { getCondensedSelection } from "@/utils/betSelection";

import {
  SELECTED_SEASON_STORAGE_KEY,
  getCurrentSeasonKey,
  getSeasonKeyFromDate,
  getSeasonLabel,
} from "@/utils/season";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useSuggestionsStore } from "@/stores/suggestions";

const bets = ref([]);
const FILTERS_STORAGE_KEY = "bets-table-filters";
const TABLE_STATE_STORAGE_KEY = "bets-table-state";

type BetsFilters = {
  season: string;
  fixture: string;
  date: string;
  bookie: string;
  stakeType: string;
  result: string;
};

const defaultFilters = (): BetsFilters => ({
  season: getSeasonLabel(getCurrentSeasonKey()),
  fixture: "",
  date: "",
  bookie: "",
  stakeType: "",
  result: "",
});

const sanitizeFilters = (value: unknown): BetsFilters => {
  const source = (value || {}) as Partial<BetsFilters>;
  const seasonRaw = String(source.season || "").trim();
  const season = /^\d{4}-\d{4}$/.test(seasonRaw) ? getSeasonLabel(seasonRaw) : seasonRaw;
  return {
    season: season || getSeasonLabel(getCurrentSeasonKey()),
    fixture: String(source.fixture || ""),
    date: String(source.date || ""),
    bookie: String(source.bookie || ""),
    stakeType: String(source.stakeType || ""),
    result: String(source.result || ""),
  };
};

const loadSavedFilters = (): BetsFilters => {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) {
      const defaults = defaultFilters();
      const selectedSeason = localStorage.getItem(SELECTED_SEASON_STORAGE_KEY);
      if (selectedSeason) {
        defaults.season = String(selectedSeason);
      }
      return defaults;
    }
    return sanitizeFilters(JSON.parse(raw));
  } catch {
    return defaultFilters();
  }
};

const filters = ref<BetsFilters>(loadSavedFilters());

// Modal visibility
const showModal = ref(false);
const showEditModal = ref(false);
const showColumnsMenu = ref(false);
const showDeleteModal = ref(false);
const isApplyingBulkResult = ref(false);
const selectedBetIds = ref<string[]>([]);
const bulkResult = ref<"Open" | "Win" | "Loss" | "Cashed Out">("Open");
const bulkCashOutValue = ref<number | null>(null);
const editingBet = ref<Record<string, any> | null>(null);
const deletingBet = ref<Record<string, any> | null>(null);
const isDeleting = ref(false);
const visibleColumns = ref({
  date: true,
  fixture: true,
  bookie: true,
  description: true,
  stakeType: true,
  stake: true,
  odds: true,
  result: true,
  profitLoss: true,
});
const sortKey = ref<"date" | "stake" | "odds" | "result" | "profit" | null>(null);
const sortDirection = ref<"asc" | "desc">("asc");
const pageSize = ref(10);
const currentPage = ref(1);
const ODDS_FORMAT_STORAGE_KEY = "odds-format-preference";
const oddsFormat = ref<OddsFormat>("decimal");

try {
  const storedOddsFormat = localStorage.getItem(ODDS_FORMAT_STORAGE_KEY);
  if (storedOddsFormat === "decimal" || storedOddsFormat === "fractional") {
    oddsFormat.value = storedOddsFormat;
  }
} catch {
  // ignore localStorage read errors
}

const authStore = useAuthStore();
const suggestionsStore = useSuggestionsStore();

type PersistedTableState = {
  sortKey: "date" | "stake" | "odds" | "result" | "profit" | null;
  sortDirection: "asc" | "desc";
  pageSize: number;
  currentPage: number;
};

const validSortKeys = new Set(["date", "stake", "odds", "result", "profit"]);
const validPageSizes = new Set([5, 10, 25, 50, 100]);

const sanitizeTableState = (value: unknown): PersistedTableState => {
  const source = (value || {}) as Partial<PersistedTableState>;
  const rawSortKey = source.sortKey;
  const nextSortKey =
    rawSortKey === null || rawSortKey === undefined
      ? null
      : validSortKeys.has(String(rawSortKey))
        ? (String(rawSortKey) as PersistedTableState["sortKey"])
        : null;
  const nextSortDirection = source.sortDirection === "desc" ? "desc" : "asc";
  const parsedPageSize = Number(source.pageSize);
  const nextPageSize = validPageSizes.has(parsedPageSize) ? parsedPageSize : 10;
  const parsedCurrentPage = Number(source.currentPage);
  const nextCurrentPage =
    Number.isInteger(parsedCurrentPage) && parsedCurrentPage > 0 ? parsedCurrentPage : 1;

  return {
    sortKey: nextSortKey,
    sortDirection: nextSortDirection,
    pageSize: nextPageSize,
    currentPage: nextCurrentPage,
  };
};

const loadSavedTableState = (): PersistedTableState => {
  try {
    const raw = localStorage.getItem(TABLE_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        sortKey: null,
        sortDirection: "asc",
        pageSize: 10,
        currentPage: 1,
      };
    }
    return sanitizeTableState(JSON.parse(raw));
  } catch {
    return {
      sortKey: null,
      sortDirection: "asc",
      pageSize: 10,
      currentPage: 1,
    };
  }
};

const savedTableState = loadSavedTableState();
sortKey.value = savedTableState.sortKey;
sortDirection.value = savedTableState.sortDirection;
pageSize.value = savedTableState.pageSize;
currentPage.value = savedTableState.currentPage;

// Fetch bets
const fetchBets = async () => {
  try {
    const res = await api.get("/api/bets");
    bets.value = res.data || [];
    const existingIds = new Set(
      (bets.value as Array<Record<string, any>>).map((bet) => String(bet.id)),
    );
    selectedBetIds.value = selectedBetIds.value.filter((id) => existingIds.has(id));
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await authStore.logout();
      window.location.href = "/sign-in";
      return;
    }
    alert("Failed to fetch bets. Is the API running?");
  }
};

watchEffect(() => {
  fetchBets();
});

// Open modal
const openModal = () => (showModal.value = true);

// Handle bet added
const onBetAdded = () => {
  fetchBets(); // refresh table
  if (authStore.user?.id) {
    void suggestionsStore.preloadSuggestions(authStore.user.id, true);
  }
};

const openEditModal = (bet: Record<string, any>) => {
  editingBet.value = bet;
  showEditModal.value = true;
};

const onBetUpdated = () => {
  fetchBets();
  if (authStore.user?.id) {
    void suggestionsStore.preloadSuggestions(authStore.user.id, true);
  }
};

const onFiltersUpdate = (nextFilters: typeof filters.value) => {
  filters.value = sanitizeFilters(nextFilters);
};

const seasonOptions = computed(() => {
  const keys = new Set<string>([getCurrentSeasonKey()]);
  for (const bet of bets.value as Array<Record<string, any>>) {
    const seasonKey = getSeasonKeyFromDate(String(bet.placedAt || ""));
    if (seasonKey) keys.add(seasonKey);
  }
  return Array.from(keys)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => getSeasonLabel(key));
});

const getSeasonKeyFromLabel = (label: string) => {
  const trimmed = String(label || "").trim();
  const keyMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (keyMatch) return `${keyMatch[1]}-${keyMatch[2]}`;
  const match = trimmed.match(/^(\d{4})\s*\/\s*(\d{2})$/);
  if (!match) return "";
  const startYear = Number(match[1]);
  return `${startYear}-${startYear + 1}`;
};

const openDeleteModal = (bet: Record<string, any>) => {
  deletingBet.value = bet;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  deletingBet.value = null;
};

const confirmDelete = async () => {
  if (!deletingBet.value?.id || isDeleting.value) return;

  try {
    isDeleting.value = true;
    await api.delete(`/api/bets/${deletingBet.value.id}`);
    await fetchBets();
    if (authStore.user?.id) {
      void suggestionsStore.preloadSuggestions(authStore.user.id, true);
    }
    closeDeleteModal();
  } catch {
    alert("Failed to delete bet. Please try again.");
  } finally {
    isDeleting.value = false;
  }
};

const normalizeResult = (result: string) =>
  String(result || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const getResultLabel = (result: string) => {
  const normalized = normalizeResult(result);
  if (normalized === "WON" || normalized === "WIN") return "Win";
  if (normalized === "LOST" || normalized === "LOSS") return "Loss";
  if (normalized === "CASHED_OUT" || normalized === "CASHEDOUT" || normalized === "VOID")
    return "Cashed Out";
  return "Open";
};

const getResultClasses = (result: string) => {
  const label = getResultLabel(result);
  if (label === "Win") return "bg-green-100 text-green-800";
  if (label === "Loss") return "bg-red-100 text-red-800";
  if (label === "Cashed Out") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
};

const normalizeStakeType = (stakeType: string) =>
  String(stakeType || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const getStakeTypeLabel = (stakeType: string) => {
  const normalized = normalizeStakeType(stakeType);
  if (normalized === "FREE") return "Free";
  if (normalized === "NORMAL_PLUS_FREE") return "Normal + Free";
  return "Normal";
};

const getStakeTypeClasses = (stakeType: string) => {
  const label = getStakeTypeLabel(stakeType);
  if (label === "Free") return "bg-blue-100 text-blue-800";
  if (label === "Normal + Free") return "bg-emerald-100 text-emerald-800";
  return "bg-green-100 text-green-800";
};

const normalizeBookmaker = (bookmaker: string) =>
  String(bookmaker || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const getBookmakerClasses = (bookmaker: string) => {
  const normalized = normalizeBookmaker(bookmaker);
  if (normalized === "BET365") return "bg-green-900 text-yellow-300";
  if (normalized === "BETFAIR") return "bg-orange-400 text-black";
  if (normalized === "BETUK") return "bg-sky-200 text-red-700";
  if (normalized === "LADBROKES") return "bg-red-600 text-white";
  if (normalized === "PADDYPOWER") return "bg-green-900 text-white";
  if (normalized === "SKYBET") return "bg-blue-900 text-white";
  if (normalized === "WILLIAMHILL") return "bg-blue-900 text-yellow-300";
  return "bg-gray-100 text-gray-700";
};

const getBookmakerLabel = (bookmaker: string) => formatBookmakerLabel(bookmaker);

const inferPlayerPropMarketFromLegacyText = (text: string, side: "O" | "U" | null): string => {
  const normalized = text.toLowerCase();

  if (normalized.includes("fouls won")) return "Fouls Won Over";
  if (normalized.includes("fouls committed") || normalized.includes("fouls")) {
    return "Fouls Committed Over";
  }
  if (normalized.includes("sot")) return side === "U" ? "SOT Under" : "SOT Over";
  if (normalized.includes("shots")) return side === "U" ? "Shots Under" : "Shots Over";
  if (normalized.includes("tackles")) return "Tackles Over";
  if (normalized.includes("carded")) return "To Be Carded";
  if (normalized.includes("ags") || normalized.includes("anytime goalscorer")) return "AGS";
  return "";
};

const getDisplaySelection = (bet: Record<string, any>) => {
  const rawSelection = String(bet.selection || "").trim();
  const betType = String(bet.betType || "");
  if (betType !== "Player Prop") return rawSelection;

  // Legacy import format: "Player O0.5 fouls won" / "Player U1.5 shots"
  const legacyMatch = rawSelection.match(/^(.*?)\s+([OU])\s*(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (legacyMatch) {
    const player = legacyMatch[1].trim();
    const side = legacyMatch[2].toUpperCase() as "O" | "U";
    const value = Number(legacyMatch[3]);
    const legacyMarketText = legacyMatch[4].trim();

    const market =
      String(bet.playerPropMarket || "").trim() ||
      inferPlayerPropMarketFromLegacyText(legacyMarketText, side);
    const line = Number.isFinite(value) ? value.toFixed(1) : "";
    return [player, market, line].filter(Boolean).join(" ");
  }

  return rawSelection;
};

// Condenses Accumulator/Bet Builder/Cross Match Bet Builder descriptions
// (which can list many legs) down to the first 2 legs + "+N more" for the
// dense table/mobile-card views, while keeping the full text available via
// a tooltip -- see getSelectionTooltip() below.
const getCondensedDisplaySelection = (bet: Record<string, any>) =>
  getCondensedSelection(bet.betType, getDisplaySelection(bet)).display;

// Only returns a tooltip string when the description was actually
// shortened, so hovering a normal (non-multi-leg or short) bet doesn't show
// a redundant native tooltip duplicating the visible text.
const getSelectionTooltip = (bet: Record<string, any>) => {
  const condensed = getCondensedSelection(bet.betType, getDisplaySelection(bet));
  return condensed.isCondensed ? condensed.full : undefined;
};

const getProfitClass = (profit: unknown) => {
  const value = Number(profit);
  if (!Number.isFinite(value)) return "text-gray-900 dark:text-white";
  if (value > 0) return "text-green-700";
  if (value < 0) return "text-red-700";
  return "text-gray-900 dark:text-white";
};

const formatProfit = (profit: unknown) => {
  const value = Number(profit);
  if (!Number.isFinite(value)) return "£0.00";
  return `£ ${value.toFixed(2)}`;
};

const selectedCount = computed(() => selectedBetIds.value.length);

const isBetSelected = (id: string) => selectedBetIds.value.includes(String(id));

const toggleBetSelection = (id: string) => {
  const key = String(id);
  if (selectedBetIds.value.includes(key)) {
    selectedBetIds.value = selectedBetIds.value.filter((value) => value !== key);
    return;
  }
  selectedBetIds.value = [...selectedBetIds.value, key];
};

const toggleSort = (key: "date" | "stake" | "odds" | "result" | "profit") => {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = "asc";
};

const getSortIndicator = (key: "date" | "stake" | "odds" | "result" | "profit") => {
  if (sortKey.value !== key) return "▲▼";
  return sortDirection.value === "asc" ? "▲" : "▼";
};

const syncOddsPreference = () => {
  try {
    const stored = localStorage.getItem(ODDS_FORMAT_STORAGE_KEY);
    if (stored === "decimal" || stored === "fractional") {
      oddsFormat.value = stored;
    }
  } catch {
    // ignore storage read errors
  }
};

onMounted(() => {
  syncOddsPreference();
  window.addEventListener("odds-format-updated", syncOddsPreference);
  window.addEventListener("storage", syncOddsPreference);
});

onBeforeUnmount(() => {
  window.removeEventListener("odds-format-updated", syncOddsPreference);
  window.removeEventListener("storage", syncOddsPreference);
});

const resultSortOrder: Record<string, number> = {
  Open: 0,
  Win: 1,
  Loss: 2,
  "Cashed Out": 3,
};

const uniqueBookies = computed(() =>
  [
    ...new Set((bets.value as Array<Record<string, any>>).map((bet) => String(bet.bookmaker))),
  ].sort(),
);

const uniqueStakeTypes = computed(() =>
  [
    ...new Set(
      (bets.value as Array<Record<string, any>>).map((bet) =>
        getStakeTypeLabel(String(bet.stakeType)),
      ),
    ),
  ].sort(),
);

const uniqueResults = computed(() => [
  ...new Set(
    (bets.value as Array<Record<string, any>>).map((bet) => getResultLabel(String(bet.result))),
  ),
]);

const totalBets = computed(() => (bets.value as Array<Record<string, any>>).length);

const totalProfitLoss = computed(() =>
  (bets.value as Array<Record<string, any>>).reduce((sum, bet) => {
    const value = Number(bet.profit);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0),
);

const favouriteBookie = computed(() => {
  const counts = new Map<string, number>();
  for (const bet of bets.value as Array<Record<string, any>>) {
    const bookmaker = String(bet.bookmaker || "").trim();
    if (!bookmaker) continue;
    counts.set(bookmaker, (counts.get(bookmaker) || 0) + 1);
  }

  let topBookie = "-";
  let topCount = 0;
  for (const [bookmaker, count] of counts.entries()) {
    if (count > topCount) {
      topBookie = bookmaker;
      topCount = count;
    }
  }
  return topBookie;
});

const filteredBets = computed(() => {
  const list = bets.value as Array<Record<string, any>>;
  const fixtureQuery = filters.value.fixture.trim().toLowerCase();
  const seasonQuery = getSeasonKeyFromLabel(filters.value.season);
  const dateQuery = filters.value.date.trim();
  const bookieQuery = filters.value.bookie.trim();
  const stakeTypeQuery = filters.value.stakeType.trim();
  const resultQuery = filters.value.result.trim();

  return list.filter((bet) => {
    if (seasonQuery && getSeasonKeyFromDate(String(bet.placedAt || "")) !== seasonQuery) {
      return false;
    }
    if (
      fixtureQuery &&
      !String(bet.fixture || "")
        .toLowerCase()
        .includes(fixtureQuery)
    ) {
      return false;
    }
    if (dateQuery && String(bet.placedAt || "").slice(0, 10) !== dateQuery) {
      return false;
    }
    if (bookieQuery && String(bet.bookmaker || "") !== bookieQuery) {
      return false;
    }
    if (stakeTypeQuery && getStakeTypeLabel(String(bet.stakeType)) !== stakeTypeQuery) {
      return false;
    }
    if (resultQuery && getResultLabel(String(bet.result)) !== resultQuery) {
      return false;
    }
    return true;
  });
});

const sortedBets = computed(() => {
  const list = [...filteredBets.value] as Array<Record<string, any>>;
  if (!sortKey.value) {
    // Default table view:
    // 1) newest day first
    // 2) within a day, keep fixtures together
    // 3) fixture groups with newest created bet first
    // 4) within a fixture/day, newest created bet first
    const latestCreatedAtByGroup = new Map<string, number>();
    for (const bet of list) {
      const day = String(bet.placedAt || "").slice(0, 10);
      const fixture = String(bet.fixture || "");
      const groupKey = `${day}||${fixture}`;
      const createdAt = new Date(bet.createdAt || bet.placedAt || 0).getTime();
      const previous = latestCreatedAtByGroup.get(groupKey) ?? Number.NEGATIVE_INFINITY;
      if (createdAt > previous) {
        latestCreatedAtByGroup.set(groupKey, createdAt);
      }
    }

    list.sort((a, b) => {
      const dayA = String(a.placedAt || "").slice(0, 10);
      const dayB = String(b.placedAt || "").slice(0, 10);
      const dayComparison = dayB.localeCompare(dayA);
      if (dayComparison !== 0) return dayComparison;

      const fixtureA = String(a.fixture || "");
      const fixtureB = String(b.fixture || "");
      const groupKeyA = `${dayA}||${fixtureA}`;
      const groupKeyB = `${dayB}||${fixtureB}`;
      const groupLatestA = latestCreatedAtByGroup.get(groupKeyA) ?? Number.NEGATIVE_INFINITY;
      const groupLatestB = latestCreatedAtByGroup.get(groupKeyB) ?? Number.NEGATIVE_INFINITY;
      if (groupLatestA !== groupLatestB) return groupLatestB - groupLatestA;

      const fixtureComparison = fixtureA.localeCompare(fixtureB, undefined, {
        sensitivity: "base",
      });
      if (fixtureComparison !== 0) return fixtureComparison;

      const createdA = new Date(a.createdAt || a.placedAt || 0).getTime();
      const createdB = new Date(b.createdAt || b.placedAt || 0).getTime();
      if (createdA !== createdB) return createdB - createdA;

      // Final deterministic fallback
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    return list;
  }

  list.sort((a, b) => {
    let comparison = 0;

    if (sortKey.value === "date") {
      comparison = new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
    } else if (sortKey.value === "stake") {
      comparison = Number(a.stake) - Number(b.stake);
    } else if (sortKey.value === "odds") {
      comparison = Number(a.odds) - Number(b.odds);
    } else if (sortKey.value === "result") {
      const aResult = getResultLabel(a.result);
      const bResult = getResultLabel(b.result);
      comparison = resultSortOrder[aResult] - resultSortOrder[bResult];
    } else if (sortKey.value === "profit") {
      comparison = Number(a.profit || 0) - Number(b.profit || 0);
    }

    return sortDirection.value === "asc" ? comparison : -comparison;
  });

  return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(sortedBets.value.length / pageSize.value)));

const paginatedBets = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedBets.value.slice(start, start + pageSize.value);
});

const allPageSelected = computed(() => {
  if (!paginatedBets.value.length) return false;
  return paginatedBets.value.every((bet) => isBetSelected(String(bet.id)));
});

const somePageSelected = computed(() => {
  if (!paginatedBets.value.length) return false;
  return paginatedBets.value.some((bet) => isBetSelected(String(bet.id)));
});

const toggleSelectPage = () => {
  const pageIds = paginatedBets.value.map((bet) => String(bet.id));
  if (!pageIds.length) return;

  if (allPageSelected.value) {
    const pageSet = new Set(pageIds);
    selectedBetIds.value = selectedBetIds.value.filter((id) => !pageSet.has(id));
    return;
  }

  const merged = new Set(selectedBetIds.value);
  pageIds.forEach((id) => merged.add(id));
  selectedBetIds.value = Array.from(merged);
};

const clearBulkSelection = () => {
  selectedBetIds.value = [];
};

const resultLabelToApi: Record<string, string> = {
  Open: "OPEN",
  Win: "WON",
  Loss: "LOST",
  "Cashed Out": "VOID",
};

const applyBulkResult = async () => {
  if (!selectedBetIds.value.length || isApplyingBulkResult.value) return;
  if (
    bulkResult.value === "Cashed Out" &&
    (bulkCashOutValue.value == null || bulkCashOutValue.value < 0)
  ) {
    alert("Please enter a valid Cash Out value for Cashed Out.");
    return;
  }

  try {
    isApplyingBulkResult.value = true;
    await api.patch("/api/bets/bulk-result", {
      ids: selectedBetIds.value,
      result: resultLabelToApi[bulkResult.value],
      cashOutValue: bulkResult.value === "Cashed Out" ? Number(bulkCashOutValue.value) : null,
    });
    await fetchBets();
    clearBulkSelection();
  } catch (error: any) {
    alert(error?.response?.data?.error || "Failed to apply bulk result.");
  } finally {
    isApplyingBulkResult.value = false;
  }
};

const goToFirstPage = () => {
  currentPage.value = 1;
};

const goToPreviousPage = () => {
  currentPage.value = Math.max(1, currentPage.value - 1);
};

const goToNextPage = () => {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1);
};

const goToLastPage = () => {
  currentPage.value = totalPages.value;
};

watch([pageSize, totalPages], () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
});

watch(bulkResult, (value) => {
  if (value !== "Cashed Out") {
    bulkCashOutValue.value = null;
  }
});

watch(
  () => [
    filters.value.season,
    filters.value.fixture,
    filters.value.date,
    filters.value.bookie,
    filters.value.stakeType,
    filters.value.result,
    sortKey.value,
    sortDirection.value,
  ],
  () => {
    currentPage.value = 1;
  },
);

watch(
  filters,
  (next) => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(sanitizeFilters(next)));
    } catch {
      // ignore localStorage write errors
    }
  },
  { deep: true },
);

watch([sortKey, sortDirection, pageSize, currentPage], () => {
  try {
    localStorage.setItem(
      TABLE_STATE_STORAGE_KEY,
      JSON.stringify(
        sanitizeTableState({
          sortKey: sortKey.value,
          sortDirection: sortDirection.value,
          pageSize: pageSize.value,
          currentPage: currentPage.value,
        }),
      ),
    );
  } catch {
    // ignore localStorage write errors
  }
});

watch(
  () => filters.value.season,
  (season) => {
    try {
      localStorage.setItem(SELECTED_SEASON_STORAGE_KEY, season);
    } catch {
      // ignore localStorage write errors
    }
  },
);

const columnOptions: Array<{
  key: keyof (typeof visibleColumns)["value"];
  label: string;
}> = [
  { key: "date", label: "Date" },
  { key: "fixture", label: "Fixture" },
  { key: "bookie", label: "Bookie" },
  { key: "description", label: "Description" },
  { key: "stakeType", label: "Stake Type" },
  { key: "stake", label: "Stake (£)" },
  { key: "odds", label: "Odds" },
  { key: "result", label: "Result" },
  { key: "profitLoss", label: "P/L" },
];
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex justify-center md:justify-end">
      <div class="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div class="text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400">Total Bets</p>
          <p class="font-semibold text-gray-900 dark:text-gray-100">{{ totalBets }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400">Favourite Bookie</p>
          <p class="font-semibold text-gray-900 dark:text-gray-100">
            {{ getBookmakerLabel(String(favouriteBookie || "")) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400">Total P/L</p>
          <p
            class="font-semibold"
            :class="
              totalProfitLoss > 0
                ? 'text-green-700'
                : totalProfitLoss < 0
                  ? 'text-red-700'
                  : 'text-gray-900 dark:text-white'
            "
          >
            £ {{ totalProfitLoss.toFixed(2) }}
          </p>
        </div>
      </div>
    </div>

    <BetsTableControls
      :filters="filters"
      :season-options="seasonOptions"
      :bookie-options="uniqueBookies"
      :stake-type-options="uniqueStakeTypes"
      :result-options="uniqueResults"
      @update:filters="onFiltersUpdate"
    />

    <!-- Bets table with updated styling -->
    <div class="mb-2 flex items-center justify-between gap-2">
      <button
        @click="openModal"
        class="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700"
        data-test-id="add-bet-button"
      >
        Add Bet
      </button>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <label for="rows-per-page-top">Show</label>
          <select
            id="rows-per-page-top"
            v-model.number="pageSize"
            class="border border-gray-300 rounded-md px-2 py-1 bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="relative">
          <button
            @click="showColumnsMenu = !showColumnsMenu"
            class="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 text-sm rounded-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Columns
          </button>
          <div
            v-if="showColumnsMenu"
            class="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-20 p-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <label
              v-for="column in columnOptions"
              :key="column.key"
              class="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <input
                v-model="visibleColumns[column.key]"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{{ column.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="md:hidden space-y-3">
      <div
        v-if="selectedCount > 0"
        class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/40"
      >
        <span class="font-medium text-blue-800 dark:text-blue-200">
          {{ selectedCount }} selected
        </span>
        <span class="text-xs text-blue-700 dark:text-blue-300">
          Select rows to update result, then Apply.
        </span>
        <select
          v-model="bulkResult"
          class="rounded border border-blue-200 bg-white px-2 py-1 text-sm dark:border-blue-800 dark:bg-gray-900 dark:text-gray-100"
        >
          <option>Open</option>
          <option>Win</option>
          <option>Loss</option>
          <option>Cashed Out</option>
        </select>
        <input
          v-if="bulkResult === 'Cashed Out'"
          v-model.number="bulkCashOutValue"
          type="number"
          min="0"
          step="0.01"
          placeholder="Cash Out Value"
          class="w-36 rounded border border-blue-200 bg-white px-2 py-1 text-sm dark:border-blue-800 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          @click="applyBulkResult"
          :disabled="isApplyingBulkResult"
          class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {{ isApplyingBulkResult ? "Applying..." : "Apply" }}
        </button>
        <button
          @click="clearBulkSelection"
          class="bg-red-600 hover:bg-red-700 text-white border border-gray-300 px-3 py-1 text-xs font-semibold rounded-md dark:border-gray-700"
        >
          Clear
        </button>
      </div>

      <div
        v-for="bet in paginatedBets"
        :key="`mobile-${bet.id}`"
        class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ bet.fixture }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ new Date(bet.placedAt).toLocaleDateString() }}
            </p>
          </div>
          <input
            type="checkbox"
            :checked="isBetSelected(String(bet.id))"
            class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="toggleBetSelection(String(bet.id))"
          />
        </div>

        <p class="mb-2 text-sm text-gray-800 dark:text-gray-200" :title="getSelectionTooltip(bet)">
          {{ getCondensedDisplaySelection(bet) }}
        </p>

        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="getBookmakerClasses(bet.bookmaker)"
          >
            {{ getBookmakerLabel(String(bet.bookmaker || "")) }}
          </span>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="getStakeTypeClasses(bet.stakeType)"
          >
            {{ getStakeTypeLabel(bet.stakeType) }}
          </span>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="getResultClasses(bet.result)"
          >
            {{ getResultLabel(bet.result) }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Stake</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">£ {{ Number(bet.stake) }}</p>
          </div>
          <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">Odds</p>
            <p class="font-semibold text-gray-900 dark:text-gray-100">
              {{ formatOddsForDisplay(Number(bet.odds), oddsFormat) }}
              <span
                v-if="bet.oddsBoostPercent"
                class="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400"
              >
                +{{ Number(bet.oddsBoostPercent) }}%
              </span>
            </p>
          </div>
          <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800">
            <p class="text-gray-500 dark:text-gray-400">P/L</p>
            <p class="font-semibold" :class="getProfitClass(bet.profit)">
              {{ formatProfit(bet.profit) }}
            </p>
          </div>
        </div>

        <p
          v-if="getResultLabel(bet.result) === 'Cashed Out' && bet.cashOutValue != null"
          class="mt-2 text-xs text-gray-600 dark:text-gray-400"
        >
          Cash Out: £{{ Number(bet.cashOutValue).toFixed(2) }}
        </p>

        <div class="mt-3 flex items-center gap-2">
          <button
            @click="openEditModal(bet)"
            class="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          >
            Edit
          </button>
          <button
            @click="openDeleteModal(bet)"
            class="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div
      class="relative hidden md:block overflow-x-auto shadow-sm rounded-lg border border-gray-200 dark:border-gray-800"
    >
      <div
        v-if="selectedCount > 0"
        class="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/40"
      >
        <span class="font-medium text-blue-800 dark:text-blue-200">
          {{ selectedCount }} selected
        </span>
        <span class="text-xs text-blue-700 dark:text-blue-300">
          Select the rows you want to update the result for, then click Apply.
        </span>
        <select
          v-model="bulkResult"
          class="rounded border border-blue-200 bg-white px-2 py-1 text-sm dark:border-blue-800 dark:bg-gray-900 dark:text-gray-100"
        >
          <option>Open</option>
          <option>Win</option>
          <option>Loss</option>
          <option>Cashed Out</option>
        </select>
        <input
          v-if="bulkResult === 'Cashed Out'"
          v-model.number="bulkCashOutValue"
          type="number"
          min="0"
          step="0.01"
          placeholder="Cash Out Value"
          class="w-36 rounded border border-blue-200 bg-white px-2 py-1 text-sm dark:border-blue-800 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          @click="applyBulkResult"
          :disabled="isApplyingBulkResult"
          class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {{ isApplyingBulkResult ? "Applying..." : "Apply" }}
        </button>
        <button
          @click="clearBulkSelection"
          class="bg-red-600 hover:bg-red-700 text-white border border-gray-300 px-3 py-1 text-xs font-semibold rounded-md dark:border-gray-700"
        >
          Clear
        </button>
      </div>
      <table class="w-full text-sm text-center text-gray-700 dark:text-gray-200">
        <thead class="bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <tr>
            <th class="px-4 py-3 font-medium">
              <input
                type="checkbox"
                :checked="allPageSelected"
                :indeterminate.prop="somePageSelected && !allPageSelected"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @change="toggleSelectPage"
              />
            </th>
            <th v-if="visibleColumns.date" class="px-6 py-3 font-medium">
              <button @click="toggleSort('date')" class="inline-flex items-center gap-1">
                Date
                <span class="text-xs text-gray-500">{{ getSortIndicator("date") }}</span>
              </button>
            </th>
            <th v-if="visibleColumns.fixture" class="px-6 py-3 font-medium">Fixture</th>
            <th v-if="visibleColumns.bookie" class="px-6 py-3 font-medium">Bookie</th>
            <th v-if="visibleColumns.description" class="px-6 py-3 font-medium">Description</th>
            <th v-if="visibleColumns.stakeType" class="px-6 py-3 font-medium">Stake Type</th>
            <th v-if="visibleColumns.stake" class="px-6 py-3 font-medium">
              <button @click="toggleSort('stake')" class="inline-flex items-center gap-1">
                Stake (£)
                <span class="text-xs text-gray-500">{{ getSortIndicator("stake") }}</span>
              </button>
            </th>
            <th v-if="visibleColumns.odds" class="px-6 py-3 font-medium">
              <button @click="toggleSort('odds')" class="inline-flex items-center gap-1">
                Odds
                <span class="text-xs text-gray-500">{{ getSortIndicator("odds") }}</span>
              </button>
            </th>
            <th v-if="visibleColumns.result" class="px-6 py-3 font-medium">
              <button @click="toggleSort('result')" class="inline-flex items-center gap-1">
                Result
                <span class="text-xs text-gray-500">{{ getSortIndicator("result") }}</span>
              </button>
            </th>
            <th v-if="visibleColumns.profitLoss" class="px-6 py-3 font-medium">
              <button @click="toggleSort('profit')" class="inline-flex items-center gap-1">
                P/L
                <span class="text-xs text-gray-500">{{ getSortIndicator("profit") }}</span>
              </button>
            </th>
            <th class="px-6 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="bet in paginatedBets"
            :key="bet.id"
            class="odd:bg-white even:bg-gray-50 border-b border-gray-200 font-medium text-gray-900 whitespace-nowrap dark:odd:bg-gray-900 dark:even:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <td class="px-4 py-4">
              <input
                type="checkbox"
                :checked="isBetSelected(String(bet.id))"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @change="toggleBetSelection(String(bet.id))"
              />
            </td>
            <td v-if="visibleColumns.date" class="px-6 py-4">
              {{ new Date(bet.placedAt).toLocaleDateString() }}
            </td>
            <td v-if="visibleColumns.fixture" class="px-6 py-4">{{ bet.fixture }}</td>
            <td v-if="visibleColumns.bookie" class="px-6 py-4">
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                :class="getBookmakerClasses(bet.bookmaker)"
              >
                {{ getBookmakerLabel(String(bet.bookmaker || "")) }}
              </span>
            </td>
            <td
              v-if="visibleColumns.description"
              class="px-6 py-4"
              :title="getSelectionTooltip(bet)"
            >
              {{ getCondensedDisplaySelection(bet) }}
            </td>
            <td v-if="visibleColumns.stakeType" class="px-6 py-4">
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                :class="getStakeTypeClasses(bet.stakeType)"
              >
                {{ getStakeTypeLabel(bet.stakeType) }}
              </span>
            </td>
            <td v-if="visibleColumns.stake" class="px-6 py-4">{{ `£ ${Number(bet.stake)}` }}</td>
            <td v-if="visibleColumns.odds" class="px-6 py-4">
              {{ formatOddsForDisplay(Number(bet.odds), oddsFormat) }}
              <span
                v-if="bet.oddsBoostPercent"
                class="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400"
              >
                +{{ Number(bet.oddsBoostPercent) }}%
              </span>
            </td>
            <td v-if="visibleColumns.result" class="px-6 py-4">
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                :class="getResultClasses(bet.result)"
              >
                {{ getResultLabel(bet.result) }}
              </span>
              <p
                v-if="getResultLabel(bet.result) === 'Cashed Out' && bet.cashOutValue != null"
                class="mt-1 text-xs text-gray-600 dark:text-gray-400"
              >
                Amount: £{{ Number(bet.cashOutValue).toFixed(2) }}
              </p>
            </td>
            <td v-if="visibleColumns.profitLoss" class="px-6 py-4 font-semibold">
              <span :class="getProfitClass(bet.profit)">
                {{ formatProfit(bet.profit) }}
              </span>
            </td>
            <td class="px-6 py-4">
              <button
                @click="openEditModal(bet)"
                class="mr-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              >
                Edit
              </button>
              <button
                @click="openDeleteModal(bet)"
                class="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
      <div class="flex items-center gap-2 text-sm">
        <button
          @click="goToFirstPage"
          :disabled="currentPage === 1"
          class="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          &lt;&lt;
        </button>
        <button
          @click="goToPreviousPage"
          :disabled="currentPage === 1"
          class="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          &lt;
        </button>
        <span class="px-2 text-gray-700 dark:text-gray-300"
          >Page {{ currentPage }} of {{ totalPages }}</span
        >
        <button
          @click="goToNextPage"
          :disabled="currentPage === totalPages"
          class="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          &gt;
        </button>
        <button
          @click="goToLastPage"
          :disabled="currentPage === totalPages"
          class="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          &gt;&gt;
        </button>
      </div>
    </div>

    <!-- Add Bet Modal -->
    <AddBetModal v-model="showModal" :odds-format="oddsFormat" @bet-added="onBetAdded" />
    <EditBetModal
      v-model="showEditModal"
      :bet="editingBet"
      :odds-format="oddsFormat"
      @bet-updated="onBetUpdated"
    />

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteModal && deletingBet"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div
        class="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto overflow-y-auto dark:bg-gray-900"
      >
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-800 dark:text-gray-100">Delete Bet</h3>
          <button
            @click="closeDeleteModal"
            class="text-gray-500 hover:text-gray-700 text-xl dark:text-gray-400 dark:hover:text-gray-200"
          >
            &times;
          </button>
        </div>

        <div class="p-4 space-y-4">
          <p class="text-sm text-gray-800 font-medium dark:text-gray-100">
            Are you sure you want to remove this bet?
          </p>
          <div
            class="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <p><span class="font-semibold">Fixture:</span> {{ deletingBet.fixture }}</p>
            <p><span class="font-semibold">Description:</span> {{ deletingBet.selection }}</p>
          </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              @click="closeDeleteModal"
              class="px-4 py-2 text-sm rounded border bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              :disabled="isDeleting"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="confirmDelete"
              class="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              :disabled="isDeleting"
            >
              {{ isDeleting ? "Deleting..." : "Yes, Delete" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
