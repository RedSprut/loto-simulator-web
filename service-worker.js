// CACHE_VERSION is stamped with the deployed build SHA by scripts/build-public-bundle.mjs
// (the 1d9084f placeholder → short git SHA). Every deploy therefore gets a unique
// cache name, so returning users/PWAs always pick up the new shell (index.html, nav,
// i18n) on the next visit — no manually-bumped constant to forget.
const CACHE_VERSION='loto-shell-v1d9084f';
const SHELL_CACHE=`${CACHE_VERSION}-static`;
const DATA_CACHE=`${CACHE_VERSION}-data`;
const CORE_PRECACHE=[
  './','./index.html','./commercial-config.js',
  './i18n-catalog.js','./i18n-runtime.js','./commercial-runtime.js','./pwa-runtime.js','./native-loader.js',
  './notifications-runtime.js',
  './boot-runtime.js','./app-runtime.js','./manifest.webmanifest','./favicon-64.png',
  './icon-192.png','./icon-512.png','./results.json',
];
const OPTIONAL_PRECACHE=[
  './safe-payment.html','./safe-payment-runtime.js','./auth-client.js','./native-bridge.js','./billing-web.js',
  './privacy.html','./terms.html','./subscription-terms.html','./legal.css','./legal-runtime.js',
  './jackpots.json','./prizes.json',
];
const SUPPORTED_LOCALES=new Set(['ru','en','no','sv','da','fi','de','fr','es','it','pt','pl','nl','et','lv','lt','uk']);
const NEVER_CACHE=/(?:results-archive|\/functions\/v1\/|\/auth\/v1\/|pro-(?:analysis|compute)|access-state|consume-feature|start-trial|billing-(?:status|reconcile)|checkout|management|payment-return|revenuecat|paddle|token|session)/i;

self.addEventListener('install',event=>{
  // Take over immediately so a version bump reaches returning users / installed
  // PWAs on the very next visit (with clients.claim() on activate), and the old
  // cache (stale index.html / JS) is purged — no manual Safari cache clearing.
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then(async cache=>{
    const request=url=>new Request(url,{cache:'reload'});
    await cache.addAll(CORE_PRECACHE.map(request));
    await Promise.allSettled(OPTIONAL_PRECACHE.map(url=>cache.add(request(url))));
  }));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name!==SHELL_CACHE&&name!==DATA_CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(event.data?.type!=='CACHE_LOCALE')return;
  const code=String(event.data.code||'').toLowerCase();
  if(!SUPPORTED_LOCALES.has(code))return;
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>
    cache.add(new Request(`./i18n/${code}.json`))
  ).catch(()=>undefined));
});

function cacheable(request,response){
  if(!response||!response.ok||response.type==='opaque')return false;
  if(request.headers.has('authorization'))return false;
  return!NEVER_CACHE.test(request.url);
}

async function networkFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(cacheable(request,response))await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(SHELL_CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  const network=fetch(request).then(async response=>{
    if(cacheable(request,response))await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  return cached||(await network)||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||NEVER_CACHE.test(url.pathname+url.search)||request.headers.has('authorization'))return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,SHELL_CACHE).catch(()=>caches.match('./index.html')));
    return;
  }
  if(/\/(?:results|jackpots|prizes|commercial-metadata)\.json$/i.test(url.pathname)){
    event.respondWith(networkFirst(request,DATA_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

// ── Web Push ─────────────────────────────────────────────────────────────────────────
// Shared payload contract (identical across iOS/Android/Web — see notifications-runtime.js):
//   { notificationType, lotteryId, drawId|date, destination, title, body }
// This handler ONLY renders and routes; it never caches push data and does not touch the
// SHELL/DATA caches, so notification traffic cannot disturb the app-shell cache behaviour.
const PUSH_DESTINATIONS={
  draw_result:'analytics',draw_results:'analytics',prize_breakdown:'analytics',
  jackpot_updated:'simulator',jackpot_update:'simulator',jackpot_updates:'simulator',
  saved_ticket_result:'check',saved_ticket_results:'check',
  deadline_reminder:'simulator',deadline_reminders:'simulator',upcoming_draw:'simulator',
  system_message:'simulator'
};

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?event.data.json():{};}catch(_e){try{payload={body:event.data&&event.data.text()};}catch(__e){payload={};}}
  const type=payload.notificationType||payload.eventType||payload.type||'';
  const destination=payload.destination||PUSH_DESTINATIONS[type]||'simulator';
  const title=payload.title||'Loto Simulator';
  const options={
    body:payload.body||'',
    icon:'./icon-192.png',
    badge:'./favicon-64.png',
    tag:payload.tag||(type+'-'+(payload.lotteryId||'')),
    data:{notificationId:payload.notificationId||payload.id||'',notificationType:type,eventType:type,lotteryId:payload.lotteryId||'',drawId:payload.drawId||payload.date||'',destination:destination,deepLink:payload.deepLink||payload.deeplink||destination,createdAt:payload.createdAt||new Date().toISOString(),title:title,body:payload.body||''},
  };
  const full={notificationId:payload.notificationId||payload.id||'',notificationType:type,eventType:type,lotteryId:payload.lotteryId||'',drawId:payload.drawId||payload.date||'',destination:destination,deepLink:payload.deepLink||payload.deeplink||destination,title:title,body:payload.body||'',createdAt:payload.createdAt||new Date().toISOString(),unread:payload.unread,payload:payload.payload||payload};
  event.waitUntil(Promise.all([
    self.registration.showNotification(title,options),
    // Also hand the payload to any open window so the in-app center + bell badge update live.
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:'LOTO_PUSH_RECEIVED',data:full})))
  ]));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{};
  const params=new URLSearchParams();
  if(data.destination)params.set('n_dest',data.destination);
  if(data.lotteryId)params.set('n_lot',data.lotteryId);
  if(data.notificationType)params.set('n_type',data.notificationType);
  if(data.drawId)params.set('n_draw',data.drawId);
  const target='./index.html?'+params.toString();
  event.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of all){
      if('focus'in client){
        client.postMessage({type:'LOTO_PUSH_OPEN',data:data});
        return client.focus();
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
