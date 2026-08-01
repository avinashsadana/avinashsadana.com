import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../../lib/api';
import { isSignedIn } from '../../../lib/admin';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSignedIn(cookies)) return fail('Not signed in.', 401);
  if (!isSupabaseConfigured()) return fail('Database is not configured.', 503);

  const body = await readJson(request);
  const id = typeof body.id === 'string' ? body.id : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!UUID.test(id)) return fail('Invalid id.', 422);

  const supabase = getSupabase();

  switch (action) {
    case 'approve': {
      const { error } = await supabase
        .from('guestbook_entries')
        .update({ approved: true })
        .eq('id', id);
      if (error) return fail('Could not approve that entry.', 500);
      return json({ ok: true });
    }

    case 'unapprove': {
      const { error } = await supabase
        .from('guestbook_entries')
        .update({ approved: false })
        .eq('id', id);
      if (error) return fail('Could not hide that entry.', 500);
      return json({ ok: true });
    }

    case 'delete-entry': {
      const { error } = await supabase.from('guestbook_entries').delete().eq('id', id);
      if (error) return fail('Could not delete that entry.', 500);
      return json({ ok: true });
    }

    case 'mark-read':
    case 'archive': {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status: action === 'archive' ? 'archived' : 'read' })
        .eq('id', id);
      if (error) return fail('Could not update that message.', 500);
      return json({ ok: true });
    }

    case 'delete-message': {
      const { error } = await supabase.from('contact_messages').delete().eq('id', id);
      if (error) return fail('Could not delete that message.', 500);
      return json({ ok: true });
    }

    default:
      return fail('Unknown action.', 422);
  }
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
