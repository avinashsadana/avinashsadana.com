import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Every piece of content on the site is validated here before the build
 * succeeds. A missing field or a malformed date fails `npm run build` with a
 * readable error rather than shipping a broken page.
 */

const highlight = z.string().min(1);

const experience = defineCollection({
  loader: glob({ base: './src/content/experience', pattern: '**/*.md' }),
  schema: z.object({
    role: z.string(),
    org: z.string(),
    orgUrl: z.url().optional(),
    location: z.string().optional(),
    /** Human-readable, e.g. "Jun 2025". Kept as text because months are all we have. */
    start: z.string(),
    end: z.string().optional(),
    current: z.boolean().default(false),
    kind: z.enum(['role', 'internship']).default('role'),
    summary: z.string(),
    highlights: z.array(highlight).default([]),
    projects: z
      .array(z.object({ title: z.string(), detail: z.string() }))
      .default([]),
    /** Lower numbers sort first. */
    order: z.number(),
  }),
});

/**
 * Current project & programme management work. Separate from `experience`
 * because it is ongoing delivery work rather than a past position.
 */
const programs = defineCollection({
  loader: glob({ base: './src/content/programs', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    org: z.string(),
    orgUrl: z.url().optional(),
    start: z.string(),
    end: z.string().optional(),
    current: z.boolean().default(false),
    summary: z.string(),
    highlights: z.array(highlight).default([]),
    /** Frameworks and tools actually used, e.g. "Lean Six Sigma", "MS Project". */
    methods: z.array(z.string()).default([]),
    order: z.number(),
    draft: z.boolean().default(false),
  }),
});

const ventures = defineCollection({
  loader: glob({ base: './src/content/ventures', pattern: '**/*.md' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    role: z.string(),
    start: z.string(),
    end: z.string().optional(),
    current: z.boolean().default(false),
    url: z.url().optional(),
    summary: z.string(),
    highlights: z.array(highlight).default([]),
    stats: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    order: z.number(),
  }),
});

const endurance = defineCollection({
  loader: glob({ base: './src/content/endurance', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['race', 'ride', 'run', 'triathlon', 'ambassador']),
    year: z.string().optional(),
    location: z.string().optional(),
    distanceKm: z.number().optional(),
    result: z.string().optional(),
    summary: z.string(),
    featured: z.boolean().default(false),
    order: z.number(),
  }),
});

const writing = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const capabilities = defineCollection({
  loader: file('src/content/data/capabilities.yaml'),
  schema: z.object({
    id: z.string(),
    group: z.string(),
    blurb: z.string().optional(),
    items: z.array(z.string()).min(1),
    order: z.number(),
  }),
});

const certifications = defineCollection({
  loader: file('src/content/data/certifications.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    issuer: z.string(),
    year: z.string().optional(),
    order: z.number(),
  }),
});

const education = defineCollection({
  loader: file('src/content/data/education.yaml'),
  schema: z.object({
    id: z.string(),
    degree: z.string(),
    field: z.string().optional(),
    institution: z.string(),
    location: z.string().optional(),
    start: z.string(),
    end: z.string(),
    note: z.string().optional(),
    order: z.number(),
  }),
});

const achievements = defineCollection({
  loader: file('src/content/data/achievements.yaml'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string().optional(),
    year: z.string().optional(),
    category: z.enum(['leadership', 'academic', 'sport', 'creative']),
    order: z.number(),
  }),
});

const books = defineCollection({
  loader: file('src/content/data/books.yaml'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    /** Left out where the author is uncertain — better blank than wrong. */
    author: z.string().optional(),
    shelf: z.enum(['spirit', 'business', 'mind', 'adventure', 'ideas', 'verse']),
    order: z.number(),
  }),
});

const timeline = defineCollection({
  loader: file('src/content/data/timeline.yaml'),
  schema: z.object({
    id: z.string(),
    lane: z.enum(['work', 'education', 'ventures', 'sport', 'creative']),
    label: z.string(),
    detail: z.string(),
    startYear: z.number().int(),
    /** Omitted for anything still running. */
    endYear: z.number().int().optional(),
    order: z.number(),
  }),
});

export const collections = {
  books,
  timeline,
  experience,
  programs,
  ventures,
  endurance,
  writing,
  capabilities,
  certifications,
  education,
  achievements,
};
