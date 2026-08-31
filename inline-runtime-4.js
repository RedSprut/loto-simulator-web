/* Mobile scroll-state controller — one passive, rAF-batched window scroll
   listener drives header collapse/hide via classes on <html>. The bottom nav
   intentionally keeps the 3D-draw dock geometry on Simulator/Analytics and does
   not compact on scroll. Width-gated (max-width:699px); a no-op on desktop. */
(function () {
  var doc = document.documentElement;
  var mobileQuery = window.matchMedia('(max-width:699px)');
  var TOP_TOL = 2, COLLAPSE_AT = 12, HIDE_AT = 64;
  var SCROLL_DELTA = 6;
  var hdrState = 'expanded', ticking = false, lastY = 0;
  function setHeader(s) {
    if (s !== hdrState) {
      hdrState = s;
      doc.classList.toggle('hdr-collapsed', s === 'collapsed');
      doc.classList.toggle('hdr-hidden', s === 'hidden');
    }
  }
  function keepNavExpanded() { doc.classList.remove('nav-compact'); }
  function apply(y) {
    keepNavExpanded();
    if (!mobileQuery.matches) {
      setHeader('expanded');
      lastY = Math.max(0, y || 0);
      return;
    }
    y = Math.max(0, y || 0);
    var dy = y - lastY;
    if (y <= TOP_TOL) {
      setHeader('expanded');
    } else if (dy > SCROLL_DELTA) {
      setHeader(y >= HIDE_AT ? 'hidden' : 'collapsed');
    } else if (dy < -SCROLL_DELTA) {
      setHeader('expanded');
    } else if (hdrState === 'expanded' && y > COLLAPSE_AT) {
      setHeader('collapsed');
    }
    lastY = y;
  }
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; apply(window.scrollY || (document.scrollingElement || {}).scrollTop || 0); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  mobileQuery.addEventListener?.('change', onScroll);
  apply(0);
})();
