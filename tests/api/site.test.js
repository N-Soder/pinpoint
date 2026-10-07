import { describe, it, expect } from 'vitest';
import { onRequestGet as getSite } from '../../functions/api/site.js';
import { call, makeEnv } from './helpers.js';

const site = async (overrides) => (await call(getSite, { env: makeEnv(overrides), path: '/api/site' })).data;

describe('/api/site', () => {
  it('returns the configured contact address', async () => {
    expect(await site({ CONTACT_EMAIL: 'owner@example.com' })).toEqual({ contact_email: 'owner@example.com' });
  });

  it('trims whitespace around the address', async () => {
    expect(await site({ CONTACT_EMAIL: '  owner@example.com\n' })).toEqual({ contact_email: 'owner@example.com' });
  });

  it('returns null when no address is configured', async () => {
    expect(await site()).toEqual({ contact_email: null });
    expect(await site({ CONTACT_EMAIL: '' })).toEqual({ contact_email: null });
  });

  it('returns null for a value that is not a plain email address', async () => {
    for (const value of [
      'not-an-email',
      'owner@example',
      'owner@example.com?subject=x&bcc=someone@example.org',
      'owner@example.com, other@example.org',
      'javascript:alert(1)',
      `${'a'.repeat(250)}@example.com`,
    ]) {
      expect(await site({ CONTACT_EMAIL: value })).toEqual({ contact_email: null });
    }
  });

  it('needs no session', async () => {
    const res = await call(getSite, { env: makeEnv({ CONTACT_EMAIL: 'owner@example.com' }), path: '/api/site' });
    expect(res.status).toBe(200);
  });
});
