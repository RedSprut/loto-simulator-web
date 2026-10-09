(function(){
  'use strict';
  if(!('serviceWorker'in navigator)||window.LotoNativeBilling?.isNative)return;
  if(!/^https?:$/.test(location.protocol))return;
  const hadController=Boolean(navigator.serviceWorker.controller);
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController||reloading)return;
    reloading=true;
    // A new version activating during the startup preloader must not replay it: Lottery Whirl finishes
    // its flight, keeps the composition for the reloaded page (which continues it) and reloads then;
    // after it has finished, the reloaded page skips it.
    const whirl=window.LotoWhirl;
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
