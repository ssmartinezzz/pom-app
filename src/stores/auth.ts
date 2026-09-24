import { create } from 'zustand';
import { User } from '../types';
import * as authApi from '../api/auth';
import { getToken, setToken, removeToken } from '../utils/storage';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isReady: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isReady: false,

  init: async () => {
    try {
      const token = await getToken();
      if (token) {
        const user = await authApi.getMe();
        set({ user, token, isReady: true });
      } else {
        set({ isReady: true });
      }
    } catch {
      await removeToken();
      set({ user: null, token: null, isReady: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login({ email, password });
      await setToken(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register({ username, email, password });
      await setToken(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    await removeToken();
    set({ user: null, token: null });
  },

  clearSession: async () => {
    await removeToken();
    set({ user: null, token: null });
  },
}));
