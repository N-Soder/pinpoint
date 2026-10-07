/**
 * Small input-validation helpers shared by the API functions.
 * Keep limits generous enough for normal use but bounded, since the
 * pin endpoints are reachable anonymously from embedded widgets.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isHttpUrl(value, maxLength = 2048) {
  if (typeof value !== 'string' || value.length > maxLength) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Page URLs ────────────────────────────────────────────────────────────────
//
// Pins record the page they were left on. Page URLs can carry credentials
// (reset tokens, OAuth codes, signed links), which have no business in the
// database or in a notification, so those parts are removed before storing.
// This goes by parameter name, plus values shaped like a signed token; a
// credential in the path itself cannot be recognised.
// public/widget.js does the same before sending. Keep the two in step:
// tests/page-url-cases.js runs one table of cases against both.

const CREDENTIAL_NAMES = new Set([
  'key', 'code', 'auth', 'sig', 'otp', 'sid', 'pass', 'session', 'sessionid', 'phpsessid',
  'jsessionid', 'authcode', 'authorization', 'accesskey', 'privatekey', 'authkey',
]);
const CREDENTIAL_NAME_PARTS = ['token', 'secret', 'passw', 'pwd', 'signature', 'credential', 'apikey', 'jwt'];
const SIGNED_TOKEN_RE = /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/;

function isCredentialParam(pair) {
  const eq = pair.indexOf('=');
  let name = eq === -1 ? pair : pair.slice(0, eq);
  const value = eq === -1 ? '' : pair.slice(eq + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // Not valid percent-encoding: judge the raw name.
  }
  name = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CREDENTIAL_NAMES.has(name)
    || CREDENTIAL_NAME_PARTS.some((part) => name.includes(part))
    || SIGNED_TOKEN_RE.test(value);
}

function scrubParams(query) {
  return query.split('&').filter((pair) => !isCredentialParam(pair)).join('&');
}

function scrubFragment(fragment) {
  // A hash route with its own query ("#/reset?token=..."): keep the route.
  const q = fragment.indexOf('?');
  if (q !== -1) {
    const rest = scrubParams(fragment.slice(q + 1));
    return fragment.slice(0, q) + (rest ? `?${rest}` : '');
  }
  // A parameter list ("#access_token=...&expires_in=..."): all or nothing.
  if (fragment.includes('=') && scrubParams(fragment) !== fragment) return '';
  return fragment;
}

/**
 * Returns `value` without credentials in its authority, query or fragment.
 * A URL with nothing to remove comes back exactly as given.
 */
export function scrubPageUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return value;
  }
  const query = u.search.slice(1);
  const fragment = u.hash.slice(1);
  const cleanQuery = scrubParams(query);
  const cleanFragment = scrubFragment(fragment);
  if (u.username === '' && u.password === '' && cleanQuery === query && cleanFragment === fragment) return value;
  return u.origin + u.pathname + (cleanQuery ? `?${cleanQuery}` : '') + (cleanFragment ? `#${cleanFragment}` : '');
}

/** Non-empty string (after trim) no longer than `max`. */
export function isRequiredString(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** null/undefined, or a string no longer than `max`. */
export function isOptionalString(value, max) {
  return value == null || (typeof value === 'string' && value.length <= max);
}

/** null/undefined, or a finite number. */
export function isOptionalNumber(value) {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

/** Parse a JSON object body, returning null if it is missing, malformed or too large. */
export async function readJsonObject(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  let text;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    const body = JSON.parse(text);
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
