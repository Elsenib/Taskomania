import { create } from "zustand";

// Session-only (not persisted): counts messages that arrived while their
// thread wasn't the one currently open, so the badge always matches what
// you haven't scrolled past yet in THIS run of the app. Entering a thread
// (ChatPanel/IdeChatPanel switching activeThread onto it) clears it back
// to 0 — never decremented one at a time, since there's no per-message
// "read" concept, just "this thread is/isn't open right now".
interface ChatUnreadState {
  unreadTeam: number;
  unreadByUser: Record<string, number>;
  bumpTeam(): void;
  bumpUser(userId: string): void;
  clearTeam(): void;
  clearUser(userId: string): void;
  total(): number;
}

export const useChatUnreadStore = create<ChatUnreadState>((set, get) => ({
  unreadTeam: 0,
  unreadByUser: {},
  bumpTeam: () => set((s) => ({ unreadTeam: s.unreadTeam + 1 })),
  bumpUser: (userId) =>
    set((s) => ({ unreadByUser: { ...s.unreadByUser, [userId]: (s.unreadByUser[userId] ?? 0) + 1 } })),
  clearTeam: () => set({ unreadTeam: 0 }),
  clearUser: (userId) => set((s) => ({ unreadByUser: { ...s.unreadByUser, [userId]: 0 } })),
  total: () => {
    const s = get();
    return s.unreadTeam + Object.values(s.unreadByUser).reduce((a, b) => a + b, 0);
  },
}));

// WhatsApp-style cap — badges never grow unbounded.
export function formatBadgeCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}
