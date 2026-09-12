import { create } from "zustand";

// Muting is purely a local, per-viewer notification preference (like
// WhatsApp) — it never touches the server, and never hides a muted
// person's messages from the thread, it only suppresses the desktop
// notification for them. Keyed by the CURRENT user's id (not just a flat
// list) since more than one person could log into the same machine.
const STORAGE_KEY = "team-tracker:mutedUsers";

function readStored(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStored(value: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // private window / storage disabled — the choice just won't survive a restart
  }
}

interface MutedUsersState {
  mutedByUser: Record<string, string[]>;
  isMuted(viewerId: string, otherUserId: string): boolean;
  toggleMute(viewerId: string, otherUserId: string): void;
}

export const useMutedUsersStore = create<MutedUsersState>((set, get) => ({
  mutedByUser: readStored(),
  isMuted: (viewerId, otherUserId) => (get().mutedByUser[viewerId] ?? []).includes(otherUserId),
  toggleMute: (viewerId, otherUserId) => {
    const current = get().mutedByUser[viewerId] ?? [];
    const next = current.includes(otherUserId)
      ? current.filter((id) => id !== otherUserId)
      : [...current, otherUserId];
    const mutedByUser = { ...get().mutedByUser, [viewerId]: next };
    writeStored(mutedByUser);
    set({ mutedByUser });
  },
}));
