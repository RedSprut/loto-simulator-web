/* Chrome tab-return repaint safety-net (item 6). The CSS de-promotion above removes the
   droppable ball layers at rest; this is the sanctioned belt-and-suspenders for any residual
   compositing drop (e.g. a blurred ancestor): when the tab becomes visible again — or is
   restored from the BFCache — force ONE repaint of the already-rendered Analytics rows. It
   never regenerates data or touches numbers; it only nudges the browser to repaint existing
   DOM, and it no-ops unless the Analytics results are actually on screen. */
(function () {
  function analyticsScope() {
    var el = document.getElementById('at-inp');
    if (!el || el.offsetParent === null) return null;           // not rendered / hidden
    if (!el.querySelector('.hist-balls')) return null;          // no result rows to restore
    return el;
  }
  var pending = false;
  function repaintOnce() {
    if (pending) return;
    var el = analyticsScope();
    if (!el) return;
    pending = true;
    // Toggle a paint-invalidating (visually identical) property, then clear it next frame.
    // No layout change, no scroll reset, no data touched — just a forced re-composite.
    el.style.transform = 'translateZ(0)';
    void el.offsetHeight;                                       // flush layout/paint
    requestAnimationFrame(function () { el.style.transform = ''; pending = false; });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) repaintOnce(); });
  window.addEventListener('pageshow', function () { repaintOnce(); });
})();
