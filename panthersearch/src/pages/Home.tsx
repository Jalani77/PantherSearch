import { ArrowRight, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { mostViewedClasses } from '../data/classes';
import { mostViewedInstructors } from '../data/instructors';
import { useCompareStore } from '../store/compareStore';
import { formatClassRoute } from '../utils/format';

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const setClassA = useCompareStore((state) => state.setClassA);
  const setClassB = useCompareStore((state) => state.setClassB);

  const introCounts = useMemo(() => ({ classes: 44, instructors: 35, semesters: 9 }), []);

  return (
    <div className="page-shell py-12 md:py-20">
      <section className="animate-fade-up mb-12">
        <div className="mb-4 text-sm text-[#6B7280]">By Panthers, for Panthers.</div>
        <h1 className="max-w-[720px] text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-[#111111] md:text-[52px]">
          One search for
          <br />
          all classes, profs &amp; reviews.
        </h1>
        <p className="mt-5 max-w-[640px] text-base leading-7 text-[#6B7280]">
          No more 20 tabs open. RateMyProf ratings, Reddit reviews, grade history, and live seat availability all live on one clean page built for GSU.
        </p>
      </section>

      <section className="surface-card animate-fade-up mb-14 p-6">
        <div className="mb-4 text-sm text-[#6B7280]">Search by class code or instructor&apos;s name...</div>
        <SearchBar value={query} onChange={setQuery} onSearch={(value) => navigate(`/?q=${encodeURIComponent(value)}`)} className="mb-4" />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setClassA('BUSA 3000');
              setClassB('MKTG 3100');
              navigate('/compare');
            }}
            className="btn-outline gap-2"
          >
            <Scale size={16} />
            Compare two classes
          </button>
          <div className="text-caption">
            {introCounts.classes}+ classes - {introCounts.instructors}+ instructors - {introCounts.semesters} semesters of grade history
          </div>
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="section-label mb-2">Top Searches</div>
        <div className="mb-6 text-sm text-[#6B7280]">Classes and instructors students are looking at the most. Click to see details.</div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card p-4">
            <div className="mb-3 text-base font-semibold text-[#111111]">Most Viewed Classes</div>
            <div className="space-y-1">
              {mostViewedClasses.map((course, index) => (
                <Link key={course.code} to={formatClassRoute(course.code)} className="flex items-center justify-between rounded-md px-3 py-3 transition hover:bg-[#F9FAFB]">
                  <div className="text-sm font-medium text-[#111111]">
                    #{index + 1} {course.code}: {course.name}
                  </div>
                  <div className="text-caption">{course.viewCount.toLocaleString()} views</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="mb-3 text-base font-semibold text-[#111111]">Most Viewed Instructors</div>
            <div className="space-y-1">
              {mostViewedInstructors.map((instructor, index) => (
                <Link key={instructor.id} to={`/instructor/${instructor.id}`} className="flex items-center justify-between rounded-md px-3 py-3 transition hover:bg-[#F9FAFB]">
                  <div className="text-sm font-medium text-[#111111]">
                    #{index + 1} {instructor.name}
                  </div>
                  <div className="text-caption">{instructor.viewCount.toLocaleString()} views</div>
                </Link>
              ))}
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
