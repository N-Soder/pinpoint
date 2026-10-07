import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SOURCE = readFileSync(new URL('../../public/widget.js', import.meta.url), 'utf8');

/** Where the widget script, and therefore the API, is served from. */
export const HOST = 'https://pinpoint.test';
export const SITE = 'https://site.test';
export const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
export const NS = '__pinpoint_';

export const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function pin(overrides = {}) {
  return {
    id: uuid(100),
    project_id: PROJECT_ID,
    page_url: `${SITE}/about`,
    element_selector: 'h1#title',
    comment: 'Typo in heading',
    author: null,
    browser: 'Firefox',
    viewport: '1280x720',
    x_offset: 0.5,
    y_offset: 0.5,
    resolved: false,
    created_at: 1_800_000_000_000,
    ...overrides,
  };
}

/** Let the widget's promise chains run. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Run public/widget.js in a fresh jsdom page, the way a host site would load it,
 * with fetch replaced by a recorder. Nothing touches the network: jsdom does not
 * load the page's own scripts or the html2canvas tag the widget adds.
 */
export async function loadWidget({
  pageUrl = `${SITE}/about?review=1`,
  scriptSrc = `${HOST}/widget.js?project=${PROJECT_ID}`,
  body = '<main><h1 id="title">Hello</h1><p>One</p><p>Two</p></main>',
  pins = [],
  // HTTP status the API answers every request with.
  status = 200,
  setup = () => {},
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>${body}<script src="${scriptSrc}"></script></body></html>`,
    { url: pageUrl, runScripts: 'outside-only' },
  );
  const { window } = dom;
  const requests = [];
  // Request headers, in step with `requests`.
  const headers = [];
  window.fetch = (url, options = {}) => {
    requests.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    headers.push(options.headers || {});
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve({ pins }) });
  };
  setup(window);
  window.eval(SOURCE);
  await settle();

  const { document } = window;
  const find = (name) => document.querySelector(`.${NS}${name}`);
  const findAll = (name) => [...document.querySelectorAll(`.${NS}${name}`)];
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  /** Click Feedback, pick an element, and get the comment form back. */
  async function startComment(selector) {
    click(find('btn'));
    click(document.querySelector(selector));
    // The screenshot library never loads here; report that, and the widget carries on without one.
    const loader = document.querySelector('script[src*="html2canvas"]');
    loader.dispatchEvent(new window.Event('error'));
    await settle();
    const form = find('popup');
    return {
      loader,
      form,
      name: form.querySelector('input'),
      comment: form.querySelector('textarea'),
      submit: async () => {
        click(form.querySelector(`.${NS}submit`));
        await settle();
      },
    };
  }

  return { window, document, requests, headers, find, findAll, click, startComment };
}
