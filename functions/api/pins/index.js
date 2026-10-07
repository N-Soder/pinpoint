import { widgetOptions, widgetJson as json, widgetErr as err } from '../_cors.js';
import {
  isUuid, isHttpUrl, isRequiredString, isOptionalString, isOptionalNumber, readJsonObject, scrubPageUrl,
  normalizePageUrl, SCREENSHOT_RE,
} from '../_validate.js';
import { LIMITS, clientOf, hit, retryAfter } from '../_ratelimit.js';
import { MAX_PINS_LISTED, MAX_PINS_PER_PROJECT, PIN_COLUMNS, coercePin } from '../_pins.js';
import { mayUseProject, REVIEW_LINK_REQUIRED } from '../_review.js';

// Widget caps screenshots at 200,000 chars; leave headroom for the rest of the body.
const MAX_BODY_BYTES = 300_000;
const MAX_SCREENSHOT_CHARS = 250_000;

export function onRequestOptions() {
  return widgetOptions();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!isUuid(projectId)) return err('project_id must be a UUID');

  // The widget asks for the page it is on; the dashboard asks for everything.
  const pageUrl = url.searchParams.get('page_url');
  if (pageUrl !== null && !isHttpUrl(pageUrl)) return err('page_url must be an http(s) URL');

  try {
    if (!(await mayUseProject(request, env, projectId))) return err(REVIEW_LINK_REQUIRED, 401);

    const rows = await env.DB.prepare(
      `SELECT ${PIN_COLUMNS} FROM pins WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(projectId, MAX_PINS_LISTED + 1).all();
    let pins = rows.results.slice(0, MAX_PINS_LISTED);
    if (pageUrl !== null) {
      // Compared in normalised form, so pins stored under an older spelling of the URL still match.
      const wanted = normalizePageUrl(pageUrl);
      pins = pins.filter((pin) => normalizePageUrl(pin.page_url) === wanted);
    }
    return json({ pins: pins.map(coercePin), has_more: rows.results.length > MAX_PINS_LISTED });
  } catch (e) {
    console.error('pins GET failed', e);
    return err('Database error', 500);
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  const perClient = await hit(env, 'pins', clientOf(request), LIMITS.pinsPerClient);
  if (!perClient.allowed) return err('Too many requests', 429, retryAfter(perClient));

  const body = await readJsonObject(request, MAX_BODY_BYTES);
  if (!body) return err('Invalid or oversized JSON body');

  const {
    id, project_id, element_selector, comment,
    element_text, element_screenshot, author, browser, viewport,
    x_offset, y_offset,
  } = body;

  if (!isUuid(id) || !isUuid(project_id)) return err('id and project_id must be UUIDs');
  // page_url is rendered as a link in the admin dashboard — only accept
  // real http(s) URLs so javascript:/data: schemes can never be stored.
  if (!isHttpUrl(body.page_url)) return err('page_url must be an http(s) URL');
  const page_url = scrubPageUrl(body.page_url);
  if (!isRequiredString(element_selector, 2000)) return err('element_selector is required (max 2000 chars)');
  if (!isRequiredString(comment, 5000)) return err('comment is required (max 5000 chars)');
  if (!isOptionalString(element_text, 500)) return err('element_text is too long');
  if (!isOptionalString(author, 100)) return err('author is too long');
  if (!isOptionalString(browser, 50)) return err('browser is too long');
  if (!isOptionalString(viewport, 20)) return err('viewport is too long');
  if (!isOptionalNumber(x_offset) || !isOptionalNumber(y_offset)) return err('x_offset/y_offset must be numbers');
  // Screenshots are rendered via <img src>; only inline image data is valid.
  if (
    element_screenshot != null &&
    !(typeof element_screenshot === 'string' &&
      element_screenshot.length <= MAX_SCREENSHOT_CHARS &&
      SCREENSHOT_RE.test(element_screenshot))
  ) {
    return err('element_screenshot must be a base64 JPEG, PNG or WebP data URL under the size limit');
  }

  try {
    if (!(await mayUseProject(request, env, project_id))) return err(REVIEW_LINK_REQUIRED, 401);
  } catch (e) {
    console.error('pins POST failed', e);
    return err('Database error', 500);
  }

  const perProject = await hit(env, 'pins-project', project_id.toLowerCase(), LIMITS.pinsPerProject);
  if (!perProject.allowed) return err('Too many requests', 429, retryAfter(perProject));

  // New pins always start open, timestamped by the server.
  const pin = {
    id, project_id, page_url, element_selector,
    element_text: element_text ?? null,
    comment,
    author: author ?? null,
    browser: browser ?? null,
    viewport: viewport ?? null,
    x_offset: x_offset ?? null,
    y_offset: y_offset ?? null,
    resolved: 0,
    created_at: Date.now(),
  };

  try {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM pins WHERE project_id = ?').bind(project_id).first();
    if (n >= MAX_PINS_PER_PROJECT) {
      return err(`This project has reached its limit of ${MAX_PINS_PER_PROJECT} pins. Delete some in the dashboard to make room.`, 409);
    }

    await env.DB.prepare(`
      INSERT INTO pins (
        id, project_id, page_url, element_selector, element_text,
        element_screenshot, comment, author, browser, viewport,
        x_offset, y_offset, resolved, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pin.id, pin.project_id, pin.page_url, pin.element_selector,
      pin.element_text, element_screenshot ?? null, pin.comment, pin.author,
      pin.browser, pin.viewport, pin.x_offset, pin.y_offset,
      pin.resolved, pin.created_at
    ).run();

    if (env.NTFY_TOPIC) {
      const who = author ? `by ${author}` : 'anonymous';
      waitUntil(fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: `New pin ${who} on ${page_url}\n\n${comment}`,
      }).catch((e) => console.error('ntfy notification failed', e)));
    }

    return json({ pin: coercePin({ ...pin, has_screenshot: element_screenshot != null }) }, 201);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) return err('Pin already exists', 409);
    if (e.message && e.message.includes('FOREIGN KEY')) return err('Project not found', 404);
    console.error('pins POST failed', e);
    return err('Database error', 500);
  }
}
