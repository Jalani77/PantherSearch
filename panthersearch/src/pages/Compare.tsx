import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ComparePanel from '../components/ComparePanel';
import SearchBar from '../components/SearchBar';
import { classMap, classes } from '../data/classes';
import { useCompareStore } from '../store/compareStore';
import type { SearchResultItem } from '../types';

export default function Compare() {
  const { classA, classB, setClassA, setClassB } = useCompareStore();
  const [queryA, setQueryA] = useState(classA ?? '');
  const [queryB, setQueryB] = useState(classB ?? '');
  const selectedA = classA ? classMap.get(classA) : undefined;
  const selectedB = classB ? classMap.get(classB) : undefined;

  const searchByLabel = (query: string, assign: (code: string | null) => void, setQuery: (value: string) => void) => {
    const match = classes.find((course) => `${course.code} ${course.name}`.toLowerCase().includes(query.toLowerCase()));
    if (match) {
      assign(match.code);
      setQuery(match.code);
    }
  };

  const comparisonReady = useMemo(() => selectedA && selectedB, [selectedA, selectedB]);
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
        <h1 className="text-[28px] font-bold text-[#111111]">Compare Two Classes</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Select two classes to view grades, stats, and reviews side-by-side.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <div className="mb-3 text-sm font-semibold text-[#111111]">Class A</div>
          <SearchBar value={queryA} onChange={setQueryA} onSearch={(query) => searchByLabel(query, setClassA, setQueryA)} onResultSelect={handleResultPick(setClassA, setQueryA)} compact />
          {selectedA ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm">
              {selectedA.code}
              <button type="button" onClick={() => { setClassA(null); setQueryA(''); }} className="text-[#6B7280]">
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
        <div className="surface-card p-4">
          <div className="mb-3 text-sm font-semibold text-[#111111]">Class B</div>
          <SearchBar value={queryB} onChange={setQueryB} onSearch={(query) => searchByLabel(query, setClassB, setQueryB)} onResultSelect={handleResultPick(setClassB, setQueryB)} compact />
          {selectedB ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm">
              {selectedB.code}
              <button type="button" onClick={() => { setClassB(null); setQueryB(''); }} className="text-[#6B7280]">
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
