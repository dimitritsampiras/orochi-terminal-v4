import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OperatorState {
  activeOperatorId: string | null;
  setActiveOperator: (id: string | null) => void;
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set) => ({
      activeOperatorId: null,
      setActiveOperator: (id) => set({ activeOperatorId: id }),
    }),
    {
      name: "orochi-operator-storage",
    }
  )
);