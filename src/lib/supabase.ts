import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Server-only Supabase client.
 *
 * The service-role key bypasses Row Level Security, which is exactly why it must
 * never reach the browser. Every table has RLS enabled with no anon policies, so
 * the *only* way in or out of the database is through the API routes in
 * src/pages/api/ — which import this module and run on the server.
 *
 * Nothing here is safe to import from a component that runs in the browser.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. Run `vercel env pull` to fetch SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/** True when the environment has everything the database calls need. */
export function isSupabaseConfigured(): boolean {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
}
