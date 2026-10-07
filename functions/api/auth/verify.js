import { sameOriginOptions, json } from '../_cors.js';
import { verifyAdminSecret, createSession, sessionCookie } from '../_auth.js';
import { readJsonObject } from '../_validate.js';
import { LIMITS, clientOf, hit, retryAfter } from '../_ratelimit.js';

export function onRequestOptions() {
  return sameOriginOptions();
}

export async function onRequestPost({ request, env }) {
  // Counted before the password is looked at, so a correct guess past the limit gains nothing.
  // Per client first: a refused client must not use up the allowance shared by everyone.
  let limit = await hit(env, 'login', clientOf(request), LIMITS.loginPerClient);
  if (limit.allowed) limit = await hit(env, 'login-all', '', LIMITS.loginOverall);
  if (!limit.allowed) return json({ ok: false }, 429, retryAfter(limit));

  const body = await readJsonObject(request, 1024);
  if (!body) return json({ ok: false }, 400);

  const password = body.password;
  if (!(await verifyAdminSecret(password, env))) return json({ ok: false }, 401);

  let session;
  try {
    session = await createSession(env);
  } catch (e) {
    // Say why in the logs only; the response must not describe the configuration.
    console.error('sign-in refused:', e.message);
    return json({ ok: false }, 500);
  }
  return json({ ok: true, expires_at: session.expires_at }, 200, { 'Set-Cookie': sessionCookie(request, session.token) });
}
