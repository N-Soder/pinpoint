import { corsOptions, json, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';

export function onRequestOptions() {
  return corsOptions();
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);

  const { id } = params;
  try {
    const result = await env.DB.prepare(
      'DELETE FROM projects WHERE id = ?'
    ).bind(id).run();

    if (result.meta.changes === 0) return err('Not found', 404);
    return json({ ok: true });
  } catch (e) {
    console.error('projects DELETE failed', e);
    return err('Database error', 500);
  }
}
