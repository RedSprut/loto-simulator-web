(function () {
  function analyticsScope() {
    var el = document.getElementById('at-inp');
    if (!el || el.offsetParent === null) return null;            
    if (!el.querySelector('.hist-balls')) return null;           
    return el;
  }
  var pending = false;
  function repaintOnce() {
    if (pending) return;
    var el = analyticsScope();
    if (!el) return;
    pending = true;
    el.style.transform = 'translateZ(0)';
    void el.offsetHeight;                                        
    requestAnimationFrame(function () { el.style.transform = ''; pending = false; });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) repaintOnce(); });
  window.addEventListener('pageshow', function () { repaintOnce(); });
})();
