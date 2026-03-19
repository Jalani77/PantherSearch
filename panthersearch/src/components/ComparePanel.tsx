import { instructorMap } from '../data/instructors';
import type { ClassRecord } from '../types';
import GradeChart from './GradeChart';
import InstructorCard from './InstructorCard';

type ComparePanelProps = {
  classA: ClassRecord;
  classB: ClassRecord;
};

const winnerClass = (a: number, b: number, left = 'text-[#16A34A]', right = 'text-[#16A34A]') => ({
  a: a >= b ? left : '',
  b: b > a ? right : ''
});

export default function ComparePanel({ classA, classB }: ComparePanelProps) {
  const avgA = classA.instructorIds.map((id) => instructorMap.get(id)?.rating ?? 0).reduce((sum, value) => sum + value, 0) / classA.instructorIds.length;
  const avgB = classB.instructorIds.map((id) => instructorMap.get(id)?.rating ?? 0).reduce((sum, value) => sum + value, 0) / classB.instructorIds.length;
  const gpaWinner = winnerClass(classA.avgGPA, classB.avgGPA);
  const studentsWinner = winnerClass(classA.totalStudents, classB.totalStudents);
  const ratingWinner = winnerClass(avgA, avgB);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {[classA, classB].map((course) => (
          <div key={course.code} className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-[#111111]">{course.code}</div>
              <div className="text-sm text-[#6B7280]">{course.name}</div>
            </div>
            <GradeChart gradeDistribution={course.gradeDistribution} medianGrade={course.medianGrade} height={300} />
            <div className="grid gap-3">
              {course.instructorIds.map((id) => {
                const instructor = instructorMap.get(id);
                if (!instructor) return null;
                return <InstructorCard key={id} instructor={instructor} condensed />;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card p-4">
        <div className="section-label mb-3">Comparison Snapshot</div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Average GPA</div>
            <div className={`mt-1 text-sm font-semibold ${gpaWinner.a}`}>{classA.code}: {classA.avgGPA.toFixed(2)}</div>
            <div className={`text-sm font-semibold ${gpaWinner.b}`}>{classB.code}: {classB.avgGPA.toFixed(2)}</div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Median grade</div>
            <div className="mt-1 text-sm font-semibold">{classA.code}: {classA.medianGrade}</div>
            <div className="text-sm font-semibold">{classB.code}: {classB.medianGrade}</div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Total students</div>
            <div className={`mt-1 text-sm font-semibold ${studentsWinner.a}`}>{classA.code}: {classA.totalStudents}</div>
            <div className={`text-sm font-semibold ${studentsWinner.b}`}>{classB.code}: {classB.totalStudents}</div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Instructor ratings</div>
            <div className={`mt-1 text-sm font-semibold ${ratingWinner.a}`}>{classA.code}: {avgA.toFixed(1)}</div>
            <div className={`text-sm font-semibold ${ratingWinner.b}`}>{classB.code}: {avgB.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="section-label mb-2">Which Should I Take?</div>
        <p className="text-sm leading-7 text-[#111111]">
          {classA.code} has a {classA.avgGPA >= classB.avgGPA ? 'higher' : 'lower'} average GPA ({classA.avgGPA.toFixed(2)} vs {classB.avgGPA.toFixed(2)}) and
          {` `}
          {classA.totalStudents >= classB.totalStudents ? 'more' : 'fewer'} students in the dataset. {classB.code} {avgB >= avgA ? 'edges ahead' : 'trails'} on instructor
          ratings ({avgB.toFixed(1)} vs {avgA.toFixed(1)}), so the better choice depends on whether you want the gentler grade profile or the stronger teaching reviews.
        </p>
      </div>
    </div>
  );
}
