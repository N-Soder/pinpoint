import { describe, it, expect } from 'vitest';
import { verifyAdminSecret, isAdmin } from '../../functions/api/_auth.js';
import { onRequestPost as verify } from '../../functions/api/auth/verify.js';
import { ADMIN_PASSWORD, call, makeEnv } from './helpers.js';

describe('verifyAdminSecret', () => {
  const env = { ADMIN_PASSWORD };

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

describe('isAdmin', () => {
  const env = { ADMIN_PASSWORD };
  const req = (authorization) =>
    new Request('https://pinpoint.test/', authorization ? { headers: { Authorization: authorization } } : {});

  it('accepts a valid Bearer token', async () => {
    expect(await isAdmin(req(`Bearer ${ADMIN_PASSWORD}`), env)).toBe(true);
  });

  it('rejects a missing header, wrong scheme, or wrong token', async () => {
    expect(await isAdmin(req(), env)).toBe(false);
    expect(await isAdmin(req(`Basic ${ADMIN_PASSWORD}`), env)).toBe(false);
    expect(await isAdmin(req('Bearer wrong'), env)).toBe(false);
  });
});

describe('POST /api/auth/verify', () => {
  it('returns 200 for the correct password', async () => {
    const res = await call(verify, { env: makeEnv(), method: 'POST', body: { password: ADMIN_PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it('returns 401 for a wrong password', async () => {
    const res = await call(verify, { env: makeEnv(), method: 'POST', body: { password: 'nope' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await call(verify, { env: makeEnv(), method: 'POST', rawBody: '{not json' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a JSON null body', async () => {
    const res = await call(verify, { env: makeEnv(), method: 'POST', rawBody: 'null' });
    expect(res.status).toBe(400);
  });
});
