import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface OrderNavItem {
  id: string;
  name: string;
}

export type OrderNavigationContext =
  | { type: "orders" }
  | { type: "session"; sessionId: number }
  | { type: "batch"; batchId: number }
  | { type: "create_session" }
  | { type: "holds" };

interface OrderNavigationStore {
  context: OrderNavigationContext | null;
  items: OrderNavItem[];
  setNavigation: (context: OrderNavigationContext, items: OrderNavItem[]) => void;
  getNavigation: (currentOrderId: string) => {
    prev: OrderNavItem | null;
    next: OrderNavItem | null;
    current: OrderNavItem | null;
    total: number;
    position: number | null;
  };
  clear: () => void;
}

export const useOrderNavigation = create<OrderNavigationStore>()(
  persist(
    (set, get) => ({
      context: null,
      items: [],

      setNavigation: (context, items) => set({ context, items }),

      getNavigation: (currentOrderId) => {
        const { items } = get();
        const currentIndex = items.findIndex((item) => item.id === currentOrderId);

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
      name: "order-navigation",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

