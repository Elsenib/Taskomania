import { create } from "zustand";

interface UiState {
  openTaskId: string | null;
  newTaskColumnId: string | null;
  openTask(taskId: string): void;
  openNewTask(columnId: string): void;
  closeModal(): void;
}

export const useUiStore = create<UiState>((set) => ({
  openTaskId: null,
  newTaskColumnId: null,
  openTask: (taskId) => set({ openTaskId: taskId, newTaskColumnId: null }),
  openNewTask: (columnId) => set({ newTaskColumnId: columnId, openTaskId: null }),
  closeModal: () => set({ openTaskId: null, newTaskColumnId: null }),
}));
