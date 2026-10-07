import { describe, it, expect, beforeEach } from 'vitest';
import * as pins from '../../functions/api/pins/index.js';
import * as pin from '../../functions/api/pins/[id].js';
import * as projects from '../../functions/api/projects/index.js';
import * as project from '../../functions/api/projects/[id].js';
import * as verify from '../../functions/api/auth/verify.js';
import * as session from '../../functions/api/auth/session.js';
import * as site from '../../functions/api/site.js';
import { ADMIN_PASSWORD, ADMIN_TOKEN, PIN_ID, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

const ALLOW_ORIGIN = 'Access-Control-Allow-Origin';

let env;
beforeEach(() => {
  env = makeEnv();
  seedProject(env);
});

// The widget runs on other sites, so the endpoints it calls must be readable cross-origin.
const widgetCalls = {
  'GET /api/pins': () => call(pins.onRequestGet, { env, path: `/api/pins?project_id=${PROJECT_ID}` }),
  'GET /api/pins (error)': () => call(pins.onRequestGet, { env, path: '/api/pins' }),
  'POST /api/pins': () => call(pins.onRequestPost, { env, method: 'POST', body: validPin() }),
  'POST /api/pins (error)': () => call(pins.onRequestPost, { env, method: 'POST', body: {} }),
  'PATCH /api/pins/:id': async () => {
    await call(pins.onRequestPost, { env, method: 'POST', body: validPin() });
    return call(pin.onRequestPatch, { env, method: 'PATCH', params: { id: PIN_ID }, body: { resolved: true } });
  },
  'PATCH /api/pins/:id (error)': () =>
    call(pin.onRequestPatch, { env, method: 'PATCH', params: { id: uuid(404) }, body: { resolved: true } }),
};

// Everything else is only ever called by the dashboard, from the same origin.
const sameOriginCalls = {
  'GET /api/projects': () => call(projects.onRequestGet, { env, token: ADMIN_TOKEN }),
  'GET /api/projects (unauthorised)': () => call(projects.onRequestGet, { env }),
  'POST /api/projects': () =>
    call(projects.onRequestPost, {
      env, method: 'POST', token: ADMIN_TOKEN, body: { id: uuid(2), name: 'Two', site_url: 'https://two.example' },
    }),
  'DELETE /api/projects/:id': () =>
    call(project.onRequestDelete, { env, method: 'DELETE', token: ADMIN_TOKEN, params: { id: PROJECT_ID } }),
  'DELETE /api/pins/:id': () =>
    call(pin.onRequestDelete, { env, method: 'DELETE', token: ADMIN_TOKEN, params: { id: uuid(404) } }),
  'DELETE /api/pins/:id (unauthorised)': () =>
    call(pin.onRequestDelete, { env, method: 'DELETE', params: { id: uuid(404) } }),
  'POST /api/auth/verify': () => call(verify.onRequestPost, { env, method: 'POST', body: { password: ADMIN_PASSWORD } }),
  'POST /api/auth/verify (wrong password)': () =>
    call(verify.onRequestPost, { env, method: 'POST', body: { password: 'nope' } }),
  'GET /api/auth/session': () => call(session.onRequestGet, { env, token: ADMIN_TOKEN }),
  'DELETE /api/auth/session': () => call(session.onRequestDelete, { env, method: 'DELETE', token: ADMIN_TOKEN }),
  'GET /api/site': () => call(site.onRequestGet, { env }),
};

describe('CORS', () => {
  it.each(Object.keys(widgetCalls))('%s is readable from any origin', async (name) => {
    const res = await widgetCalls[name]();
    expect(res.headers.get(ALLOW_ORIGIN)).toBe('*');
  });

  it.each(Object.keys(sameOriginCalls))('%s sends no CORS headers', async (name) => {
    const res = await sameOriginCalls[name]();
    expect(res.headers.get(ALLOW_ORIGIN)).toBeNull();
  });

  it.each([['/api/pins', pins], ['/api/pins/:id', pin]])('preflight for %s allows only what the widget sends', (_path, route) => {
    const res = route.onRequestOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get(ALLOW_ORIGIN)).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PATCH, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it.each([
    ['/api/projects', projects], ['/api/projects/:id', project],
    ['/api/auth/verify', verify], ['/api/auth/session', session], ['/api/site', site],
  ])('preflight for %s grants nothing', (_path, route) => {
    const res = route.onRequestOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get(ALLOW_ORIGIN)).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Headers')).toBeNull();
  });
});

describe('API response headers', () => {
  it.each(Object.keys({ ...widgetCalls, ...sameOriginCalls }))('%s is JSON that is neither sniffed nor stored', async (name) => {
    const res = await ({ ...widgetCalls, ...sameOriginCalls })[name]();
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
