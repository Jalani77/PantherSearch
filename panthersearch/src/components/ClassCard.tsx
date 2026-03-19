import { Link } from 'react-router-dom';
import type { ClassRecord } from '../types';
import { formatClassRoute } from '../utils/format';

export default function ClassCard({ course }: { course: ClassRecord }) {
  return (
    <Link to={formatClassRoute(course.code)} className="surface-card block p-4 transition hover:bg-[#FAFAFA]">
      <div className="mb-1 text-base font-semibold text-[#111111]">
        {course.code} - {course.name}
      </div>
      <div className="mb-3 text-caption">{course.department}</div>
      <div className="text-sm leading-6 text-[#111111]">{course.description}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {course.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280]">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
