/* Static SEO pages (scripts/build-seo-pages.mjs): the random line generator. It carries no user-facing
 * text — every label is rendered into the page in its own language — and it never talks to a server.
 * Each line is drawn uniformly without replacement with crypto.getRandomValues (rejection sampling,
 * so no modulo bias). */
(function () {
  'use strict';
  var cryptoApi = window.crypto || window.msCrypto;
  if (!cryptoApi || !cryptoApi.getRandomValues) return;
  function randomBelow(n) {
    var limit = Math.floor(4294967296 / n) * n, buf = new Uint32Array(1);
    do { cryptoApi.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }
  function pick(count, min, max) {
    var pool = [], out = [], i;
    for (i = min; i <= max; i++) pool.push(i);
    for (i = 0; i < count; i++) {
      var j = i + randomBelow(pool.length - i), t = pool[i];
      pool[i] = pool[j]; pool[j] = t;
      out.push(pool[i]);
    }
    return out.sort(function (a, b) { return a - b; });
  }
  function parse(value) {
    var p = String(value || '').split(',').map(Number);
    return p.length === 3 && p.every(function (x) { return x > 0 && x === Math.floor(x); }) ? p : null;
  }
  function ball(n, extra) {
    var el = document.createElement('span');
    el.className = extra ? 'ball x' : 'ball';
    el.textContent = String(n);
    return el;
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-gen]'), function (box) {
    var game = box.querySelector('.gen-game'), lines = box.querySelector('.gen-lines');
    var go = box.querySelector('.gen-go'), out = box.querySelector('.gen-out');
    if (!game || !lines || !go || !out) return;
    function run() {
      var option = game.options[game.selectedIndex];
      var main = parse(option.getAttribute('data-main')), extra = parse(option.getAttribute('data-extra'));
      if (!main) return;
      out.textContent = '';
      for (var n = Number(lines.value) || 1, k = 0; k < n; k++) {
        var row = document.createElement('span');
        row.className = 'balls lg';
        row.setAttribute('data-game', option.getAttribute('data-app') || '');
        pick(main[0], main[1], main[2]).forEach(function (x) { row.appendChild(ball(x, false)); });
        if (extra) pick(extra[0], extra[1], extra[2]).forEach(function (x) { row.appendChild(ball(x, true)); });
        out.appendChild(row);
      }
    }
    go.hidden = false;
    go.addEventListener('click', run);
    game.addEventListener('change', function () { out.textContent = ''; });
  });
})();
