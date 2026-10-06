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
  if (await verifyAdminSecret(password, env)) {
    const { token, expires_at } = await createSession(env);
    return json({ ok: true, expires_at }, 200, { 'Set-Cookie': sessionCookie(request, token) });
  }
  return json({ ok: false }, 401);
}
