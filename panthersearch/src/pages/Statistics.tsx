import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import StatsRankList from '../components/StatsRankList';
import { classes } from '../data/classes';

export default function Statistics() {
  const navigate = useNavigate();
  const easiest = [...classes].sort((a, b) => b.avgGPA - a.avgGPA).slice(0, 15);
  const hardest = [...classes].sort((a, b) => a.avgGPA - b.avgGPA).slice(0, 15);
  const mostTaken = [...classes].sort((a, b) => b.totalStudents - a.totalStudents).slice(0, 15);

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#111111]">Statistics</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Course difficulty, instructor statistics, teaching load, and more.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
          <button type="button" onClick={() => navigate('/compare')} className="btn-outline">
            Compare two classes
          </button>
          <div className="w-full xl:w-[420px]">
            <SearchBar compact onSearch={(query) => navigate(`/?q=${encodeURIComponent(query)}`)} placeholder="Search stats by class or instructor..." />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <StatsRankList title="Easiest Classes (By Avg GPA)" subtitle="Numeric grades only." items={easiest} mode="gpa" gpaColor="#16A34A" />
        <StatsRankList title="Hardest Classes (By Avg GPA)" subtitle="Numeric grades only." items={hardest} mode="gpa" gpaColor="#DC2626" />
        <StatsRankList title="Most Taken Classes" subtitle="Total students across all terms in our data." items={mostTaken} mode="students" />
      </div>
    </div>
  );
}
