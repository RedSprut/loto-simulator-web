document.documentElement.classList.add('loto-booting');
(function(){
  try{
    var probe=document.createElement('div');
    probe.style.cssText='position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll';
    document.documentElement.appendChild(probe);
    var takesSpace=probe.offsetWidth-probe.clientWidth>0;
    probe.remove();
    var fine=false;
    try{fine=matchMedia('(pointer:fine)').matches;}catch(_e){}
    if(takesSpace||fine)document.documentElement.classList.add('loto-overlay-bars');
  }catch(_){}
})();
(function(){var clr=function(){document.body&&document.body.classList.remove('access-pending');window.__lotoTierResolved=true;};
  window.addEventListener('loto:accesschange',function h(){clr();window.removeEventListener('loto:accesschange',h);});
  setTimeout(clr,6000);})();
window.__bootErrors=[];window.__bootErrorDetails=[];
window.__lotoRoutePopInstalled=true;
(function(){
  var inFlight=false,queue=[],timer=0;
  function settled(lost){
    window.LotoNavigation?.onTraversalsSettled?.(!!lost);
    try{window.dispatchEvent(new CustomEvent('loto:traversalssettled',{detail:{lost:!!lost}}));}catch(_){}
  }
  function start(fn,args){inFlight=true;clearTimeout(timer);timer=setTimeout(lose,1000);fn.apply(history,args);}
  function landed(){clearTimeout(timer);inFlight=false;if(queue.length){var next=queue.shift();start(next[0],next[1]);}else settled(false);}
  function lose(){clearTimeout(timer);inFlight=false;queue=[];settled(true);}
  ['back','forward','go'].forEach(function(name){
    var fn=history[name];if(typeof fn!=='function')return;
    try{history[name]=function(delta){
      if(name==='go'&&!delta)return fn.apply(history,arguments);
      if(inFlight){queue.push([fn,arguments]);return;}
      start(fn,arguments);
    };}catch(_){}
  });
  Object.defineProperty(window,'__lotoPendingTraversals',{get:function(){return (inFlight?1:0)+queue.length;}});
  window.addEventListener('popstate',function(event){
    var programmatic=inFlight;
    try{event.lotoProgrammatic=programmatic;}catch(_){}    
    window.LotoNavigation?.onPopState?.(event,programmatic);
    if(programmatic)landed();
  });
  window.addEventListener('pageshow',function(event){if(event.persisted&&(inFlight||queue.length))lose();});
})();
window.onerror=function(msg,src,line,col,err){
  try{
    if(!err&&!src&&!line&&!col&&/^Script error\.?$/.test(String(msg))){window.__bootErrorDetails.push({message:String(msg),source:'',line:0,column:0,stack:'',opaque:true,time:Date.now()});return false;}
    window.__bootErrors.push(msg+' @'+line+':'+col);
    window.__bootErrorDetails.push({message:String(msg),source:src||'',line:line||0,column:col||0,stack:err&&err.stack||'',time:Date.now()});
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
  if(r&&(r.name==='AuthCallbackError'||r.__isAuthCallbackError)){try{e.preventDefault();}catch(_e){}return;}
  window.onerror(String(r&&r.message||r||'promise rejection'),'',0,0,r);
});
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
  window.__lotoMarkAppReady=function(){
    appReady=true;requestHide();
    var s=document.getElementById('boot-err');
    if(s&&s.hasAttribute('data-slow')&&!(window.__bootErrors||[]).length&&s.parentNode)s.parentNode.removeChild(s);
  };
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
      b.setAttribute('data-slow','');
      hide();
    }
  },6500);
})();
