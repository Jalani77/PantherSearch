import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import type { LiveGradesResponse } from '../types';
import { readJsonCache, safeCacheKey, writeJsonCache } from '../utils/cache';
import { normalizeCourseCode, resolveCourseName } from '../utils/normalize';

const IPORT_TTL_MS = 24 * 60 * 60 * 1000;
const IPORT_URL = 'https://iport.gsu.edu';

async function tryTableauDiscovery(courseCode: string) {
  const response = await fetch(IPORT_URL, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'PantherSearch/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`IPORT homepage failed with ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const tableauScript = $('script')
    .map((_, node) => $(node).html() ?? '')
    .get()
    .find((content) => content.includes('bootstrapSession') || content.includes('tableau'));

  if (!tableauScript) {
    return null;
  }

  const urlMatch = tableauScript.match(/https?:\/\/[^"']+/);
  return urlMatch?.[0] ?? null;
}

async function scrapeWithPuppeteer(courseCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(IPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    const discoveredRows = await page.evaluate((requestedCourseCode) => {
      const text = document.body.innerText;
      if (!text.toLowerCase().includes('grades')) {
        return [];
      }

      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      const matching = lines.filter((line) => line.toUpperCase().includes(requestedCourseCode.toUpperCase()));

      return matching.map((line, index) => ({
        term: `Term ${index + 1}`,
        instructor: 'Unknown',
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0, W: 0, WF: 0 },
        totalStudents: 0,
        avgGPA: 0,
        raw: line,
      }));
    }, courseCode);

    return discoveredRows;
  } finally {
    await browser.close();
  }
}

export async function fetchIportGrades(courseCode: string) {
  const normalized = normalizeCourseCode(courseCode);
  const cacheKey = safeCacheKey(normalized);
  const cached = await readJsonCache<LiveGradesResponse>('grades', cacheKey, IPORT_TTL_MS);
  if (cached) return cached;

  const tableauHint = await tryTableauDiscovery(normalized);
  const scrapedRows = await scrapeWithPuppeteer(normalized);

  const payload: LiveGradesResponse = {
    courseCode: normalized,
    courseName: resolveCourseName(normalized),
    semesters: scrapedRows
      .filter((row) => row.totalStudents > 0)
      .map((row) => ({
        term: row.term,
        instructor: row.instructor,
        gradeDistribution: row.gradeDistribution,
        totalStudents: row.totalStudents,
        avgGPA: row.avgGPA,
      })),
    cachedAt: new Date().toISOString(),
    source: tableauHint ?? IPORT_URL,
  };

  await writeJsonCache('grades', cacheKey, payload);
  return payload;
}
