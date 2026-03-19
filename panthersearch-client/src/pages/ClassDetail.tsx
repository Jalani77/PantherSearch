import { ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GradeChart from '../components/GradeChart';
import ReviewCard from '../components/ReviewCard';
import SeatAvailability from '../components/SeatAvailability';
import SemesterTabs from '../components/SemesterTabs';
import { api, liveSemesterToDistribution, redditResponseToReviews } from '../lib/api';
import { useSearchStore } from '../store/searchStore';
import type { ActiveTerm, GradeDistribution, LiveGradeSemester, ProfessorBySlugResponse, RateMyProfessorResponse, Review, ReviewSource, Section } from '../types';
import { emptyDistribution, fromClassSlug, getMedianKey, sumDistributions } from '../utils/format';

type GradeGroup = {
  term: string;
  rows: LiveGradeSemester[];
  distribution: GradeDistribution;
  students: number;
  avgGPA: number;
};

const toCourseKey = (classCode: string) => classCode.toUpperCase().replace(/\s+/g, '-');

const termCodeToLabel = (termCode: string) => {
  if (!termCode || termCode.length < 6) return termCode;
  const year = termCode.slice(0, 4);
  const suffix = termCode.slice(4);
  if (suffix === '01') return `Spring ${year}`;
  if (suffix === '05') return `Summer ${year}`;
  if (suffix === '08') return `Fall ${year}`;
  return termCode;
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
  const classCode = fromClassSlug(code);
  const addRecentlyViewed = useSearchStore((state) => state.addRecentlyViewed);
  const [mode, setMode] = useState<'semester' | 'compare'>('semester');
  const [selectedSemester, setSelectedSemester] = useState('All semesters');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All Sources' | ReviewSource>('All Sources');
  const [sortBy, setSortBy] = useState<'Most Helpful' | 'Most Recent' | 'Lowest Rating' | 'Highest Rating'>('Most Helpful');
  const [courseName, setCourseName] = useState(classCode);
  const [gradesRows, setGradesRows] = useState<LiveGradeSemester[]>([]);
  const [gradesSource, setGradesSource] = useState('');
  const [gradesWarning, setGradesWarning] = useState<string | null>(null);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradesError, setGradesError] = useState<string | null>(null);
  const [seatSections, setSeatSections] = useState<Section[]>([]);
  const [activeTerms, setActiveTerms] = useState<ActiveTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('202605');
  const [seatsUpdated, setSeatsUpdated] = useState('');
  const [seatsSource, setSeatsSource] = useState('GoSOLAR Live Data');
  const [seatsWarning, setSeatsWarning] = useState<string | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsRefreshing, setSeatsRefreshing] = useState(false);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<ProfessorBySlugResponse[]>([]);
  const [instructorRateMyProfessor, setInstructorRateMyProfessor] = useState<Record<string, RateMyProfessorResponse>>({});
  const [redditReviews, setRedditReviews] = useState<Review[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const loadSeats = async (termCode?: string, refreshing = false) => {
    if (refreshing) setSeatsRefreshing(true);
    else setSeatsLoading(true);
    try {
      const seatsResponse = await api.getSeats(classCode, termCode || selectedTerm);
      setSeatSections(seatsResponse.sections || []);
      setSeatsUpdated(seatsResponse.lastUpdated);
      setSeatsSource(seatsResponse.source);
      setSeatsWarning(seatsResponse.warning ?? null);
      if (seatsResponse.activeTerms?.length) {
        setActiveTerms(seatsResponse.activeTerms);
        if (!termCode && seatsResponse.activeTerms.some((term) => term.code === '202605')) setSelectedTerm('202605');
        else if (!termCode && seatsResponse.activeTerms[0]) setSelectedTerm(seatsResponse.activeTerms[0].code);
      }
      setSeatsError(null);
    } catch (error) {
      console.error('ClassDetail seat load failed', error);
      setSeatsError(error instanceof Error ? error.message : 'Unable to load live seats');
    } finally {
      setSeatsLoading(false);
      setSeatsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!classCode) return;
    addRecentlyViewed(classCode);
    void api
      .trackView({
        type: 'course',
        key: toCourseKey(classCode),
      })
      .catch(() => undefined);
  }, [addRecentlyViewed, classCode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setGradesLoading(true);
      setGradesError(null);
      setReviewError(null);
      setFatalError(null);
      try {
        const [catalogResponse, gradesResponse, redditResponse, professorsResponse, termsResponse] = await Promise.all([
          api.getCatalogByCode(classCode).catch(() => null),
          api.getGrades(classCode),
          api.getReddit(classCode, 'query').catch(() => ({ results: [], source: 'Reddit', query: classCode, cachedAt: new Date().toISOString() })),
          api.getProfessors(classCode).catch(() => ({ results: [], source: 'GoSOLAR', cachedAt: new Date().toISOString() })),
          api.getActiveTerms().catch(() => []),
        ]);
        if (cancelled) return;

        if (catalogResponse?.item?.name) setCourseName(catalogResponse.item.name);
        setGradesRows(Array.isArray(gradesResponse.semesters) ? gradesResponse.semesters : []);
        setGradesSource(gradesResponse.source || '');
        setGradesWarning((gradesResponse as any).warning ?? null);
        setRedditReviews(redditResponseToReviews(classCode, undefined, redditResponse));

        const professorResults = professorsResponse.results.slice(0, 8);
        const profiles = await Promise.all(professorResults.map((prof) => api.getProfessorBySlug(prof.slug).catch(() => null)));
        const safeProfiles = profiles.filter((profile): profile is ProfessorBySlugResponse => Boolean(profile?.professor));
        if (!cancelled) setInstructors(safeProfiles);

        const rmpEntries = await Promise.all(
          safeProfiles.map(async (profile) => {
            const slug = profile.professor?.slug;
            if (!slug) return null;
            const payload = await api.getProfessorRateMyProfessor(slug).catch(() => null);
            return payload ? [slug, payload] : null;
          }),
        );
        if (!cancelled) {
          const map: Record<string, RateMyProfessorResponse> = {};
          rmpEntries.forEach((entry) => {
            if (!entry) return;
            map[entry[0]] = entry[1];
          });
          setInstructorRateMyProfessor(map);
        }

        const preferredTerm = termsResponse.some((term) => term.code === '202605') ? '202605' : termsResponse[0]?.code || selectedTerm;
        if (!cancelled) {
          if (termsResponse.length) setActiveTerms(termsResponse);
          setSelectedTerm(preferredTerm);
        }
        await loadSeats(preferredTerm);
      } catch (error) {
        if (cancelled) return;
        console.error('ClassDetail load failed', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        setGradesError(message);
        setReviewError(message);
        setFatalError('Something went wrong while loading this class. Please refresh or try another class.');
      } finally {
        if (!cancelled) setGradesLoading(false);
      }
    };

    if (classCode) {
      void load();
    } else {
      setFatalError('Class code is missing from the URL.');
      setGradesLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [classCode]);

  const groupedSemesters = useMemo(() => aggregateGradeRows(gradesRows), [gradesRows]);

  useEffect(() => {
    if (!groupedSemesters.length) return;
    if (!compareA) setCompareA(groupedSemesters[0].term);
    if (!compareB) setCompareB(groupedSemesters[Math.min(1, groupedSemesters.length - 1)].term);
  }, [groupedSemesters, compareA, compareB]);

  const selectedGroup = useMemo(() => {
    const fallbackDistribution = emptyDistribution();
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
    return {
      distribution: semester?.distribution ?? fallbackDistribution,
      students: semester?.students ?? 0,
      avgGPA: semester?.avgGPA ?? 0,
      medianGrade: getMedianKey(semester?.distribution ?? fallbackDistribution),
    };
  }, [groupedSemesters, selectedSemester]);

  const compareGroupA = groupedSemesters.find((group) => group.term === compareA) ?? groupedSemesters[0];
  const compareGroupB = groupedSemesters.find((group) => group.term === compareB) ?? groupedSemesters[1];

  const reviewPool = useMemo(() => {
    const rateMyProfessorReviews = instructors.flatMap((profile) => {
      const slug = profile.professor?.slug;
      if (!slug) return [];
      const rateMyProfessor = instructorRateMyProfessor[slug];
      if (!rateMyProfessor?.hasRateMyProfessorData) return [];
      return (rateMyProfessor.reviews || []).map((review) => ({
        id: review.id || `${slug}-${review.date}-${review.courseCode}`,
        classCode: review.courseCode || classCode,
        instructorId: slug,
        source: 'RateMyProfessors' as const,
        semester: review.courseCode || 'Recent',
        rating: Math.round(review.rating || rateMyProfessor.rating || 0),
        difficulty: Math.round(review.difficulty || rateMyProfessor.difficulty || 0),
        gradeReceived: 'N/A',
        wouldTakeAgain: (rateMyProfessor.wouldTakeAgainPercent || 0) >= 50,
        comment: review.comment || 'No written comment provided.',
        thumbsUp: 0,
        date: review.date || 'Recent',
        tags: rateMyProfessor.tags?.length ? rateMyProfessor.tags.slice(0, 3) : ['RateMyProfessor'],
        title: `${profile.professor?.name || 'Instructor'} on ${review.courseCode || classCode}`,
      }));
    });
    const filtered = [...rateMyProfessorReviews, ...redditReviews].filter((review) => (sourceFilter === 'All Sources' ? true : review.source === sourceFilter));
    return filtered.sort((a, b) => {
      if (sortBy === 'Most Helpful') return b.thumbsUp - a.thumbsUp;
      if (sortBy === 'Most Recent') return b.date.localeCompare(a.date);
      if (sortBy === 'Lowest Rating') return a.rating - b.rating;
      return b.rating - a.rating;
    });
  }, [instructorRateMyProfessor, instructors, classCode, redditReviews, sourceFilter, sortBy]);

  if (fatalError && !gradesRows.length && !seatSections.length) {
    return (
      <div className="page-shell py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="mb-2 font-semibold">Something went wrong</div>
          <div>{fatalError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#111827]">{classCode || code}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">{courseName}</p>
          </div>
        </div>
        <button type="button" className="btn-outline gap-2">
          <Share2 size={16} />
          Share this class
        </button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="btn-outline cursor-default">{instructors.length} professors</div>
        <div className="btn-outline cursor-default">{reviewPool.length} reviews</div>
        <div className="btn-outline cursor-default">{groupedSemesters.length} live semesters</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_340px]">
        <div className="space-y-6">
          <section className="surface-card bg-[#F7F7FB] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label">01 - GRADE DISTRIBUTION</div>
                {gradesSource ? <div className="mt-2 text-caption">Source: {gradesSource}</div> : null}
                {gradesWarning ? <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">{gradesWarning}</div> : null}
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

            {gradesLoading ? <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#6B7280]">Loading grade history...</div> : null}
            {gradesError ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gradesError}</div> : null}

            {!gradesLoading && !gradesError ? (
              mode === 'semester' ? (
                <div className="space-y-4">
                  <SemesterTabs semesters={groupedSemesters.map((item) => item.term)} selected={selectedSemester} onChange={setSelectedSemester} />
                  <div className="grid gap-2 rounded-xl border border-[#DDE3FF] bg-white p-4 md:grid-cols-3">
                    <div>
                      <div className="text-caption">{selectedSemester}</div>
                      <div className="text-sm font-semibold text-[#111827]">Total students: {selectedGroup.students}</div>
                    </div>
                    <div className="text-sm font-medium text-[#111827]">Average grade: {selectedGroup.avgGPA.toFixed(3)}</div>
                    <div className="text-sm font-medium text-[#111827]">Median grade: {selectedGroup.medianGrade}</div>
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
                        <div className="mb-2 text-sm font-semibold text-[#111827]">{compareGroupA.term}</div>
                        <GradeChart gradeDistribution={compareGroupA.distribution} medianGrade={getMedianKey(compareGroupA.distribution)} height={280} />
                      </div>
                    ) : null}
                    {compareGroupB ? (
                      <div>
                        <div className="mb-2 text-sm font-semibold text-[#111827]">{compareGroupB.term}</div>
                        <GradeChart gradeDistribution={compareGroupB.distribution} medianGrade={getMedianKey(compareGroupB.distribution)} height={280} />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            ) : null}
          </section>

          <SeatAvailability
            sections={seatSections}
            activeTerms={activeTerms}
            selectedTerm={selectedTerm}
            onTermChange={(termCode) => {
              setSelectedTerm(termCode);
              void loadSeats(termCode);
            }}
            lastUpdated={seatsUpdated}
            source={seatsSource}
            warning={seatsWarning}
            loading={seatsLoading}
            refreshing={seatsRefreshing}
            onRefresh={() => loadSeats(selectedTerm, true)}
          />
          {seatsError ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{seatsError}</div> : null}

          <section className="surface-card bg-[#F7F7FB] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="section-label">04 - STUDENT REVIEWS</div>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-xl border border-[#D7DCEF] bg-white px-3 py-2 text-sm outline-none focus:border-[#6C2DFF]">
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
                  {source === 'RateMyProfessors' ? 'RateMyProfessor' : source}
                </button>
              ))}
            </div>
            {reviewError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{reviewError}</div> : null}
            {!reviewPool.length ? <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">No reviews available for this class yet.</div> : null}
            <div className="space-y-4">{reviewPool.map((review) => <ReviewCard key={review.id} review={review} />)}</div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface-card bg-[#F8FAFF] p-5">
            <div className="section-label mb-2">02 - INSTRUCTORS</div>
            <div className="mb-4 text-caption">Real instructors from GoSOLAR sections for this class.</div>
            <div className="space-y-3">
              {instructors.map((profile) => {
                const professor = profile.professor;
                if (!professor?.slug) return null;
                const rateMyProfessor = instructorRateMyProfessor[professor.slug];
                const rating = rateMyProfessor?.rating || 0;
                const difficulty = rateMyProfessor?.difficulty || 0;
                const wouldTakeAgain = rateMyProfessor?.wouldTakeAgainPercent || 0;
                const hasRateMyProfessorData = Boolean(rateMyProfessor?.hasRateMyProfessorData);
                return (
                  <div key={professor.slug} className="surface-card bg-white p-4">
                    <div className="mb-1 text-base font-semibold text-[#111827]">{professor.name}</div>
                    <div className="mb-2 text-caption">{(professor.terms || []).map(termCodeToLabel).join(', ') || (professor.campus || []).join(', ')}</div>
                    {hasRateMyProfessorData ? (
                      <>
                        <div className="mb-2">
                          <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#1B3BFF]">
                            <span>Rating</span>
                            <span>{rating.toFixed(1)}/5</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#DBEAFE]">
                            <div className="h-full rounded-full bg-[#1B3BFF]" style={{ width: `${Math.min(100, Math.max(0, (rating / 5) * 100))}%` }} />
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#6C2DFF]">
                            <span>Difficulty</span>
                            <span>{difficulty.toFixed(1)}/5</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#EDE9FE]">
                            <div className="h-full rounded-full bg-[#6C2DFF]" style={{ width: `${Math.min(100, Math.max(0, (difficulty / 5) * 100))}%` }} />
                          </div>
                        </div>
                        <div className="text-sm text-[#111827]">Would take again: {wouldTakeAgain}%</div>
                      </>
                    ) : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        RateMyProfessor data not available for this instructor yet.
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => navigate(`/instructor/${professor.slug}`)} className="btn-black px-3 py-2 text-xs">
                        View instructor <ExternalLink size={12} className="ml-1 inline-block" />
                      </button>
                      {rateMyProfessor?.ratemyprofessorUrl ? (
                        <a href={rateMyProfessor.ratemyprofessorUrl} target="_blank" rel="noreferrer noopener" className="btn-outline px-3 py-2 text-xs">
                          RateMyProfessor
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!instructors.length ? <div className="rounded-md border border-[#E5E7EB] bg-white p-3 text-sm text-[#6B7280]">No instructor records found for this class.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
