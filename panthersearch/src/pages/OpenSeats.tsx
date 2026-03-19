import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classes, departments, mostViewedClasses } from '../data/classes';
import { instructorMap } from '../data/instructors';
import { api } from '../lib/api';
import type { Section } from '../types';
import { formatClassRoute, formatSemesterTimestamp } from '../utils/format';

type SortKey = 'class' | 'crn' | 'instructor' | 'enrolled' | 'seats';

export default function OpenSeats() {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [days, setDays] = useState('All');
  const [openOnly, setOpenOnly] = useState(true);
  const [morningOnly, setMorningOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('class');
  const [sections, setSections] = useState<Section[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetCourses = useMemo(() => {
    const filteredCourses = classes.filter((course) => {
      const matchesQuery = !query.trim() || `${course.code} ${course.name} ${course.department}`.toLowerCase().includes(query.toLowerCase());
      const matchesDepartment = department === 'All' || course.department === department;
      return matchesQuery && matchesDepartment;
    });

    if (filteredCourses.length) return filteredCourses.slice(0, 10);
    return mostViewedClasses.slice(0, 8);
  }, [department, query]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const responses = await Promise.all(targetCourses.map((course) => api.getSeats(course.code)));
        if (cancelled) return;
        const merged = responses.flatMap((response) => response.sections);
        setSections(merged);
        const newest = responses.map((response) => response.lastUpdated).sort().slice(-1)[0] ?? '';
        setLastUpdated(newest);
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
  }, [targetCourses]);

  const filtered = useMemo(() => {
    return [...sections]
      .filter((section) => {
        const instructorName = section.instructorName ?? instructorMap.get(section.instructorId ?? '')?.name ?? '';
        const haystack = `${section.classCode} ${section.location} ${instructorName}`.toLowerCase();
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
    full: filtered.filter((section) => section.seatsRemaining === 0).length,
    waitlisted: filtered.filter((section) => section.waitlisted > 0).length,
  };

  return (
    <div className="page-shell py-10">
      <div className="mb-8">
        <div className="section-label mb-2">Open Seats</div>
        <h1 className="text-[28px] font-bold text-[#111111]">Open Seats - Spring 2026</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Live section availability for GSU classes. No PAWS login required.</p>
      </div>

      <div className="surface-card mb-6 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_180px_auto_auto_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by class, instructor, or location..." className="surface-card px-4 py-3 outline-none" />
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="surface-card px-4 py-3 outline-none">
            <option>All</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {['All', 'MWF', 'TR', 'Online', 'MW', 'F'].map((item) => (
              <button key={item} type="button" onClick={() => setDays(item)} className={`pill-tab ${days === item ? 'pill-tab-active' : ''}`}>
                {item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={openOnly} onChange={() => setOpenOnly((value) => !value)} />
            Open only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={morningOnly} onChange={() => setMorningOnly((value) => !value)} />
            Morning only
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm">
        <div>
          Showing {summary.total} sections - {summary.open} open - {summary.full} full - {summary.waitlisted} waitlisted
        </div>
        <div className="text-caption">Last updated: {lastUpdated ? formatSemesterTimestamp(new Date(lastUpdated)) : 'Loading...'}</div>
      </div>

      {loading ? <div className="surface-card mb-4 p-4 text-sm text-[#6B7280]">Loading live sections from GoSolar...</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
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
                const statusLabel =
                  section.seatsRemaining === 0 && section.waitlisted > 0
                    ? `Waitlist (${section.waitlisted})`
                    : section.seatsRemaining === 0
                      ? 'FULL'
                      : `${section.seatsRemaining} seats left`;

                return (
                  <tr key={section.id} className="border-t border-[#E5E7EB] transition hover:bg-[#FAFAFA]">
                    <td className="px-4 py-4">
                      <Link to={formatClassRoute(section.classCode)} className="font-semibold hover:underline">
                        {section.classCode}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#6B7280]">{section.crn}</td>
                    <td className="px-4 py-4">
                      {section.instructorId ? (
                        <Link to={`/instructor/${section.instructorId}`} className="hover:underline">
                          {section.instructorName ?? instructorMap.get(section.instructorId)?.name ?? 'Staff'}
                        </Link>
                      ) : (
                        <span>{section.instructorName ?? 'Staff'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">{section.days} {section.startTime === 'Async' ? '' : `${section.startTime}-${section.endTime}`}</td>
                    <td className="px-4 py-4 text-[#6B7280]">{section.location}</td>
                    <td className="px-4 py-4">
                      {section.enrolled} / {section.capacity}
                    </td>
                    <td className="px-4 py-4">{section.seatsRemaining}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${section.seatsRemaining === 0 ? 'border-red-200 bg-red-50 text-red-700' : section.seatsRemaining <= 5 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                        {statusLabel}
                      </span>
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
