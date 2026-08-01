import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Direct database access for assertions.
 *
 * Tests verify persistence by querying Supabase with the service-role key, the
 * same way the server does. This deliberately avoids adding any test-only
 * endpoint to the application itself — nothing in src/ exists purely for tests.
 */

let client: SupabaseClient | null = null;

export function db(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function contactMessageExists(marker: string): Promise<boolean> {
  const supabase = db();
  if (!supabase) return false;

  const { data } = await supabase
    .from('contact_messages')
    .select('id')
    .ilike('message', `%${marker}%`)
    .limit(1);

  return (data ?? []).length > 0;
}

export async function guestbookEntry(marker: string) {
  const supabase = db();
  if (!supabase) return null;

  const { data } = await supabase
    .from('guestbook_entries')
    .select('id, approved, message')
    .ilike('message', `%${marker}%`)
    .limit(1);

  return (data ?? [])[0] ?? null;
}

/** Removes anything a test run created, so the real site stays clean. */
export async function cleanup(marker: string): Promise<void> {
  const supabase = db();
  if (!supabase) return;

  await supabase.from('contact_messages').delete().ilike('message', `%${marker}%`);
  await supabase.from('guestbook_entries').delete().ilike('message', `%${marker}%`);
}

export async function cleanupAllProbes(): Promise<void> {
  const supabase = db();
  if (!supabase) return;

  await supabase.from('contact_messages').delete().ilike('message', '%pw-%');
  await supabase.from('guestbook_entries').delete().ilike('message', '%pw-%');
  await supabase.from('page_views').delete().eq('path', '/pw-probe');
}
