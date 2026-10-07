// The widget runs on other sites, so the endpoints it calls must be readable
// from any origin. Everything else is only called by the dashboard, from the
// same origin, and sends no CORS headers at all.
export const WIDGET_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pinpoint-Review',
};

// public/_headers does not apply to Functions, so set these here.
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

/** Preflight answer for endpoints the widget calls. */
export function widgetOptions() {
  return new Response(null, { status: 204, headers: WIDGET_CORS });
}

/** Preflight answer for same-origin endpoints: grants nothing, so browsers block the cross-origin request. */
export function sameOriginOptions() {
  return new Response(null, { status: 204 });
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, ...headers },
  });
}

export function err(message, status = 400, headers = {}) {
  return json({ error: message }, status, headers);
}

export function widgetJson(data, status = 200, headers = {}) {
  return json(data, status, { ...WIDGET_CORS, ...headers });
}

export function widgetErr(message, status = 400, headers = {}) {
  return widgetJson({ error: message }, status, headers);
}
