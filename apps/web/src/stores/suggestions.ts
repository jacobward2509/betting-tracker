import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/lib/api";

type SuggestionPayload = {
  teams: string[];
  players: string[];
};

type StoredSuggestions = {
  userId: string;
  teams: string[];
  players: string[];
};

const SUGGESTIONS_STORAGE_KEY = "bet-suggestions-cache";

const sanitizeList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

export const useSuggestionsStore = defineStore("suggestions", () => {
  const teams = ref<string[]>([]);
  const players = ref<string[]>([]);
  const loadedUserId = ref<string | null>(null);
  const isLoading = ref(false);

  const setSuggestions = (userId: string, payload: SuggestionPayload) => {
    loadedUserId.value = userId;
    teams.value = sanitizeList(payload.teams);
    players.value = sanitizeList(payload.players);
    try {
      const data: StoredSuggestions = {
        userId,
        teams: teams.value,
        players: players.value,
      };
      localStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage write errors
    }
  };

  const hydrateFromStorage = (userId: string) => {
    try {
      const raw = localStorage.getItem(SUGGESTIONS_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<StoredSuggestions>;
      if (String(parsed.userId || "") !== userId) return false;
      loadedUserId.value = userId;
      teams.value = sanitizeList(parsed.teams);
      players.value = sanitizeList(parsed.players);
      return true;
    } catch {
      return false;
    }
  };

  const preloadSuggestions = async (userId: string, force = false) => {
    if (!userId) return;
    if (!force && loadedUserId.value === userId && (teams.value.length || players.value.length)) return;

    if (!force && hydrateFromStorage(userId)) return;

    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const res = await api.get("/api/suggestions");
      setSuggestions(userId, {
        teams: sanitizeList(res.data?.teams),
        players: sanitizeList(res.data?.players),
      });
    } catch (error) {
      console.error("Failed to preload suggestions:", error);
    } finally {
      isLoading.value = false;
    }
  };

  const clear = () => {
    loadedUserId.value = null;
    teams.value = [];
    players.value = [];
  };

  return {
    teams,
    players,
    loadedUserId,
    preloadSuggestions,
    setSuggestions,
    clear,
  };
});
