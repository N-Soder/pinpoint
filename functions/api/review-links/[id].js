import { sameOriginOptions, json, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';
import { isUuid } from '../_validate.js';
import { newReviewToken } from '../_review.js';

// Admin only. `id` is the project's id. See ../_review.js for what a review link is.

export function onRequestOptions() {
  return sameOriginOptions();
}

/** The project's review token, or null if it does not require a review link. */
export async function onRequestGet({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);
  try {
    const row = await env.DB.prepare('SELECT token FROM review_tokens WHERE project_id = ?').bind(params.id).first();
    return json({ review_token: row ? row.token : null });
  } catch (e) {
    console.error('review-links GET failed', e);
    return err('Database error', 500);
  }
}

/** Require a review link, or replace the current one (the old link stops working). */
export async function onRequestPut({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);
  if (!isUuid(params.id)) return err('Project id must be a UUID');

  const review_token = newReviewToken();
  try {
    await env.DB.prepare(`
      INSERT INTO review_tokens (project_id, token, created_at) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET token = excluded.token, created_at = excluded.created_at
    `).bind(params.id, review_token, Date.now()).run();
    return json({ review_token });
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY')) return err('Project not found', 404);
    console.error('review-links PUT failed', e);
    return err('Database error', 500);
  }
}

/** Stop requiring a review link: the project ID alone is enough again. */
export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);
  try {
    await env.DB.prepare('DELETE FROM review_tokens WHERE project_id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch (e) {
    console.error('review-links DELETE failed', e);
    return err('Database error', 500);
  }
}
