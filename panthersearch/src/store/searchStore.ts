import { create } from 'zustand';

type SearchStore = {
  recentSearches: string[];
  recentlyViewed: string[];
  addSearch: (query: string) => void;
  addRecentlyViewed: (code: string) => void;
};

export const useSearchStore = create<SearchStore>((set) => ({
  recentSearches: [],
  recentlyViewed: [],
  addSearch: (query) =>
    set((state) => ({
      recentSearches: [query, ...state.recentSearches.filter((item) => item !== query)].slice(0, 10)
    })),
  addRecentlyViewed: (code) =>
    set((state) => ({
      recentlyViewed: [code, ...state.recentlyViewed.filter((item) => item !== code)].slice(0, 10)
    }))
}));
