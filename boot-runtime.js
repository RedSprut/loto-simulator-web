/* Splash-прелоадер (вылетающие шары логотипа): класс loto-booting ставится ДО
   первого кадра, чтобы основной UI не мигал до появления шаров. Это первый inline-
   скрипт, поэтому build выносит его в boot-runtime.js (parser-blocking, исполняется
   раньше <body>). Скрытие/удаление splash — в IIFE в конце этого же скрипта. */
document.documentElement.classList.add('loto-booting');
/* THE PAGE SCROLLBAR MAY NEVER TAKE LAYOUT WIDTH.
   A platform CLASSIC scrollbar is part of the layout: the browser subtracts it from the viewport,
   so the header, the page background and every centred box stop short of the window's right edge
   and the engine paints its track in the strip that is left — a permanent light band down the
   right of the site, straight across the dark header. No CSS turns a classic bar into an overlay
   one: the engine picks that from the OS ("Show scroll bars" on macOS), and `scrollbar-gutter`
   and `::-webkit-scrollbar` only ever made it worse. The only way for the page to keep its full
   width is for its bar to be zero-width.
   So: measure once, here, whether this platform's scrollbars take space, and if they do, hide the
   PAGE one (`html.loto-overlay-bars`, next to the `.loto-booting` rules). Where the platform
   already overlays — Safari, every touch device, a Mac set to "show scroll bars when scrolling" —
   nothing is touched and the native bar keeps working, because there it costs no width. The probe
   is on documentElement so it runs before <body> exists, and before the first paint, so the strip
   never flashes. Long pages keep their own affordance either way: #scroll-anchors shows a
   jump-to-top/bottom control whenever the document is over two viewports tall.
   Inner sheets and panels are NOT affected — they keep the desktop bar the app draws for them. */
(function(){
  try{
    var probe=document.createElement('div');
    probe.style.cssText='position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll';
    document.documentElement.appendChild(probe);
    var takesSpace=probe.offsetWidth-probe.clientWidth>0;
    probe.remove();
    if(takesSpace)document.documentElement.classList.add('loto-overlay-bars');
  }catch(_){}
})();
/* No FREE-before-PRO flash: the body starts `access-pending` (tier badges hidden); reveal them
   only once the real access level has resolved. refreshAccess() awaits the backend before its
   first emit, so the first accesschange already carries the true tier. A timeout is a safety net
   so badges never stay hidden if that event never fires. */
(function(){var clr=function(){document.body&&document.body.classList.remove('access-pending');window.__lotoTierResolved=true;};
  window.addEventListener('loto:accesschange',function h(){clr();window.removeEventListener('loto:accesschange',h);});
  setTimeout(clr,6000);})();
/* диагностический ловец: покажет любую ошибку прямо на экране */
window.__bootErrors=[];
window.onerror=function(msg,src,line,col,err){
  try{
    window.__bootErrors.push(msg+' @'+line+':'+col);
    var b=document.getElementById('boot-err');
    if(!b){
      b=document.createElement('div');
      b.id='boot-err';
      b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#B3261E;color:#fff;font:12px/1.5 -apple-system,monospace;padding:10px 14px;white-space:pre-wrap;word-break:break-all;max-height:45vh;overflow:auto;visibility:visible!important';
      (document.body||document.documentElement).appendChild(b);
    }
    b.textContent='⚠️ '+window.__bootErrors.join('\n');
  }catch(e){}
  return false;
};
window.addEventListener('unhandledrejection',function(e){
  var r=e&&e.reason;
  /* Magic-link / OAuth callback failures (expired · already-used · invalid link) are a normal
     user scenario, especially now that native deep-links feed the callback URL into the auth
     flow; that flow already shows a localized message. Don't ALSO trip the raw diagnostic
     error banner for this one handled case (every other error still surfaces). */
  if(r&&(r.name==='AuthCallbackError'||r.__isAuthCallbackError)){try{e.preventDefault();}catch(_e){}return;}
  window.onerror(String(r&&r.message||r||'promise rejection'),'',0,0);
});
/* Скрыть splash после появления приложения. Основной путь ждёт явную отметку
   готовности первого стабильного кадра; fail-open остаётся только для ошибок
   загрузки, чтобы приложение не зависало за прелоадером. */
(function(){
  var d=document.documentElement;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var minMs=reduce?280:1700,done=false,anchor=0,nativeSplashHidden=false,appReady=false;
  function isNativeCapacitor(){
    try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}
    catch(_e){return false;}
  }
  function hideNativeLaunchSplash(){
    if(nativeSplashHidden||!isNativeCapacitor())return;
    nativeSplashHidden=true;
    var splash=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.SplashScreen;
    if(!splash||typeof splash.hide!=='function')return;
    try{splash.hide({fadeOutDuration:160});}catch(_e){}
  }
  function reveal(){d.classList.remove('loto-booting');}
  function basicUiReady(){
    return !!(document.body&&document.getElementById('rows-c')&&document.querySelector('.page.show')&&document.getElementById('bn-sim'));
  }
  function hide(){
    if(done)return;done=true;
    var s=document.getElementById('loto-splash');
    hideNativeLaunchSplash();
    if(!s){reveal();return;}
    s.classList.add('ls-hide');
    setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);reveal();},520);
  }
  /* Единственный шлюз показа приложения: ждём, пока i18n применит определённый язык
     (window.__lotoI18nApplied). Иначе splash мог исчезнуть раньше перевода, и пользователь с
     польским/украинским устройством на миг увидел бы исходный русский текст. Ожидание
     ограничено 3 с (и почти всегда равно нулю: __lotoI18nApplied выставляется в finally, даже
     если чанк локали не загрузился), поэтому за splash приложение зависнуть не может. */
  var i18nWaiting=false;
  function whenLanguageApplied(run){
    if(window.__lotoI18nApplied){run();return;}
    if(i18nWaiting)return;
    i18nWaiting=true;
    var fired=false,tries=0;
    var go=function(){if(fired)return;fired=true;clearInterval(poll);run();};
    window.addEventListener('loto:languagechange',go,{once:true});
    var poll=setInterval(function(){if(window.__lotoI18nApplied||++tries>60)go();},50);
  }
  function requestHide(){
    if(done)return;
    whenLanguageApplied(function(){
      if(done)return;
      setTimeout(hide,Math.max(0,minMs-(Date.now()-anchor)));
    });
  }
  window.__lotoMarkAppReady=function(){appReady=true;requestHide();};
  // Отсчёт от появления DOM (шары уже в разметке), чтобы анимация всегда была видна.
  function arm(){
    anchor=anchor||Date.now();
    requestAnimationFrame(function(){requestAnimationFrame(hideNativeLaunchSplash);});
    if(appReady||basicUiReady())requestHide();
    else setTimeout(function(){if(basicUiReady())window.__lotoMarkAppReady();},500);
  }
  if(document.readyState!=='loading')arm();
  else document.addEventListener('DOMContentLoaded',arm,{once:true});
  setTimeout(function(){
    if(done)return;
    if(basicUiReady())window.__lotoMarkAppReady();
    else{
      var b=document.getElementById('boot-err');
      if(!b){
        b=document.createElement('div');
        b.id='boot-err';
        b.style.cssText='position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:99999;background:rgba(10,4,8,.92);color:#fff;border:1px solid rgba(233,180,76,.45);border-radius:14px;font:13px/1.45 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;padding:12px 14px;visibility:visible!important';
        (document.body||document.documentElement).appendChild(b);
      }
      var msg='Приложение загружается дольше обычного. Проверьте соединение или перезапустите приложение.';
      try{b.textContent=(window.LotoI18n&&window.LotoI18n.translate)?window.LotoI18n.translate(msg):msg;}catch(_e){b.textContent=msg;}
      hide();
    }
  },6500);
})();
