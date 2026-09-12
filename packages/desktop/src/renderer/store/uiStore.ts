import { create } from "zustand";

interface UiState {
  openTaskId: string | null;
  newTaskColumnId: string | null;
  sendToTestingTaskId: string | null;
  chatOpen: boolean;
  openTask(taskId: string): void;
  openNewTask(columnId: string): void;
  openSendToTesting(taskId: string): void;
  closeModal(): void;
  openChat(): void;
  closeChat(): void;
}

export const useUiStore = create<UiState>((set) => ({
  openTaskId: null,
  newTaskColumnId: null,
  sendToTestingTaskId: null,
  chatOpen: false,
  openTask: (taskId) => set({ openTaskId: taskId, newTaskColumnId: null, sendToTestingTaskId: null }),
  openNewTask: (columnId) => set({ newTaskColumnId: columnId, openTaskId: null, sendToTestingTaskId: null }),
  openSendToTesting: (taskId) => set({ sendToTestingTaskId: taskId, openTaskId: null, newTaskColumnId: null }),
  closeModal: () => set({ openTaskId: null, newTaskColumnId: null, sendToTestingTaskId: null }),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
}));
