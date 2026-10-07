import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkSession, clearLegacyToken, createProject, deletePin, deleteProject, fetchContactEmail, fetchPins,
  fetchProjects, fetchProjectsWithCounts, patchPin, setUnauthorizedHandler, signOut, verifyPassword,
} from './api';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('dashboard API client', () => {
  it('signs in by posting the password', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}'));
    expect(await verifyPassword('secret')).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/verify');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({ password: 'secret' });
  });

  it('reads the contact address from the site endpoint', async () => {
    fetchMock.mockResolvedValue(new Response('{"contact_email":"owner@example.com"}'));
    expect(await fetchContactEmail()).toBe('owner@example.com');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/site');
  });

  it('has no contact address when none is configured or the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('{"contact_email":null}'));
    expect(await fetchContactEmail()).toBeNull();
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await fetchContactEmail()).toBeNull();
    fetchMock.mockRejectedValue(new TypeError('network down'));
    expect(await fetchContactEmail()).toBeNull();
  });

  it('returns false when password verification is rejected', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    expect(await verifyPassword('wrong')).toBe(false);
  });

  it('never sends an Authorization header; the session is a cookie', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ projects: [] })));
    await fetchProjects();
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });

  it.each([
    [{ authenticated: true }, 200, true],
    [{ authenticated: false }, 200, false],
    [{}, 200, false],
    [{ authenticated: true }, 500, false],
  ])('checkSession maps %j (HTTP %i) to %s', async (body, status, expected) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
    expect(await checkSession()).toBe(expected);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/session');
  });

  it('checkSession treats a network failure as signed out', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await checkSession()).toBe(false);
  });

  it('signs out by deleting the session', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}'));
    await signOut();
    expect(fetchMock.mock.calls[0]).toEqual(['/api/auth/session', { method: 'DELETE' }]);
  });

  it('removes a password left in localStorage by earlier versions', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });
    clearLegacyToken();
    expect(removeItem).toHaveBeenCalledWith('pinpoint_auth');
  });

  it('tolerates storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => clearLegacyToken()).not.toThrow();
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
    fetchMock.mockResolvedValue(new Response('{"error":"Project already exists"}', { status: 409 }));
    await expect(fetchProjects()).rejects.toThrow('Project already exists');
  });

  it('calls the unauthorized handler when the session is rejected', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(new Response('{"error":"Unauthorized"}', { status: 401 }));
    await expect(fetchProjects()).rejects.toThrow('Unauthorized');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call the unauthorized handler for other errors', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(new Response('{"error":"Database error"}', { status: 500 }));
    await expect(fetchProjects()).rejects.toThrow('Database error');
    expect(handler).not.toHaveBeenCalled();
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
