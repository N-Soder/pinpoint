import { describe, it, expect } from 'vitest';
import { HOST, NS, PROJECT_ID, SITE, loadWidget, pin, settle, uuid } from './helpers.js';

describe('activation', () => {
  it('does nothing when the script src has no project', async () => {
    const { requests, find } = await loadWidget({ scriptSrc: `${HOST}/widget.js` });
    expect(requests).toEqual([]);
    expect(find('btn')).toBeNull();
  });

  it('does nothing when the page URL has no review parameter', async () => {
    const { requests, find } = await loadWidget({ pageUrl: `${SITE}/about` });
    expect(requests).toEqual([]);
    expect(find('btn')).toBeNull();
  });

  it('shows the Feedback button and asks its own host for the project\'s pins', async () => {
    const { requests, find } = await loadWidget();
    expect(find('btn').textContent).toContain('Feedback');
    expect(requests).toEqual([{ url: `${HOST}/api/pins?project_id=${PROJECT_ID}`, method: 'GET', body: undefined }]);
  });
});

describe('markers', () => {
  it('shows only this page\'s pins, numbered, ignoring review= and a trailing slash', async () => {
    const { findAll } = await loadWidget({
      pageUrl: `${SITE}/about/?review=1`,
      pins: [
        pin({ id: uuid(1) }),
        pin({ id: uuid(2), page_url: `${SITE}/pricing` }),
        pin({ id: uuid(3), element_selector: 'p:nth-of-type(2)', resolved: true }),
      ],
    });
    const markers = findAll('marker');
    expect(markers.map((m) => m.textContent)).toEqual(['1', '2']);
    expect(markers[0].classList.contains('open')).toBe(true);
    expect(markers[1].classList.contains('resolved')).toBe(true);
  });

  it('skips a pin whose selector is invalid or matches nothing', async () => {
    const { findAll } = await loadWidget({
      pins: [pin({ id: uuid(1), element_selector: '!!not a selector' }), pin({ id: uuid(2), element_selector: '#gone' })],
    });
    expect(findAll('marker')).toEqual([]);
  });

  it('renders pin content as text, never as markup', async () => {
    const hostile = '<img src=x onerror="window.pwned = true"><script>window.pwned = true</script>';
    const { window, document, find, findAll, click } = await loadWidget({
      pins: [pin({ comment: hostile, author: hostile, browser: hostile, viewport: hostile })],
    });
    const before = document.querySelectorAll('img, script').length;
    click(findAll('marker')[0]);

    const popup = find('pin-popup');
    expect(popup.querySelector(`.${NS}pin-popup-comment`).textContent).toBe(hostile);
    expect(popup.querySelector(`.${NS}pin-popup-meta`).textContent).toContain(hostile);
    expect(popup.querySelectorAll('img, script')).toHaveLength(0);
    expect(document.querySelectorAll('img, script')).toHaveLength(before);
    expect(window.pwned).toBeUndefined();
  });

  it('resolves a pin through the API', async () => {
    const { requests, find, findAll, click } = await loadWidget({ pins: [pin()] });
    click(findAll('marker')[0]);
    click(find('resolve-btn'));
    await settle();

    expect(requests.at(-1)).toEqual({ url: `${HOST}/api/pins/${uuid(100)}`, method: 'PATCH', body: { resolved: true } });
    expect(findAll('marker')[0].classList.contains('resolved')).toBe(true);
  });

  it('offers no Resolve button on a resolved pin', async () => {
    const { find, findAll, click } = await loadWidget({ pins: [pin({ resolved: true })] });
    click(findAll('marker')[0]);
    expect(find('resolve-btn').style.display).toBe('none');
  });
});

describe('leaving a comment', () => {
  it('sends the comment, where it was left and basic browser details, and nothing else', async () => {
    const { requests, startComment } = await loadWidget();
    const form = await startComment('h1');
    form.comment.value = '  Typo here  ';
    await form.submit();

    const post = requests.at(-1);
    expect(post.method).toBe('POST');
    expect(post.url).toBe(`${HOST}/api/pins`);
    expect(Object.keys(post.body).sort()).toEqual([
      'browser', 'comment', 'created_at', 'element_selector', 'id', 'page_url',
      'project_id', 'resolved', 'viewport', 'x_offset', 'y_offset',
    ]);
    expect(post.body).toMatchObject({
      project_id: PROJECT_ID,
      page_url: `${SITE}/about`,
      element_selector: 'h1#title',
      comment: 'Typo here',
      resolved: false,
    });
    expect(post.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(post.body.viewport).toMatch(/^\d+x\d+$/);
  });

  it('sends the name only when one was typed', async () => {
    const { requests, startComment } = await loadWidget();
    const form = await startComment('h1');
    form.name.value = ' Sam ';
    form.comment.value = 'Looks good';
    await form.submit();
    expect(requests.at(-1).body.author).toBe('Sam');
  });

  it('does not send an empty comment', async () => {
    const { requests, startComment } = await loadWidget();
    const form = await startComment('h1');
    form.comment.value = '   ';
    await form.submit();
    expect(requests.filter((r) => r.method === 'POST')).toEqual([]);
  });

  it('builds a selector from the nearest id, or by position', async () => {
    const { requests, startComment } = await loadWidget({
      body: '<main><section id="intro"><p>One</p><p><em>Two</em></p></section><p>Three</p></main>',
    });
    const form = await startComment('em');
    form.comment.value = 'Emphasis';
    await form.submit();
    expect(requests.at(-1).body.element_selector).toBe('section#intro > p:nth-of-type(2) > em');
  });

  it('removes review= from the stored page URL and keeps the rest', async () => {
    const { requests, startComment } = await loadWidget({ pageUrl: `${SITE}/list/?page=2&review=1#row-4` });
    const form = await startComment('h1');
    form.comment.value = 'Row is misaligned';
    await form.submit();
    expect(requests.at(-1).body.page_url).toBe(`${SITE}/list?page=2#row-4`);
  });

  it('adds a marker for the new pin without asking the API again', async () => {
    const { requests, findAll, startComment } = await loadWidget();
    const form = await startComment('h1');
    form.comment.value = 'Typo here';
    await form.submit();
    expect(findAll('marker')).toHaveLength(1);
    expect(requests.filter((r) => r.method === 'GET')).toHaveLength(1);
  });
});

describe('screenshot library', () => {
  it('is loaded only when a comment is started, pinned to a version and an SRI hash', async () => {
    const { document, startComment } = await loadWidget();
    expect(document.querySelector('script[src*="html2canvas"]')).toBeNull();

    const { loader } = await startComment('h1');
    expect(loader.src).toBe('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    expect(loader.integrity).toMatch(/^sha512-[A-Za-z0-9+/]{86}==$/);
    expect(loader.crossOrigin).toBe('anonymous');
  });
});
