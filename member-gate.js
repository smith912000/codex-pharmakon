/* WILD loading screen: the same code as assets/wild-loader.js, carried here so members' pages
   get it without a second blocking request. Keep the two in step. */
(function () {
  if (window.__wildLoader) return;
  window.__wildLoader = 1;
  var d = document.documentElement, t0 = Date.now();

  /* today's colour from the last visit, so nothing shifts when wild-time.js (deferred) arrives */
  try {
    var h = localStorage.getItem('wild_hue');
    if (h != null && !/[?&](hue|at)=/.test(location.search)) {
      d.style.setProperty('--wild-hue', parseFloat(h) + 'deg');
      var hs = document.createElement('style');
      hs.textContent = 'html{filter:hue-rotate(var(--wild-hue,0deg))}img,video,picture,[data-keep-hue]{filter:hue-rotate(calc(-1 * var(--wild-hue,0deg)))}';
      (document.head || d).appendChild(hs);
    }
  } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#wild-loader{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'background:#06100E;color:#A3B0AB;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.42em;text-indent:.42em;' +
    'visibility:visible!important;transition:opacity .2s ease}' +
    '#wild-loader.out{opacity:0;pointer-events:none}' +
    '#wild-loader svg{width:40px;height:48px;animation:wildbreathe 1.6s ease-in-out infinite}' +
    '@keyframes wildbreathe{0%,100%{opacity:.5;transform:scale(.94)}50%{opacity:1;transform:scale(1)}}' +
    '@media(prefers-reduced-motion:reduce){#wild-loader svg{animation:none}#wild-loader{transition:none}}';
  (document.head || d).appendChild(css);

  var el = document.createElement('div');
  el.id = 'wild-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading');
  el.innerHTML = '<svg viewBox="0 0 100 120" aria-hidden="true"><g fill="none" stroke="#4DB8A2" stroke-width="7"><circle cx="50" cy="44" r="34"/><circle cx="50" cy="76" r="34"/></g>' +
    '<line x1="50" y1="51" x2="50" y2="69" stroke="#EBA37F" stroke-width="8" stroke-linecap="round"/></svg><div>WILD</div>';
  d.appendChild(el); /* on <html>, not <body>, so the members' gate never hides it */

  var gone = false;
  function lift() {
    if (gone) return;
    gone = true;
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }
  window.WILD_LOADER = { lift: lift };
  /* lift on the frame after the page is parsed, so the page is drawn underneath as it fades */
  function ready() {
    (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(lift);
  }
  if (document.readyState !== 'loading') ready();
  else document.addEventListener('DOMContentLoaded', ready);
  setTimeout(lift, Math.max(0, 3000 - (Date.now() - t0)));
})();

/* WILD membership gate. Uses the same sign-in as WILD OS: the session WILD OS
   stores in localStorage (same github.io origin) is checked against the WILD
   auth verify webhook. Non-members see a locked screen instead of the site. */
(function () {
  var KEY = 'wild_member_session';
  var VERIFY = 'https://helpful-vision-boards-helen.trycloudflare.com/webhook/wild/auth/verify';
  var WILD_OS = 'https://smith912000.github.io/wild-os/';
  var JOIN = 'https://smith912000.github.io/wild-programme/#join';
  var NAME = document.currentScript && document.currentScript.getAttribute('data-name') || 'This library';

  var root = document.documentElement;
  root.classList.add('wild-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.wild-locked,html.wild-locked body{overflow:hidden!important}' +
    'html.wild-locked body>*:not(#wild-gate){visibility:hidden!important}' +
    '#wild-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'background:#06100e;color:#edefe6;font:16px/1.6 Georgia,"Times New Roman",serif;visibility:visible!important}' +
    '#wild-gate .box{max-width:420px;text-align:center}' +
    '#wild-gate h1{font-weight:normal;letter-spacing:.12em;color:#eba37f;font-size:1.4rem;margin:0 0 12px}' +
    '#wild-gate p{color:#a3b0ab;margin:0 0 18px}' +
    '#wild-gate a,#wild-gate button{display:block;width:100%;margin:10px 0 0;padding:12px 16px;border-radius:8px;font:600 .9rem system-ui,sans-serif;' +
    'letter-spacing:.04em;text-decoration:none;cursor:pointer;box-sizing:border-box}' +
    '#wild-gate .main{background:#d2825a;color:#06100e;border:0}' +
    '#wild-gate .alt{background:none;color:#eba37f;border:1px solid rgba(210,130,90,.4)}' +
    '#wild-gate small{display:block;margin-top:16px;color:#7f8f89;font:.78rem system-ui,sans-serif}';
  (document.head || root).appendChild(css);

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function claims(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - p.length % 4) % 4)))));
    } catch (e) { return {}; }
  }
  // Pages can wait for 'wild:unlocked' before playing anything the visitor should see
  // (the hub's intro film), and stop it on 'wild:locked'.
  function tell(name) { try { document.dispatchEvent(new Event(name)); } catch (e) {} }
  function unlock() {
    var was = root.classList.contains('wild-locked');
    root.classList.remove('wild-locked');
    var g = document.getElementById('wild-gate');
    if (g) g.remove();
    if (was) tell('wild:unlocked');
  }
  function lock() {
    if (!root.classList.contains('wild-locked')) { root.classList.add('wild-locked'); tell('wild:locked'); }
  }
  function show(kind) {
    lock();
    if (kind === 'checking') return paint('<div class="box"><p>Checking your membership…</p></div>');
    var msg = kind === 'lapsed'
      ? 'Your WILD membership has ended. Rejoin to open ' + NAME + ' again.'
      : NAME + ' is part of the WILD membership. Sign in through WILD OS with your Whop account, then come back to this page.';
    var html = '<div class="box"><h1>' + (kind === 'lapsed' ? 'Membership ended' : 'Members only') + '</h1><p>' + msg + '</p>' +
      (kind === 'lapsed' ? '' : '<a class="main" href="' + WILD_OS + '">Sign in through WILD OS</a>') +
      '<a class="' + (kind === 'lapsed' ? 'main' : 'alt') + '" href="' + JOIN + '">Join WILD</a>' +
      '<button class="alt" type="button" id="wild-gate-retry">I have signed in, check again</button>' +
      '<small>Membership is £13 a month or £100 a year and includes WILD OS, Codex Pharmakon and SGE.</small></div>';
    paint(html);
    document.getElementById('wild-gate-retry').onclick = check;
  }
  function paint(html) {
    var g = document.getElementById('wild-gate');
    if (!g) {
      g = document.createElement('div');
      g.id = 'wild-gate';
      (document.body || root).appendChild(g);
    }
    g.innerHTML = html;
  }
  function check() {
    var s = read();
    if (!s || !s.token) return show('guest');
    var c = claims(s.token);
    var now = Math.floor(Date.now() / 1000);
    // A member whose signed session has not expired is let in at once, so the
    // page is not held on "Checking your membership" for the webhook round
    // trip. The check still runs in the background and relocks the page if the
    // membership has ended or the session is rejected.
    // A sign-in older than its 7-day token still opens at once if the sign-in server confirmed it in
    // the last 7 days (it is renewed in the background), so a member never waits on that server.
    var recent = !!(s.verifiedAt && (Date.now() - s.verifiedAt) < 7 * 86400000);
    var trusted = !!(s.member && ((c.exp && c.exp > now) || recent));
    if (trusted) unlock(); else show('checking');
    // A stalled webhook must not hold the page on "Checking your membership": give up after 4 s
    // (the catch below then keeps trusted sessions open and locks the rest).
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    fetch(VERIFY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (r) {
        var j = r.body || {};
        if (j.ok && j.token) {
          save({ token: j.token, member: !!j.member, name: j.name || s.name || null, email: claims(j.token).email || s.email || null, expiresAt: j.expiresAt || null, verifiedAt: Date.now() });
          return j.member ? unlock() : show('lapsed');
        }
        show('guest');
      })
      .catch(function () {
        // Offline or webhook down: a member session that is still in date, or that the server
        // confirmed in the last 7 days, keeps the page open; anything else locks.
        if (trusted) unlock(); else show('guest');
      });
  }
  function start() { check(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && root.classList.contains('wild-locked')) check();
  });
})();
