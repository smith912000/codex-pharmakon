/* WILD membership gate. Uses the same sign-in as WILD OS: the session WILD OS
   stores in localStorage (same github.io origin) is checked against the WILD
   auth verify webhook. Non-members see a locked screen instead of the site. */
(function () {
  var KEY = 'wild_member_session';
  var VERIFY = 'https://smith912000.app.n8n.cloud/webhook/wild/auth/verify';
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
    'background:#050309 radial-gradient(60% 50% at 50% 0%,rgba(99,73,184,.22),transparent 70%);color:#F4F1ED;' +
    'font:16px/1.6 "DM Sans",system-ui,sans-serif;visibility:visible!important}' +
    '#wild-gate .box{max-width:400px;width:100%;text-align:center;padding:32px 28px;border-radius:18px;' +
    'background:#120C1F;border:1px solid rgba(99,73,184,.35);box-shadow:0 30px 60px rgba(0,0,0,.5)}' +
    '#wild-gate .mark{display:block;width:44px;height:52px;margin:0 auto 16px}' +
    '#wild-gate h1{font:600 1.75rem/1.15 "Cormorant Garamond",Georgia,serif;color:#F4F1ED;letter-spacing:.01em;margin:0 0 10px}' +
    '#wild-gate p{color:rgba(244,241,237,.68);margin:0 0 20px;font-size:.95rem}' +
    '#wild-gate a,#wild-gate button{display:block;width:100%;min-height:48px;margin:10px 0 0;padding:12px 18px;border-radius:999px;' +
    'font:600 .9rem "DM Sans",system-ui,sans-serif;letter-spacing:.02em;text-decoration:none;cursor:pointer;box-sizing:border-box}' +
    '#wild-gate .main{background:#C9A84C;color:#0B0714;border:0}' +
    '#wild-gate .main:hover{background:#E9C766}' +
    '#wild-gate .alt{background:rgba(99,73,184,.14);color:#B9A9F0;border:1px solid rgba(99,73,184,.5)}' +
    '#wild-gate a:focus-visible,#wild-gate button:focus-visible{outline:2px solid #E9C766;outline-offset:3px}' +
    '#wild-gate small{display:block;margin-top:18px;color:rgba(244,241,237,.5);font:.78rem "DM Sans",system-ui,sans-serif}';
  var MARK = '<svg class="mark" viewBox="0 0 100 120" aria-hidden="true" fill="none">' +
    '<circle cx="50" cy="42" r="36" stroke="#6349B8" stroke-width="2.5"/><circle cx="50" cy="78" r="36" stroke="#6349B8" stroke-width="2.5"/>' +
    '<path d="M50 51V69" stroke="#E9C766" stroke-width="3" stroke-linecap="round"/></svg>';
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
  function unlock() {
    root.classList.remove('wild-locked');
    var g = document.getElementById('wild-gate');
    if (g) g.remove();
  }
  function show(kind) {
    if (kind === 'checking') return paint('<div class="box">' + MARK + '<p>Checking your membership…</p></div>');
    var msg = kind === 'lapsed'
      ? 'Your WILD membership has ended. Rejoin to open ' + NAME + ' again.'
      : NAME + ' is part of the WILD membership. Sign in through WILD OS with your Whop account, then come back to this page.';
    var html = '<div class="box">' + MARK + '<h1>' + (kind === 'lapsed' ? 'Membership ended' : 'Members only') + '</h1><p>' + msg + '</p>' +
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
    fetch(VERIFY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token }) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (r) {
        var j = r.body || {};
        if (j.ok && j.token) {
          save({ token: j.token, member: !!j.member, name: j.name || s.name || null, email: claims(j.token).email || s.email || null, expiresAt: j.expiresAt || null });
          return j.member ? unlock() : show('lapsed');
        }
        show('guest');
      })
      .catch(function () {
        // Offline or webhook down: same grace as WILD OS, trust an unexpired member token.
        if (s.member && c.exp && c.exp > now) unlock(); else show('guest');
      });
  }
  function start() { show('checking'); check(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && root.classList.contains('wild-locked')) check();
  });
})();
