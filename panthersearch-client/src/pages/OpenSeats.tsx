import { ArrowLeft, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ActiveTerm, Section } from '../types';
import { formatClassRoute, formatSemesterTimestamp } from '../utils/format';

type SortKey = 'class' | 'crn' | 'instructor' | 'enrolled' | 'seats';

const DAY_FILTERS = ['All', 'MWF', 'TR', 'Online', 'MW', 'F'];
const CAMPUS_OPTIONS = ['All Campuses', 'Atlanta (main)', 'Perimeter - Alpharetta', 'Perimeter - Clarkston', 'Perimeter - Decatur', 'Perimeter - Dunwoody', 'Perimeter - Newton', 'Online'];

export default function OpenSeats() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [campus, setCampus] = useState('All Campuses');
  const [days, setDays] = useState('All');
  const [openOnly, setOpenOnly] = useState(true);
  const [morningOnly, setMorningOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('class');
  const [sections, setSections] = useState<Section[]>([]);
  const [terms, setTerms] = useState<ActiveTerm[]>([]);
  const [defaultCourseCode, setDefaultCourseCode] = useState('ACCT 2101');
  const [selectedTerm, setSelectedTerm] = useState('202605');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [source, setSource] = useState('GoSOLAR Live Data');
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const openPawsRegistration = (termCode: string, crn: string) => {
    window.open(
      `https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb/classRegistration/classRegistration?term=${encodeURIComponent(termCode)}&crn=${encodeURIComponent(crn)}`,
      '_blank',
      'noopener',
    );
  };

  useEffect(() => {
    let cancelled = false;
    const loadTerms = async () => {
      try {
        const list = await api.getActiveTerms();
        if (!cancelled) {
          setTerms(list);
          if (list.some((t) => t.code === '202605')) setSelectedTerm('202605');
          else if (list[0]) setSelectedTerm(list[0].code);
        }
      } catch {
        // keep defaults
      }
    };
    void loadTerms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      const catalog = await api.getCatalog().catch(() => null);
      if (!cancelled && catalog?.items?.length) {
        setDefaultCourseCode(catalog.items[0].code);
      }
    };
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const targetQuery = query.trim() || defaultCourseCode;
        const subject = (targetQuery.match(/^([A-Za-z]{2,4})/)?.[1] || defaultCourseCode.split(' ')[0] || 'ACCT').toUpperCase();
        const payload = await api.searchClasses(targetQuery, selectedTerm, campus === 'All Campuses' ? undefined : campus);
        const seatsPayload = await api.getSeats(targetQuery, selectedTerm, campus === 'All Campuses' ? undefined : campus);
        if (cancelled) return;
        const queryCodes = new Set(payload.map((item) => item.id));
        const merged = seatsPayload.sections.filter((section) => !query.trim() || queryCodes.size === 0 || queryCodes.has(section.classCode) || `${section.classCode} ${section.courseTitle} ${section.instructorName} ${section.location}`.toLowerCase().includes(query.toLowerCase()));
        setSections(merged);
        setLastUpdated(seatsPayload.lastUpdated);
        setSource(seatsPayload.source);
        setWarning(seatsPayload.warning ?? null);
        if (seatsPayload.activeTerms?.length) {
          setTerms(seatsPayload.activeTerms);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedTerm, campus, query, defaultCourseCode]);

  const filtered = useMemo(() => {
    return [...sections]
      .filter((section) => {
        const haystack = `${section.classCode} ${section.location} ${section.instructorName ?? ''} ${section.courseTitle ?? ''}`.toLowerCase();
        const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
        const matchesDays = days === 'All' || section.days === days;
        const matchesOpen = !openOnly || section.seatsRemaining > 0;
        const matchesMorning = !morningOnly || section.startTime === 'Async' || section.startTime.includes('AM');
        return matchesQuery && matchesDays && matchesOpen && matchesMorning;
      })
      .sort((a, b) => {
        if (sortKey === 'class') return a.classCode.localeCompare(b.classCode);
        if (sortKey === 'crn') return a.crn.localeCompare(b.crn);
        if (sortKey === 'instructor') return (a.instructorName ?? '').localeCompare(b.instructorName ?? '');
        if (sortKey === 'enrolled') return b.enrolled - a.enrolled;
        return b.seatsRemaining - a.seatsRemaining;
      });
  }, [days, morningOnly, openOnly, query, sections, sortKey]);

  const summary = {
    total: filtered.length,
    open: filtered.filter((section) => section.seatsRemaining > 0).length,
    full: filtered.filter((section) => section.seatsRemaining <= 0).length,
    waitlisted: filtered.filter((section) => section.waitlisted > 0).length,
  };

  return (
    <div className="page-shell py-10">
      <div className="mb-8 rounded-[28px] border border-[#DDE3FF] bg-[#F7F7FB] px-6 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="section-label mb-2">Open Seats</div>
              <h1 className="text-[28px] font-bold text-[#111827]">Open Seats - {terms.find((term) => term.code === selectedTerm)?.label ?? selectedTerm}</h1>
              <p className="mt-2 max-w-[680px] text-sm leading-6 text-[#6B7280]">Live section availability for GSU classes with instant filters for time, campus, and seat pressure. No PAWS login required.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-sm text-[#3730A3]">
            <Sparkles size={14} />
            Live seat intelligence
          </div>
        </div>

        {warning ? <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{warning}</div> : null}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#DDE3FF] bg-white p-4">
            <div className="text-caption">Source</div>
            <div className="mt-1 text-sm font-semibold text-[#111827]">{source}</div>
          </div>
          <div className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] p-4">
            <div className="text-caption text-[#166534]">Open sections</div>
            <div className="mt-1 text-xl font-semibold text-[#166534]">{summary.open}</div>
          </div>
          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
            <div className="text-caption text-[#92400E]">Full sections</div>
            <div className="mt-1 text-xl font-semibold text-[#92400E]">{summary.full}</div>
          </div>
          <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] p-4">
            <div className="text-caption text-[#3730A3]">Last refresh</div>
            <div className="mt-1 text-sm font-semibold text-[#3730A3]">{lastUpdated ? formatSemesterTimestamp(new Date(lastUpdated)) : 'Loading live data...'}</div>
          </div>
        </div>
      </div>

      <div className="surface-card mb-6 bg-[#F7F7FB] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_170px_220px_auto_auto_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by class, instructor, or location..." className="rounded-xl border border-[#D7DCEF] bg-white px-4 py-3 outline-none focus:border-[#6C2DFF]" />
          <select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)} className="rounded-xl border border-[#D7DCEF] bg-white px-4 py-3 outline-none focus:border-[#6C2DFF]">
            {terms.map((term) => (
              <option key={term.code} value={term.code}>
                {term.label}
              </option>
            ))}
          </select>
          <select value={campus} onChange={(event) => setCampus(event.target.value)} className="rounded-xl border border-[#D7DCEF] bg-white px-4 py-3 outline-none focus:border-[#6C2DFF]">
            {CAMPUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {DAY_FILTERS.map((item) => (
              <button key={item} type="button" onClick={() => setDays(item)} className={`pill-tab ${days === item ? 'pill-tab-active' : ''}`}>
                {item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-[#111111]">
            <button type="button" aria-pressed={openOnly} data-checked={openOnly} onClick={() => setOpenOnly((value) => !value)} className="toggle-pill">
              <span className="toggle-thumb" />
            </button>
            Open only
          </label>
          <label className="flex items-center gap-3 text-sm text-[#111111]">
            <button type="button" aria-pressed={morningOnly} data-checked={morningOnly} onClick={() => setMorningOnly((value) => !value)} className="toggle-pill">
              <span className="toggle-thumb" />
            </button>
            Morning only
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE3FF] bg-white px-4 py-3 text-sm">
        <div>
          Showing {summary.total} sections - {summary.open} open - {summary.full} full - {summary.waitlisted} waitlisted
        </div>
        <div className="text-caption">Last updated: {lastUpdated ? formatSemesterTimestamp(new Date(lastUpdated)) : 'Loading...'}</div>
      </div>

      {loading ? <div className="surface-card mb-4 p-4 text-sm text-[#6B7280]">Loading live sections from GoSOLAR...</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head text-left">
              <tr>
                {[
                  ['class', 'Class'],
                  ['crn', 'Section/CRN'],
                  ['instructor', 'Instructor'],
                  ['class', 'Schedule'],
                  ['class', 'Location'],
                  ['enrolled', 'Enrolled'],
                  ['seats', 'Seats'],
                  ['seats', 'Status'],
                  ['seats', 'Register'],
                ].map(([key, label], index) => (
                  <th key={`${key}-${label}-${index}`} className="px-4 py-3">
                    <button type="button" onClick={() => setSortKey(key as SortKey)} className="font-inherit">
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((section) => {
                const overEnrolled = section.seatsRemaining < 0;
                const shownSeats = Math.max(0, section.seatsRemaining);
                const statusLabel = overEnrolled ? 'FULL (over-enrolled)' : section.seatsRemaining === 0 && section.waitlisted > 0 ? `Waitlist (${section.waitlisted})` : section.seatsRemaining === 0 ? 'FULL' : `${shownSeats} seats left`;
                const fill = section.capacity ? Math.min(100, Math.max(0, (section.enrolled / section.capacity) * 100)) : 0;
                const waitlisted = section.seatsRemaining === 0 && section.waitlisted > 0;
                return (
                  <tr key={section.id} className="border-t border-[#E5E7EB] transition hover:bg-[#F3F1FF]">
                    <td className="px-4 py-4">
                      <Link to={formatClassRoute(section.classCode)} className="font-semibold text-[#1B3BFF] hover:underline">
                        {section.classCode}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#6B7280]">
                      <a href={`https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb/classRegistration/classRegistration?txt_term=${section.termCode || selectedTerm}&txt_courseReferenceNumber=${section.crn}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {section.crn}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      {section.instructorSlug ? (
                        <Link to={`/instructor/${section.instructorSlug}`} className="hover:underline">
                          {section.instructorName ?? 'Staff'}
                        </Link>
                      ) : (
                        <span>{section.instructorName ?? 'Staff'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {section.days} {section.startTime === 'Async' ? '' : `${section.startTime}-${section.endTime}`}
                    </td>
                    <td className="px-4 py-4 text-[#6B7280]">
                      {section.location}
                      {section.campus ? <div className="text-caption">{section.campus}</div> : null}
                    </td>
                    <td className="px-4 py-4">
                      {section.enrolled} / {section.capacity}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#111111]">{shownSeats}</div>
                      <div className="mt-2 h-2.5 w-full max-w-[120px] overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: 'linear-gradient(90deg, #1B3BFF 0%, #6C2DFF 100%)' }} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`status-chip ${
                          waitlisted
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : section.seatsRemaining <= 0
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : section.seatsRemaining <= 5
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-green-200 bg-green-50 text-green-700'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => openPawsRegistration(section.termCode || selectedTerm, section.crn)} className="btn-black px-3 py-1.5 text-xs">
                        Register in PAWS
                      </button>
                      <div className="mt-2 max-w-[220px] text-[11px] leading-4 text-[#6B7280]">After login, go to Registration and enter CRN {section.crn} for {section.termLabel || terms.find((term) => term.code === selectedTerm)?.label || selectedTerm}.</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
