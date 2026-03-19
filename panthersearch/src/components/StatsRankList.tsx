import { Link } from 'react-router-dom';
import type { ClassRecord } from '../types';
import { formatClassRoute } from '../utils/format';

type StatsRankListProps = {
  title: string;
  subtitle: string;
  items: ClassRecord[];
  mode: 'gpa' | 'students';
  gpaColor?: string;
};

export default function StatsRankList({ title, subtitle, items, mode, gpaColor = '#111111' }: StatsRankListProps) {
  return (
    <div className="surface-card p-4">
      <div className="section-label mb-2">{title}</div>
      <div className="mb-4 text-caption">{subtitle}</div>
      <div className="space-y-1">
        {items.map((course, index) => (
          <Link key={course.code} to={formatClassRoute(course.code)} className="block rounded-md px-3 py-3 transition hover:bg-[#F9FAFB]">
            <div className="mb-1 flex items-start gap-3">
              <span className="w-6 text-sm font-semibold text-[#6B7280]">#{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#111111]">
                  {course.code}: {course.name}
                </div>
                <div className="text-caption">
                  {mode === 'students' ? (
                    <span>
                      <span className="font-semibold text-[#6B7280]">{course.totalStudents} students</span> - {course.semesterCount} semesters - {course.avgGPA.toFixed(2)} GPA
                    </span>
                  ) : (
                    <span>
                      <span style={{ color: gpaColor }} className="font-semibold">
                        {course.avgGPA.toFixed(2)} GPA
                      </span>{' '}
                      - {course.semesterCount} semesters - {course.totalStudents} students
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
