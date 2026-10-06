import { corsOptions, json, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';
import { readJsonObject } from '../_validate.js';

function coercePin(row) {
  return { ...row, resolved: row.resolved === 1 || row.resolved === true };
}

export function onRequestOptions() {
  return corsOptions();
}

export async function onRequestPatch({ request, env, params }) {
  const { id } = params;

  const body = await readJsonObject(request, 1024);
  if (!body) return err('Invalid JSON');

  if (typeof body.resolved !== 'boolean') return err('resolved (boolean) is required');

  const resolvedInt = body.resolved ? 1 : 0;
  try {
    const row = await env.DB.prepare(
      'UPDATE pins SET resolved = ? WHERE id = ? RETURNING *'
    ).bind(resolvedInt, id).first();

    if (!row) return err('Not found', 404);
    return json({ pin: coercePin(row) });
  } catch (e) {
    console.error('pins PATCH failed', e);
    return err('Database error', 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);

  const { id } = params;
  try {
    const result = await env.DB.prepare(
      'DELETE FROM pins WHERE id = ?'
    ).bind(id).run();

    if (result.meta.changes === 0) return err('Not found', 404);
    return json({ ok: true });
  } catch (e) {
    console.error('pins DELETE failed', e);
    return err('Database error', 500);
  }
}
