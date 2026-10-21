/* WILD vault (browser). Members-only content is stored encrypted in the public
   repo (".wv" files, see tools/wild-vault.mjs). After the membership gate,
   this asks the WILD content key service for the key, using the member's
   signed WILD session, and decrypts files in the browser. The key is held in
   memory for this page only and never saved.

   WildVault.open({ app: 'codex', epoch: '2026Q4' }) -> Promise<vault>
   vault.text(url) -> Promise<string>
   Rejects with err.code = 'guest' | 'lapsed' | 'offline' | 'broken'. */
(function () {
  if (window.WildVault) return;
  var SESSION = 'wild_member_session';
  // n8n address comes from member-gate.js (loaded first), so moving n8n is a one-line change there.
  var BASE = window.WILD_N8N_BASE || 'https://smith912000.app.n8n.cloud';
  var KEY_URL = BASE + '/webhook/wild/content/key';
  var VERIFY = BASE + '/webhook/wild/auth/verify';
  var MAGIC = [87, 86, 48, 49]; // "WV01"
  var opened = {};

  function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; }
  }
  function claims(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - p.length % 4) % 4)))));
    } catch (e) { return {}; }
  }
  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); },
            function () { throw fail('offline', 'Could not reach the WILD key service.'); });
  }
  // Same refresh as member-gate.js: the verify endpoint re-checks Whop when the
  // session is over 24 hours old and returns a fresh signed session.
  function refresh(s) {
    return post(VERIFY, { token: s.token }).then(function (j) {
      if (!(j.ok && j.token)) throw fail('guest');
      var n = { token: j.token, member: !!j.member, name: j.name || s.name || null, email: claims(j.token).email || s.email || null, expiresAt: j.expiresAt || null, verifiedAt: Date.now() };
      try { localStorage.setItem(SESSION, JSON.stringify(n)); } catch (e) {}
      if (!j.member) throw fail('lapsed');
      return n;
    });
  }
  function hexBytes(h) {
    var a = new Uint8Array(h.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  }
  function getKey(app, epoch) {
    var s = readSession();
    if (!s || !s.token) return Promise.reject(fail('guest'));
    var c = claims(s.token), now = Date.now() / 1000;
    var start = (c.iat && now - c.iat > 20 * 3600) ? refresh(s) : Promise.resolve(s);
    function ask(sess, retried) {
      return post(KEY_URL, { token: sess.token, app: app, epoch: epoch }).then(function (j) {
        if (j.ok && /^[0-9a-f]{64}$/.test(j.key || '')) return j.key;
        if (j.error === 'stale_session' && !retried) return refresh(sess).then(function (n) { return ask(n, true); });
        if (j.error === 'not_member') throw fail('lapsed');
        if (j.__status === 401) throw fail('guest');
        throw fail('broken', 'Key service refused: ' + (j.error || j.__status));
      });
    }
    return start.then(function (sess) { return ask(sess, false); }).then(function (hex) {
      return crypto.subtle.importKey('raw', hexBytes(hex), 'AES-GCM', false, ['decrypt']);
    });
  }
  function gunzip(buf) {
    var ds = new DecompressionStream('gzip');
    return new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
  }
  function open(opts) {
    var id = opts.app + '|' + opts.epoch;
    if (!opened[id]) {
      opened[id] = getKey(opts.app, opts.epoch).then(function (key) {
        var aad = new TextEncoder().encode(id);
        return {
          text: function (url) {
            return fetch(url, { cache: 'no-cache' }).then(function (r) {
              if (!r.ok) throw fail('broken', 'Missing file ' + url);
              return r.arrayBuffer();
            }).then(function (ab) {
              var b = new Uint8Array(ab);
              for (var i = 0; i < 4; i++) if (b[i] !== MAGIC[i]) throw fail('broken', 'Not a vault file ' + url);
              return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(4, 16), additionalData: aad }, key, b.subarray(16));
            }).then(gunzip);
          }
        };
      });
      opened[id].catch(function (e) {
        delete opened[id];
        try { document.dispatchEvent(new CustomEvent('wild:vault-denied', { detail: e.code })); } catch (x) {}
      });
    }
    return opened[id];
  }
  window.WildVault = { open: open };
})();
