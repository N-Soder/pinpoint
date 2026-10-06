const AUTH_KEY = 'pinpoint_auth';

function getToken(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function hasToken(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401 && getToken()) {
    // Stored password is no longer valid (e.g. rotated) — drop it and show the login gate.
    clearToken();
    window.location.reload();
  }
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

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function verifyPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export function storeToken(password: string): void {
  localStorage.setItem(AUTH_KEY, password);
}

export function clearToken(): void {
  localStorage.removeItem(AUTH_KEY);
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
