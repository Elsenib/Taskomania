import { create } from "zustand";

interface UiState {
  openTaskId: string | null;
  newTaskColumnId: string | null;
  sendToTestingTaskId: string | null;
  openTask(taskId: string): void;
  openNewTask(columnId: string): void;
  openSendToTesting(taskId: string): void;
  closeModal(): void;
}

export const useUiStore = create<UiState>((set) => ({
  openTaskId: null,
  newTaskColumnId: null,
  sendToTestingTaskId: null,
  openTask: (taskId) => set({ openTaskId: taskId, newTaskColumnId: null, sendToTestingTaskId: null }),
  openNewTask: (columnId) => set({ newTaskColumnId: columnId, openTaskId: null, sendToTestingTaskId: null }),
  openSendToTesting: (taskId) => set({ sendToTestingTaskId: taskId, openTaskId: null, newTaskColumnId: null }),
  closeModal: () => set({ openTaskId: null, newTaskColumnId: null, sendToTestingTaskId: null }),
}));
