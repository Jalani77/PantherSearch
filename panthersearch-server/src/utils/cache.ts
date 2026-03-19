import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cacheRoot = path.resolve(process.cwd(), 'server', 'cache');

export async function ensureCacheDir(dirName: string) {
  const dir = path.join(cacheRoot, dirName);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonCache<T>(dirName: string, cacheKey: string, ttlMs: number): Promise<T | null> {
  const dir = await ensureCacheDir(dirName);
  const filePath = path.join(dir, `${cacheKey}.json`);

  try {
    const fileStat = await stat(filePath);
    const ageMs = Date.now() - fileStat.mtimeMs;
    if (ageMs > ttlMs) {
      return null;
    }

    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonCache<T>(dirName: string, cacheKey: string, data: T) {
  const dir = await ensureCacheDir(dirName);
  const filePath = path.join(dir, `${cacheKey}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

export function safeCacheKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
