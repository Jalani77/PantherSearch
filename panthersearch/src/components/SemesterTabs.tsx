type SemesterTabsProps = {
  semesters: string[];
  selected: string;
  onChange: (semester: string) => void;
};

export default function SemesterTabs({ semesters, selected, onChange }: SemesterTabsProps) {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
      {['All semesters', ...semesters].map((semester) => (
        <button
          key={semester}
          type="button"
          onClick={() => onChange(semester)}
          className={`pill-tab whitespace-nowrap ${selected === semester ? 'pill-tab-active' : ''}`}
        >
          {semester}
        </button>
      ))}
    </div>
  );
}
