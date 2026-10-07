import { widgetOptions, widgetJson, widgetErr, json, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';
import { isUuid, readJsonObject } from '../_validate.js';
import { PIN_COLUMNS, coercePin } from '../_pins.js';
import { mayUseProject, REVIEW_LINK_REQUIRED } from '../_review.js';
import { LIMITS, clientOf, hit, retryAfter } from '../_ratelimit.js';

export function onRequestOptions() {
  return widgetOptions();
}

export async function onRequestPatch({ request, env, params }) {
  const { id } = params;

  const limit = await hit(env, 'resolve', clientOf(request), LIMITS.resolvePerClient);
  if (!limit.allowed) return widgetErr('Too many requests', 429, retryAfter(limit));

  const body = await readJsonObject(request, 1024);
  if (!body) return widgetErr('Invalid JSON');

  if (typeof body.resolved !== 'boolean') return widgetErr('resolved (boolean) is required');

  // A pin id alone is not enough: the widget must also name the pin's project,
  // which is what it was given access to. The dashboard's admin session needs neither.
  const admin = await isAdmin(request, env);
  if (!admin && !isUuid(body.project_id)) return widgetErr('project_id must be a UUID');

  const resolvedInt = body.resolved ? 1 : 0;
  try {
    // The update below only touches a pin in the named project, so checking that project's link is enough.
    if (!admin && !(await mayUseProject(request, env, body.project_id))) return widgetErr(REVIEW_LINK_REQUIRED, 401);

    const row = admin
      ? await env.DB.prepare(
        `UPDATE pins SET resolved = ? WHERE id = ? RETURNING ${PIN_COLUMNS}`
      ).bind(resolvedInt, id).first()
      : await env.DB.prepare(
        `UPDATE pins SET resolved = ? WHERE id = ? AND project_id = ? RETURNING ${PIN_COLUMNS}`
      ).bind(resolvedInt, id, body.project_id).first();

    if (!row) return widgetErr('Not found', 404);
    return widgetJson({ pin: coercePin(row) });
  } catch (e) {
    console.error('pins PATCH failed', e);
    return widgetErr('Database error', 500);
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
