/**
 * Built-in rate limiting: fixed-window counters in D1 (table rate_limits).
 *
 * It lives in the app, rather than in a Cloudflare rule, so that it covers
 * every hostname the deployment answers on and works for any self-hosted copy.
 *
 * If the counter cannot be read or written (most likely the table has not been
 * created yet: npm run db:migrate:remote), requests are let through and the
 * error is logged, so a missed migration cannot lock anyone out.
 */

const MINUTE = 60 * 1000;

export const LIMITS = {
  // Sign-in attempts. The overall cap is what bounds password guessing spread
  // over many addresses; while it is reached, nobody can sign in (existing
  // sessions keep working).
  loginPerClient: { limit: 10, windowMs: 15 * MINUTE },
  loginOverall: { limit: 100, windowMs: 15 * MINUTE },
  // New pins. Per client leaves room for several reviewers behind one address.
  pinsPerClient: { limit: 60, windowMs: 10 * MINUTE },
  pinsPerProject: { limit: 300, windowMs: 60 * MINUTE },
  // Resolve / reopen.
  resolvePerClient: { limit: 120, windowMs: 10 * MINUTE },
};

// Every window above is far shorter than this, so older rows are finished with.
const STALE_AFTER_MS = 24 * 60 * MINUTE;

const encoder = new TextEncoder();

/**
 * Who a request counts against: the IPv4 address, or the /64 for IPv6, where
 * one connection routinely has the whole /64 to pick addresses from.
 */
export function clientOf(request) {
  const ip = (request.headers.get('CF-Connecting-IP') || '').trim().toLowerCase();
  if (!ip) return 'unknown';
  if (!ip.includes(':') || ip.includes('.')) return ip;

  const [head, tail] = ip.split('::');
  const before = head ? head.split(':') : [];
  const after = tail ? tail.split(':') : [];
  const groups = tail === undefined
    ? before
    : [...before, ...Array(Math.max(0, 8 - before.length - after.length)).fill('0'), ...after];
  return groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Counter keys hold a hash keyed by this instance's secret, so the table never contains an address. */
async function pseudonym(env, subject) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`pinpoint-rate-limit-v1:${env.ADMIN_PASSWORD ?? ''}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(subject)));
  return Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Count one request against `rule` for `subject`.
 * Returns { allowed: true }, or { allowed: false, retryAfter: seconds }.
 */
export async function hit(env, name, subject, rule, now = Date.now()) {
  try {
    const key = `${name}:${await pseudonym(env, subject)}`;
    // One statement, so concurrent requests cannot both read the same count.
    const row = await env.DB.prepare(`
      INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start + ? <= excluded.window_start
                     THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start + ? <= excluded.window_start
                            THEN excluded.window_start ELSE rate_limits.window_start END
      RETURNING count, window_start
    `).bind(key, now, rule.windowMs, rule.windowMs).first();

    // A counter starting a window is a cheap, regular moment to sweep finished ones.
    if (row.count === 1) {
      await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - STALE_AFTER_MS).run();
    }

    if (row.count > rule.limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.window_start + rule.windowMs - now) / 1000)) };
    }
    return { allowed: true };
  } catch (e) {
    console.error('rate limit not enforced:', e);
    return { allowed: true };
  }
}

/** Headers for a 429 answer. */
export function retryAfter(result) {
  return { 'Retry-After': String(result.retryAfter) };
}
