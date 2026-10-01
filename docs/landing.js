(function () {
  var THEME_KEY = 'stage-drop-theme';
  var LANG_KEY = 'stage-drop-lang';
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var label = toggle && toggle.querySelector('.theme-label');
  var btnVi = document.getElementById('lang-vi');
  var btnEn = document.getElementById('lang-en');

  var I18N = {
    vi: {
      'meta.title': 'stage-drop — staging tĩnh tức thì',
      'meta.desc': 'stage-drop — staging site tĩnh tức thì. Docs Pages + lab Worker upload/claim.',
      'nav.how': 'Cách hoạt động',
      'nav.arch': 'Kiến trúc',
      'nav.qs': 'Bắt đầu nhanh',
      'nav.gallery': 'Ảnh chụp',
      'nav.lab': 'Lab demo',
      'theme.toDark': 'Tối',
      'theme.toLight': 'Sáng',
      'theme.ariaToDark': 'Chuyển sang giao diện tối',
      'theme.ariaToLight': 'Chuyển sang giao diện sáng',
      'hero.pitch': '<strong>Staging site tĩnh tức thì</strong>, mang đi được: kéo-thả zip → nhận URL tạm → claim trước khi hết hạn.',
      'badge.inspired': 'Lấy cảm hứng từ',
      'callout.title': 'Trang này chỉ là docs tĩnh (GitHub Pages).',
      'callout.body': ' API upload/claim chạy trên <strong>lab Worker</strong> — không chạy trên Pages. Thử demo live hoặc clone repo và <code>npm run dev</code>.',
      'cta.lab': 'Thử lab demo',
      'cta.repo': 'Repo GitHub',
      'cta.health': 'Health',
      'how.title': 'Cách hoạt động',
      'how.upload.title': 'Upload',
      'how.upload.body': 'Thả zip (≤10&nbsp;MB, ≤500 file) có <code>index.html</code>. Nhận live + claim URL.',
      'how.live.title': 'Live URL',
      'how.live.body': 'Site phục vụ dưới <code>/s/:siteId/</code> trong <strong>60 phút</strong> nếu chưa claim.',
      'how.claim.title': 'Claim',
      'how.claim.body': 'Token một lần (≥128-bit). Chỉ lưu hash; claim xóa hạn + xoay hash.',
      'how.sweep.title': 'Sweep',
      'how.sweep.body': 'Cron <code>*/5</code> dọn site hết hạn chưa claim khỏi R2 + KV.',
      'arch.title': 'Kiến trúc',
      'arch.expand': 'Phóng to',
      'arch.close': 'Đóng',
      'arch.body': 'Core Hono portable sau interface <code>BlobStore</code> / <code>MetaStore</code>. <strong>Lab Worker</strong>: R2 (<code>sites/{id}/</code>) + KV (<code>meta:</code>, <code>claim:</code>, <code>exp:</code>). Local: FS + in-memory. <strong>Pages = intro tĩnh</strong>; <strong>Lab = API thật</strong>.',
      'arch.kv.meta': 'SiteMeta JSON (claimed, expiresAt, claimTokenHash…).',
      'arch.kv.claim': 'Tra token → siteId (chỉ lưu hash).',
      'arch.kv.exp': 'Chỉ mục phụ cho sweepExpired.',
      'arch.flow.title': 'Luồng request (lab)',
      'arch.flow.cap': 'Upload → validate → R2 + KV → liveUrl/claimUrl; serve /s/:id; claim; cron sweep.',
      'arch.state.title': 'Máy trạng thái site',
      'arch.state.cap': 'LiveUnclaimed → Claimed (one-shot) hoặc Expired (TTL 60 phút) → sweep xóa.',
      'arch.claim.title': 'Claim (one-shot)',
      'arch.claim.cap': 'Hash lookup → claimed=true, expiresAt=null, xóa exp:, xoay claim hash (token cũ vô hiệu).',
      'arch.noscript': 'Bật JavaScript để xem Mermaid, hoặc xem chart trong README.',
      'qs.title': 'Bắt đầu nhanh',
      'qs.body': 'Demo live trên lab Worker, hoặc chạy local — GitHub Pages chỉ host trang docs tĩnh này.',
      'gallery.title': 'Ảnh chụp',
      'gallery.body': 'Luồng demo: upload → live URL → claim. Ảnh load từ <code>shot-*.js</code>.',
      'gallery.1': '01 — UI upload',
      'gallery.2': '02 — Đã upload (live + claim)',
      'gallery.3': '03 — Site live',
      'gallery.4': '04 — Đã claim',
      'links.title': 'Liên kết',
      'links.repo': 'Repo GitHub',
      'links.pages': 'Docs Pages',
      'links.lab': 'Lab demo',
      'links.health': 'Health',
      'footer.left': 'MIT © Duc Vo · Open-source đi kèm bài blog',
      'footer.right': 'Pages = docs · Lab = API thật'
    },
    en: {
      'meta.title': 'stage-drop — instant static staging',
      'meta.desc': 'stage-drop — portable instant static-site staging. Pages docs + live lab Worker.',
      'nav.how': 'How it works',
      'nav.arch': 'Architecture',
      'nav.qs': 'Quickstart',
      'nav.gallery': 'Screenshots',
      'nav.lab': 'Lab demo',
      'theme.toDark': 'Dark',
      'theme.toLight': 'Light',
      'theme.ariaToDark': 'Switch to dark theme',
      'theme.ariaToLight': 'Switch to light theme',
      'hero.pitch': 'Portable <strong>instant static-site staging</strong>: drag-and-drop a zip → get a temporary live URL → claim it before it expires.',
      'badge.inspired': 'Inspired by',
      'callout.title': 'This page is static docs (GitHub Pages).',
      'callout.body': ' The upload/claim API runs on the <strong>lab Worker</strong> — not on Pages. Try the live demo or clone and run <code>npm run dev</code>.',
      'cta.lab': 'Try lab demo',
      'cta.repo': 'GitHub repo',
      'cta.health': 'Health',
      'how.title': 'How it works',
      'how.upload.title': 'Upload',
      'how.upload.body': 'Drop a zip (≤10&nbsp;MB, ≤500 files) with <code>index.html</code>. Get live + claim URLs back.',
      'how.live.title': 'Live URL',
      'how.live.body': 'Site is served under <code>/s/:siteId/</code> for <strong>60 minutes</strong> unless claimed.',
      'how.claim.title': 'Claim',
      'how.claim.body': 'One-shot token (≥128-bit). Only a hash is stored; claim clears expiry and rotates the hash.',
      'how.sweep.title': 'Sweep',
      'how.sweep.body': 'Cron <code>*/5</code> removes expired unclaimed sites from R2 + KV.',
      'arch.title': 'Architecture',
      'arch.expand': 'Expand',
      'arch.close': 'Close',
      'arch.body': 'Portable Hono core behind <code>BlobStore</code> / <code>MetaStore</code>. <strong>Lab Worker</strong>: R2 (<code>sites/{id}/</code>) + KV (<code>meta:</code>, <code>claim:</code>, <code>exp:</code>). Local: FS + in-memory. <strong>Pages = static intro</strong>; <strong>Lab = real API</strong>.',
      'arch.kv.meta': 'SiteMeta JSON (claimed, expiresAt, claimTokenHash…).',
      'arch.kv.claim': 'Token lookup → siteId (hash only).',
      'arch.kv.exp': 'Secondary index for sweepExpired.',
      'arch.flow.title': 'Request flow (lab)',
      'arch.flow.cap': 'Upload → validate → R2 + KV → liveUrl/claimUrl; serve /s/:id; claim; cron sweep.',
      'arch.state.title': 'Site state machine',
      'arch.state.cap': 'LiveUnclaimed → Claimed (one-shot) or Expired (60‑min TTL) → sweep deletes.',
      'arch.claim.title': 'Claim (one-shot)',
      'arch.claim.cap': 'Hash lookup → claimed=true, expiresAt=null, delete exp:, rotate claim hash (old token dead).',
      'arch.noscript': 'Enable JavaScript for Mermaid diagrams, or see the chart in the README.',
      'qs.title': 'Quickstart',
      'qs.body': 'Try the live lab Worker, or run locally — GitHub Pages only hosts this static companion site.',
      'gallery.title': 'Screenshots',
      'gallery.body': 'Demo flow: upload → live URL → claim. Shots load from <code>shot-*.js</code>.',
      'gallery.1': '01 — Upload UI',
      'gallery.2': '02 — Uploaded (live + claim)',
      'gallery.3': '03 — Live staged site',
      'gallery.4': '04 — Claimed',
      'links.title': 'Links',
      'links.repo': 'GitHub repo',
      'links.pages': 'Docs Pages',
      'links.lab': 'Lab demo',
      'links.health': 'Health',
      'footer.left': 'MIT © Duc Vo · Independent open-source companion to the blog article',
      'footer.right': 'Pages = docs · Lab = real API'
    }
  };

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function currentLang() {
    return root.getAttribute('lang') === 'en' ? 'en' : 'vi';
  }

  function applyI18n(lang) {
    var dict = I18N[lang] || I18N.vi;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!dict[key]) return;
      el.innerHTML = dict[key];
    });
    document.title = dict['meta.title'];
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', dict['meta.desc']);
    root.setAttribute('lang', lang);
    if (btnVi) btnVi.setAttribute('aria-pressed', lang === 'vi' ? 'true' : 'false');
    if (btnEn) btnEn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    syncThemeLabel();
  }

  function syncThemeLabel() {
    if (!toggle) return;
    var dark = currentTheme() === 'dark';
    var dict = I18N[currentLang()] || I18N.vi;
    toggle.setAttribute('aria-label', dark ? dict['theme.ariaToLight'] : dict['theme.ariaToDark']);
    if (label) label.textContent = dark ? dict['theme.toLight'] : dict['theme.toDark'];
  }

  function setTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    }
    syncThemeLabel();
    renderMermaid(true);
  }

  function setLang(lang, persist) {
    if (persist) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }
    applyI18n(lang);
  }

  applyI18n(currentLang());

  if (toggle) {
    toggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });
  }
  var langToggle = document.querySelector('.lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'lang-vi') setLang('vi', true);
      if (btn.id === 'lang-en') setLang('en', true);
    });
  }

  function themeVars(dark) {
    if (dark) {
      return {
        primaryColor: '#141b2d', primaryTextColor: '#e8eefc', primaryBorderColor: '#243049',
        lineColor: '#5b8cff', secondaryColor: '#0d1424', tertiaryColor: '#1a2744',
        background: '#0b1020', mainBkg: '#141b2d', nodeBorder: '#243049',
        clusterBkg: '#0d1424', titleColor: '#e8eefc', edgeLabelBackground: '#0b1020'
      };
    }
    return {
      primaryColor: '#ffffff', primaryTextColor: '#152033', primaryBorderColor: '#d8e0ef',
      lineColor: '#3b6ef5', secondaryColor: '#eef2fa', tertiaryColor: '#dfe8ff',
      background: '#f4f6fb', mainBkg: '#ffffff', nodeBorder: '#d8e0ef',
      clusterBkg: '#eef2fa', titleColor: '#152033', edgeLabelBackground: '#ffffff'
    };
  }

  var MERMAID_FLOW = [
    'flowchart TD',
    '  U["Upload zip"] --> V["Unzip + validate"]',
    '  V --> R2["R2 sites/{id}/"]',
    '  V --> KV["KV meta:{id} · claim:{sha256} · exp:{expiresAt}:{id}"]',
    '  KV --> URL["liveUrl + claimUrl"]',
    '  S["GET /s/:id"] --> M["Lookup meta"]',
    '  M -->|ok| SR["Serve from R2"]',
    '  M -->|unclaimed expired| G["410 Gone"]',
    '  C["Claim token"] --> H["SHA-256 → claim:{hash}"]',
    '  H --> CL["claimed=true · expiresAt=null · delete exp: · rotate claim hash"]',
    '  CR["Cron */5"] --> SW["sweepExpired"]',
    '  SW --> DEL["Delete R2 + all KV keys"]'
  ].join('\n');

  var MERMAID_STATE = [
    'stateDiagram-v2',
    '  [*] --> LiveUnclaimed: upload',
    '  LiveUnclaimed --> Claimed: claim one-shot',
    '  LiveUnclaimed --> Expired: TTL 60 min',
    '  Expired --> [*]: cron sweep',
    '  Claimed --> [*]'
  ].join('\n');

  var MERMAID_CLAIM = [
    'flowchart LR',
    '  T["Raw claim token"] --> H["SHA-256"]',
    '  H --> L["KV claim:{hash} → siteId"]',
    '  L --> U["Update meta: claimed · expiresAt=null"]',
    '  U --> D["Delete exp: key"]',
    '  U --> R["Rotate claim hash — one-shot"]'
  ].join('\n');

  var SOURCES = {
    'arch-mermaid-flow': MERMAID_FLOW,
    'arch-mermaid-state': MERMAID_STATE,
    'arch-mermaid-claim': MERMAID_CLAIM
  };

  var mermaidReady = false;
  function renderMermaid(force) {
    if (typeof mermaid === 'undefined') return;
    var dark = currentTheme() === 'dark';
    try {
      if (!mermaidReady || force) {
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          themeVariables: themeVars(dark),
          flowchart: { curve: 'basis', htmlLabels: true },
          securityLevel: 'loose'
        });
        mermaidReady = true;
      }
      var nodes = [];
      Object.keys(SOURCES).forEach(function (id) {
        var host = document.getElementById(id);
        if (!host) return;
        var src = SOURCES[id];
        host.setAttribute('data-src', src);
        host.removeAttribute('data-processed');
        host.style.display = 'flex';
        host.textContent = src;
        nodes.push(host);
      });
      if (nodes.length) mermaid.run({ nodes: nodes }).catch(function () {});
    } catch (e) {}
  }

  function initMermaid() { renderMermaid(true); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initMermaid, 50); });
  } else { setTimeout(initMermaid, 50); }

  try {
    var shots = window.STAGE_DROP_SHOTS || {};
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var key = img.getAttribute('data-shot');
      if (shots[key]) {
        img.src = shots[key];
        img.removeAttribute('onerror');
        var ph = img.nextElementSibling;
        if (ph && ph.classList.contains('placeholder')) ph.style.display = 'none';
      }
    });
  } catch (e) {}

  var modal = document.getElementById('diagram-modal');
  var expandBtn = document.getElementById('diagram-expand');
  var modalBody = document.getElementById('diagram-modal-body');
  var lastFocus = null;

  function isMermaidErrorSvg(svg) {
    if (!svg) return true;
    var t = (svg.textContent || '') + (svg.getAttribute('aria-roledescription') || '');
    if (/syntax error/i.test(t)) return true;
    if (svg.querySelector && svg.querySelector('g#syntax-error, [id*="syntax-error"], .error-icon')) return true;
    return false;
  }

  function openModal() {
    if (!modal || !modalBody) return;
    lastFocus = document.activeElement;
    var host = document.getElementById('arch-mermaid-flow');
    var rendered = host && host.querySelector('svg');
    modalBody.innerHTML = '';
    if (rendered && !isMermaidErrorSvg(rendered)) {
      modalBody.appendChild(rendered.cloneNode(true));
    } else if (host && typeof mermaid !== 'undefined') {
      var box = document.createElement('div');
      box.className = 'mermaid';
      box.textContent = host.getAttribute('data-src') || MERMAID_FLOW;
      modalBody.appendChild(box);
      try { mermaid.run({ nodes: [box] }).catch(function () {}); } catch (e) {}
    }
    if (typeof modal.showModal === 'function') modal.showModal();
    else { modal.hidden = false; modal.setAttribute('open', ''); }
    var closeBtn = document.getElementById('diagram-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else { modal.hidden = true; modal.removeAttribute('open'); }
    modalBody.innerHTML = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (expandBtn) expandBtn.addEventListener('click', openModal);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target && e.target.hasAttribute('data-close')) closeModal();
    });
    modal.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(); });
  }
  document.querySelectorAll('#diagram-close').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
})();
