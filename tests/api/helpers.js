import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createSession, SESSION_COOKIE } from '../../functions/api/_auth.js';

const SCHEMA = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');

export const ADMIN_PASSWORD = 'test-admin-password';
/** A valid admin session token for ADMIN_PASSWORD. */
export const ADMIN_TOKEN = (await createSession({ ADMIN_PASSWORD })).token;

/** Deterministic UUIDs — the API only accepts UUID ids. */
export const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const PROJECT_ID = uuid(1);
export const PIN_ID = uuid(100);

/**
 * Minimal D1 shim over an in-memory node:sqlite database loaded with
 * db/schema.sql — enough of the prepare/bind/first/all/run surface
 * that the Pages Functions use.
 */
export function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const plain = (row) => (row ? { ...row } : null);

  function statement(sql, args = []) {
    return {
      bind: (...next) => statement(sql, next),
      first: async () => plain(db.prepare(sql).get(...args)),
      all: async () => ({ results: db.prepare(sql).all(...args).map(plain) }),
      run: async () => {
        const { changes } = db.prepare(sql).run(...args);
        return { meta: { changes: Number(changes) } };
      },
    };
  }

  return { prepare: (sql) => statement(sql), raw: db };
}

export function makeEnv(overrides = {}) {
  return { DB: makeDb(), ADMIN_PASSWORD, ...overrides };
}

/** Build a Pages Functions context and invoke `handler`. */
export async function call(handler, {
  env,
  method = 'GET',
  path = '/',
  body,
  rawBody,
  token,
  origin,
  params = {},
  waitUntil = () => {},
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Cookie = `${SESSION_COOKIE}=${token}`;
  if (origin) headers.Origin = origin;
  const request = new Request(`https://pinpoint.test${path}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const res = await handler({ request, env, params, waitUntil });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
}

export function seedProject(env, id = PROJECT_ID) {
  env.DB.raw
    .prepare('INSERT INTO projects (id, name, site_url, created_at) VALUES (?, ?, ?, ?)')
    .run(id, 'Test Project', 'https://example.com', 1000);
  return id;
}

export function validPin(overrides = {}) {
  return {
    id: PIN_ID,
    project_id: PROJECT_ID,
    page_url: 'https://example.com/about',
    element_selector: 'main > h1',
    comment: 'Typo in heading',
    ...overrides,
  };
}
