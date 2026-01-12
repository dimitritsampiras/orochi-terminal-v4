// src/lib/stores/task-queue.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskItem {
  id: string;
  label: string;
  status: TaskStatus;
  error?: string;
}

export interface Task {
  id: string;
  type: "bulk_shipments" | "bulk_fulfill";
  label: string;
  status: TaskStatus;
  items: TaskItem[];
  progress: number; // 0-100
  createdAt: number;
  completedAt?: number;
  sessionId?: number; // For context
}

interface TaskQueueStore {
  tasks: Task[];
  activeTaskId: string | null;

  // Actions
  addTask: (task: Omit<Task, "createdAt">) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskItem: (taskId: string, itemId: string, updates: Partial<TaskItem>) => void;
  setActiveTask: (taskId: string | null) => void;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;

  // Computed
  getActiveTask: () => Task | null;
  getPendingTasks: () => Task[];
}

export const useTaskQueue = create<TaskQueueStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,

      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, { ...task, createdAt: Date.now() }],
        })),

      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        })),

      updateTaskItem: (taskId, itemId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  items: t.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
                }
              : t
          ),
        })),

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),

      removeTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
          activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        })),

      clearCompleted: () =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.status !== "completed"),
        })),

      getActiveTask: () => {
        const { tasks, activeTaskId } = get();
        return tasks.find((t) => t.id === activeTaskId) || null;
      },

      getPendingTasks: () => {
        const { tasks } = get();
        return tasks.filter((t) => t.status === "pending" || t.status === "running");
      },
    }),
    {
      name: "task-queue",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
