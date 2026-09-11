import { create } from "zustand";

export type Locale = "az" | "en";

const STORAGE_KEY = "team-tracker:locale";

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "az";
  } catch {
    return "az";
  }
}

interface LocaleState {
  locale: Locale;
  setLocale(locale: Locale): void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: readStored(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // private window / storage disabled — the choice just won't survive a restart
    }
    set({ locale });
  },
}));
