import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Instructor } from '../types';

type InstructorCardProps = {
  instructor: Instructor;
  selected?: boolean;
  semesters?: string[];
  onSelect?: () => void;
  condensed?: boolean;
};

const MetricBar = ({ value, max = 5, color }: { value: number; max?: number; color: string }) => (
  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
    <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
  </div>
);

export default function InstructorCard({ instructor, selected = false, semesters = [], onSelect, condensed = false }: InstructorCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`surface-card w-full cursor-pointer p-4 text-left transition hover:bg-[#FAFAFA] ${selected ? 'border-black border-l-4' : ''}`}
    >
      <div className="mb-1 text-base font-semibold text-[#111111]">{instructor.name}</div>
      <div className="mb-4 text-caption">{semesters.length ? semesters.join(', ') : instructor.department}</div>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-16 text-[#6B7280]">Rating</span>
          <MetricBar value={instructor.rating} color="#111111" />
          <span className="w-10 text-right font-medium">{instructor.rating.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="w-16 text-[#6B7280]">Difficulty</span>
          <MetricBar value={instructor.difficulty} color="#D97706" />
          <span className="w-10 text-right font-medium">{instructor.difficulty.toFixed(1)}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-[#6B7280]">Would take again</span>
        <span className="font-semibold text-[#111111]">{instructor.wouldTakeAgain}%</span>
      </div>
      {!condensed ? (
        <Link
          to={`/instructor/${instructor.id}`}
          onClick={(event) => event.stopPropagation()}
          className="btn-black mt-4 inline-flex gap-2 px-3 py-2 text-xs"
        >
          View instructor
          <ArrowRight size={14} />
        </Link>
      ) : null}
    </button>
  );
}
