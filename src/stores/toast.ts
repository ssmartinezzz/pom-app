import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  duration: number; // ms, 0 = persistent
}

const DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 8000,
  warning: 5000,
  info: 3000,
};

const MAX_VISIBLE = 3;
let counter = 0;

interface ToastState {
  messages: ToastMessage[];
  show: (type: ToastType, text: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  messages: [],

  show: (type, text) => {
    const id = `toast-${++counter}`;
    const duration = DURATIONS[type];
    const toast: ToastMessage = { id, type, text, duration };

    set((s) => ({
      messages: [...s.messages.slice(-(MAX_VISIBLE - 1)), toast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, duration);
    }
  },

  dismiss: (id) => {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
  },

  dismissAll: () => {
    set({ messages: [] });
  },
}));
