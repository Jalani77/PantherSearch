import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ComparePanel from '../components/ComparePanel';
import SearchBar from '../components/SearchBar';
import { api } from '../lib/api';
import { useCompareStore } from '../store/compareStore';
import type { CatalogItem, SearchResultItem } from '../types';

export default function Compare() {
  const { classA, classB, setClassA, setClassB } = useCompareStore();
  const [queryA, setQueryA] = useState(classA ?? '');
  const [queryB, setQueryB] = useState(classB ?? '');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await api.getCatalog().catch(() => null);
      if (!cancelled && response) setCatalog(response.items);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedA = classA ? catalog.find((item) => item.code === classA) : undefined;
  const selectedB = classB ? catalog.find((item) => item.code === classB) : undefined;

  const searchByLabel = (query: string, assign: (code: string | null) => void, setQueryValue: (value: string) => void) => {
    const match = catalog.find((course) => `${course.code} ${course.name}`.toLowerCase().includes(query.toLowerCase()));
    if (match) {
      assign(match.code);
      setQueryValue(match.code);
    }
  };

  const comparisonReady = useMemo(() => !!selectedA && !!selectedB, [selectedA, selectedB]);
  const handleResultPick =
    (assign: (code: string | null) => void, setQueryValue: (value: string) => void) =>
    (result: SearchResultItem) => {
      if (result.type !== 'class') return;
      assign(result.id);
      setQueryValue(result.id);
    };

  return (
    <div className="page-shell py-10">
      <div className="mb-8">
        <div className="section-label mb-2">Compare</div>
        <h1 className="text-[28px] font-bold text-[#111827]">Compare Two Classes</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Select two classes to view live seat and enrollment stats side-by-side.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card bg-[#F7F7FB] p-4">
          <div className="mb-3 text-sm font-semibold text-[#111827]">Class A</div>
          <SearchBar value={queryA} onChange={setQueryA} onSearch={(query) => searchByLabel(query, setClassA, setQueryA)} onResultSelect={handleResultPick(setClassA, setQueryA)} compact />
          {selectedA ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1.5 text-sm text-[#1B3BFF]">
              {selectedA.code}
              <button
                type="button"
                onClick={() => {
                  setClassA(null);
                  setQueryA('');
                }}
                className="text-[#6B7280]"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
        <div className="surface-card bg-[#F7F7FB] p-4">
          <div className="mb-3 text-sm font-semibold text-[#111827]">Class B</div>
          <SearchBar value={queryB} onChange={setQueryB} onSearch={(query) => searchByLabel(query, setClassB, setQueryB)} onResultSelect={handleResultPick(setClassB, setQueryB)} compact />
          {selectedB ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-1.5 text-sm text-[#6C2DFF]">
              {selectedB.code}
              <button
                type="button"
                onClick={() => {
                  setClassB(null);
                  setQueryB('');
                }}
                className="text-[#6B7280]"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8">{comparisonReady ? <ComparePanel classA={selectedA!} classB={selectedB!} /> : <div className="surface-card p-6 text-sm text-[#6B7280]">Pick two classes to unlock the side-by-side comparison.</div>}</div>
    </div>
  );
}
