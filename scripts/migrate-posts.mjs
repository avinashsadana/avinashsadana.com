/**
 * One-off: moves the file-based articles into the posts table.
 *
 * Run once. It is idempotent — an article already in the database is skipped,
 * so re-running cannot duplicate or overwrite anything.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DIR = 'src/content/writing';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Minimal frontmatter reader — enough for the fields these files use. */
function parse(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const [, front, body] = match;
  const data = {};
  let key = null;

  for (const line of front.split('\n')) {
    if (/^\s*#/.test(line)) continue;

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && key) {
      (data[key] ||= []).push(listItem[1].trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    const pair = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!pair) {
      // Continuation of a folded block scalar.
      if (key && typeof data[key] === 'string' && line.trim()) {
        data[key] = `${data[key]} ${line.trim()}`.trim();
      }
      continue;
    }

    key = pair[1];
    const value = pair[2].trim();
    if (value === '>-' || value === '>' || value === '|') data[key] = '';
    else if (value === '') data[key] = [];
    else data[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return { data, body: body.trim() };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
let inserted = 0;
let skipped = 0;

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const parsed = parse(readFileSync(`${DIR}/${file}`, 'utf8'));
  if (!parsed) {
    console.log(`  ! could not parse ${file}`);
    continue;
  }

  const { data: existing } = await supabase.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) {
    skipped += 1;
    console.log(`  = ${slug} (already there)`);
    continue;
  }

  const { error } = await supabase.from('posts').insert({
    slug,
    title: data(parsed, 'title'),
    description: data(parsed, 'description'),
    body: parsed.body,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
    status: String(parsed.data.draft) === 'true' ? 'draft' : 'published',
    pub_date: new Date(parsed.data.pubDate ?? Date.now()).toISOString(),
  });

  if (error) console.log(`  ! ${slug}: ${error.message}`);
  else {
    inserted += 1;
    console.log(`  + ${slug}`);
  }
}

function data(parsed, key) {
  const value = parsed.data[key];
  return typeof value === 'string' ? value : String(value ?? '');
}

console.log(`\ninserted ${inserted}, skipped ${skipped}`);
