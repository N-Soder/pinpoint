import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as reviewLink from '../../functions/api/review-links/[id].js';
import { onRequestGet as listPins, onRequestPost as createPin, onRequestOptions as pinsOptions } from '../../functions/api/pins/index.js';
import { onRequestPatch as patchPin } from '../../functions/api/pins/[id].js';
import { onRequestDelete as deleteProject } from '../../functions/api/projects/[id].js';
import { ADMIN_TOKEN, PIN_ID, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

let env;
beforeEach(() => {
  env = makeEnv();
  seedProject(env);
});

const admin = { token: ADMIN_TOKEN };
const link = (method, extra = {}) =>
  call(reviewLink[`onRequest${method}`], { env, method: method.toUpperCase(), params: { id: PROJECT_ID }, ...extra });
/** Turn the review link on and return its token. */
const requireLink = async () => (await link('Put', admin)).data.review_token;

const list = (extra = {}) => call(listPins, { env, path: `/api/pins?project_id=${PROJECT_ID}`, ...extra });
const post = (extra = {}, body = validPin()) => call(createPin, { env, method: 'POST', body, ...extra });
const resolve = (extra = {}, body = { resolved: true, project_id: PROJECT_ID }) =>
  call(patchPin, { env, method: 'PATCH', params: { id: PIN_ID }, body, ...extra });
const pinCount = () => env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n;

describe('/api/review-links/:projectId', () => {
  it.each(['Get', 'Put', 'Delete'])('%s requires an admin session', async (method) => {
    const res = await link(method);
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('is off until turned on', async () => {
    expect((await link('Get', admin)).data).toEqual({ review_token: null });
  });

  it('creates a long random token and shows it to the admin again later', async () => {
    const token = await requireLink();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await link('Get', admin)).data).toEqual({ review_token: token });
  });

  it('replaces the token when asked again, so the old link stops working', async () => {
    const first = await requireLink();
    const second = await requireLink();
    expect(second).not.toBe(first);
    expect((await list({ review: first })).status).toBe(401);
    expect((await list({ review: second })).status).toBe(200);
  });

  it('turns off again', async () => {
    await requireLink();
    expect((await link('Delete', admin)).status).toBe(200);
    expect((await link('Get', admin)).data).toEqual({ review_token: null });
    expect((await list()).status).toBe(200);
  });

  it('answers 404 for an unknown project and 400 for a malformed id', async () => {
    const unknown = await call(reviewLink.onRequestPut, { env, method: 'PUT', params: { id: uuid(404) }, ...admin });
    expect(unknown.status).toBe(404);
    const malformed = await call(reviewLink.onRequestPut, { env, method: 'PUT', params: { id: 'abc' }, ...admin });
    expect(malformed.status).toBe(400);
  });

  it('goes when the project is deleted', async () => {
    await requireLink();
    await call(deleteProject, { env, method: 'DELETE', params: { id: PROJECT_ID }, ...admin });
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM review_tokens').get().n).toBe(0);
  });
});

describe('a project that requires a review link', () => {
  let token;
  beforeEach(async () => {
    await post();
    token = await requireLink();
  });

  it.each([
    ['no token', undefined],
    ['a wrong token', 'A'.repeat(32)],
    ['the review=1 of an ordinary link', '1'],
  ])('refuses to list pins with %s', async (_label, review) => {
    const res = await list({ review });
    expect(res.status).toBe(401);
    expect(res.data).not.toHaveProperty('pins');
    // The widget on another site must be able to see the refusal.
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('lists pins with the token, or for a signed-in admin', async () => {
    expect((await list({ review: token })).data.pins).toHaveLength(1);
    expect((await list(admin)).data.pins).toHaveLength(1);
  });

  it('refuses a new pin without the token, stores nothing and notifies nobody', async () => {
    const waitUntil = vi.fn();
    env.NTFY_TOPIC = 'my-topic';
    const res = await post({ waitUntil }, validPin({ id: uuid(101) }));
    expect(res.status).toBe(401);
    expect(pinCount()).toBe(1);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('accepts a new pin with the token', async () => {
    expect((await post({ review: token }, validPin({ id: uuid(101) }))).status).toBe(201);
    expect(pinCount()).toBe(2);
  });

  it('refuses to resolve without the token, and resolves with it or as admin', async () => {
    const resolved = () => env.DB.raw.prepare('SELECT resolved FROM pins WHERE id = ?').get(PIN_ID).resolved;
    expect((await resolve()).status).toBe(401);
    expect(resolved()).toBe(0);
    expect((await resolve({ review: token })).status).toBe(200);
    expect(resolved()).toBe(1);
    expect((await resolve(admin, { resolved: false })).status).toBe(200);
    expect(resolved()).toBe(0);
  });

  it('cannot be sidestepped by naming a project that needs no link', async () => {
    seedProject(env, uuid(2));
    const res = await resolve({}, { resolved: true, project_id: uuid(2) });
    expect(res.status).toBe(404);
    expect(env.DB.raw.prepare('SELECT resolved FROM pins WHERE id = ?').get(PIN_ID).resolved).toBe(0);
  });

  it('does not accept one project\'s token for another', async () => {
    seedProject(env, uuid(2));
    const other = (await call(reviewLink.onRequestPut, { env, method: 'PUT', params: { id: uuid(2) }, ...admin })).data.review_token;
    expect((await list({ review: other })).status).toBe(401);
  });

  it('leaves projects without a link open as before', async () => {
    seedProject(env, uuid(2));
    const res = await call(listPins, { env, path: `/api/pins?project_id=${uuid(2)}` });
    expect(res.status).toBe(200);
  });
});

describe('review links before the table exists', () => {
  it('keeps the pin endpoints working as they were, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.DB.raw.exec('DROP TABLE review_tokens');
    expect((await post()).status).toBe(201);
    expect((await list()).data.pins).toHaveLength(1);
    expect((await resolve()).status).toBe(200);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('CORS', () => {
  it('lets the widget send the review token header', () => {
    expect(pinsOptions().headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Pinpoint-Review');
  });
});
