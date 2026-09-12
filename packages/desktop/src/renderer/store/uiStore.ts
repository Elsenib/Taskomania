import { create } from "zustand";

// "team" = the shared team-wide thread; any other string = the userId of
// the person a DM thread is open with. Kept alongside chatOpen (rather than
// null meaning closed) so re-opening the panel returns to the same thread.
export type ChatThread = "team" | string;

interface UiState {
  openTaskId: string | null;
  newTaskColumnId: string | null;
  sendToTestingTaskId: string | null;
  chatOpen: boolean;
  activeChatThread: ChatThread;
  openTask(taskId: string): void;
  openNewTask(columnId: string): void;
  openSendToTesting(taskId: string): void;
  closeModal(): void;
  openChat(thread?: ChatThread): void;
  closeChat(): void;
  setActiveChatThread(thread: ChatThread): void;
}

export const useUiStore = create<UiState>((set) => ({
  openTaskId: null,
  newTaskColumnId: null,
  sendToTestingTaskId: null,
  chatOpen: false,
  activeChatThread: "team",
  openTask: (taskId) => set({ openTaskId: taskId, newTaskColumnId: null, sendToTestingTaskId: null }),
  openNewTask: (columnId) => set({ newTaskColumnId: columnId, openTaskId: null, sendToTestingTaskId: null }),
  openSendToTesting: (taskId) => set({ sendToTestingTaskId: taskId, openTaskId: null, newTaskColumnId: null }),
  closeModal: () => set({ openTaskId: null, newTaskColumnId: null, sendToTestingTaskId: null }),
  openChat: (thread) => set((s) => ({ chatOpen: true, activeChatThread: thread ?? s.activeChatThread })),
  closeChat: () => set({ chatOpen: false }),
  setActiveChatThread: (thread) => set({ activeChatThread: thread }),
}));
