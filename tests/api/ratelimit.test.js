import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LIMITS, clientOf, hit } from '../../functions/api/_ratelimit.js';
import { onRequestPost as verify } from '../../functions/api/auth/verify.js';
import { onRequestPost as createPin } from '../../functions/api/pins/index.js';
import { onRequestPatch as patchPin } from '../../functions/api/pins/[id].js';
import { ADMIN_PASSWORD, PIN_ID, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

const NOW = 1_800_000_000_000;
const RULE = { limit: 3, windowMs: 60_000 };

let env;
beforeEach(() => {
  env = makeEnv();
  seedProject(env);
});

const rows = () => env.DB.raw.prepare('SELECT * FROM rate_limits').all();

describe('hit', () => {
  it('allows up to the limit, then refuses and says when to come back', async () => {
    for (let i = 0; i < RULE.limit; i++) {
      expect(await hit(env, 'test', 'a', RULE, NOW + i)).toEqual({ allowed: true });
    }
    expect(await hit(env, 'test', 'a', RULE, NOW + 10_000)).toEqual({ allowed: false, retryAfter: 50 });
    expect(await hit(env, 'test', 'a', RULE, NOW + 59_999)).toEqual({ allowed: false, retryAfter: 1 });
  });

  it('starts again once the window has passed', async () => {
    for (let i = 0; i < RULE.limit + 2; i++) await hit(env, 'test', 'a', RULE, NOW);
    expect(await hit(env, 'test', 'a', RULE, NOW + RULE.windowMs)).toEqual({ allowed: true });
  });

  it('counts each subject and each limit separately', async () => {
    for (let i = 0; i < RULE.limit + 1; i++) await hit(env, 'test', 'a', RULE, NOW);
    expect((await hit(env, 'test', 'b', RULE, NOW)).allowed).toBe(true);
    expect((await hit(env, 'other', 'a', RULE, NOW)).allowed).toBe(true);
    expect((await hit(env, 'test', 'a', RULE, NOW)).allowed).toBe(false);
  });

  it('stores a keyed hash of the subject, never the subject itself', async () => {
    await hit(env, 'test', '203.0.113.7', RULE, NOW);
    const [row] = rows();
    expect(row.key).toMatch(/^test:[0-9a-f]{32}$/);
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');

    // A different instance (different secret) produces a different hash for the same address.
    const other = makeEnv({ ADMIN_PASSWORD: 'another-instance' });
    await hit(other, 'test', '203.0.113.7', RULE, NOW);
    expect(other.DB.raw.prepare('SELECT key FROM rate_limits').get().key).not.toBe(row.key);
  });

  it('clears out counters that are long finished', async () => {
    await hit(env, 'test', 'old', RULE, NOW);
    await hit(env, 'test', 'new', RULE, NOW + 25 * 60 * 60 * 1000);
    expect(rows()).toHaveLength(1);
  });

  it('does not enforce, and says so in the logs, when the table is missing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.DB.raw.exec('DROP TABLE rate_limits');
    for (let i = 0; i < RULE.limit + 2; i++) {
      expect(await hit(env, 'test', 'a', RULE, NOW)).toEqual({ allowed: true });
    }
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('clientOf', () => {
  const from = (ip) => clientOf(new Request('https://pinpoint.test/', { headers: ip ? { 'CF-Connecting-IP': ip } : {} }));

  it('uses the whole IPv4 address', () => {
    expect(from('203.0.113.7')).toBe('203.0.113.7');
    expect(from('203.0.113.7')).not.toBe(from('203.0.113.8'));
  });

  it('treats one IPv6 /64 as one client, however it is written', () => {
    expect(from('2001:db8:1:2::1')).toBe(from('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(from('2001:db8:1:2::1')).toBe(from('2001:0DB8:0001:0002:0:0:0:1'));
    expect(from('2001:db8::1')).toBe(from('2001:db8:0:0:1::'));
    expect(from('2001:db8:1:2::1')).not.toBe(from('2001:db8:1:3::1'));
    expect(from('::1')).toBe(from('::2'));
  });

  it('files requests with no address together', () => {
    expect(from(undefined)).toBe('unknown');
  });
});

describe('sign-in limits', () => {
  const login = (password, ip) => call(verify, { env, method: 'POST', body: { password }, ip });

  it('refuses further attempts from one client, even with the right password', async () => {
    for (let i = 0; i < LIMITS.loginPerClient.limit; i++) {
      expect((await login('nope', '203.0.113.7')).status).toBe(401);
    }
    const res = await login(ADMIN_PASSWORD, '203.0.113.7');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('leaves other clients alone', async () => {
    for (let i = 0; i < LIMITS.loginPerClient.limit + 1; i++) await login('nope', '203.0.113.7');
    expect((await login(ADMIN_PASSWORD, '198.51.100.1')).status).toBe(200);
  });

  it('caps attempts across all clients, so spreading guesses over many addresses does not help', async () => {
    for (let i = 0; i < LIMITS.loginOverall.limit; i++) {
      expect((await login('nope', `198.51.${Math.floor(i / 250)}.${i % 250}`)).status).toBe(401);
    }
    expect((await login(ADMIN_PASSWORD, '192.0.2.1')).status).toBe(429);
  });

  it('does not let one refused client use up the allowance for everyone', async () => {
    for (let i = 0; i < LIMITS.loginOverall.limit + 20; i++) await login('nope', '203.0.113.7');
    expect((await login(ADMIN_PASSWORD, '198.51.100.1')).status).toBe(200);
  });
});

describe('pin limits', () => {
  const post = (n, ip, extra = {}) =>
    call(createPin, { env, method: 'POST', body: validPin({ id: uuid(1000 + n), ...extra }), ip });
  const count = () => env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n;

  it('refuses a flood of new pins from one client and stores none of the extras', async () => {
    for (let i = 0; i < LIMITS.pinsPerClient.limit; i++) {
      expect((await post(i, '203.0.113.7')).status).toBe(201);
    }
    const res = await post(999, '203.0.113.7');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    // The widget on another site must be able to read the refusal.
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(count()).toBe(LIMITS.pinsPerClient.limit);
    expect((await post(1000, '198.51.100.1')).status).toBe(201);
  });

  it('does not notify for a refused pin', async () => {
    const waitUntil = vi.fn();
    env.NTFY_TOPIC = 'my-topic';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    for (let i = 0; i < LIMITS.pinsPerClient.limit + 5; i++) {
      await call(createPin, { env, method: 'POST', body: validPin({ id: uuid(1000 + i) }), ip: '203.0.113.7', waitUntil });
    }
    expect(waitUntil).toHaveBeenCalledTimes(LIMITS.pinsPerClient.limit);
    fetchMock.mockRestore();
  });

  it('caps new pins per project across all clients', async () => {
    for (let i = 0; i < LIMITS.pinsPerProject.limit; i++) {
      expect((await post(i, `198.51.${Math.floor(i / 250)}.${i % 250}`)).status).toBe(201);
    }
    expect((await post(5000, '192.0.2.1')).status).toBe(429);
    // Another project is unaffected.
    seedProject(env, uuid(2));
    expect((await post(5001, '192.0.2.1', { project_id: uuid(2) })).status).toBe(201);
  });

  it('refuses a flood of resolve and reopen requests from one client', async () => {
    await call(createPin, { env, method: 'POST', body: validPin() });
    const patch = (resolved) =>
      call(patchPin, { env, method: 'PATCH', params: { id: PIN_ID }, body: { resolved, project_id: PROJECT_ID }, ip: '203.0.113.7' });
    for (let i = 0; i < LIMITS.resolvePerClient.limit; i++) {
      expect((await patch(i % 2 === 0)).status).toBe(200);
    }
    const res = await patch(true);
    expect(res.status).toBe(429);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
