/**
 * Review links.
 *
 * By default a project's ID is all it takes to read and add its pins, and the
 * ID is in the embed snippet on the host site. An admin can instead require a
 * review link for a project: its pins are then only available to requests that
 * carry the project's token, which reviewers get as ?review=<token> on the page
 * URL and which never appears in the site's HTML.
 *
 * The token is stored as it is, so the dashboard can show the link again. It
 * guards nothing but pins held in the same database.
 */

import { isAdmin, secretsEqual } from './_auth.js';

export const REVIEW_HEADER = 'X-Pinpoint-Review';

/** 192 random bits as 32 URL-safe characters. */
export function newReviewToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

/** The project's review token, or null when it does not require one. Throws on a database error. */
export async function reviewTokenFor(env, projectId) {
  try {
    const row = await env.DB.prepare('SELECT token FROM review_tokens WHERE project_id = ?').bind(projectId).first();
    return row ? row.token : null;
  } catch (e) {
    // Deployed before the schema was applied: no project can have turned a link on yet.
    if (String(e && e.message).includes('no such table')) {
      console.error('review_tokens table is missing (run npm run db:migrate:remote); review links are unavailable');
      return null;
    }
    throw e;
  }
}

/** Whether this request may read or change the project's pins. Throws on a database error. */
export async function mayUseProject(request, env, projectId) {
  const required = await reviewTokenFor(env, projectId);
  if (required === null) return true;
  const offered = request.headers.get(REVIEW_HEADER);
  if (offered && (await secretsEqual(offered, required))) return true;
  return isAdmin(request, env);
}

export const REVIEW_LINK_REQUIRED = 'This project can only be opened through its review link';
