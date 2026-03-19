import { ArrowLeft, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GradeChart from '../components/GradeChart';
import InstructorCard from '../components/InstructorCard';
import ReviewCard from '../components/ReviewCard';
import SeatAvailability from '../components/SeatAvailability';
import SemesterTabs from '../components/SemesterTabs';
import { classMap } from '../data/classes';
import { instructorMap } from '../data/instructors';
import { useSearchStore } from '../store/searchStore';
import type { GradeDistribution, LiveGradeSemester, ProfessorApiResponse, Review, ReviewSource } from '../types';
import { api, liveSemesterToDistribution, redditResponseToReviews, rmpResponseToReviews } from '../lib/api';
import { fromClassSlug, getMedianKey, sumDistributions } from '../utils/format';

type GradeGroup = {
  term: string;
  rows: LiveGradeSemester[];
  distribution: GradeDistribution;
  students: number;
  avgGPA: number;
};

function aggregateGradeRows(rows: LiveGradeSemester[]) {
  const groups = new Map<string, LiveGradeSemester[]>();
  rows.forEach((row) => {
    const existing = groups.get(row.term) ?? [];
    existing.push(row);
    groups.set(row.term, existing);
  });

  return Array.from(groups.entries()).map(([term, termRows]) => {
    const students = termRows.reduce((sum, row) => sum + row.totalStudents, 0);
    const avgGPA = students ? termRows.reduce((sum, row) => sum + row.avgGPA * row.totalStudents, 0) / students : 0;
    return {
      term,
      rows: termRows,
      distribution: sumDistributions(termRows.map(liveSemesterToDistribution)),
      students,
      avgGPA: Number(avgGPA.toFixed(3)),
    } satisfies GradeGroup;
  });
}

export default function ClassDetail() {
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const addRecentlyViewed = useSearchStore((state) => state.addRecentlyViewed);
  const course = classMap.get(fromClassSlug(code));
  const [mode, setMode] = useState<'semester' | 'compare'>('semester');
  const [selectedSemester, setSelectedSemester] = useState('All semesters');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'All Sources' | ReviewSource>('All Sources');
  const [sortBy, setSortBy] = useState<'Most Helpful' | 'Most Recent' | 'Lowest Rating' | 'Highest Rating'>('Most Helpful');
  const [gradesRows, setGradesRows] = useState<LiveGradeSemester[]>([]);
  const [gradesSource, setGradesSource] = useState('');
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradesError, setGradesError] = useState<string | null>(null);
  const [seatSections, setSeatSections] = useState<any[]>([]);
  const [seatsUpdated, setSeatsUpdated] = useState('');
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [professorData, setProfessorData] = useState<Record<string, ProfessorApiResponse>>({});
  const [redditReviews, setRedditReviews] = useState<Review[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (course) addRecentlyViewed(course.code);
  }, [addRecentlyViewed, course]);

  useEffect(() => {
    if (!course) return;
    let cancelled = false;

    const load = async () => {
      setGradesLoading(true);
      setSeatsLoading(true);
      setGradesError(null);
      setSeatsError(null);
      setReviewError(null);

      try {
        const [gradesResponse, seatsResponse, redditResponse, ...professorResponses] = await Promise.all([
          api.getGrades(course.code),
          api.getSeats(course.code),
          api.getReddit(course.code),
          ...course.instructorIds.map((id) => {
            const instructor = instructorMap.get(id);
            return instructor ? api.getProfessor(instructor.name) : Promise.resolve(null as any);
          }),
        ]);

        if (cancelled) return;

        setGradesRows(gradesResponse.semesters);
        setGradesSource(gradesResponse.source);
        setSeatSections(seatsResponse.sections);
        setSeatsUpdated(seatsResponse.lastUpdated);
        setRedditReviews(redditResponseToReviews(course.code, selectedInstructorId ?? course.instructorIds[0], redditResponse));

        const professorMap = course.instructorIds.reduce<Record<string, ProfessorApiResponse>>((acc, id, index) => {
          if (professorResponses[index]) {
            acc[id] = professorResponses[index];
          }
          return acc;
        }, {});
        setProfessorData(professorMap);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setGradesError(message);
        setSeatsError(message);
        setReviewError(message);
      } finally {
        if (!cancelled) {
          setGradesLoading(false);
          setSeatsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [course]);

  const courseInstructors = useMemo(() => {
    if (!course) return [];
    return course.instructorIds.map((id) => {
      const local = instructorMap.get(id);
      const live = professorData[id]?.professor;
      if (!local) return null;
      return {
        ...local,
        rating: live?.avgRating ?? local.rating,
        difficulty: live?.avgDifficulty ?? local.difficulty,
        wouldTakeAgain: live?.wouldTakeAgainPercent ?? local.wouldTakeAgain,
      };
    }).filter(Boolean);
  }, [course, professorData]);

  const filteredGradeRows = useMemo(() => {
    if (!selectedInstructorId || !course) return gradesRows;
    const instructorName = instructorMap.get(selectedInstructorId)?.name.toLowerCase() ?? '';
    return gradesRows.filter((row) => row.instructor.toLowerCase().includes(instructorName.split(' ').slice(-1)[0] ?? instructorName));
  }, [course, gradesRows, selectedInstructorId]);

  const groupedSemesters = useMemo(() => aggregateGradeRows(filteredGradeRows), [filteredGradeRows]);

  useEffect(() => {
    if (!groupedSemesters.length) return;
    if (!compareA) setCompareA(groupedSemesters[0].term);
    if (!compareB) setCompareB(groupedSemesters[Math.min(1, groupedSemesters.length - 1)].term);
  }, [groupedSemesters, compareA, compareB]);

  const selectedGroup = useMemo(() => {
    if (selectedSemester === 'All semesters') {
      const distribution = sumDistributions(groupedSemesters.map((group) => group.distribution));
      const students = groupedSemesters.reduce((sum, group) => sum + group.students, 0);
      const avgGPA = students ? groupedSemesters.reduce((sum, group) => sum + group.avgGPA * group.students, 0) / students : 0;
      return {
        distribution,
        students,
        avgGPA: Number(avgGPA.toFixed(3)),
        medianGrade: getMedianKey(distribution),
      };
    }

    const semester = groupedSemesters.find((group) => group.term === selectedSemester);
    const distribution = semester?.distribution ?? {
      '4.0': 0,
      '3.5': 0,
      '3.0': 0,
      '2.5': 0,
      '2.0': 0,
      '1.5': 0,
      '1.0': 0,
      '0.0': 0,
      I: 0,
      CR: 0,
      NC: 0,
    };
    return {
      distribution,
      students: semester?.students ?? 0,
      avgGPA: semester?.avgGPA ?? 0,
      medianGrade: getMedianKey(distribution),
    };
  }, [groupedSemesters, selectedSemester]);

  const compareGroupA = groupedSemesters.find((group) => group.term === compareA) ?? groupedSemesters[0];
  const compareGroupB = groupedSemesters.find((group) => group.term === compareB) ?? groupedSemesters[1];

  const reviewPool = useMemo(() => {
    if (!course) return [];
    const rmpReviews = course.instructorIds.flatMap((id) => {
      const instructor = instructorMap.get(id);
      return instructor ? rmpResponseToReviews(course.code, id, instructor.name, professorData[id] ?? { query: instructor.name, found: false, source: 'RMP', cachedAt: new Date().toISOString() }) : [];
    });

    const filtered = [...rmpReviews, ...redditReviews].filter((review) => {
      if (sourceFilter === 'All Sources') return true;
      return review.source === sourceFilter;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'Most Helpful') return b.thumbsUp - a.thumbsUp;
      if (sortBy === 'Most Recent') return b.date.localeCompare(a.date);
      if (sortBy === 'Lowest Rating') return a.rating - b.rating;
      return b.rating - a.rating;
    });
  }, [course, professorData, redditReviews, sourceFilter, sortBy]);

  if (!course) {
    return <div className="page-shell py-16 text-sm text-[#6B7280]">Class not found.</div>;
  }

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#111111]">{course.code}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">{course.name}</p>
          </div>
        </div>
        <button type="button" className="btn-outline gap-2">
          <Share2 size={16} />
          Share this class
        </button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="btn-outline cursor-default">{course.instructorIds.length} professors</div>
        <div className="btn-outline cursor-default">{reviewPool.length} reviews</div>
        <div className="btn-outline cursor-default">{groupedSemesters.length} live semesters</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_340px]">
        <div className="space-y-6">
          <section className="surface-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label">01 - Grade Distribution</div>
                {gradesSource ? <div className="mt-2 text-caption">Source: {gradesSource}</div> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode('semester')} className={`pill-tab ${mode === 'semester' ? 'pill-tab-active' : ''}`}>
                  Grades by semesters
                </button>
                <button type="button" onClick={() => setMode('compare')} className={`pill-tab ${mode === 'compare' ? 'pill-tab-active' : ''}`}>
                  Compare semesters
                </button>
              </div>
            </div>

            {gradesLoading ? <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#6B7280]">Loading live grade data from IPORT...</div> : null}
            {gradesError ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gradesError}</div> : null}

            {!gradesLoading && !gradesError ? (
              mode === 'semester' ? (
                <div className="space-y-4">
                  <SemesterTabs semesters={groupedSemesters.map((item) => item.term)} selected={selectedSemester} onChange={setSelectedSemester} />
                  <div className="grid gap-2 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4 md:grid-cols-3">
                    <div>
                      <div className="text-caption">{selectedSemester}</div>
                      <div className="text-sm font-semibold text-[#111111]">Total students: {selectedGroup.students}</div>
                    </div>
                    <div className="text-sm font-medium text-[#111111]">Average grade: {selectedGroup.avgGPA.toFixed(3)}</div>
                    <div className="text-sm font-medium text-[#111111]">Median grade: {selectedGroup.medianGrade}</div>
                  </div>
                  <GradeChart gradeDistribution={selectedGroup.distribution} medianGrade={selectedGroup.medianGrade} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={compareA} onChange={(event) => setCompareA(event.target.value)} className="surface-card px-4 py-3 outline-none">
                      {groupedSemesters.map((item) => (
                        <option key={item.term} value={item.term}>
                          {item.term}
                        </option>
                      ))}
                    </select>
                    <select value={compareB} onChange={(event) => setCompareB(event.target.value)} className="surface-card px-4 py-3 outline-none">
                      {groupedSemesters.map((item) => (
                        <option key={item.term} value={item.term}>
                          {item.term}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {compareGroupA ? (
                      <div>
                        <div className="mb-2 text-sm font-semibold text-[#111111]">{compareGroupA.term}</div>
                        <GradeChart gradeDistribution={compareGroupA.distribution} medianGrade={getMedianKey(compareGroupA.distribution)} height={280} />
                      </div>
                    ) : null}
                    {compareGroupB ? (
                      <div>
                        <div className="mb-2 text-sm font-semibold text-[#111111]">{compareGroupB.term}</div>
                        <GradeChart gradeDistribution={compareGroupB.distribution} medianGrade={getMedianKey(compareGroupB.distribution)} height={280} />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            ) : null}
          </section>

          {seatsLoading ? <div className="surface-card p-4 text-sm text-[#6B7280]">Loading live seat availability from GoSolar...</div> : null}
          {!seatsLoading ? <SeatAvailability sections={seatSections} lastUpdated={seatsUpdated} onRefresh={() => api.getSeats(course.code).then((response) => { setSeatSections(response.sections); setSeatsUpdated(response.lastUpdated); })} title={seatSections[0]?.semester ?? 'Spring 2026'} /> : null}
          {seatsError ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{seatsError}</div> : null}

          <section className="surface-card p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="section-label">04 - Student Reviews</div>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="surface-card px-3 py-2 text-sm outline-none">
                {['Most Helpful', 'Most Recent', 'Lowest Rating', 'Highest Rating'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['All Sources', 'RateMyProfessors', 'Reddit', 'PantherSearch'] as const).map((source) => (
                <button key={source} type="button" onClick={() => setSourceFilter(source)} className={`pill-tab ${sourceFilter === source ? 'pill-tab-active' : ''}`}>
                  {source}
                </button>
              ))}
            </div>
            {reviewError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{reviewError}</div> : null}
            <div className="space-y-4">
              {reviewPool.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <div className="section-label mb-2">02 - Instructors</div>
            <div className="mb-4 text-caption">Select a box to filter the live grade history by instructor.</div>
            <div className="space-y-3">
              {courseInstructors.map((instructor) =>
                instructor ? (
                  <InstructorCard
                    key={instructor.id}
                    instructor={instructor}
                    selected={selectedInstructorId === instructor.id}
                    semesters={groupedSemesters.slice(0, 4).map((item) => item.term)}
                    onSelect={() => setSelectedInstructorId((current) => (current === instructor.id ? null : instructor.id))}
                  />
                ) : null,
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
