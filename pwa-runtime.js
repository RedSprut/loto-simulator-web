(function(){
  'use strict';
  // Is what runs here still current? One tiny file answers it: build.json, written by every deploy
  // (build-public-bundle.mjs) and never cached by the worker or the browser.
  //  · web: the deploy the site serves now vs the one this page was built with (data-build), ordered by
  //    build time — a page NEWER than the file (a CDN lagging behind) is never called stale;
  //  · iOS / Android: the store build the owner published there (`stores`) vs the installed build. The
  //    app's own code is bundled; a web deploy never makes it stale and nothing replaces it.
  // Asked at launch, on a return to the app, and when a file of the app fails to load (or an analysis
  // fails: rec-ui.js). A failed or unreadable answer is «unknown» — a lost connection or a server error
  // never shows anything. A confirmed update loads app-update.js (lazy) for the notice.
  const native=(()=>{try{return!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch(_e){return false;}})();
  const web=!native&&/^https?:$/.test(location.protocol);
  const BUILD=document.documentElement.getAttribute('data-build')||'';
  const HEX=/^[0-9a-f]{7,40}$/i;
  const base=native?String(window.LOTO_COMMERCIAL_CONFIG?.nativeDataBaseUrl||'https://lottosimulator.app/').replace(/\/*$/,'/'):'./';
  let stale=false,hiddenAt=0,reloading=false;
  let lastCheck=0,pending=null,result='unknown',shownFor='',failedFor='';
  // At most 5 s: a slow network answers «unknown», never holds up the caller (an analysis waits on it).
  function readManifest(){
    const abort=typeof AbortController==='function'?new AbortController():null;
    const timer=setTimeout(()=>{try{abort&&abort.abort();}catch(_e){}},5000);
    return fetch(`${base}build.json?t=${Date.now()}`,{cache:'no-store',credentials:'omit',signal:abort?abort.signal:undefined})
      .then(response=>response.ok?response.json():null).then(data=>data&&typeof data==='object'?data:null).catch(()=>null)
      .finally(()=>clearTimeout(timer));
  }
  async function checkWeb(){
    if(!HEX.test(BUILD))return{state:'unknown'};
    const m=await readManifest();
    if(!m||!HEX.test(String(m.build||'')))return{state:'unknown'};
    if(m.build===BUILD)return{state:'current'};
    // Another build: stale only when it is the newer one.
    const at=Date.parse(m.builtAt||'')||0,builtAt=Date.parse(document.documentElement.getAttribute('data-build-ts')||'')||0;
    if(!at||!builtAt||at<=builtAt)return{state:'unknown'};
    return{state:'stale',target:m.build};
  }
  async function checkStore(){
    const app=window.Capacitor?.Plugins?.App,platform=window.Capacitor?.getPlatform?.();
    if(!app||typeof app.getInfo!=='function'||(platform!=='ios'&&platform!=='android'))return{state:'unknown'};
    const [info,m]=await Promise.all([app.getInfo().catch(()=>null),readManifest()]);
    const store=m&&m.stores&&m.stores[platform],installed=Number(info&&info.build);
    if(!store||!(installed>0)||!/^https:\/\/(?:apps\.apple\.com|play\.google\.com)\//.test(String(store.url||'')))return{state:'unknown'};
    const latest=Number(store.build)||0,minimum=Number(store.minimum)||0;
    if(minimum>installed)return{state:'required',target:String(minimum),url:store.url,platform};
    if(latest>installed)return{state:'store',target:String(latest),url:store.url,platform};
    return{state:'current'};
  }
  // A notice once per update and page; a failure while the page is stale shows it once more.
  function notify(answer,reason){
    const failure=reason==='resource'||reason==='analysis';
    let later='';try{later=sessionStorage.getItem('loto_update_later')||'';}catch(_e){}
    if((shownFor===answer.target||later===answer.target)&&!(failure&&failedFor!==answer.target))return;
    shownFor=answer.target;
    if(failure)failedFor=answer.target;
    const open=()=>{try{window.LotoAppUpdate.show({mode:answer.state==='stale'?'web':answer.state,target:answer.target,url:answer.url,platform:answer.platform});}catch(_e){}};
    if(window.LotoAppUpdate){open();return;}
    const script=document.createElement('script');
    script.src=`./app-update.js${HEX.test(BUILD)?`?v=${BUILD}`:''}`;
    script.onload=open;
    document.head.appendChild(script);
  }
  // reason: 'launch' | 'return' | 'resource' | 'analysis'. Light: a return re-asks after 5 minutes (an
  // hour in the app), a failure after 10 seconds; concurrent asks share one request.
  function check(reason){
    if(!web&&!native)return Promise.resolve('unknown');
    // A page on its way out asks nothing: files cancelled by the unload are no sign of a stale page.
    if(reloading)return Promise.resolve(result);
    if(pending)return pending;
    const gap=reason==='launch'?0:reason==='return'?(native?36e5:3e5):1e4;
    if(Date.now()-lastCheck<gap)return Promise.resolve(result);
    if(native&&(reason==='resource'||reason==='analysis'))return Promise.resolve(result);
    lastCheck=Date.now();
    pending=(native?checkStore():checkWeb()).catch(()=>({state:'unknown'})).then(answer=>{
      pending=null;result=answer.state;
      if(answer.state==='current'){try{sessionStorage.removeItem('loto_update_attempt');}catch(_e){}}
      if(answer.state==='stale'){
        stale=true;
        navigator.serviceWorker?.getRegistration?.().then(r=>r&&r.update()).catch(()=>{});
      }
      if(answer.state==='stale'||answer.state==='store'||answer.state==='required')notify(answer,reason);
      return answer.state;
    });
    return pending;
  }
  window.LotoFreshness=Object.freeze({check,state:()=>result});
  window.addEventListener('pagehide',()=>{reloading=true;});
  window.addEventListener('pageshow',event=>{if(event.persisted)reloading=false;});
  if(native){
    window.addEventListener('load',()=>{setTimeout(()=>check('launch'),4000);},{once:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check('return');});
    return;
  }
  if(!web)return;
  // A script or stylesheet of the app that failed to load: the first sign of a page left behind a deploy.
  window.addEventListener('error',event=>{
    const el=event.target;
    if(!el||el===window||!el.tagName)return;
    const src=el.tagName==='SCRIPT'?el.src:el.tagName==='LINK'?el.href:'';
    try{if(!src||new URL(src,location.href).origin!==location.origin)return;}catch(_e){return;}
    check('resource');
  },true);
  if(!('serviceWorker'in navigator)||window.LotoNativeBilling?.isNative){
    window.addEventListener('load',()=>{setTimeout(()=>check('launch'),4000);},{once:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check('return');});
    return;
  }
  // No reload on a deploy (service-worker.js fromBuild); an older tab restarts on a return after 30 min.
  function controllerBuild(){
    const worker=navigator.serviceWorker.controller;
    if(!worker||typeof MessageChannel!=='function')return Promise.resolve('');
    return new Promise(resolve=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>resolve(''),3000);
      channel.port1.onmessage=event=>{clearTimeout(timer);resolve(String(event.data||''));};
      try{worker.postMessage({type:'BUILD'},[channel.port2]);}catch(_e){clearTimeout(timer);resolve('');}
    });
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    controllerBuild().then(build=>{if(build&&BUILD&&build!==BUILD)stale=true;});
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){hiddenAt=Date.now();return;}
    const away=hiddenAt?Date.now()-hiddenAt:0;
    hiddenAt=0;
    if(!stale||reloading||away<18e5){check('return');return;}
    reloading=true;
    const whirl=window.LotoWhirl;   // skipped on the restart
    if(whirl&&typeof whirl.handOver==='function'&&whirl.handOver(()=>location.reload()))return;
    location.reload();
  });
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
      // Force an immediate update check on every load so a returning device (esp. a
      // sticky installed iOS PWA) picks up a freshly deployed shell without waiting
      // for the hourly interval — the SHA-based cache name guarantees it's detected.
      registration.update().catch(()=>{});
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});
        });
      });
      setInterval(()=>registration.update().catch(()=>{}),60*60*1000);
    }catch(error){
      console.warn('Service Worker registration failed',error);
    }
    // After the page has settled: the check never competes with the first paint.
    setTimeout(()=>check('launch'),4000);
  },{once:true});
})();
