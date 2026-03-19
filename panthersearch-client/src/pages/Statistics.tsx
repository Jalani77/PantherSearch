import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import StatsRankList from '../components/StatsRankList';
import { api } from '../lib/api';
import type { CatalogItem } from '../types';

export default function Statistics() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await api.getCatalog().catch(() => null);
      if (!cancelled && response) setItems(response.items);
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mostOpen = useMemo(() => [...items].sort((a, b) => b.openSeats - a.openSeats).slice(0, 15), [items]);
  const leastOpen = useMemo(() => [...items].sort((a, b) => a.openSeats - b.openSeats).slice(0, 15), [items]);
  const mostTaken = useMemo(() => [...items].sort((a, b) => b.totalStudents - a.totalStudents).slice(0, 15), [items]);

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#111827]">Statistics</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Live course availability, section volume, and enrollment trends from GoSOLAR.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
          <button type="button" onClick={() => navigate('/compare')} className="btn-outline">
            Compare two classes
          </button>
          <div className="w-full xl:w-[420px]">
            <SearchBar compact onSearch={(query) => navigate(`/?q=${encodeURIComponent(query)}`)} placeholder="Search stats by class or instructor..." />
          </div>
        </div>
      </div>

      {loading ? <div className="surface-card p-4 text-sm text-[#6B7280]">Loading live statistics...</div> : null}

      {!loading ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <StatsRankList title="Most Open Classes" subtitle="By current open seats in registration-open terms." items={mostOpen} mode="openSeats" valueColor="#16A34A" />
          <StatsRankList title="Tightest Availability" subtitle="By lowest open seats in registration-open terms." items={leastOpen} mode="openSeats" valueColor="#DC2626" />
          <StatsRankList title="Most Taken Classes" subtitle="Total enrolled students across loaded terms." items={mostTaken} mode="students" />
        </div>
      ) : null}
    </div>
  );
}
