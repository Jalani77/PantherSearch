import { Loader2, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveTerm, Section } from '../types';
import { formatSemesterTimestamp } from '../utils/format';

type SeatAvailabilityProps = {
  sections: Section[];
  activeTerms: ActiveTerm[];
  selectedTerm: string;
  onTermChange: (termCode: string) => void;
  defaultOpenOnly?: boolean;
  defaultCampus?: string;
  lastUpdated?: string;
  source?: string;
  warning?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
};

const CAMPUS_OPTIONS = ['All Campuses', 'Atlanta (main)', 'Perimeter - Alpharetta', 'Perimeter - Clarkston', 'Perimeter - Decatur', 'Perimeter - Dunwoody', 'Perimeter - Newton', 'Online'];

const SeatBar = ({ section }: { section: Section }) => {
  const fill = section.capacity ? Math.min(100, Math.max(0, (section.enrolled / section.capacity) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
      <div className="h-full rounded-full" style={{ width: `${fill}%`, background: 'linear-gradient(90deg, #1B3BFF 0%, #6C2DFF 100%)' }} />
    </div>
  );
};

const statusForSection = (section: Section) => {
  if (section.seatsRemaining < 0) return { label: 'FULL (over-enrolled)', className: 'bg-red-50 text-red-700 border-red-200' };
  if (section.seatsRemaining === 0 && section.waitlisted > 0) return { label: `Waitlist (${section.waitlisted})`, className: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (section.seatsRemaining === 0) return { label: 'FULL', className: 'bg-red-50 text-red-700 border-red-200' };
  if (section.seatsRemaining <= 5) return { label: `${section.seatsRemaining} seats left`, className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: `${section.seatsRemaining} seats left`, className: 'bg-green-50 text-green-700 border-green-200' };
};

export default function SeatAvailability({
  sections,
  activeTerms,
  selectedTerm,
  onTermChange,
  defaultOpenOnly = true,
  defaultCampus = 'All Campuses',
  lastUpdated,
  source = 'GoSOLAR Live Data',
  warning = null,
  loading = false,
  refreshing = false,
  onRefresh,
}: SeatAvailabilityProps) {
  const [openOnly, setOpenOnly] = useState(defaultOpenOnly);
  const [campus, setCampus] = useState(defaultCampus);
  const displayedUpdated = lastUpdated ? new Date(lastUpdated) : new Date();
  const filteredSections = useMemo(() => {
    return sections.filter((section) => {
      if (openOnly && section.seatsRemaining <= 0) return false;
      if (campus !== 'All Campuses' && (section.campus || '').toLowerCase() !== campus.toLowerCase()) return false;
      return true;
    });
  }, [sections, openOnly, campus]);

  const summary = {
    total: filteredSections.length,
    open: filteredSections.filter((section) => section.seatsRemaining > 0).length,
    full: filteredSections.filter((section) => section.seatsRemaining <= 0).length,
    waitlist: filteredSections.filter((section) => section.waitlisted > 0).length,
  };

  const selectedTermLabel = activeTerms.find((term) => term.code === selectedTerm)?.label ?? selectedTerm;
  const openPawsRegistration = (termCode: string, crn: string) => {
    window.open(
      `https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb/classRegistration/classRegistration?term=${encodeURIComponent(termCode)}&crn=${encodeURIComponent(crn)}`,
      '_blank',
      'noopener',
    );
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#F7F7FB] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2 flex items-center gap-2">
            03 - OPEN SEATS
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            {selectedTermLabel}
          </div>
          <div className="text-sm text-[#4B5563]">
            Source: {source}
            {lastUpdated ? ` - Last updated ${formatSemesterTimestamp(displayedUpdated)}` : ''}
          </div>
          {warning ? <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">{warning}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedTerm} onChange={(event) => onTermChange(event.target.value)} className="rounded-xl border border-[#D7DCEF] bg-white px-3 py-2 text-xs outline-none focus:border-[#6C2DFF]">
            {activeTerms.map((term) => (
              <option key={term.code} value={term.code}>
                {term.label}
              </option>
            ))}
          </select>
          <select value={campus} onChange={(event) => setCampus(event.target.value)} className="rounded-xl border border-[#D7DCEF] bg-white px-3 py-2 text-xs outline-none focus:border-[#6C2DFF]">
            {CAMPUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-3 text-sm text-[#111111]">
            <button type="button" aria-pressed={openOnly} data-checked={openOnly} onClick={() => setOpenOnly((value) => !value)} className="toggle-pill">
              <span className="toggle-thumb" />
            </button>
            Open sections only
          </label>
          <button type="button" disabled={refreshing} onClick={() => void onRefresh?.()} className="btn-outline gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#E5E7EB] bg-[#FCFCFD] p-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
          <div className="text-caption">Sections shown</div>
          <div className="mt-1 text-lg font-semibold text-[#111827]">{summary.total}</div>
        </div>
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3">
          <div className="text-caption text-[#166534]">Open now</div>
          <div className="mt-1 text-lg font-semibold text-[#166534]">{summary.open}</div>
        </div>
        <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
          <div className="text-caption text-[#92400E]">Full sections</div>
          <div className="mt-1 text-lg font-semibold text-[#92400E]">{summary.full}</div>
        </div>
        <div className="rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-3">
          <div className="text-caption text-[#6B21A8]">Waitlists</div>
          <div className="mt-1 text-lg font-semibold text-[#6B21A8]">{summary.waitlist}</div>
        </div>
      </div>

      {loading ? <div className="p-4 text-sm text-[#6B7280]">Loading live sections...</div> : null}

      {!loading ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head text-left">
              <tr>
                <th className="px-4 py-3">CRN</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Days/Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Register</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((section) => {
                const status = statusForSection(section);
                const shownSeats = Math.max(0, section.seatsRemaining);
                return (
                  <tr key={section.id} className="border-t border-[#E5E7EB] align-top transition hover:bg-[#F3F1FF]">
                    <td className="px-4 py-4 font-mono text-xs text-[#6B7280]">
                      <a href={`https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb/classRegistration/classRegistration?txt_term=${section.termCode || selectedTerm}&txt_courseReferenceNumber=${section.crn}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {section.crn}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      {section.instructorSlug ? (
                        <Link to={`/instructor/${section.instructorSlug}`} className="font-medium hover:underline">
                          {section.instructorName ?? 'Staff'}
                        </Link>
                      ) : (
                        <span className="font-medium">{section.instructorName ?? 'Staff'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[#111111]">
                      {section.days} {section.startTime === 'Async' ? '' : `${section.startTime}-${section.endTime}`}
                      {section.notes ? <div className="mt-1 text-caption">{section.notes}</div> : null}
                    </td>
                    <td className="px-4 py-4 text-[#6B7280]">
                      {section.location}
                      {section.campus ? <div className="text-caption">{section.campus}</div> : null}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {section.enrolled} / {section.capacity}
                    </td>
                    <td className="min-w-[180px] px-4 py-4">
                      <div className="mb-2 text-xs text-[#6B7280]">{shownSeats} open</div>
                      <SeatBar section={section} />
                    </td>
                    <td className="px-4 py-4">
                      <span className={`status-chip ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => openPawsRegistration(section.termCode || selectedTerm, section.crn)} className="btn-black px-3 py-1.5 text-xs">
                        Register in PAWS
                      </button>
                      <div className="mt-2 max-w-[220px] text-[11px] leading-4 text-[#6B7280]">After login, go to Registration and enter CRN {section.crn} for {section.termLabel || selectedTermLabel}.</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
