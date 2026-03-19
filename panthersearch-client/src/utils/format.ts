import type { GradeDistribution, GradeKey } from '../types';

export const GRADE_ORDER: GradeKey[] = ['4.0', '3.5', '3.0', '2.5', '2.0', '1.5', '1.0', '0.0', 'I', 'CR', 'NC'];

export const GRADE_COLORS: Record<GradeKey, string> = {
  '4.0': '#16A34A',
  '3.5': '#65A30D',
  '3.0': '#854D0E',
  '2.5': '#CA8A04',
  '2.0': '#C2410C',
  '1.5': '#DC2626',
  '1.0': '#B91C1C',
  '0.0': '#991B1B',
  I: '#9CA3AF',
  CR: '#6B7280',
  NC: '#4B5563'
};

export const slugifyClassCode = (code: string) => code.replace(/\s+/g, '');

export const formatClassRoute = (code: string) => `/class/${slugifyClassCode(code)}`;

export const fromClassSlug = (slug: string) => {
  const match = slug.match(/^([A-Za-z]+)(\d.*)$/);
  if (!match) return slug;
  return `${match[1].toUpperCase()} ${match[2]}`;
};

export const emptyDistribution = (): GradeDistribution => ({
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
  NC: 0
});

export const sumDistributions = (distributions: GradeDistribution[]): GradeDistribution =>
  distributions.reduce((acc, distribution) => {
    GRADE_ORDER.forEach((key) => {
      acc[key] += distribution[key];
    });
    return acc;
  }, emptyDistribution());

export const getDistributionTotal = (distribution: GradeDistribution) =>
  GRADE_ORDER.reduce((sum, key) => sum + distribution[key], 0);

export const getMedianKey = (distribution: GradeDistribution) => {
  const total = getDistributionTotal(distribution);
  if (total === 0) return '4.0';
  let running = 0;
  for (const key of GRADE_ORDER) {
    running += distribution[key];
    if (running >= total / 2) return key;
  }
  return 'NC';
};

export const formatSemesterTimestamp = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
