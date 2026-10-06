import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE, SESSION_TTL_MS, createSession, isAdmin, verifyAdminSecret, verifySession,
} from '../../functions/api/_auth.js';
import { onRequestPost as verify } from '../../functions/api/auth/verify.js';
import { onRequestGet as getSession, onRequestDelete as endSession } from '../../functions/api/auth/session.js';
import { ADMIN_PASSWORD, ADMIN_TOKEN, call, makeEnv } from './helpers.js';

const env = { ADMIN_PASSWORD };

describe('verifyAdminSecret', () => {
  it('accepts the correct password', async () => {
    expect(await verifyAdminSecret(ADMIN_PASSWORD, env)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await verifyAdminSecret('nope', env)).toBe(false);
  });

  it.each([undefined, null, '', 123, {}])('rejects non-string or empty candidate %p', async (candidate) => {
    expect(await verifyAdminSecret(candidate, env)).toBe(false);
  });

  it.each([undefined, ''])('fails closed when the secret is %p', async (secret) => {
    expect(await verifyAdminSecret('', { ADMIN_PASSWORD: secret })).toBe(false);
    expect(await verifyAdminSecret('anything', { ADMIN_PASSWORD: secret })).toBe(false);
  });
});

describe('session tokens', () => {
  const NOW = 1_800_000_000_000;

  it('issues a token that verifies until it expires', async () => {
    const { token, expires_at } = await createSession(env, NOW);
    expect(expires_at).toBe(NOW + SESSION_TTL_MS);
    expect(await verifySession(token, env, NOW)).toBe(true);
    expect(await verifySession(token, env, expires_at - 1)).toBe(true);
    expect(await verifySession(token, env, expires_at)).toBe(false);
  });

  it('does not contain the password', async () => {
    const { token } = await createSession(env, NOW);
    expect(token).not.toContain(ADMIN_PASSWORD);
  });

  it('rejects a token whose expiry was extended', async () => {
    const { token, expires_at } = await createSession(env, NOW);
    const forged = token.replace(String(expires_at), String(expires_at + SESSION_TTL_MS));
    expect(await verifySession(forged, env, NOW)).toBe(false);
  });

  it('rejects a token with a tampered signature', async () => {
    const { token } = await createSession(env, NOW);
    const last = token.at(-1) === 'A' ? 'B' : 'A';
    expect(await verifySession(token.slice(0, -1) + last, env, NOW)).toBe(false);
  });

  it('rejects every session once the password is rotated', async () => {
    const { token } = await createSession(env, NOW);
    expect(await verifySession(token, { ADMIN_PASSWORD: 'rotated' }, NOW)).toBe(false);
  });

  it.each([undefined, null, '', 42, 'v1', 'v1.123', 'v2.123.abc', ADMIN_PASSWORD, 'v1.notanumber.sig'])(
    'rejects malformed token %p',
    async (token) => {
      expect(await verifySession(token, env, NOW)).toBe(false);
    },
  );

  it.each([undefined, ''])('fails closed when the secret is %p', async (secret) => {
    const { token } = await createSession({ ADMIN_PASSWORD: '' }, NOW);
    expect(await verifySession(token, { ADMIN_PASSWORD: secret }, NOW)).toBe(false);
  });
});

describe('isAdmin', () => {
  const req = (headers = {}) => new Request('https://pinpoint.test/api/projects', { headers });
  const cookie = (value) => ({ Cookie: `${SESSION_COOKIE}=${value}` });

  it('accepts a valid session cookie', async () => {
    expect(await isAdmin(req(cookie(ADMIN_TOKEN)), env)).toBe(true);
  });

  it('finds the session cookie among other cookies', async () => {
    expect(await isAdmin(req({ Cookie: `theme=dark; ${SESSION_COOKIE}=${ADMIN_TOKEN}; other=1` }), env)).toBe(true);
  });

  it('rejects a missing or invalid cookie', async () => {
    expect(await isAdmin(req(), env)).toBe(false);
    expect(await isAdmin(req(cookie('garbage')), env)).toBe(false);
    expect(await isAdmin(req({ Cookie: 'theme=dark' }), env)).toBe(false);
  });

  it('no longer accepts the raw password, as a bearer token or a cookie', async () => {
    expect(await isAdmin(req({ Authorization: `Bearer ${ADMIN_PASSWORD}` }), env)).toBe(false);
    expect(await isAdmin(req(cookie(ADMIN_PASSWORD)), env)).toBe(false);
  });

  it('does not accept a session token sent as a bearer token', async () => {
    expect(await isAdmin(req({ Authorization: `Bearer ${ADMIN_TOKEN}` }), env)).toBe(false);
  });

  it('accepts a same-origin request and refuses a cross-origin one', async () => {
    expect(await isAdmin(req({ ...cookie(ADMIN_TOKEN), Origin: 'https://pinpoint.test' }), env)).toBe(true);
    expect(await isAdmin(req({ ...cookie(ADMIN_TOKEN), Origin: 'https://preview.pinpoint.test' }), env)).toBe(false);
    expect(await isAdmin(req({ ...cookie(ADMIN_TOKEN), Origin: 'https://evil.test' }), env)).toBe(false);
    expect(await isAdmin(req({ ...cookie(ADMIN_TOKEN), Origin: 'null' }), env)).toBe(false);
  });
});

describe('POST /api/auth/verify', () => {
  const login = (options) => call(verify, { env: makeEnv(), method: 'POST', path: '/api/auth/verify', ...options });

  it('sets a session cookie for the correct password', async () => {
    const res = await login({ body: { password: ADMIN_PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.expires_at).toBeGreaterThan(Date.now());
    // The token travels only in the cookie, where page scripts cannot read it.
    expect(res.data).not.toHaveProperty('token');

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=v1\\.`));
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api', `Max-Age=${SESSION_TTL_MS / 1000}`]) {
      expect(setCookie).toContain(attribute);
    }

    const token = setCookie.split(';')[0].slice(SESSION_COOKIE.length + 1);
    expect(await verifySession(token, env)).toBe(true);
  });

  it('omits Secure over plain http so local dev works', async () => {
    const request = new Request('http://localhost:8787/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    const res = await verify({ request, env: makeEnv() });
    expect(res.headers.get('Set-Cookie')).not.toContain('Secure');
  });

  it('returns 401 and no cookie for a wrong password', async () => {
    const res = await login({ body: { password: 'nope' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it.each([['invalid JSON', '{not json'], ['a JSON null body', 'null']])('returns 400 for %s', async (_label, rawBody) => {
    const res = await login({ rawBody });
    expect(res.status).toBe(400);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });
});

describe('/api/auth/session', () => {
  it('reports whether the request is signed in', async () => {
    const path = '/api/auth/session';
    expect((await call(getSession, { env: makeEnv(), path, token: ADMIN_TOKEN })).data).toEqual({ authenticated: true });
    expect((await call(getSession, { env: makeEnv(), path })).data).toEqual({ authenticated: false });
    expect((await call(getSession, { env: makeEnv(), path, token: 'garbage' })).data).toEqual({ authenticated: false });
  });

  it('clears the cookie on sign-out', async () => {
    const res = await call(endSession, { env: makeEnv(), method: 'DELETE', path: '/api/auth/session', token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
    expect(setCookie).toContain('Max-Age=0');
  });
});
