import { Link } from 'react-router-dom';
import type { ClassRecord } from '../types';
import { formatClassRoute } from '../utils/format';

export default function ClassCard({ course }: { course: ClassRecord }) {
  return (
    <Link to={formatClassRoute(course.code)} className="surface-card block bg-[#F8F8FD] p-4 transition hover:bg-[#EEF2FF]">
      <div className="mb-1 text-base font-semibold text-[#111827]">
        {course.code} - {course.name}
      </div>
      <div className="mb-3 text-caption">{course.department}</div>
      <div className="text-sm leading-6 text-[#111827]">{course.description}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {course.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[#DDE3FF] bg-white px-2.5 py-1 text-xs text-[#6B7280]">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
