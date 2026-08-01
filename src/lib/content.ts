import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Ordering helpers. Every collection carries an explicit `order` field so the
 * sequence on the page is controlled from the content file, not from filenames.
 */
const byOrder = <T extends { data: { order: number } }>(a: T, b: T) => a.data.order - b.data.order;

export const getExperience = async () => (await getCollection('experience')).sort(byOrder);

/** Drafts (including the `_template.md` starter) never reach the page. */
export const getPrograms = async () =>
  (await getCollection('programs', ({ data }) => !data.draft)).sort(byOrder);

export const getVentures = async () => (await getCollection('ventures')).sort(byOrder);

export const getEndurance = async () => (await getCollection('endurance')).sort(byOrder);

export const getCapabilities = async () => (await getCollection('capabilities')).sort(byOrder);

export const getCertifications = async () => (await getCollection('certifications')).sort(byOrder);

export const getEducation = async () => (await getCollection('education')).sort(byOrder);

export const getAchievements = async () => (await getCollection('achievements')).sort(byOrder);

/** Published posts, newest first. Drafts are excluded from every build. */
export const getPosts = async () =>
  (await getCollection('writing', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

export type Post = CollectionEntry<'writing'>;
export type Venture = CollectionEntry<'ventures'>;

/** "Jun 2025 — Aug 2025" / "May 2018 — Present" */
export function dateRange(start: string, end?: string, current = false): string {
  if (current) return `${start} — Present`;
  return end ? `${start} — ${end}` : start;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rough read time, used as a courtesy label on posts. */
export function readingTime(body: string | undefined): string {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
