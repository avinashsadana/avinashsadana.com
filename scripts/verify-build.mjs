/**
 * Verifies the production build output.
 *
 * Some guarantees only exist after a real build — the sitemap, the prerendered
 * HTML, and the promise that draft content never ships. Those are checked here
 * against dist/ rather than against the dev server, because the dev server does
 * not produce them.
 *
 * Run with: npm run verify:build   (after npm run build)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT = 'dist/client';
const failures = [];
const notes = [];

const fail = (message) => failures.push(message);
const ok = (message) => notes.push(message);

function read(path) {
  return readFileSync(join(CLIENT, path), 'utf8');
}

function has(path) {
  return existsSync(join(CLIENT, path));
}

// --- Prerendered pages -------------------------------------------------------
const expectedPages = [
  'index.html',
  'about/index.html',
  'work/index.html',
  'ventures/index.html',
  'ventures/wedesi-festival/index.html',
  'ventures/cycle-n-chai/index.html',
  'endurance/index.html',
  'writing/index.html',
  'resume/index.html',
  'contact/index.html',
  '404.html',
];

for (const page of expectedPages) {
  if (has(page)) ok(`prerendered ${page}`);
  else fail(`missing prerendered page: ${page}`);
}

// --- SEO artefacts -----------------------------------------------------------
for (const asset of ['sitemap-index.xml', 'robots.txt', 'rss.xml', 'og.jpg', 'avinash-sadana.jpg', 'favicon.svg']) {
  if (has(asset)) ok(`emitted ${asset}`);
  else fail(`missing asset: ${asset}`);
}

if (has('sitemap-index.xml')) {
  const index = read('sitemap-index.xml');
  const referenced = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (referenced.length === 0) fail('sitemap index references no sitemaps');

  const urls = referenced
    .map((url) => url.replace('https://avinashsadana.com/', ''))
    .filter((name) => has(name))
    .flatMap((name) => [...read(name).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

  if (urls.length < expectedPages.length - 1) {
    fail(`sitemap lists only ${urls.length} URLs`);
  } else {
    ok(`sitemap lists ${urls.length} URLs`);
  }

  if (urls.some((url) => url.includes('/admin'))) fail('sitemap exposes /admin');
  else ok('sitemap excludes /admin');

  if (urls.some((url) => url.includes('/api/'))) fail('sitemap exposes API routes');
  else ok('sitemap excludes API routes');
}

// --- Draft content must never ship ------------------------------------------
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

if (existsSync(CLIENT)) {
  const html = walk(CLIENT).map((file) => readFileSync(file, 'utf8')).join('\n');

  if (html.includes('Programme or project name')) {
    fail('the programmes template placeholder leaked into the build');
  } else {
    ok('draft/template content excluded');
  }

  if (html.includes('TODO(avinash)')) fail('a TODO marker leaked into rendered output');

  // A production build must never contain a draft. "Draft" only means anything
  // if this holds.
  if (html.includes('Draft — not public') || html.includes('not published on the live site')) {
    fail('a draft article leaked into the production build');
  } else {
    ok('no drafts in the production build');
  }

  if (has('rss.xml') && read('rss.xml').includes('Draft')) {
    fail('a draft reached the RSS feed');
  }

  // Credentials must never reach a static file.
  for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'service_role', 'ADMIN_PASSWORD']) {
    if (html.includes(secret)) fail(`"${secret}" appears in built HTML`);
  }
  ok('no credential names in built HTML');
}

// --- Structured data ---------------------------------------------------------
if (has('index.html')) {
  const home = read('index.html');
  const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  if (blocks.length === 0) {
    fail('home page has no JSON-LD');
  } else {
    let person = null;
    for (const [, raw] of blocks) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed['@type'] === 'Person') person = parsed;
      } catch {
        fail('home page contains malformed JSON-LD');
      }
    }
    if (person) ok(`Person JSON-LD valid (${person.sameAs?.length ?? 0} sameAs links)`);
    else fail('home page has no Person JSON-LD');
  }

  if (home.includes('rel="canonical"')) ok('canonical URL present');
  else fail('home page has no canonical URL');
}

// --- Serverless functions ----------------------------------------------------
const functionsDir = '.vercel/output/functions';
if (existsSync(functionsDir)) ok('Vercel function bundle produced');
else fail('no Vercel function output — API routes would 404 in production');

// --- Report ------------------------------------------------------------------
console.log(`\n  ${notes.length} checks passed`);
for (const note of notes) console.log(`    ✓ ${note}`);

if (failures.length > 0) {
  console.error(`\n  ${failures.length} FAILED`);
  for (const failure of failures) console.error(`    ✗ ${failure}`);
  process.exit(1);
}

console.log('\n  Build output verified.\n');
