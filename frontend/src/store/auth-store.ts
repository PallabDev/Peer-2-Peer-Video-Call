import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { authApi } from "../services/auth";
import type { User } from "../types/app";
import { socketService } from "../services/socket";
import { callManager } from "../services/call-manager";
import { sessionToken } from "../utils/session";

const TOKEN_KEY = "callie.auth.token";

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (payload: { email: string; password: string; }) => Promise<void>;
  register: (payload: { firstName: string; lastName?: string; email: string; password: string; }) => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: true,
  bootstrap: async () => {
    set({ loading: true });
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!token) {
      sessionToken.set(null);
      set({ loading: false, token: null, user: null });
      return;
    }

    try {
      set({ token });
      sessionToken.set(token);
      const response = await authApi.me();
      set({ user: response.data, loading: false });
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      sessionToken.set(null);
      set({ token: null, user: null, loading: false });
    }
  },
  login: async (payload) => {
    const response = await authApi.login(payload);
    await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
    sessionToken.set(response.data.token);
    set({
      token: response.data.token,
      user: response.data.user,
      loading: false,
    });
  },
  register: async (payload) => {
    const response = await authApi.register(payload);
    return response.message;
  },
  logout: async () => {
    socketService.disconnect();
    await callManager.reset();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    sessionToken.set(null);
    set({ token: null, user: null, loading: false });
  },
  refreshUser: async () => {
    const token = get().token;
    if (!token) {
      return;
    }

    const response = await authApi.me();
    set({ user: response.data });
  },
  setUser: (user) => set({ user }),
}));
