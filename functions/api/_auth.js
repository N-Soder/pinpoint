/**
 * Admin auth helpers.
 *
 * The admin secret is env.ADMIN_PASSWORD (a Cloudflare Pages secret). It is
 * only ever checked at login (POST /api/auth/verify); every other admin
 * request is authorised by the session cookie issued there.
 *
 * Validation fails closed: if the secret is unset/empty, or the candidate
 * is not a non-empty string, access is denied. The comparison is done on
 * SHA-256 digests so it takes the same time regardless of where the
 * strings first differ.
 */

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

function digestsEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Compares two secrets without revealing, through timing, where they differ. */
export async function secretsEqual(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  return digestsEqual(x, y);
}

/**
 * Returns true only when `candidate` matches env.ADMIN_PASSWORD.
 * Fails closed when the secret is missing or the candidate is invalid.
 */
export async function verifyAdminSecret(candidate, env) {
  const secret = env.ADMIN_PASSWORD;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  return secretsEqual(candidate, secret);
}

// ── Sessions ─────────────────────────────────────────────────────────────────
//
// A successful login is exchanged for a signed, expiring session token held in
// an HttpOnly cookie, so the password itself is never stored in the browser and
// page scripts cannot read the session. Tokens are stateless:
//   v1.<expiry ms>.<base64url HMAC-SHA256 of "v1.<expiry ms>">
// The signing key is derived from ADMIN_PASSWORD, so rotating the password
// ends every session. When SESSION_SECRET is set it is mixed into the key as
// well: a stolen token then gives nothing to test password guesses against,
// and rotating SESSION_SECRET ends every session without a password change.

export const SESSION_COOKIE = 'pinpoint_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_SESSION_SECRET_LENGTH = 32;

const encoder = new TextEncoder();

/** Rejects when SESSION_SECRET is set but unusable, so a weak one is never silently ignored. */
async function sessionKey(env) {
  const sessionSecret = env.SESSION_SECRET;
  let material = `pinpoint-session-v1:${env.ADMIN_PASSWORD}`;
  if (sessionSecret != null && sessionSecret !== '') {
    if (typeof sessionSecret !== 'string' || sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
    }
    material = `pinpoint-session-v2:${sessionSecret}\n${env.ADMIN_PASSWORD}`;
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Issue a session token. Call only after verifyAdminSecret has passed. Rejects if SESSION_SECRET is unusable. */
export async function createSession(env, now = Date.now()) {
  const expires_at = now + SESSION_TTL_MS;
  const payload = `v1.${expires_at}`;
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), encoder.encode(payload));
  return { token: `${payload}.${toBase64Url(new Uint8Array(signature))}`, expires_at };
}

/** Returns true only for an unexpired token signed with the current secrets. Fails closed. */
export async function verifySession(token, env, now = Date.now()) {
  const secret = env.ADMIN_PASSWORD;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof token !== 'string') return false;

  const match = /^(v1\.(\d{1,15}))\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const [, payload, expiry, signature] = match;
  if (Number(expiry) <= now) return false;

  const signatureBytes = fromBase64Url(signature);
  // Base64 leaves spare bits in the last character; accept only the canonical spelling.
  if (toBase64Url(signatureBytes) !== signature) return false;

  let key;
  try {
    key = await sessionKey(env);
  } catch (e) {
    console.error('session check refused:', e.message);
    return false;
  }
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload));
}

/** Set-Cookie value for a session token; pass an empty token to clear the cookie. */
export function sessionCookie(request, token, maxAgeMs = SESSION_TTL_MS) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${token ? Math.floor(maxAgeMs / 1000) : 0}`,
  ];
  // Plain-http local dev (wrangler pages dev) cannot use Secure cookies in every browser.
  if (new URL(request.url).protocol === 'https:') parts.push('Secure');
  return parts.join('; ');
}

function readSessionCookie(request) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return value.join('=');
  }
  return null;
}

/**
 * Returns true if the request carries a valid admin session cookie.
 *
 * Browsers attach cookies automatically, so a request that names a different
 * origin is refused: SameSite=Strict does not cover sibling subdomains (for
 * example Pages preview deployments), and this check does.
 */
export async function isAdmin(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return verifySession(readSessionCookie(request), env);
}
