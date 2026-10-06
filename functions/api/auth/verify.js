import { corsOptions, json } from '../_cors.js';
import { verifyAdminSecret } from '../_auth.js';
import { readJsonObject } from '../_validate.js';

export function onRequestOptions() {
  return corsOptions();
}

export async function onRequestPost({ request, env }) {
  const body = await readJsonObject(request, 1024);
  if (!body) return json({ ok: false }, 400);

  const password = body.password;
  if (await verifyAdminSecret(password, env)) {
    return json({ ok: true });
  }
  return json({ ok: false }, 401);
}
