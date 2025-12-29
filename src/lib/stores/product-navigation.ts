import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ProductNavItem {
  id: string;
  title: string;
}

export type ProductNavigationContext =
  | { type: "products" }
  | { type: "search"; query: string };

interface ProductNavigationStore {
  context: ProductNavigationContext | null;
  items: ProductNavItem[];
  setNavigation: (context: ProductNavigationContext, items: ProductNavItem[]) => void;
  getNavigation: (currentProductId: string) => {
    prev: ProductNavItem | null;
    next: ProductNavItem | null;
    current: ProductNavItem | null;
    total: number;
    position: number | null;
  };
  clear: () => void;
}

export const useProductNavigation = create<ProductNavigationStore>()(
  persist(
    (set, get) => ({
      context: null,
      items: [],

      setNavigation: (context, items) => set({ context, items }),

      getNavigation: (currentProductId) => {
        const { items } = get();
        const currentIndex = items.findIndex((item) => item.id === currentProductId);

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

      clear: () => set({ context: null, items: [] }),
    }),
    {
      name: "product-navigation",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

