import { ArrowRight, Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { api } from '../lib/api';
import { useCompareStore } from '../store/compareStore';
import type { StatusResponse, ViewEntry } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [topClassViews, setTopClassViews] = useState<ViewEntry[]>([]);
  const [topInstructorViews, setTopInstructorViews] = useState<ViewEntry[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const setClassA = useCompareStore((state) => state.setClassA);
  const setClassB = useCompareStore((state) => state.setClassB);

  const introCounts = useMemo(
    () => ({
      classes: status?.totalSections ? Math.max(1, Math.round(status.totalSections / 3)) : 0,
      instructors: status?.totalProfessors ?? 0,
      terms: status?.activeTerms?.length ?? 0,
    }),
    [status],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [trendingResponse, statusResponse] = await Promise.all([api.getTrending(5).catch(() => ({ courses: [], professors: [] })), api.getStatus().catch(() => null)]);
      if (!cancelled) {
        setTopClassViews(trendingResponse.courses || []);
        setTopInstructorViews(trendingResponse.professors || []);
        setStatus(statusResponse);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-shell py-12 md:py-20">
      <section className="animate-fade-up mb-12 overflow-hidden rounded-[30px] border border-[#DDE3FF] bg-gradient-to-br from-[#F9FAFF] via-[#F7F7FB] to-[#F2F4FF] px-6 py-10 md:px-10 md:py-14">
        <div className="mb-4 inline-flex rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-sm text-[#3730A3]">By Panthers, for Panthers.</div>
        <h1 className="max-w-[720px] text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-[#111827] md:text-[52px]">
          One search for
          <br />
          all classes, profs &amp; reviews.
        </h1>
        <p className="mt-5 max-w-[640px] text-base leading-7 text-[#4B5563]">No more 20 tabs open. RateMyProf ratings, Reddit reviews, grade history, and live seat availability all live on one clean page built for GSU.</p>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E0E7FF] bg-white/90 p-4">
            <div className="text-caption">Instant planning</div>
            <div className="mt-2 text-sm font-semibold text-[#111827]">Search course codes, titles, and professors from one box.</div>
          </div>
          <div className="rounded-2xl border border-[#E0E7FF] bg-white/90 p-4">
            <div className="text-caption">Real signals</div>
            <div className="mt-2 text-sm font-semibold text-[#111827]">Blend grade history, ratings, Reddit context, and seats in one workflow.</div>
          </div>
          <div className="rounded-2xl border border-[#E0E7FF] bg-white/90 p-4">
            <div className="text-caption">Faster choices</div>
            <div className="mt-2 text-sm font-semibold text-[#111827]">Compare sections and spot open seats before you ever open PAWS.</div>
          </div>
        </div>
      </section>

      {status?.sources?.banner?.warning ? <div className="mb-6 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{status.sources.banner.warning}</div> : null}

      <section className="surface-card animate-fade-up mb-14 bg-[#F7F7FB] p-6 md:p-7">
        <div className="mb-4 text-sm text-[#4B5563]">Search by class code or instructor&apos;s name...</div>
        <SearchBar value={query} onChange={setQuery} onSearch={(value) => navigate(`/?q=${encodeURIComponent(value)}`)} className="mb-4" />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setClassA(null);
              setClassB(null);
              navigate('/compare');
            }}
            className="btn-outline gap-2"
          >
            <Scale size={16} />
            Compare two classes
          </button>
          <div className="text-caption">
            {introCounts.classes}+ course groups - {introCounts.instructors}+ professors - {introCounts.terms} active registration terms
          </div>
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="section-label mb-2">Top Searches</div>
        <div className="mb-6 text-sm text-[#4B5563]">Classes and instructors students are looking at the most. Click to see details.</div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card bg-[#F7F7FB] p-4 md:p-5">
            <div className="mb-3 text-base font-semibold text-[#111827]">Most Viewed Classes</div>
            <div className="space-y-1">
              {(topClassViews.length ? topClassViews : []).slice(0, 5).map((course, index) => (
                <Link key={course.key} to={course.href} className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-[#EEF2FF]">
                  <div className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                    <span className="rank-marker h-8" />
                    <span>#{index + 1} {course.label}</span>
                  </div>
                  <div className="text-caption">{course.count.toLocaleString()} views</div>
                </Link>
              ))}
              {!topClassViews.length ? <div className="px-3 py-3 text-sm text-[#6B7280]">No trending items yet...</div> : null}
            </div>
          </div>
          <div className="surface-card bg-[#F7F7FB] p-4 md:p-5">
            <div className="mb-3 text-base font-semibold text-[#111827]">Most Viewed Instructors</div>
            <div className="space-y-1">
              {(topInstructorViews.length ? topInstructorViews : []).slice(0, 5).map((instructor, index) => (
                <Link key={instructor.key} to={instructor.href} className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-[#EEF2FF]">
                  <div className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                    <span className="rank-marker h-8" />
                    <span>#{index + 1} {instructor.label}</span>
                  </div>
                  <div className="text-caption">{instructor.count.toLocaleString()} views</div>
                </Link>
              ))}
              {!topInstructorViews.length ? <div className="px-3 py-3 text-sm text-[#6B7280]">No trending items yet...</div> : null}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Link to="/stats" className="btn-black gap-2">
            View more stats
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
