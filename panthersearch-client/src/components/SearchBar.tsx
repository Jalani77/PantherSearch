import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSearchStore } from '../store/searchStore';
import type { SearchResultItem } from '../types';

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
  className = '',
}: SearchBarProps) {
  const navigate = useNavigate();
  const addSearch = useSearchStore((state) => state.addSearch);
  const [internalValue, setInternalValue] = useState(value ?? '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexData, setIndexData] = useState<{ courses: Array<{ code: string; title: string; slug: string }>; instructors: Array<{ name: string; slug: string }> }>({
    courses: [],
    instructors: [],
  });
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

  useEffect(() => {
    let cancelled = false;
    const loadIndex = async () => {
      setLoading(true);
      try {
        const payload = await api.getSearchIndex();
        if (cancelled) return;
        setIndexData({ courses: payload.courses || [], instructors: payload.instructors || [] });
        setIndexReady(true);
        setIndexError(null);
      } catch (error) {
        if (cancelled) return;
        setIndexError(error instanceof Error ? error.message : 'Search index unavailable');
        setIndexReady(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadIndex();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = inputValue.trim();
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!indexReady) return;
      const lower = query.toLowerCase();
      const courseMatches = indexData.courses
        .filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(lower))
        .slice(0, 10)
        .map(
          (course): SearchResultItem => ({
            id: course.code,
            type: 'class',
            title: `${course.code} - ${course.title}`,
            subtitle: 'GSU Course',
            metric: 'Class',
            href: `/class/${course.slug || course.code.replace(/\s+/g, '')}`,
          }),
        );
      const instructorMatches = indexData.instructors
        .filter((instructor) => instructor.name.toLowerCase().includes(lower))
        .slice(0, 10)
        .map(
          (instructor): SearchResultItem => ({
            id: instructor.slug,
            type: 'instructor',
            title: instructor.name,
            subtitle: 'GSU Instructor',
            metric: 'Instructor',
            href: `/instructor/${instructor.slug}`,
          }),
        );
      if (!cancelled) setResults([...courseMatches, ...instructorMatches].slice(0, 16));
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [indexData.courses, indexData.instructors, indexReady, inputValue]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(results.length > 0 && inputValue.trim().length >= 3);
  }, [results, inputValue]);

  const grouped = useMemo(
    () => ({
      classes: results.filter((item) => item.type === 'class'),
      instructors: results.filter((item) => item.type === 'instructor'),
    }),
    [results],
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

  const renderGroup = (items: SearchResultItem[], label: string) => {
    if (!items.length) return null;
    const isInstructorGroup = label === 'Instructors';
    return (
      <div className="px-3 py-2">
        <div className="section-label mb-2">{label}</div>
        <div className={isInstructorGroup ? 'grid gap-1 sm:grid-cols-2' : 'space-y-1'}>
          {items.map((item) => {
            const index = results.findIndex((result) => result.id === item.id && result.type === item.type);
            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => selectResult(item)}
                className={`dropdown-item flex w-full items-center justify-between px-3 py-2.5 text-left ${index === activeIndex ? 'bg-[#EEF2FF]' : ''}`}
              >
                <div>
                  <div className="text-sm font-semibold text-[#111827]">{item.title}</div>
                  <div className="text-xs text-[#6B7280]">{item.subtitle}</div>
                </div>
                <div className="text-sm font-semibold text-[#4338CA]">{item.metric}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={`input-shell flex items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3.5'}`}>
        <Search size={18} className="text-[#6C2DFF]" />
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
          className={`w-full border-0 bg-transparent outline-none placeholder:text-[#94A3B8] ${compact ? 'text-sm' : 'text-base'}`}
        />
        <button type="button" onClick={() => submit(inputValue)} className="btn-black px-4 py-2">
          Search
        </button>
      </div>

      {loading ? <div className="mt-2 px-1 text-xs text-[#6B7280]">Loading search index...</div> : null}
      {!loading && indexError ? <div className="mt-2 px-1 text-xs text-red-600">Search is temporarily unavailable: {indexError}</div> : null}

      {open && results.length > 0 ? (
        <div className="dropdown-panel animate-dropdown absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden">
          {renderGroup(grouped.classes, 'Classes')}
          {grouped.classes.length && grouped.instructors.length ? <div className="mx-3 border-t border-[#E5E7EB]" /> : null}
          {renderGroup(grouped.instructors, 'Instructors')}
        </div>
      ) : null}
    </div>
  );
}
