import { sameOriginOptions, err } from '../_cors.js';
import { isAdmin } from '../_auth.js';
import { SCREENSHOT_RE } from '../_validate.js';

export function onRequestOptions() {
  return sameOriginOptions();
}

/**
 * A pin's screenshot, for the dashboard. Pin lists leave screenshots out
 * because they are large; the dashboard loads each one from here, once, and
 * the browser keeps it (a screenshot never changes).
 */
export async function onRequestGet({ request, env, params }) {
  if (!(await isAdmin(request, env))) return err('Unauthorized', 401);

  let row;
  try {
    row = await env.DB.prepare('SELECT element_screenshot FROM pins WHERE id = ?').bind(params.id).first();
  } catch (e) {
    console.error('screenshots GET failed', e);
    return err('Database error', 500);
  }

  // Only ever serve a plain raster image, whatever an older version may have stored.
  const match = SCREENSHOT_RE.exec(row?.element_screenshot ?? '');
  if (!match) return err('Not found', 404);
  const [, type, base64] = match;

  return new Response(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), {
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
