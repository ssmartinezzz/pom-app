import { create } from 'zustand';
import { Language } from '../types';
import * as languagesApi from '../api/languages';

interface LanguagesState {
  languages: Language[];
  fetched: boolean;
  fetch: () => Promise<void>;
}

export const useLanguagesStore = create<LanguagesState>((set, get) => ({
  languages: [],
  fetched: false,

  fetch: async () => {
    if (get().fetched) return;
    const languages = await languagesApi.listLanguages();
    set({ languages, fetched: true });
  },
}));
