import { computed, ref } from "vue";
import { defineStore } from "pinia";
import api, { setAuthToken } from "@/lib/api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type SignupPreferences = {
  enabledBookmakers?: string[];
  defaultBookmaker?: string;
  defaultBetType?: string;
  defaultStake?: number;
};

const TOKEN_STORAGE_KEY = "auth-token";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  const applyToken = (nextToken: string | null) => {
    token.value = nextToken;
    setAuthToken(nextToken);
    try {
      if (nextToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  const clearAuth = () => {
    applyToken(null);
    user.value = null;
  };

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      applyToken(stored || null);
    } catch {
      applyToken(null);
    }
  };

  const fetchMe = async () => {
    if (!token.value) {
      user.value = null;
      return;
    }

    try {
      const res = await api.get("/api/auth/me");
      user.value = res.data?.user || null;
    } catch {
      clearAuth();
    }
  };

  const init = async () => {
    if (initialized.value) return;
    initialized.value = true;
    loadFromStorage();
    await fetchMe();
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    preferences?: SignupPreferences,
  ) => {
    const payload: Record<string, unknown> = { name, email, password };
    if (preferences) {
      payload.preferences = preferences;
    }
    const res = await api.post("/api/auth/signup", payload);
    applyToken(String(res.data?.token || ""));
    user.value = res.data?.user || null;
  };

  const login = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    applyToken(String(res.data?.token || ""));
    user.value = res.data?.user || null;
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore logout API errors
    }
    clearAuth();
  };

  const updateProfile = async (name: string) => {
    const res = await api.patch("/api/auth/me", { name });
    user.value = res.data?.user || null;
  };

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    init,
    signup,
    login,
    logout,
    updateProfile,
    clearAuth,
  };
});
