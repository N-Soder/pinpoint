// The admin session lives in an HttpOnly cookie set by the API, which the
// browser sends with these same-origin requests. Nothing is stored here.

let onUnauthorized: (() => void) | null = null;

/** Register a callback for when the API rejects the session (expired, or the password was rotated). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  site_url: string;
  created_at: number;
}

export interface ProjectWithCounts extends Project {
  open_pin_count: number;
}

export interface Pin {
  id: string;
  project_id: string;
  page_url: string;
  element_selector: string;
  element_text: string | null;
  /** The image itself is not in pin lists; load it from screenshotUrl(pin.id). */
  has_screenshot: boolean;
  comment: string;
  author: string | null;
  browser: string | null;
  viewport: string | null;
  x_offset: number | null;
  y_offset: number | null;
  resolved: boolean;
  created_at: number;
}

// ── Site ─────────────────────────────────────────────────────────────────────

/** The instance owner's contact address for the landing page, or null if none is configured. */
export async function fetchContactEmail(): Promise<string | null> {
  try {
    const res = await fetch('/api/site');
    if (!res.ok) return null;
    const body = (await res.json()) as { contact_email?: string | null };
    return body.contact_email ?? null;
  } catch {
    return null;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** `limited`: too many attempts, try again later. `failed`: the server could not be reached or could not sign anyone in. */
export type SignInResult = 'ok' | 'wrong' | 'limited' | 'failed';

/** Sign in. On success the API sets the session cookie. */
export async function verifyPassword(password: string): Promise<SignInResult> {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'wrong';
    if (res.status === 429) return 'limited';
    return 'failed';
  } catch {
    return 'failed';
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
}

/** Earlier versions kept the admin password in localStorage; remove any leftover copy. */
export function clearLegacyToken(): void {
  try {
    localStorage.removeItem('pinpoint_auth');
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/api/projects');
  return data.projects;
}

export async function fetchProjectsWithCounts(): Promise<ProjectWithCounts[]> {
  const data = await apiFetch<{ projects: ProjectWithCounts[] }>('/api/projects?include_counts=1');
  return data.projects;
}

export async function createProject(project: { id: string; name: string; site_url: string }): Promise<Project> {
  const data = await apiFetch<{ project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
}

// ── Pins ─────────────────────────────────────────────────────────────────────

export interface PinList {
  pins: Pin[];
  /** The project holds more pins than the API returns in one list (the newest come first). */
  hasMore: boolean;
}

export async function fetchPins(projectId: string): Promise<PinList> {
  const data = await apiFetch<{ pins: Pin[]; has_more?: boolean }>(
    `/api/pins?project_id=${encodeURIComponent(projectId)}`
  );
  return { pins: data.pins, hasMore: data.has_more === true };
}

// ── Review links ─────────────────────────────────────────────────────────────

const reviewLinkPath = (projectId: string) => `/api/review-links/${encodeURIComponent(projectId)}`;

/** The project's review link token, or null when anyone with the project ID can use it. */
export async function fetchReviewToken(projectId: string): Promise<string | null> {
  const data = await apiFetch<{ review_token: string | null }>(reviewLinkPath(projectId));
  return data.review_token;
}

/** Require a review link, or replace the current one. Returns the new token. */
export async function createReviewToken(projectId: string): Promise<string> {
  const data = await apiFetch<{ review_token: string }>(reviewLinkPath(projectId), { method: 'PUT' });
  return data.review_token;
}

export async function deleteReviewToken(projectId: string): Promise<void> {
  await apiFetch(reviewLinkPath(projectId), { method: 'DELETE' });
}

/** The link reviewers open: the project's site with the token as ?review=. Null if the site URL is unusable. */
export function reviewLinkFor(siteUrl: string, token: string): string | null {
  try {
    const url = new URL(siteUrl);
    url.searchParams.set('review', token);
    return url.toString();
  } catch {
    return null;
  }
}

/** Where the dashboard loads a pin's screenshot from. Admin only. */
export function screenshotUrl(pinId: string): string {
  return `/api/screenshots/${encodeURIComponent(pinId)}`;
}

export async function patchPin(id: string, updates: { resolved: boolean }): Promise<Pin> {
  const data = await apiFetch<{ pin: Pin }>(`/api/pins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return data.pin;
}

export async function deletePin(id: string): Promise<void> {
  await apiFetch(`/api/pins/${id}`, { method: 'DELETE' });
}
