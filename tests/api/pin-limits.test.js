import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet as listPins, onRequestPost as createPin } from '../../functions/api/pins/index.js';
import { MAX_PINS_LISTED, MAX_PINS_PER_PROJECT } from '../../functions/api/_pins.js';
import { onRequestPatch as patchPin } from '../../functions/api/pins/[id].js';
import { onRequestGet as getScreenshot } from '../../functions/api/screenshots/[id].js';
import { normalizePageUrl } from '../../functions/api/_validate.js';
import { SESSION_COOKIE } from '../../functions/api/_auth.js';
import { SCRUBBED, UNCHANGED } from '../page-url-cases.js';
import { ADMIN_TOKEN, PIN_ID, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

// 1x1 JPEG-ish payload; the API only checks the data URL's shape.
const SHOT_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const SHOT = `data:image/jpeg;base64,${btoa(String.fromCharCode(...SHOT_BYTES))}`;

let env;
beforeEach(() => {
  env = makeEnv();
  seedProject(env);
});

const post = (body) => call(createPin, { env, method: 'POST', body });
const list = (query = '') => call(listPins, { env, path: `/api/pins?project_id=${PROJECT_ID}${query}` });
const insert = (id, pageUrl, createdAt = 1, projectId = PROJECT_ID, screenshot = null) =>
  env.DB.raw.prepare(
    'INSERT INTO pins (id, project_id, page_url, element_selector, comment, element_screenshot, resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(id, projectId, pageUrl, 'h1', 'c', screenshot, createdAt);

describe('GET /api/pins', () => {
  it('leaves screenshots out and says which pins have one', async () => {
    await post(validPin({ element_screenshot: SHOT }));
    await post(validPin({ id: uuid(101) }));
    const { data } = await list();
    expect(data.pins).toHaveLength(2);
    for (const pin of data.pins) expect(pin).not.toHaveProperty('element_screenshot');
    expect(Object.fromEntries(data.pins.map((p) => [p.id, p.has_screenshot]))).toEqual({ [PIN_ID]: true, [uuid(101)]: false });
    expect(data.has_more).toBe(false);
  });

  it('returns one page\'s pins when page_url is given', async () => {
    insert('about', 'https://example.com/about', 1);
    insert('about-slash', 'https://example.com/about/', 2);
    insert('pricing', 'https://example.com/pricing', 3);
    // Stored before credentials were stripped from page URLs.
    insert('about-legacy', 'https://example.com/about?token=last-week', 4);

    const res = await list(`&page_url=${encodeURIComponent('https://example.com/about?review=1&token=today')}`);
    expect(res.status).toBe(200);
    expect(res.data.pins.map((p) => p.id)).toEqual(['about-legacy', 'about-slash', 'about']);
  });

  it.each(['javascript:alert(1)', 'not a url'])('rejects page_url %p', async (pageUrl) => {
    expect((await list(`&page_url=${encodeURIComponent(pageUrl)}`)).status).toBe(400);
  });

  it('returns at most the newest MAX_PINS_LISTED pins and says there are more', async () => {
    for (let i = 0; i < MAX_PINS_LISTED + 1; i++) insert(`pin-${i}`, 'https://example.com', i);
    const { data } = await list();
    expect(data.pins).toHaveLength(MAX_PINS_LISTED);
    expect(data.pins[0].id).toBe(`pin-${MAX_PINS_LISTED}`);
    expect(data.has_more).toBe(true);
  });
});

describe('normalizePageUrl', () => {
  it.each(UNCHANGED)('keeps %s', (url) => {
    expect(normalizePageUrl(url)).toBe(url);
  });

  it.each(SCRUBBED)('%s -> %s', (url, expected) => {
    expect(normalizePageUrl(url)).toBe(expected);
  });

  it('ignores review= and trailing slashes, like the widget', () => {
    expect(normalizePageUrl('https://example.com/list/?page=2&review=1#row-4')).toBe('https://example.com/list?page=2#row-4');
    expect(normalizePageUrl('https://example.com/?review=abc')).toBe('https://example.com/');
  });
});

describe('POST /api/pins', () => {
  it('does not echo the screenshot back', async () => {
    const res = await post(validPin({ element_screenshot: SHOT }));
    expect(res.status).toBe(201);
    expect(res.data.pin).not.toHaveProperty('element_screenshot');
    expect(res.data.pin.has_screenshot).toBe(true);
  });

  it('refuses new pins once a project holds MAX_PINS_PER_PROJECT', async () => {
    for (let i = 0; i < MAX_PINS_PER_PROJECT; i++) insert(`pin-${i}`, 'https://example.com', i);
    const res = await post(validPin());
    expect(res.status).toBe(409);
    expect(res.data.error).toContain(String(MAX_PINS_PER_PROJECT));
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n).toBe(MAX_PINS_PER_PROJECT);

    // Other projects still have room.
    seedProject(env, uuid(2));
    expect((await post(validPin({ project_id: uuid(2) }))).status).toBe(201);
  });
});

describe('PATCH /api/pins/:id', () => {
  const patch = (body, extra = {}) => call(patchPin, { env, method: 'PATCH', params: { id: PIN_ID }, body, ...extra });
  const resolved = () => env.DB.raw.prepare('SELECT resolved FROM pins WHERE id = ?').get(PIN_ID).resolved;
  beforeEach(() => post(validPin({ element_screenshot: SHOT })));

  it('needs the pin\'s project, not just its id', async () => {
    expect((await patch({ resolved: true })).status).toBe(400);
    expect((await patch({ resolved: true, project_id: 'abc' })).status).toBe(400);
    expect(resolved()).toBe(0);
  });

  it('answers 404, and changes nothing, for another project\'s id', async () => {
    seedProject(env, uuid(2));
    expect((await patch({ resolved: true, project_id: uuid(2) })).status).toBe(404);
    expect(resolved()).toBe(0);
  });

  it('resolves with the right project and does not return the screenshot', async () => {
    const res = await patch({ resolved: true, project_id: PROJECT_ID });
    expect(res.status).toBe(200);
    expect(res.data.pin).toMatchObject({ id: PIN_ID, resolved: true, has_screenshot: true });
    expect(res.data.pin).not.toHaveProperty('element_screenshot');
  });

  it('lets a signed-in admin resolve by id alone', async () => {
    expect((await patch({ resolved: true }, { token: ADMIN_TOKEN })).status).toBe(200);
    expect(resolved()).toBe(1);
  });
});

describe('GET /api/screenshots/:id', () => {
  const get = (id, { token } = {}) =>
    getScreenshot({
      request: new Request(`https://pinpoint.test/api/screenshots/${id}`, {
        headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
      }),
      env,
      params: { id },
    });

  it('requires an admin session', async () => {
    await post(validPin({ element_screenshot: SHOT }));
    const res = await get(PIN_ID);
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves the image, cacheable by the admin\'s browser only', async () => {
    await post(validPin({ element_screenshot: SHOT }));
    const res = await get(PIN_ID, { token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual(SHOT_BYTES);
  });

  it('answers 404 for a pin without one, or an unknown pin', async () => {
    await post(validPin());
    expect((await get(PIN_ID, { token: ADMIN_TOKEN })).status).toBe(404);
    expect((await get(uuid(404), { token: ADMIN_TOKEN })).status).toBe(404);
  });

  it('does not serve stored data that is not a plain raster image', async () => {
    // Rows written before the screenshot type was restricted.
    insert('svg', 'https://example.com', 1, PROJECT_ID, 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    insert('html', 'https://example.com', 2, PROJECT_ID, 'data:text/html;base64,PHNjcmlwdD4=');
    expect((await get('svg', { token: ADMIN_TOKEN })).status).toBe(404);
    expect((await get('html', { token: ADMIN_TOKEN })).status).toBe(404);
  });
});
