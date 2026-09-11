import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "team-tracker:theme";

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

// Applied once at module load (before the first render) so there's no flash
// of the wrong theme on startup.
const initialTheme = readStored();
applyTheme(initialTheme);

interface ThemeState {
  theme: ThemePreference;
  setTheme(pref: ThemePreference): void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (pref) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // private window / storage disabled — the choice just won't survive a restart
    }
    applyTheme(pref);
    set({ theme: pref });
  },
}));
