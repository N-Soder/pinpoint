import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestGet as listPins, onRequestPost as createPin } from '../../functions/api/pins/index.js';
import { onRequestPatch as patchPin, onRequestDelete as deletePin } from '../../functions/api/pins/[id].js';
import { onRequestOptions } from '../../functions/api/pins/index.js';
import { ADMIN_TOKEN, PIN_ID, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

let env;
beforeEach(() => {
  env = makeEnv();
  seedProject(env);
});

const post = (body, extra = {}) => call(createPin, { env, method: 'POST', path: '/api/pins', body, ...extra });

describe('POST /api/pins', () => {
  it('creates a pin with defaults and a boolean resolved', async () => {
    const res = await post(validPin());
    expect(res.status).toBe(201);
    expect(res.data.pin).toMatchObject({ ...validPin(), resolved: false, author: null, element_screenshot: null });
    expect(typeof res.data.pin.created_at).toBe('number');

    const row = env.DB.raw.prepare('SELECT * FROM pins WHERE id = ?').get(PIN_ID);
    expect(row.comment).toBe('Typo in heading');
    expect(row.resolved).toBe(0);
  });

  it('stores optional fields', async () => {
    const res = await post(validPin({
      author: 'Sam', browser: 'Firefox', viewport: '1440x900',
      x_offset: 0.25, y_offset: 0.75, element_text: 'Abuot us',
      element_screenshot: 'data:image/jpeg;base64,AAAA',
    }));
    expect(res.status).toBe(201);
    const row = env.DB.raw.prepare('SELECT * FROM pins WHERE id = ?').get(PIN_ID);
    expect(row).toMatchObject({
      author: 'Sam', browser: 'Firefox', viewport: '1440x900',
      x_offset: 0.25, y_offset: 0.75, element_text: 'Abuot us',
    });
  });

  it('ignores client-supplied resolved and created_at', async () => {
    const res = await post(validPin({ resolved: true, created_at: 1 }));
    expect(res.status).toBe(201);
    expect(res.data.pin.resolved).toBe(false);
    const row = env.DB.raw.prepare('SELECT * FROM pins WHERE id = ?').get(PIN_ID);
    expect(row.resolved).toBe(0);
    expect(row.created_at).toBeGreaterThan(1);
  });

  it.each(['id', 'project_id', 'page_url', 'element_selector', 'comment'])('requires %s', async (field) => {
    const res = await post(validPin({ [field]: undefined }));
    expect(res.status).toBe(400);
  });

  it.each(['id', 'project_id'])('rejects a non-UUID %s', async (field) => {
    const res = await post(validPin({ [field]: 'abc' }));
    expect(res.status).toBe(400);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'not a url', 42])('rejects page_url %p', async (page_url) => {
    const res = await post(validPin({ page_url }));
    expect(res.status).toBe(400);
  });

  it.each([
    'https://evil.test/x.png', 'javascript:alert(1)', 'data:text/html,<script>', 42,
    // Only the raster formats a canvas can produce, base64-encoded.
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/jpeg,not-base64',
    'data:image/jpeg;base64,AAAA"><script>',
    'data:image/jpeg;base64,',
  ])(
    'rejects element_screenshot %p',
    async (shot) => {
      const res = await post(validPin({ element_screenshot: shot }));
      expect(res.status).toBe(400);
    },
  );

  it.each(['jpeg', 'png', 'webp'])('accepts a base64 %s screenshot', async (type) => {
    const res = await post(validPin({ element_screenshot: `data:image/${type};base64,iVBORw0KGgo+/A==` }));
    expect(res.status).toBe(201);
  });

  it('stores the page URL without credentials it carried', async () => {
    const res = await post(validPin({ page_url: 'https://example.com/reset?step=2&token=abc123#access_token=xyz' }));
    expect(res.status).toBe(201);
    expect(res.data.pin.page_url).toBe('https://example.com/reset?step=2');
    const row = env.DB.raw.prepare('SELECT page_url FROM pins WHERE id = ?').get(PIN_ID);
    expect(row.page_url).toBe('https://example.com/reset?step=2');
  });

  it.each([
    ['blank comment', { comment: '   ' }],
    ['over-long comment', { comment: 'x'.repeat(5001) }],
    ['over-long selector', { element_selector: 'x'.repeat(2001) }],
    ['over-long author', { author: 'x'.repeat(101) }],
    ['non-numeric offset', { x_offset: '1' }],
    ['non-finite offset', { y_offset: Infinity }],
  ])('rejects %s', async (_label, overrides) => {
    // JSON.stringify turns Infinity into null, so send that one raw.
    const body = JSON.stringify(validPin(overrides)).replace('"y_offset":null', '"y_offset":1e999');
    const res = await call(createPin, { env, method: 'POST', rawBody: body });
    expect(res.status).toBe(400);
  });

  it('rejects a body over the size limit', async () => {
    const res = await post(validPin({ element_screenshot: 'data:image/jpeg;base64,' + 'A'.repeat(400_000) }));
    expect(res.status).toBe(400);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n).toBe(0);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await post(validPin({ project_id: uuid(404) }));
    expect(res.status).toBe(404);
  });

  it('returns 409 for a duplicate id', async () => {
    await post(validPin());
    expect((await post(validPin())).status).toBe(409);
  });

  it.each([['invalid JSON', '{nope'], ['JSON null', 'null'], ['a JSON array', '[]']])('returns 400 for %s', async (_l, rawBody) => {
    const res = await call(createPin, { env, method: 'POST', rawBody });
    expect(res.status).toBe(400);
  });

  it('sends an ntfy notification when NTFY_TOPIC is set', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const waitUntil = vi.fn();
    env.NTFY_TOPIC = 'my-topic';

    await post(validPin({ author: 'Sam' }), { waitUntil });

    expect(waitUntil).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ntfy.sh/my-topic');
    expect(init.body).toContain('by Sam');
    expect(init.body).toContain('Typo in heading');
    fetchMock.mockRestore();
  });

  it('leaves credentials in the page URL out of the notification', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    env.NTFY_TOPIC = 'my-topic';
    await post(validPin({ page_url: 'https://example.com/reset?token=abc123' }));
    const body = fetchMock.mock.calls[0][1].body;
    expect(body).toContain('https://example.com/reset');
    expect(body).not.toContain('abc123');
    fetchMock.mockRestore();
  });

  it('URL-encodes the ntfy topic', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    env.NTFY_TOPIC = 'a/b?c';
    await post(validPin());
    expect(fetchMock.mock.calls[0][0]).toBe('https://ntfy.sh/a%2Fb%3Fc');
    fetchMock.mockRestore();
  });

  it('does not notify when NTFY_TOPIC is unset', async () => {
    const waitUntil = vi.fn();
    await post(validPin(), { waitUntil });
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

describe('GET /api/pins', () => {
  it.each(['', '?project_id=x', '?project_id=1%20OR%201=1'])('requires a UUID project_id (%p)', async (query) => {
    expect((await call(listPins, { env, path: `/api/pins${query}` })).status).toBe(400);
  });

  it('returns only that project\'s pins, newest first, with boolean resolved', async () => {
    const other = seedProject(env, uuid(2));
    // Insert directly: the API timestamps pins itself, so ordering needs fixed created_at values.
    const insert = env.DB.raw.prepare(
      'INSERT INTO pins (id, project_id, page_url, element_selector, comment, resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insert.run('old', PROJECT_ID, 'https://example.com', 'h1', 'c', 0, 1);
    insert.run('new', PROJECT_ID, 'https://example.com', 'h1', 'c', 1, 2);
    insert.run('elsewhere', other, 'https://example.com', 'h1', 'c', 0, 3);

    const res = await call(listPins, { env, path: `/api/pins?project_id=${PROJECT_ID}` });
    expect(res.status).toBe(200);
    expect(res.data.pins.map((p) => [p.id, p.resolved])).toEqual([['new', true], ['old', false]]);
  });
});

describe('PATCH /api/pins/:id', () => {
  const patch = (id, body) => call(patchPin, { env, method: 'PATCH', params: { id }, body });

  it('toggles resolved', async () => {
    await post(validPin());
    const res = await patch(PIN_ID, { resolved: true });
    expect(res.status).toBe(200);
    expect(res.data.pin.resolved).toBe(true);

    const back = await patch(PIN_ID, { resolved: false });
    expect(back.data.pin.resolved).toBe(false);
  });

  it('returns 404 for an unknown pin', async () => {
    expect((await patch(uuid(404), { resolved: true })).status).toBe(404);
  });

  it.each([{}, { resolved: 'yes' }, { resolved: 1 }])('rejects body %p', async (body) => {
    await post(validPin());
    expect((await patch(PIN_ID, body)).status).toBe(400);
  });

  it('returns 400 for a JSON null body', async () => {
    const res = await call(patchPin, { env, method: 'PATCH', params: { id: PIN_ID }, rawBody: 'null' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/pins/:id', () => {
  it('requires admin', async () => {
    await post(validPin());
    expect((await call(deletePin, { env, method: 'DELETE', params: { id: PIN_ID } })).status).toBe(401);
  });

  it('deletes a pin', async () => {
    await post(validPin());
    const res = await call(deletePin, { env, method: 'DELETE', params: { id: PIN_ID }, token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n).toBe(0);
  });

  it('returns 404 for an unknown pin', async () => {
    const res = await call(deletePin, { env, method: 'DELETE', params: { id: uuid(404) }, token: ADMIN_TOKEN });
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('answers preflight with 204 and allow headers', async () => {
    const res = onRequestOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
