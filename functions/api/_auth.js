/**
 * Admin auth helpers.
 *
 * The admin secret is env.ADMIN_PASSWORD (a Cloudflare Pages secret).
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

/**
 * Returns true only when `candidate` matches env.ADMIN_PASSWORD.
 * Fails closed when the secret is missing or the candidate is invalid.
 */
export async function verifyAdminSecret(candidate, env) {
  const secret = env.ADMIN_PASSWORD;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(secret)]);
  return digestsEqual(a, b);
}

/**
 * Returns true if the request carries a valid admin Bearer token.
 * Validated server-side against env.ADMIN_PASSWORD — never exposed to the client.
 */
export async function isAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyAdminSecret(token, env);
}
