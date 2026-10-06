import { describe, it, expect } from 'vitest';
import {
  isUuid, isHttpUrl, isRequiredString, isOptionalString, isOptionalNumber, readJsonObject,
} from '../../functions/api/_validate.js';
import { PROJECT_ID } from './helpers.js';

const request = (body, headers = {}) =>
  new Request('https://pinpoint.test/', { method: 'POST', body, headers });

describe('isUuid', () => {
  it.each([PROJECT_ID, PROJECT_ID.toUpperCase()])('accepts %p', (value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each(['', 'abc', '1 OR 1=1', `${PROJECT_ID} `, PROJECT_ID.replaceAll('-', ''), null, undefined, 42])(
    'rejects %p',
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});

describe('isHttpUrl', () => {
  it.each(['https://example.com', 'http://localhost:8080/path?q=1'])('accepts %p', (value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com', 'example.com', '', null, 42])(
    'rejects %p',
    (value) => {
      expect(isHttpUrl(value)).toBe(false);
    },
  );

  it('rejects URLs over the length limit', () => {
    expect(isHttpUrl(`https://example.com/${'a'.repeat(2048)}`)).toBe(false);
  });
});

describe('string and number helpers', () => {
  it('isRequiredString needs non-blank text within the limit', () => {
    expect(isRequiredString('ok', 5)).toBe(true);
    expect(isRequiredString('   ', 5)).toBe(false);
    expect(isRequiredString('too long', 5)).toBe(false);
    expect(isRequiredString(undefined, 5)).toBe(false);
  });

  it('isOptionalString allows null/undefined but not other types', () => {
    expect(isOptionalString(null, 5)).toBe(true);
    expect(isOptionalString(undefined, 5)).toBe(true);
    expect(isOptionalString('', 5)).toBe(true);
    expect(isOptionalString('too long', 5)).toBe(false);
    expect(isOptionalString(42, 5)).toBe(false);
  });

  it('isOptionalNumber allows null/undefined and finite numbers only', () => {
    expect(isOptionalNumber(null)).toBe(true);
    expect(isOptionalNumber(0.5)).toBe(true);
    expect(isOptionalNumber(NaN)).toBe(false);
    expect(isOptionalNumber(Infinity)).toBe(false);
    expect(isOptionalNumber('1')).toBe(false);
  });
});

describe('readJsonObject', () => {
  it('parses a JSON object', async () => {
    expect(await readJsonObject(request('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it.each(['null', '[]', '"text"', '42', '{nope', ''])('returns null for %p', async (body) => {
    expect(await readJsonObject(request(body), 100)).toBeNull();
  });

  it('returns null when the body is larger than the limit', async () => {
    expect(await readJsonObject(request(JSON.stringify({ a: 'x'.repeat(200) })), 100)).toBeNull();
  });

  it('measures the limit in bytes, not characters', async () => {
    // 40 three-byte characters: 44 chars of JSON but 124 bytes.
    expect(await readJsonObject(request(JSON.stringify({ a: '€'.repeat(40) })), 100)).toBeNull();
  });
});
