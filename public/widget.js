/**
 * Pinpoint — Visual Website Feedback Widget
 * Self-contained, no dependencies (html2canvas loaded dynamically when needed)
 *
 * Usage: <script src="https://your-domain.com/widget.js?project=PROJECT_ID"></script>
 * Add ?review=1 to any page URL to activate feedback mode.
 */
(function () {
  // Get project ID from script src.
  // document.currentScript is set synchronously; fall back to scanning by filename
  // for async/defer-loaded scripts where document.currentScript is null.
  var currentScript = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf('widget.js') !== -1) return all[i];
    }
    return all[all.length - 1];
  }());
  var srcMatch = ((currentScript && currentScript.src) || '').match(/[?&]project=([^&]+)/);
  var PROJECT_ID = srcMatch ? srcMatch[1] : null;
  if (!PROJECT_ID) return;

  // Route API calls through same-origin proxy to avoid CORS restrictions
  var PROXY_BASE = (function () {
    try { return new URL(currentScript.src).origin; } catch (e) { return ''; }
  })();

  // Only activate if the page URL has a review= parameter (not preview= and the like)
  if (!/[?&]review=/.test(window.location.search)) return;

  // State
  var commentMode = false;
  var hoveredEl = null;
  var popup = null;
  var html2canvasLoaded = false;
  var existingPins = [];
  var pinDetailPopup = null;
  var markerEls = [];

  // Styles namespace
  var NS = '__pinpoint_';

  // UUID v4 from the browser's secure generator. randomUUID only exists on
  // https pages; getRandomValues also works on plain-http staging sites.
  function generateUUID() {
    var c = window.crypto || window.msCrypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
      var bytes = c.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = '';
      for (var i = 0; i < 16; i++) {
        hex += (bytes[i] + 0x100).toString(16).slice(1);
        if (i === 3 || i === 5 || i === 7 || i === 9) hex += '-';
      }
      return hex;
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Load html2canvas from CDN, pinned with Subresource Integrity
  function loadHtml2Canvas(cb) {
    if (html2canvasLoaded) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.integrity = 'sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==';
    s.crossOrigin = 'anonymous';
    s.onload = function () { html2canvasLoaded = true; cb(); };
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }

  // CSS selector path
  function getSelector(el) {
    var parts = [];
    while (el && el !== document.body && el !== document.documentElement) {
      var tag = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(tag + '#' + el.id); break; }
      var parent = el.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === el.tagName; });
        if (siblings.length > 1) {
          var idx = Array.prototype.indexOf.call(siblings, el) + 1;
          tag += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(tag);
      el = parent;
    }
    return parts.join(' > ') || 'body';
  }

  // Simple browser string
  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    return 'Other';
  }

  // Normalise a URL for pageUrl comparison: strip ?review param and trailing slashes
  function normalizeUrl(url) {
    try {
      var u = new URL(url);
      u.searchParams.delete('review');
      var path = u.pathname.replace(/\/+$/, '') || '/';
      var search = u.search === '?' ? '' : u.search;
      return u.origin + path + search + u.hash;
    } catch (e) {
      return url.replace(/[?&]review=[^&]*/g, '').replace(/\?$/, '').replace(/\/+$/, '');
    }
  }

  // ── REST API helpers ──────────────────────────────────────────────────────

  function pinpointPost(path, body) {
    return fetch(PROXY_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function pinpointPatch(path, body) {
    return fetch(PROXY_BASE + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function pinpointGet(path) {
    return fetch(PROXY_BASE + path);
  }

  // Inject global styles
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.' + NS + 'btn{position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:8px 16px;border:none;border-radius:20px;background:#1a1a1a;color:#fff;font:500 13px/1 -apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:background .15s}',
    '.' + NS + 'btn:hover{background:#333}',
    '.' + NS + 'btn.active{background:#2563eb}',
    '.' + NS + 'highlight{outline:2px solid #2563eb!important;outline-offset:2px;cursor:crosshair!important}',
    '.' + NS + 'popup{position:fixed;z-index:2147483647;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:280px;box-shadow:0 8px 24px rgba(0,0,0,.15);font:14px/1.4 -apple-system,sans-serif}',
    '.' + NS + 'popup input,.' + NS + 'popup textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font:13px/1.4 -apple-system,sans-serif;margin-bottom:8px;resize:vertical}',
    '.' + NS + 'popup input:focus,.' + NS + 'popup textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.15)}',
    '.' + NS + 'popup textarea{min-height:64px}',
    '.' + NS + 'actions{display:flex;gap:8px;justify-content:flex-end}',
    '.' + NS + 'actions button{padding:6px 14px;border:none;border-radius:6px;font:500 13px/1 -apple-system,sans-serif;cursor:pointer}',
    '.' + NS + 'submit{background:#2563eb;color:#fff}',
    '.' + NS + 'submit:hover{background:#1d4ed8}',
    '.' + NS + 'cancel{background:#f3f4f6;color:#374151}',
    '.' + NS + 'cancel:hover{background:#e5e7eb}',
    '.' + NS + 'toast{position:fixed;bottom:70px;right:20px;z-index:2147483647;background:#065f46;color:#fff;padding:10px 18px;border-radius:8px;font:500 13px/1 -apple-system,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none}',
    '.' + NS + 'toast.show{opacity:1}',
    // Marker styles
    '.' + NS + 'marker{position:fixed;z-index:999999;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px/1 -apple-system,sans-serif;color:#fff;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:translate(-50%,-50%);user-select:none;transition:transform .1s}',
    '.' + NS + 'marker:hover{transform:translate(-50%,-50%) scale(1.2)}',
    '.' + NS + 'marker.open{background:#ef4444}',
    '.' + NS + 'marker.resolved{background:#9ca3af}',
    // Pin detail popup styles
    '.' + NS + 'pin-popup{position:fixed;z-index:2147483647;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;width:280px;box-shadow:0 8px 24px rgba(0,0,0,.15);font:13px/1.5 -apple-system,sans-serif}',
    '.' + NS + 'pin-popup-comment{margin:0 0 8px;font-size:13px;color:#111827;line-height:1.5}',
    '.' + NS + 'pin-popup-meta{font-size:11px;color:#6b7280;margin-bottom:8px}',
    '.' + NS + 'pin-popup-badges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}',
    '.' + NS + 'badge{display:inline-block;padding:2px 7px;border-radius:10px;background:#f3f4f6;color:#374151;font:500 11px/1.6 -apple-system,sans-serif}',
    '.' + NS + 'resolve-btn{display:block;width:100%;padding:6px 0;border:none;border-radius:6px;background:#2563eb;color:#fff;font:500 12px/1 -apple-system,sans-serif;cursor:pointer;text-align:center}',
    '.' + NS + 'resolve-btn:hover{background:#1d4ed8}',
  ].join('\n');
  document.head.appendChild(styleEl);

  // Feedback button
  var btn = document.createElement('button');
  btn.className = NS + 'btn';
  btn.textContent = '\ud83d\udcac Feedback';
  document.body.appendChild(btn);

  // Toast
  var toastEl = document.createElement('div');
  toastEl.className = NS + 'toast';
  toastEl.textContent = '\u2713 Comment saved';
  document.body.appendChild(toastEl);

  function showToast() {
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  // Toggle comment mode
  btn.addEventListener('click', function () {
    commentMode = !commentMode;
    btn.classList.toggle('active', commentMode);
    btn.textContent = commentMode ? '\u2715 Cancel' : '\ud83d\udcac Feedback';
    if (!commentMode) {
      removeHighlight();
      closePopup();
    }
  });

  function removeHighlight() {
    if (hoveredEl) {
      hoveredEl.classList.remove(NS + 'highlight');
      hoveredEl = null;
    }
  }

  function closePopup() {
    if (popup) { popup.remove(); popup = null; }
  }

  function closePinDetailPopup() {
    if (pinDetailPopup) { pinDetailPopup.remove(); pinDetailPopup = null; }
  }

  // Hover highlight
  document.addEventListener('mouseover', function (e) {
    if (!commentMode || popup) return;
    var el = e.target;
    if (el === btn || el === toastEl || el.closest('.' + NS + 'marker')) return;
    removeHighlight();
    el.classList.add(NS + 'highlight');
    hoveredEl = el;
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!commentMode || popup) return;
    if (e.target) e.target.classList.remove(NS + 'highlight');
    if (hoveredEl === e.target) hoveredEl = null;
  }, true);

  // Click-outside handler for pin detail popup (runs in capture phase, before marker onclick)
  document.addEventListener('click', function (e) {
    if (!pinDetailPopup) return;
    if (!pinDetailPopup.contains(e.target) && !e.target.closest('.' + NS + 'marker')) {
      closePinDetailPopup();
    }
  }, true);

  // Click to pin
  document.addEventListener('click', function (e) {
    if (!commentMode) return;
    var el = e.target;
    if (!el || el === btn || el.closest('.' + NS + 'popup') || el.closest('.' + NS + 'btn')
        || el.closest('.' + NS + 'marker') || el.closest('.' + NS + 'pin-popup')) return;
    e.preventDefault();
    e.stopPropagation();

    removeHighlight();
    var selector = getSelector(el);
    var text = (el.innerText || '').trim().substring(0, 80) || null;

    // Screenshot element
    loadHtml2Canvas(function () {
      var screenshotPromise;
      if (typeof html2canvas === 'function') {
        screenshotPromise = html2canvas(el, { useCORS: true, scale: 1, logging: false })
          .then(function (canvas) {
            // Scale down large elements and use JPEG to keep payload small
            var MAX_DIM = 600;
            if (canvas.width > MAX_DIM || canvas.height > MAX_DIM) {
              var ratio = Math.min(MAX_DIM / canvas.width, MAX_DIM / canvas.height);
              var scaled = document.createElement('canvas');
              scaled.width = Math.round(canvas.width * ratio);
              scaled.height = Math.round(canvas.height * ratio);
              scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
              canvas = scaled;
            }
            var dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            return dataUrl.length > 200000 ? null : dataUrl;
          })
          .catch(function () { return null; });
      } else {
        screenshotPromise = Promise.resolve(null);
      }

      screenshotPromise.then(function (screenshot) {
        var rect = el.getBoundingClientRect();
        var xOffset = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
        var yOffset = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
        showPopup(selector, text, screenshot, e.clientX, e.clientY, xOffset, yOffset);
      });
    });
  }, true);

  function showPopup(selector, text, screenshot, x, y, xOffset, yOffset) {
    closePopup();
    popup = document.createElement('div');
    popup.className = NS + 'popup';

    // Position
    var pw = 280, ph = 220;
    var left = Math.min(x + 10, window.innerWidth - pw - 20);
    var top = Math.min(y + 10, window.innerHeight - ph - 20);
    popup.style.left = Math.max(10, left) + 'px';
    popup.style.top = Math.max(10, top) + 'px';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Your name (optional)';

    var commentInput = document.createElement('textarea');
    commentInput.placeholder = 'Leave your feedback...';

    var actions = document.createElement('div');
    actions.className = NS + 'actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = NS + 'cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function () { closePopup(); };

    var submitBtn = document.createElement('button');
    submitBtn.className = NS + 'submit';
    submitBtn.textContent = 'Submit';
    submitBtn.onclick = function () {
      var comment = commentInput.value.trim();
      if (!comment) { commentInput.style.borderColor = '#ef4444'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      var pinId = generateUUID();
      var now = Date.now();

      var attrs = {
        id: pinId,
        project_id: PROJECT_ID,
        page_url: normalizeUrl(window.location.href),
        element_selector: selector,
        comment: comment,
        browser: getBrowser(),
        viewport: window.innerWidth + 'x' + window.innerHeight,
        x_offset: xOffset,
        y_offset: yOffset,
        resolved: false,
        created_at: now
      };
      if (text) attrs.element_text = text;
      if (screenshot) attrs.element_screenshot = screenshot;
      if (nameInput.value.trim()) attrs.author = nameInput.value.trim();

      pinpointPost('/api/pins', attrs).then(function (res) {
        if (res.ok) {
          existingPins.push(attrs);
          renderAllMarkers();
          closePopup();
          showToast();
        } else {
          submitBtn.textContent = 'Error \u2014 retry';
          submitBtn.disabled = false;
        }
      }).catch(function () {
        submitBtn.textContent = 'Error \u2014 retry';
        submitBtn.disabled = false;
      });
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);

    popup.appendChild(nameInput);
    popup.appendChild(commentInput);
    popup.appendChild(actions);
    document.body.appendChild(popup);

    commentInput.focus();
  }

  // ── Existing pins: fetch, render markers, detail popup ──────────────────────

  function fetchExistingPins() {
    var currentNorm = normalizeUrl(window.location.href);
    pinpointGet('/api/pins?project_id=' + encodeURIComponent(PROJECT_ID))
      .then(function (res) {
        if (!res.ok) {
          console.warn('[Pinpoint] Failed to fetch pins:', res.status);
          return;
        }
        res.json().then(function (result) {
          var pins = result.pins || [];
          existingPins = pins.filter(function (p) {
            return normalizeUrl(p.page_url) === currentNorm;
          });
          renderAllMarkers();
        }).catch(function (err) {
          console.warn('[Pinpoint] Failed to parse pins response:', err);
        });
      }).catch(function (err) {
        console.warn('[Pinpoint] Network error fetching pins:', err);
      });
  }

  function renderAllMarkers() {
    // Remove existing markers from DOM
    markerEls.forEach(function (entry) { entry.markerEl.remove(); });
    markerEls = [];

    var num = 0;
    existingPins.forEach(function (pin) {
      var target = null;
      try { target = document.querySelector(pin.element_selector); } catch (e) {}
      if (!target) return;

      var rect = target.getBoundingClientRect();
      num++;

      var markerEl = document.createElement('div');
      markerEl.className = NS + 'marker ' + (pin.resolved ? 'resolved' : 'open');
      markerEl.textContent = num;
      markerEl.style.left = (pin.x_offset != null ? rect.left + pin.x_offset * rect.width  : rect.left) + 'px';
      markerEl.style.top  = (pin.y_offset != null ? rect.top  + pin.y_offset * rect.height : rect.top)  + 'px';

      // Capture pin and markerEl in closure
      (function (p, m) {
        m.addEventListener('click', function (e) {
          e.stopPropagation();
          showPinDetailPopup(p, m);
        });
      }(pin, markerEl));

      document.body.appendChild(markerEl);
      markerEls.push({ pin: pin, markerEl: markerEl });
    });
  }

  function updateMarkerPositions() {
    markerEls.forEach(function (entry) {
      var target = null;
      try { target = document.querySelector(entry.pin.element_selector); } catch (e) {}
      if (!target) return;
      var rect = target.getBoundingClientRect();
      var pin = entry.pin;
      entry.markerEl.style.left = (pin.x_offset != null ? rect.left + pin.x_offset * rect.width  : rect.left) + 'px';
      entry.markerEl.style.top  = (pin.y_offset != null ? rect.top  + pin.y_offset * rect.height : rect.top)  + 'px';
    });
  }

  window.addEventListener('scroll', updateMarkerPositions, true);
  window.addEventListener('resize', updateMarkerPositions);

  function showPinDetailPopup(pin, markerEl) {
    closePinDetailPopup();

    var pd = document.createElement('div');
    pd.className = NS + 'pin-popup';

    // Position near the marker, clamped to viewport
    var mLeft = parseFloat(markerEl.style.left) || 0;
    var mTop = parseFloat(markerEl.style.top) || 0;
    var pw = 280, ph = 180;
    var left = Math.min(mLeft + 16, window.innerWidth - pw - 10);
    var top = Math.min(mTop + 16, window.innerHeight - ph - 10);
    pd.style.left = Math.max(10, left) + 'px';
    pd.style.top = Math.max(10, top) + 'px';

    // Comment
    var commentEl = document.createElement('p');
    commentEl.className = NS + 'pin-popup-comment';
    commentEl.textContent = pin.comment;
    pd.appendChild(commentEl);

    // Author + timestamp
    var meta = document.createElement('div');
    meta.className = NS + 'pin-popup-meta';
    var authorStr = pin.author || 'Anonymous';
    var dateStr = pin.created_at ? new Date(pin.created_at).toLocaleString() : '';
    meta.textContent = authorStr + (dateStr ? ' \u00b7 ' + dateStr : '');
    pd.appendChild(meta);

    // Badges
    if (pin.browser || pin.viewport) {
      var badges = document.createElement('div');
      badges.className = NS + 'pin-popup-badges';
      if (pin.browser) {
        var b1 = document.createElement('span');
        b1.className = NS + 'badge';
        b1.textContent = pin.browser;
        badges.appendChild(b1);
      }
      if (pin.viewport) {
        var b2 = document.createElement('span');
        b2.className = NS + 'badge';
        b2.textContent = pin.viewport;
        badges.appendChild(b2);
      }
      pd.appendChild(badges);
    }

    // Resolve button
    var resolveBtn = document.createElement('button');
    resolveBtn.className = NS + 'resolve-btn';
    resolveBtn.textContent = '\u2713 Resolve';
    if (pin.resolved) resolveBtn.style.display = 'none';
    resolveBtn.onclick = function () {
      resolveBtn.disabled = true;
      resolveBtn.textContent = 'Resolving...';
      pinpointPatch('/api/pins/' + pin.id, { resolved: true }).then(function (res) {
        if (res.ok) {
          pin.resolved = true;
          markerEl.className = NS + 'marker resolved';
          resolveBtn.style.display = 'none';
        } else {
          resolveBtn.textContent = 'Error \u2014 retry';
          resolveBtn.disabled = false;
        }
      }).catch(function () {
        resolveBtn.textContent = 'Error \u2014 retry';
        resolveBtn.disabled = false;
      });
    };
    pd.appendChild(resolveBtn);

    document.body.appendChild(pd);
    pinDetailPopup = pd;
  }

  // Kick off initial fetch
  fetchExistingPins();
}());
