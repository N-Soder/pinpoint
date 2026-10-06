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
