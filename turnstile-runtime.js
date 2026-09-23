/* Cloudflare Turnstile — the client half of the free-Calendar-run step-up.
 *
 * Loaded LAZILY and only when the server has actually asked for a challenge, so a visitor who is
 * never challenged never fetches a byte from Cloudflare and no third-party script sits on the
 * startup path.
 *
 * What this file is NOT: a gate. It only obtains a token. Every decision — whether a challenge is
 * required, whether the token is genuine, whether it was minted for this action and origin, and
 * whether it has already been redeemed — is made by the server against Cloudflare's siteverify
 * with a secret this file never sees.
 *
 * Managed mode is chosen in the Cloudflare dashboard when the widget is created; the client only
 * renders it. `action` is pinned to `calendar_trial` and the server refuses a token carrying any
 * other action, so a token minted on some other widget or flow cannot be replayed here.
 *
 * Without a configured site key nothing is rendered and getToken() resolves to '' — the server
 * then reports the challenge as unconfigured and the account, mailbox and installation pools stay
 * the real gates. On a LOCAL page talking to a LOCAL backend the OFFICIAL Cloudflare test key is
 * used (documented, always-passes) so the flow can be exercised in development. Both halves of
 * that condition matter: the test key mints the literal token `XXXX.DUMMY.TOKEN.XXXX`, which only
 * a deployment holding Cloudflare's matching TEST SECRET accepts. Sent to production it is just a
 * bad token — and a bad token is charged to the VISITOR as a failed challenge. A Capacitor
 * WebView is served from hostname `localhost` as well, so "we are on localhost" alone must never
 * be the reason to mint one.
 */
(function () {
  'use strict';
  if (window.LotoTurnstile) return;

  var SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  // Cloudflare's documented always-passes test site key. It is public and useless in production:
  // a token it mints only validates against the matching test SECRET.
  var TEST_SITE_KEY = '1x00000000000000000000AA';
  var ACTION = 'calendar_trial';
  var loading = null;

  function config() { try { return window.LOTO_COMMERCIAL_CONFIG || {}; } catch (e) { return {}; } }
  function isLocal() {
    try {
      var host = location.hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '' || navigator.webdriver === true;
    } catch (e) { return false; }
  }
  // Is the configured backend one whose Turnstile SECRET can only be the test secret? A hosted
  // Supabase project is a real backend with a real secret; an empty config reaches no backend at
  // all, so nothing it mints can ever be charged to anybody.
  function backendIsLocal() {
    try {
      var url = String(config().supabaseUrl || '').trim();
      if (!url) return true;
      var host = new URL(url).hostname;
      return host === 'localhost' || host === '127.0.0.1';
    } catch (e) { return false; }
  }
  function siteKey() {
    var key = String(config().turnstileSiteKey || '').trim();
    if (key) return key;
    // A native build shipped without the site key lands here: it renders NO widget rather than a
    // test one, so the server sees no token instead of a bad one. The person is still gated by
    // the risk score, but our packaging mistake never becomes their recorded challenge failure.
    return isLocal() && backendIsLocal() ? TEST_SITE_KEY : '';
  }
  function available() { return !!siteKey(); }

  function loadScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('turnstile_timeout')); }, 15000);
      function cleanup() { clearTimeout(timer); loading = null; }
      script.src = SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        clearTimeout(timer);
        if (window.turnstile) resolve(window.turnstile);
        else { cleanup(); reject(new Error('turnstile_missing')); }
      };
      script.onerror = function () { cleanup(); script.remove(); reject(new Error('turnstile_unreachable')); };
      document.head.appendChild(script);
    });
    return loading;
  }

  // Render the widget into `host` and resolve with a fresh token. A token is single-use and
  // short-lived, so one is obtained per attempt and never cached.
  function getToken(host, options) {
    var settings = options || {};
    if (!available()) return Promise.resolve('');
    return loadScript().then(function (turnstile) {
      return new Promise(function (resolve) {
        var settled = false;
        var widgetId = null;
        function finish(value) {
          if (settled) return;
          settled = true;
          // Leave the widget mounted only long enough to hand the token over; a stale widget
          // would otherwise keep refreshing tokens nobody redeems.
          try { if (widgetId !== null) turnstile.remove(widgetId); } catch (e) {}
          resolve(value || '');
        }
        var timer = setTimeout(function () { finish(''); }, 60000);
        try {
          widgetId = turnstile.render(host, {
            sitekey: siteKey(),
            action: settings.action || ACTION,
            theme: (document.documentElement.dataset || {}).theme === 'dark' ? 'dark' : 'light',
            language: (document.documentElement.lang || 'en').slice(0, 2),
            callback: function (token) { clearTimeout(timer); finish(token); },
            'error-callback': function () { clearTimeout(timer); finish(''); },
            'expired-callback': function () { clearTimeout(timer); finish(''); },
            'timeout-callback': function () { clearTimeout(timer); finish(''); },
          });
        } catch (e) { clearTimeout(timer); finish(''); }
      });
    }).catch(function () { return ''; });
  }

  window.LotoTurnstile = {
    ACTION: ACTION,
    available: available,
    isTestKey: function () { return siteKey() === TEST_SITE_KEY; },
    getToken: getToken,
  };
})();
