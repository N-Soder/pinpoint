import { describe, it, expect } from 'vitest';
import { scrubPageUrl } from '../../functions/api/_validate.js';
import { SCRUBBED, UNCHANGED } from '../page-url-cases.js';

describe('scrubPageUrl', () => {
  it.each(UNCHANGED)('leaves %s exactly as sent', (url) => {
    expect(scrubPageUrl(url)).toBe(url);
  });

  it.each(SCRUBBED)('%s -> %s', (url, expected) => {
    expect(scrubPageUrl(url)).toBe(expected);
  });

  it('does not rewrite a URL it has nothing to remove from', () => {
    // No trailing slash added, no re-encoding: the widget matches pins to pages by this string.
    for (const url of ['https://site.test', 'https://Site.Test/A%20b?x=a+b&y=%7E']) {
      expect(scrubPageUrl(url)).toBe(url);
    }
  });

  it('is stable when applied twice', () => {
    for (const [url] of SCRUBBED) {
      expect(scrubPageUrl(scrubPageUrl(url))).toBe(scrubPageUrl(url));
    }
  });
});
