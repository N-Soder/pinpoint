import { corsOptions, json, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';
import { isUuid, isHttpUrl, isRequiredString, readJsonObject } from '../_validate.js';

export function onRequestOptions() {
  return corsOptions();
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const includeCounts = url.searchParams.get('include_counts') === '1';

  try {
    let rows;
    if (includeCounts) {
      rows = await env.DB.prepare(`
        SELECT p.id, p.name, p.site_url, p.created_at,
               COUNT(CASE WHEN pi.resolved = 0 THEN 1 END) AS open_pin_count
        FROM projects p
        LEFT JOIN pins pi ON pi.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).all();
    } else {
      rows = await env.DB.prepare(
        'SELECT id, name, site_url, created_at FROM projects ORDER BY created_at DESC'
      ).all();
    }
    return json({ projects: rows.results });
  } catch (e) {
    console.error('projects GET failed', e);
    return err('Database error', 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);

  const body = await readJsonObject(request, 8 * 1024);
  if (!body) return err('Invalid JSON');

  const { id } = body;
  const name = typeof body.name === 'string' ? body.name.trim() : body.name;
  const site_url = typeof body.site_url === 'string' ? body.site_url.trim() : body.site_url;
  if (!isUuid(id)) return err('id must be a UUID');
  if (!isRequiredString(name, 200)) return err('name is required (max 200 chars)');
  if (!isHttpUrl(site_url)) return err('site_url must be an http(s) URL');

  const created_at = Date.now();
  try {
    await env.DB.prepare(
      'INSERT INTO projects (id, name, site_url, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, name, site_url, created_at).run();
    return json({ project: { id, name, site_url, created_at } }, 201);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) return err('Project already exists', 409);
    console.error('projects POST failed', e);
    return err('Database error', 500);
  }
}
