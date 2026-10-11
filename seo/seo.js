/* Static SEO pages (scripts/build-seo-pages.mjs): the random line generator. It carries no user-facing
 * text — every label is rendered into the page in its own language — and it never talks to a server.
 * Each line is drawn uniformly without replacement with crypto.getRandomValues (rejection sampling,
 * so no modulo bias).
 *
 * «Призовые совпадения»: every line drawn here is queued on this device (localStorage, same origin as
 * the app; nothing leaves the browser) with the moment it was drawn and the page it was drawn on. The
 * app takes the queue in on its next prize scan (LotoWinMatch, index.html) and checks each line against
 * the official draw that was next at that moment. Bounded: the newest 500 lines, none older than 45 days
 * (a line waits at most a week for its draw, and the app keeps an unchecked row 35 days after it). */
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
  var OUTBOX = 'loto_seo_generated_v1', KEEP = 500, MAX_AGE = 45 * 86400000;
  // Answers whether the lines were queued (storage blocked or full: they were not).
  function queue(app, rows) {
    try {
      var now = Date.now(), page = location.pathname.replace(/index\.html$/, '');
      var list = JSON.parse(localStorage.getItem(OUTBOX) || '[]');
      if (!Array.isArray(list)) list = [];
      list = list.filter(function (e) { return e && typeof e.at === 'number' && now - e.at < MAX_AGE; });
      rows.forEach(function (row) {
        var uid = new Uint32Array(2);
        cryptoApi.getRandomValues(uid);
        list.push({ v: 1, id: 'se' + now.toString(36) + uid[0].toString(36) + uid[1].toString(36), game: app, at: now, main: row.main, bonus: row.bonus, page: page });
      });
      localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-KEEP)));
      return true;
    } catch (_e) { return false; }
  }
  function ball(n, extra) {
    var el = document.createElement('span');
    el.className = extra ? 'ball x' : 'ball';
    el.textContent = String(n);
    return el;
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-gen]'), function (box) {
    var game = box.querySelector('.gen-game'), lines = box.querySelector('.gen-lines');
    var go = box.querySelector('.gen-go'), out = box.querySelector('.gen-out'), saved = box.querySelector('.gen-saved');
    if (!game || !lines || !go || !out) return;
    function run() {
      var option = game.options[game.selectedIndex];
      var main = parse(option.getAttribute('data-main')), extra = parse(option.getAttribute('data-extra'));
      if (!main) return;
      var app = option.getAttribute('data-app') || '', drawn = [];
      out.textContent = '';
      for (var n = Number(lines.value) || 1, k = 0; k < n; k++) {
        var row = document.createElement('span'), nums = { main: pick(main[0], main[1], main[2]), bonus: extra ? pick(extra[0], extra[1], extra[2]) : [] };
        row.className = 'balls lg';
        row.setAttribute('data-game', app);
        nums.main.forEach(function (x) { row.appendChild(ball(x, false)); });
        nums.bonus.forEach(function (x) { row.appendChild(ball(x, true)); });
        out.appendChild(row);
        drawn.push(nums);
      }
      if (saved) saved.hidden = !queue(app, drawn);
    }
    go.hidden = false;
    go.addEventListener('click', run);
    game.addEventListener('change', function () { out.textContent = ''; if (saved) saved.hidden = true; });
  });
})();
