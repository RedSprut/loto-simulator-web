/* Splash-прелоадер (вылетающие шары логотипа): класс loto-booting ставится ДО
   первого кадра, чтобы основной UI не мигал до появления шаров. Это первый inline-
   скрипт, поэтому build выносит его в boot-runtime.js (parser-blocking, исполняется
   раньше <body>). Скрытие/удаление splash — в IIFE в конце этого же скрипта. */
document.documentElement.classList.add('loto-booting');
/* диагностический ловец: покажет любую ошибку прямо на экране */
window.__bootErrors=[];
window.onerror=function(msg,src,line,col,err){
  try{
    window.__bootErrors.push(msg+' @'+line+':'+col);
    var b=document.getElementById('boot-err');
    if(!b){
      b=document.createElement('div');
      b.id='boot-err';
      b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#B3261E;color:#fff;font:12px/1.5 -apple-system,monospace;padding:10px 14px;white-space:pre-wrap;word-break:break-all;max-height:45vh;overflow:auto';
      (document.body||document.documentElement).appendChild(b);
    }
    b.textContent='⚠️ '+window.__bootErrors.join('\n');
  }catch(e){}
  return false;
};
window.addEventListener('unhandledrejection',function(e){
  window.onerror(String(e.reason&&e.reason.message||e.reason||'promise rejection'),'',0,0);
});
/* Скрыть splash после появления приложения (или по таймауту) — единая логика для web
   desktop/mobile Safari·Chrome·Firefox и Capacitor iOS/Android. Основной UI раскрываем
   ТОЛЬКО после полного УДАЛЕНИЯ splash (ни одного кадра с обоими сразу); жёсткие таймауты
   гарантируют, что overlay никогда не зависнет и не оставит pointer-events. */
(function(){
  var d=document.documentElement;
  setTimeout(function(){d.classList.remove('loto-booting');},5000); // safety net
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var minMs=reduce?280:1700,done=false,anchor=0,nativeSplashHidden=false;
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
  function hide(){
    if(done)return;done=true;
    var s=document.getElementById('loto-splash');
    if(!s){reveal();return;}
    s.classList.add('ls-hide');
    setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);reveal();},520);
  }
  // Отсчёт от появления DOM (шары уже в разметке), чтобы анимация всегда была видна.
  function arm(){
    anchor=anchor||Date.now();
    setTimeout(hideNativeLaunchSplash,32);
    setTimeout(hide,Math.max(0,minMs-(Date.now()-anchor)));
  }
  if(document.readyState!=='loading')arm();
  else document.addEventListener('DOMContentLoaded',arm,{once:true});
  setTimeout(hide,5200); // hard cap: never hang the overlay
})();
