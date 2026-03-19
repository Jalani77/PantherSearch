import { create } from 'zustand';

type CompareStore = {
  classA: string | null;
  classB: string | null;
  setClassA: (code: string | null) => void;
  setClassB: (code: string | null) => void;
  clearCompare: () => void;
};

export const useCompareStore = create<CompareStore>((set) => ({
  classA: null,
  classB: null,
  setClassA: (code) => set({ classA: code }),
  setClassB: (code) => set({ classB: code }),
  clearCompare: () => set({ classA: null, classB: null })
}));
