import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GradeDistribution } from '../types';
import { GRADE_COLORS, GRADE_ORDER } from '../utils/format';

type GradeChartProps = {
  gradeDistribution: GradeDistribution;
  height?: number;
  showMedian?: boolean;
  medianGrade?: string;
};

export default function GradeChart({ gradeDistribution, height = 340, showMedian = true, medianGrade }: GradeChartProps) {
  const data = GRADE_ORDER.map((grade) => ({
    grade,
    count: gradeDistribution[grade],
    color: GRADE_COLORS[grade]
  }));

  return (
    <div className="surface-card p-4">
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 16 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="grade" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#F3F4F6' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.grade} fill={entry.color} />
              ))}
              <LabelList dataKey="count" position="top" fill="#111111" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showMedian && medianGrade ? <div className="mt-2 text-center text-xs text-[#6B7280]">median: {medianGrade}</div> : null}
    </div>
  );
}
