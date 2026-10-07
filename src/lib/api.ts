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
  element_screenshot: string | null;
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

/** Sign in. On success the API sets the session cookie. */
export async function verifyPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
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

export async function fetchPins(projectId: string): Promise<Pin[]> {
  const data = await apiFetch<{ pins: Pin[] }>(
    `/api/pins?project_id=${encodeURIComponent(projectId)}`
  );
  return data.pins;
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
