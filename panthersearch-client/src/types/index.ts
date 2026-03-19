export type GradeKey =
  | '4.0'
  | '3.5'
  | '3.0'
  | '2.5'
  | '2.0'
  | '1.5'
  | '1.0'
  | '0.0'
  | 'I'
  | 'CR'
  | 'NC';

export type GradeDistribution = Record<GradeKey, number>;

export type SemesterBreakdown = {
  semester: string;
  students: number;
  avgGPA: number;
  gradeDistribution: GradeDistribution;
};

export type ClassRecord = {
  code: string;
  slug: string;
  name: string;
  department: string;
  credits: number;
  description: string;
  totalStudents: number;
  avgGPA: number;
  medianGrade: string;
  semesterCount: number;
  gradeDistribution: GradeDistribution;
  semesterBreakdown: SemesterBreakdown[];
  instructorIds: string[];
  tags: string[];
  viewCount: number;
};

export type Instructor = {
  id: string;
  name: string;
  department: string;
  title: string;
  rating: number;
  difficulty: number;
  wouldTakeAgain: number;
  classIds: string[];
  semestersTaught: string[];
  tags: string[];
  bio: string;
  viewCount: number;
};

export type ReviewSource = 'RateMyProfessors' | 'Reddit' | 'PantherSearch';

export type Review = {
  id: string;
  classCode: string;
  instructorId?: string;
  source: ReviewSource;
  semester: string;
  rating: number;
  difficulty: number;
  gradeReceived: string;
  wouldTakeAgain: boolean;
  comment: string;
  thumbsUp: number;
  date: string;
  tags: string[];
  title?: string;
  url?: string;
  author?: string;
};

export type Section = {
  id: string;
  classCode: string;
  courseTitle?: string;
  subject?: string;
  courseNumber?: string;
  termCode?: string;
  termLabel?: string;
  crn: string;
  instructorId?: string;
  instructorSlug?: string;
  instructorName?: string;
  days: string;
  startTime: string;
  endTime: string;
  location: string;
  campus?: string;
  enrolled: number;
  capacity: number;
  seatsRemaining: number;
  waitlisted: number;
  semester: string;
  isOnline: boolean;
  notes?: string;
};

export type SearchResultItem = {
  id: string;
  type: 'class' | 'instructor';
  title: string;
  subtitle: string;
  metric: string;
  href: string;
};

export type LiveGradeSemester = {
  term: string;
  instructor: string;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
    W: number;
    WF: number;
  };
  totalStudents: number;
  avgGPA: number;
};

export type LiveGradesResponse = {
  courseCode: string;
  courseName: string;
  semesters: LiveGradeSemester[];
  cachedAt: string;
  source: string;
};

export type LiveSeatsResponse = {
  courseCode: string;
  termCode: string;
  termLabel: string;
  activeTerms?: { code: string; label: string }[];
  lastUpdated: string;
  sections: Section[];
  source: string;
  warning?: string | null;
};

export type ActiveTerm = {
  code: string;
  label: string;
};

export type CatalogItem = {
  code: string;
  name: string;
  department: string;
  totalStudents: number;
  openSeats: number;
  sections: number;
  termCount: number;
};

export type CatalogResponse = {
  cachedAt: string;
  source: string;
  items: CatalogItem[];
};

export type CatalogByCodeResponse = {
  cachedAt: string;
  source: string;
  item: CatalogItem;
};

export type ProfessorRosterItem = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  rmpSearchName: string;
  departments: string[];
  campus: string[];
  courses: string[];
  terms: string[];
  sections: any[];
  rmpData: any;
};

export type ProfessorsResponse = {
  cachedAt: string;
  source: string;
  results: ProfessorRosterItem[];
};

export type ProfessorBySlugResponse = {
  cachedAt: string;
  found: boolean;
  source: string;
  professor: ProfessorRosterItem | null;
  rmpData?: ProfessorApiResponse['professor'] | null;
};

export type StatusResponse = {
  lastRefresh: string | null;
  termsLoaded: string[];
  totalSections: number;
  totalProfessors: number;
  sources: {
    banner: { status: 'healthy' | 'degraded'; source: string; warning?: string | null };
    rmp: { status: string };
    reddit: { status: string };
  };
  refresh: {
    banner: string | null;
    rmp: string | null;
    grades: string | null;
  };
  activeTerms: ActiveTerm[];
};

export type RmpReview = {
  id: string;
  comment: string;
  className: string;
  date: string;
  grade: string;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
  ratingTags: string[];
  helpfulRating: number;
  difficultyRating: number;
  attendanceMandatory?: boolean;
};

export type ProfessorApiResponse = {
  cachedAt: string;
  professor?: {
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    avgRating: number;
    avgDifficulty: number;
    wouldTakeAgainPercent: number;
    numRatings: number;
    tags?: string[];
    reviews: RmpReview[];
  };
};

export type ProfessorSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  avgRating: number;
  avgDifficulty: number;
  wouldTakeAgainPercent: number;
  numRatings: number;
  department: string;
};

export type ProfessorSearchResponse = {
  query: string;
  cachedAt: string;
  source?: string;
  roster?: ProfessorRosterItem[];
  results: ProfessorSearchResult[];
};

export type ProfessorApiLegacyResponse = {
  query: string;
  found: boolean;
  source: string;
  cachedAt: string;
  professor?: {
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    avgRating: number;
    avgDifficulty: number;
    wouldTakeAgainPercent: number;
    numRatings: number;
    reviews: RmpReview[];
  };
};

export type RedditResult = {
  id: string;
  title: string;
  url: string;
  permalink: string;
  subreddit: string;
  score: number;
  createdUtc: number;
  author: string;
  selftext: string;
  topComment?: string;
};

export type RedditApiResponse = {
  query: string;
  source: string;
  cachedAt: string;
  results: RedditResult[];
};

export type ViewEntry = {
  type: 'course' | 'professor' | 'class' | 'instructor';
  key: string;
  label: string;
  href: string;
  subtitle: string;
  count: number;
};

export type RateMyProfessorReview = {
  id: string;
  date: string;
  courseCode: string;
  comment: string;
  rating: number;
  difficulty: number;
};

export type RateMyProfessorResponse = {
  cachedAt: string;
  source: string;
  hasRateMyProfessorData: boolean;
  rating: number;
  difficulty: number;
  wouldTakeAgainPercent: number;
  numRatings: number;
  tags: string[];
  reviews: RateMyProfessorReview[];
  ratemyprofessorUrl: string;
  professorSlug?: string;
  error?: string;
};

export type SearchIndexResponse = {
  cachedAt: string;
  source: string;
  courses: Array<{ code: string; title: string; slug: string }>;
  instructors: Array<{ name: string; slug: string }>;
};

export type TrendingResponse = {
  source: string;
  cachedAt: string;
  courses: ViewEntry[];
  professors: ViewEntry[];
};
