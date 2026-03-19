import { RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { instructorMap } from '../data/instructors';
import type { Section } from '../types';
import { formatSemesterTimestamp } from '../utils/format';

type SeatAvailabilityProps = {
  sections: Section[];
  defaultOpenOnly?: boolean;
  lastUpdated?: string;
  onRefresh?: () => void | Promise<void>;
  title?: string;
};

const SeatBar = ({ section }: { section: Section }) => {
  const fill = section.capacity ? (section.enrolled / section.capacity) * 100 : 0;
  const color = fill > 90 ? '#DC2626' : fill >= 70 ? '#D97706' : '#16A34A';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
      <div className="h-full rounded-full" style={{ width: `${fill}%`, backgroundColor: color }} />
    </div>
  );
};

const statusForSection = (section: Section) => {
  if (section.seatsRemaining === 0 && section.waitlisted > 0) return { label: `Waitlist (${section.waitlisted})`, className: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (section.seatsRemaining === 0) return { label: 'FULL', className: 'bg-red-50 text-red-700 border-red-200' };
  if (section.seatsRemaining <= 5) return { label: `${section.seatsRemaining} seats left`, className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: `${section.seatsRemaining} seats left`, className: 'bg-green-50 text-green-700 border-green-200' };
};

export default function SeatAvailability({ sections, defaultOpenOnly = false, lastUpdated, onRefresh, title = 'Spring 2026' }: SeatAvailabilityProps) {
  const [openOnly, setOpenOnly] = useState(defaultOpenOnly);
  const [localUpdated, setLocalUpdated] = useState(new Date(lastUpdated ?? '2026-03-18T11:45:00'));
  const filteredSections = openOnly ? sections.filter((section) => section.seatsRemaining > 0) : sections;
  const displayedUpdated = lastUpdated ? new Date(lastUpdated) : localUpdated;

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2 flex items-center gap-2">
            03 - OPEN SEATS
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            {title}
          </div>
          <div className="text-sm text-[#6B7280]">Live section availability with no PAWS login required.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#111111]">
            <input type="checkbox" checked={openOnly} onChange={() => setOpenOnly((value) => !value)} className="h-4 w-4 rounded border-[#D1D5DB]" />
            Open sections only
          </label>
          <button
            type="button"
            onClick={() => {
              setLocalUpdated(new Date());
              void onRefresh?.();
            }}
            className="btn-outline gap-2 px-3 py-2 text-xs"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
            <tr>
              <th className="px-4 py-3">CRN</th>
              <th className="px-4 py-3">Instructor</th>
              <th className="px-4 py-3">Days/Time</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Enrolled</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSections.map((section) => {
              const instructor = section.instructorId ? instructorMap.get(section.instructorId) : undefined;
              const status = statusForSection(section);
              return (
                <tr key={section.id} className="border-t border-[#E5E7EB] align-top transition hover:bg-[#FAFAFA]">
                  <td className="px-4 py-4 font-mono text-xs text-[#6B7280]">{section.crn}</td>
                  <td className="px-4 py-4">
                    {section.instructorId ? (
                      <Link to={`/instructor/${section.instructorId}`} className="font-medium hover:underline">
                        {section.instructorName ?? instructor?.name ?? 'Staff'}
                      </Link>
                    ) : (
                      <span className="font-medium">{section.instructorName ?? instructor?.name ?? 'Staff'}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-[#111111]">
                    {section.days} {section.startTime === 'Async' ? '' : `${section.startTime}-${section.endTime}`}
                  </td>
                  <td className="px-4 py-4 text-[#6B7280]">{section.location}</td>
                  <td className="px-4 py-4 font-medium">
                    {section.enrolled} / {section.capacity}
                  </td>
                  <td className="min-w-[180px] px-4 py-4">
                    <SeatBar section={section} />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#E5E7EB] px-4 py-3 text-caption">Last updated: {formatSemesterTimestamp(displayedUpdated)}</div>
    </div>
  );
}
