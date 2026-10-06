import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearToken, createProject, deletePin, deleteProject, fetchPins,
  fetchProjects, fetchProjectsWithCounts, hasToken, patchPin, storeToken, verifyPassword,
} from './api';

const fetchMock = vi.fn<typeof fetch>();
const reload = vi.fn();

// Tests run in node, so stand in for the two browser globals the client touches.
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { location: { reload } });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  reload.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('dashboard API client', () => {
  it('verifies passwords without attaching a stored admin token', async () => {
    storeToken('old-password');
    fetchMock.mockResolvedValue(new Response('{}'));
    expect(await verifyPassword('new-password')).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/verify');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({ password: 'new-password' });
    expect(options?.headers).not.toHaveProperty('Authorization');
  });

  it('returns false when password verification is rejected', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    expect(await verifyPassword('wrong')).toBe(false);
  });

  it('uses the current stored token and stops sending it after logout', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ projects: [] })));
    storeToken('test-token');
    await fetchProjects();
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    clearToken();
    await fetchProjects();
    expect(fetchMock.mock.calls[1][1]?.headers).not.toHaveProperty('Authorization');
  });

  it('unwraps projects with open pin counts', async () => {
    const project = { id: 'p1', name: 'Site', site_url: 'https://example.com', created_at: 1, open_pin_count: 2 };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ projects: [project] })));
    expect(await fetchProjectsWithCounts()).toEqual([project]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects?include_counts=1');
  });

  it('creates projects with a JSON body and unwraps the result', async () => {
    const input = { id: 'p1', name: 'Site', site_url: 'https://example.com' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ project: { ...input, created_at: 1 } })));
    expect(await createProject(input)).toEqual({ ...input, created_at: 1 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/projects');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body as string)).toEqual(input);
  });

  it('encodes project query parameters when fetching pins', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pins: [{ id: 'pin-1' }] })));
    expect(await fetchPins('site & preview')).toEqual([{ id: 'pin-1' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pins?project_id=site%20%26%20preview');
  });

  it('patches a pin and returns its updated state', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pin: { id: 'pin-1', resolved: true } })));
    expect(await patchPin('pin-1', { resolved: true })).toEqual({ id: 'pin-1', resolved: true });
    expect(fetchMock.mock.calls[0]).toEqual(['/api/pins/pin-1', expect.objectContaining({ method: 'PATCH', body: '{"resolved":true}' })]);
  });

  it.each([
    ['project', deleteProject, '/api/projects/p1'],
    ['pin', deletePin, '/api/pins/p1'],
  ] as const)('deletes a %s', async (_name, remove, path) => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}'));
    expect(await remove('p1')).toBeUndefined();
    expect(fetchMock.mock.calls[0]).toEqual([path, expect.objectContaining({ method: 'DELETE' })]);
  });

  it('reports API error messages', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"Unauthorized"}', { status: 401 }));
    await expect(fetchProjects()).rejects.toThrow('Unauthorized');
    expect(reload).not.toHaveBeenCalled();
  });

  it('drops a rejected stored token and reloads to show the login gate', async () => {
    storeToken('stale-token');
    fetchMock.mockResolvedValue(new Response('{"error":"Unauthorized"}', { status: 401 }));
    await expect(fetchProjects()).rejects.toThrow('Unauthorized');
    expect(hasToken()).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reports the HTTP status when an error response is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    await expect(fetchProjects()).rejects.toThrow('HTTP 502');
  });

  it('propagates network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchProjects()).rejects.toThrow('Failed to fetch');
  });
});
