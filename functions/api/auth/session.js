import { sameOriginOptions, json } from '../_cors.js';
import { isAdmin, sessionCookie } from '../_auth.js';

export function onRequestOptions() {
  return sameOriginOptions();
}

/** Lets the dashboard ask whether it is signed in; it cannot read the HttpOnly cookie itself. */
export async function onRequestGet({ request, env }) {
  return json({ authenticated: await isAdmin(request, env) });
}

/** Sign out: clear the session cookie. */
export function onRequestDelete({ request }) {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '') });
}
