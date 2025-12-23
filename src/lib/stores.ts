// src/lib/stores/assembly-navigation-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AssemblyNavItem {
  id: string;
  itemPosition: number;
}

interface AssemblyNavigationStore {
  batchId: number | null;
  items: AssemblyNavItem[];
  setNavigation: (batchId: number, items: AssemblyNavItem[]) => void;
  getNavigation: (currentItemId: string) => {
    prev: AssemblyNavItem | null;
    next: AssemblyNavItem | null;
    current: AssemblyNavItem | null;
    total: number;
    position: number | null;
  };
  clear: () => void;
}

export const useAssemblyNavigation = create<AssemblyNavigationStore>()(
  persist(
    (set, get) => ({
      batchId: null,
      items: [],

      setNavigation: (batchId, items) => set({ batchId, items }),

      getNavigation: (currentItemId) => {
        const { items } = get();
        const currentIndex = items.findIndex((item) => item.id === currentItemId);

        if (currentIndex === -1) {
          return { prev: null, next: null, current: null, total: items.length, position: null };
        }

        return {
          prev: currentIndex > 0 ? items[currentIndex - 1] : null,
          next: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
          current: items[currentIndex],
          total: items.length,
          position: currentIndex,
        };
      },

      clear: () => set({ batchId: null, items: [] }),
    }),
    {
      name: "assembly-navigation",
      storage: createJSONStorage(() => sessionStorage), // survives refresh, not new tabs
    }
  )
);
