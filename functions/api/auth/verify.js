import { corsOptions, json } from '../_cors.js';
import { verifyAdminSecret, createSession, sessionCookie } from '../_auth.js';
import { readJsonObject } from '../_validate.js';

export function onRequestOptions() {
  return corsOptions();
}

export async function onRequestPost({ request, env }) {
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
