import { Search } from 'lucide-react';
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classes } from '../data/classes';
import { instructors } from '../data/instructors';
import { useSearchStore } from '../store/searchStore';
import type { SearchResultItem } from '../types';
import { formatClassRoute } from '../utils/format';

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  onResultSelect?: (result: SearchResultItem) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
};

export default function SearchBar({
  value,
  onChange,
  onSearch,
  onResultSelect,
  placeholder = "e.g. BUSA 3000, Calculus, Dr. Webb...",
  compact = false,
  className = ''
}: SearchBarProps) {
  const navigate = useNavigate();
  const addSearch = useSearchStore((state) => state.addSearch);
  const [internalValue, setInternalValue] = useState(value ?? '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputValue = value ?? internalValue;

  useEffect(() => {
    setInternalValue(value ?? '');
  }, [value]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (query.length < 3) return [] as SearchResultItem[];

    const classResults: SearchResultItem[] = classes
      .filter((course) => `${course.code} ${course.name} ${course.department}`.toLowerCase().includes(query))
      .slice(0, 6)
      .map((course) => ({
        id: course.code,
        type: 'class',
        title: `${course.code} - ${course.name}`,
        subtitle: course.department,
        metric: `${course.avgGPA.toFixed(2)} GPA`,
        href: formatClassRoute(course.code)
      }));

    const instructorResults: SearchResultItem[] = instructors
      .filter((instructor) => `${instructor.name} ${instructor.department}`.toLowerCase().includes(query))
      .slice(0, 6)
      .map((instructor) => ({
        id: instructor.id,
        type: 'instructor',
        title: instructor.name,
        subtitle: instructor.department,
        metric: `${instructor.rating.toFixed(1)} / 5`,
        href: `/instructor/${instructor.id}`
      }));

    return [...classResults, ...instructorResults];
  }, [inputValue]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(results.length > 0 && inputValue.trim().length >= 3);
  }, [results, inputValue]);

  const grouped = useMemo(
    () => ({
      classes: results.filter((item) => item.type === 'class'),
      instructors: results.filter((item) => item.type === 'instructor')
    }),
    [results]
  );

  const submit = (query: string) => {
    if (!query.trim()) return;
    addSearch(query.trim());
    onSearch?.(query.trim());
    setOpen(false);
  };

  const selectResult = (result: SearchResultItem) => {
    addSearch(result.title);
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      navigate(result.href);
    }
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && results[activeIndex]) {
        selectResult(results[activeIndex]);
      } else {
        submit(inputValue);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={`surface-card flex items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3.5'}`}>
        <Search size={18} className="text-[#6B7280]" />
        <input
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (value === undefined) setInternalValue(nextValue);
            onChange?.(nextValue);
          }}
          onFocus={() => setOpen(results.length > 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full border-0 bg-transparent outline-none placeholder:text-[#9CA3AF] ${compact ? 'text-sm' : 'text-base'}`}
        />
        <button type="button" onClick={() => submit(inputValue)} className="btn-black px-4 py-2">
          Search
        </button>
      </div>

      {open && results.length > 0 ? (
        <div className="surface-card absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden">
          {grouped.classes.length ? (
            <div className="border-b border-[#E5E7EB] px-3 py-2">
              <div className="section-label mb-2">Classes</div>
              <div className="space-y-1">
                {grouped.classes.map((item) => {
                  const index = results.findIndex((result) => result.id === item.id && result.type === item.type);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectResult(item)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-[#F9FAFB] ${index === activeIndex ? 'bg-[#F3F4F6]' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#111111]">{item.title}</div>
                        <div className="text-caption">{item.subtitle}</div>
                      </div>
                      <div className="text-sm font-medium text-[#111111]">{item.metric}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {grouped.instructors.length ? (
            <div className="px-3 py-2">
              <div className="section-label mb-2">Instructors</div>
              <div className="space-y-1">
                {grouped.instructors.map((item) => {
                  const index = results.findIndex((result) => result.id === item.id && result.type === item.type);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectResult(item)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-[#F9FAFB] ${index === activeIndex ? 'bg-[#F3F4F6]' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#111111]">{item.title}</div>
                        <div className="text-caption">{item.subtitle}</div>
                      </div>
                      <div className="text-sm font-medium text-[#111111]">{item.metric}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
