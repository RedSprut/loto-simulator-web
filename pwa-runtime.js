(function(){
  'use strict';
  if(!('serviceWorker'in navigator)||window.LotoNativeBilling?.isNative)return;
  if(!/^https?:$/.test(location.protocol))return;
  // No reload on a deploy (service-worker.js fromBuild); an older tab restarts on a return after 30 min.
  const BUILD=document.documentElement.getAttribute('data-build')||'';
  let stale=false,hiddenAt=0,reloading=false;
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
    if(!stale||reloading||away<18e5)return;
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
  },{once:true});
})();
