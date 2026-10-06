import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet as listProjects, onRequestPost as createProject } from '../../functions/api/projects/index.js';
import { onRequestDelete as deleteProject } from '../../functions/api/projects/[id].js';
import { ADMIN_PASSWORD, PROJECT_ID, call, makeEnv, seedProject, uuid, validPin } from './helpers.js';

let env;
beforeEach(() => {
  env = makeEnv();
});

const admin = { token: ADMIN_PASSWORD };
const EMPTY_ID = uuid(2);

describe('GET /api/projects', () => {
  it('requires admin', async () => {
    expect((await call(listProjects, { env, path: '/api/projects' })).status).toBe(401);
  });

  it('lists projects newest first', async () => {
    seedProject(env, 'old');
    env.DB.raw.prepare('INSERT INTO projects VALUES (?, ?, ?, ?)').run('new', 'New', 'https://new.test', 2000);

    const res = await call(listProjects, { env, path: '/api/projects', ...admin });
    expect(res.status).toBe(200);
    expect(res.data.projects.map((p) => p.id)).toEqual(['new', 'old']);
    expect(res.data.projects[0]).not.toHaveProperty('open_pin_count');
  });

  it('counts only open pins with include_counts=1', async () => {
    seedProject(env);
    seedProject(env, EMPTY_ID);
    const insert = env.DB.raw.prepare(
      'INSERT INTO pins (id, project_id, page_url, element_selector, comment, resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insert.run('a', PROJECT_ID, 'https://example.com', 'h1', 'c', 0, 1);
    insert.run('b', PROJECT_ID, 'https://example.com', 'h1', 'c', 0, 2);
    insert.run('c', PROJECT_ID, 'https://example.com', 'h1', 'c', 1, 3);

    const res = await call(listProjects, { env, path: '/api/projects?include_counts=1', ...admin });
    const counts = Object.fromEntries(res.data.projects.map((p) => [p.id, p.open_pin_count]));
    expect(counts).toEqual({ [PROJECT_ID]: 2, [EMPTY_ID]: 0 });
  });
});

describe('POST /api/projects', () => {
  const body = { id: PROJECT_ID, name: '  My Site  ', site_url: ' https://my.site ' };

  it('requires admin', async () => {
    expect((await call(createProject, { env, method: 'POST', body })).status).toBe(401);
  });

  it('creates a project with trimmed fields', async () => {
    const res = await call(createProject, { env, method: 'POST', body, ...admin });
    expect(res.status).toBe(201);
    expect(res.data.project).toMatchObject({ id: PROJECT_ID, name: 'My Site', site_url: 'https://my.site' });
    expect(env.DB.raw.prepare('SELECT name FROM projects WHERE id = ?').get(PROJECT_ID).name).toBe('My Site');
  });

  it('returns 409 for a duplicate id', async () => {
    await call(createProject, { env, method: 'POST', body, ...admin });
    const res = await call(createProject, { env, method: 'POST', body, ...admin });
    expect(res.status).toBe(409);
  });

  it.each([
    ['missing fields', { id: PROJECT_ID }],
    ['non-UUID id', { ...body, id: 'p1' }],
    ['non-string name', { ...body, name: 42 }],
    ['blank name', { ...body, name: '   ' }],
    ['over-long name', { ...body, name: 'x'.repeat(201) }],
    ['javascript: site_url', { ...body, site_url: 'javascript:alert(1)' }],
    ['a JSON array', []],
  ])('returns 400 for %s', async (_label, bad) => {
    const res = await call(createProject, { env, method: 'POST', body: bad, ...admin });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a JSON null body', async () => {
    const res = await call(createProject, { env, method: 'POST', rawBody: 'null', ...admin });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('requires admin', async () => {
    seedProject(env);
    const res = await call(deleteProject, { env, method: 'DELETE', params: { id: PROJECT_ID } });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await call(deleteProject, { env, method: 'DELETE', params: { id: uuid(404) }, ...admin });
    expect(res.status).toBe(404);
  });

  it('deletes the project and cascades to its pins', async () => {
    seedProject(env);
    const p = validPin();
    env.DB.raw
      .prepare('INSERT INTO pins (id, project_id, page_url, element_selector, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(p.id, p.project_id, p.page_url, p.element_selector, p.comment, 1);

    const res = await call(deleteProject, { env, method: 'DELETE', params: { id: PROJECT_ID }, ...admin });
    expect(res.status).toBe(200);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM pins').get().n).toBe(0);
  });
});
