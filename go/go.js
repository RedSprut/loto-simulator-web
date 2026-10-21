/* Managed promotion links of Lotto Simulator — the page side (go/index.html and 404.html).
 *
 * A published link is https://lottosimulator.app/go/?l=<link> (a normal 200 page whose preview card is
 * the site's own) or the short form https://lottosimulator.app/go/<link> (GitHub Pages serves 404.html
 * for it, which runs this file too). Either way this script only takes the link code from the address
 * and navigates to the `go` edge function, which redirects to the link's fixed page with its campaign
 * tags (and counts the click only if the owner switched counting on). It reads no storage, writes
 * none, sends no request of its own and knows nothing about the visitor; without JavaScript the page
 * still offers a plain link to the app. The one text is shown in the browser's language. */
(function () {
  'use strict';
  var TEXT = {
    ru: 'Открываем Lotto Simulator…', en: 'Opening Lotto Simulator…', no: 'Åpner Lotto Simulator …', nb: 'Åpner Lotto Simulator …',
    sv: 'Öppnar Lotto Simulator …', da: 'Åbner Lotto Simulator …', fi: 'Avataan Lotto Simulator…', de: 'Lotto Simulator wird geöffnet …',
    fr: 'Ouverture de Lotto Simulator…', es: 'Abriendo Lotto Simulator…', it: 'Apertura di Lotto Simulator…', pt: 'A abrir o Lotto Simulator…',
    pl: 'Otwieranie Lotto Simulator…', nl: 'Lotto Simulator wordt geopend…', et: 'Lotto Simulatori avamine…', lv: 'Atver Lotto Simulator…',
    lt: 'Atidaromas Lotto Simulator…', uk: 'Відкриваємо Lotto Simulator…'
  };
  try {
    var code = String(navigator.language || (navigator.languages && navigator.languages[0]) || 'en').toLowerCase().split('-')[0];
    var text = document.getElementById('go-text');
    if (text && TEXT[code]) { text.textContent = TEXT[code]; document.documentElement.lang = code; }
  } catch (e) {}
  var m = /^\/go\/([A-Za-z0-9-]{1,31})\/?$/.exec(location.pathname);
  var slug = m ? m[1] : (/^\/go\/?$/.test(location.pathname) ? new URLSearchParams(location.search).get('l') : null);
  if (!slug) return;                               // the 404 page of any other address: nothing to do
  slug = String(slug).toLowerCase();
  var cfg = window.LOTO_COMMERCIAL_CONFIG || {};
  var base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  var valid = /^[a-z0-9](?:[a-z0-9-]{0,29}[a-z0-9])?$/.test(slug) && slug.indexOf('--') < 0;
  if (!valid || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)) { location.replace('/'); return; }
  location.replace(base + '/functions/v1/go/' + encodeURIComponent(slug));
})();
