import { corsOptions, json } from './_cors.js';

// One address, nothing that could add headers or recipients to a mailto: link.
const EMAIL = /^[^\s@<>"',;:?&]+@[^\s@<>"',;:?&]+\.[^\s@<>"',;:?&]+$/;

export function onRequestOptions() {
  return corsOptions();
}

/** Public details about this instance for the landing page. */
export function onRequestGet({ env }) {
  const email = typeof env.CONTACT_EMAIL === 'string' ? env.CONTACT_EMAIL.trim() : '';
  return json({ contact_email: email.length <= 254 && EMAIL.test(email) ? email : null });
}
