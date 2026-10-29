// CACHE_VERSION is stamped with the deployed build SHA by scripts/build-public-bundle.mjs
// (the 7ebd30e placeholder → short git SHA). Every deploy therefore gets a unique
// cache name, so returning users/PWAs always pick up the new shell (index.html, nav,
// i18n) on the next visit — no manually-bumped constant to forget.
const CACHE_VERSION='loto-shell-v7ebd30e';
const SHELL_CACHE=`${CACHE_VERSION}-static`;
const DATA_CACHE=`${CACHE_VERSION}-data`;
// The deploy this worker belongs to. Every script, stylesheet and catalog a built page loads carries
// its own deploy as ?v=<build>, so the worker can tell a page of ANOTHER deploy from its own and
// serve each page the files of the deploy it was built with (see fromBuild). That is what lets a new
// worker take over open pages without reloading them.
const BUILD='7ebd30e';
const BUILT=!BUILD.startsWith('__');
const shellCacheOf=build=>`loto-shell-v${build}-static`;
const CORE_PRECACHE=[
  './','./index.html','./commercial-config.js',
  './i18n-catalog.js','./lang-detect.js','./i18n-runtime.js','./commercial-runtime.js','./pwa-runtime.js','./native-loader.js','./external-link-runtime.js',
  './discovery-ux.js','./discovery-ux.css','./lottery-whirl.js','./lottery-whirl.css','./notifications-runtime.js',
  './boot-runtime.js','./app-runtime.js','./manifest.webmanifest','./favicon-64.png',
  './icon-192.png','./icon-512.png',
];
// results.json is NOT precached: it is 6 MB, the page fetches it itself at boot, and the runtime
// handler already stores that fetch in DATA_CACHE (network-first), so offline still works after
// one visit. Downloading it a second time here — with cache:'reload', so not even from the HTTP
// cache — doubled the traffic of a cold first visit and was what made a tap on a lazily loaded
// screen wait until loadCourtApp() gave up after 20s.

const OPTIONAL_PRECACHE=[
  './suggestions.js','./suggestions-i18n.js','./suggestions.css',
  './app-update.js',
  './discovery-guide.js',
  './win-match-core.js','./smart-start.js','./court-core.js','./court-ui.js','./working-set.js','./worksets.js','./action-center.js','./free-welcome.js','./prize-archive.js','./leaders-ui.js','./calendar-core.js','./calendar-ui.js','./rec-core.js','./rec-analysis.js','./rec-ui.js','./math-tech.js','./math-tech.css','./cosmos-ui.js','./cosmos.css','./jackpot-ceremony.js','./jackpot-ceremony.css','./turnstile-runtime.js',
  './safe-payment.html','./safe-payment-runtime.js','./auth-client.js','./native-bridge.js','./billing-web.js',
  './privacy.html','./terms.html','./subscription-terms.html','./legal.css','./legal-runtime.js',
  './jackpots.json','./prizes.json',
];
const LOCALE_PARTS=new Set(['court','cosmos','jackpot']);
const SUPPORTED_LOCALES=new Set(['ru','en','no','sv','da','fi','de','fr','es','it','pt','pl','nl','et','lv','lt','uk']);
// build.json is the deploy's own name (pwa-runtime.js asks whether the page is behind): always the network.
const NEVER_CACHE=/(?:\/build\.json|results-archive|\/functions\/v1\/|\/auth\/v1\/|pro-(?:analysis|compute)|access-state|consume-feature|start-trial|billing-(?:status|reconcile)|checkout|management|payment-return|revenuecat|paddle|token|session)/i;

// A file the OPTIONAL precache is fetching right now, so a page asking for the SAME file gets
// that one response instead of starting a second download of it.
const inflightPrecache=new Map();

// The optional set is everything the app loads LAZILY (the court screens, the auth client, the
// legal pages). It must never compete with the page for the connection pool: a user who taps
// «Присяжные» seconds after a cold first load used to wait behind this precache until
// loadCourtApp() gave up after 20s and showed «Анализ недоступен». So it runs AFTER activation,
// one file at a time, it skips what is already cached, and it does not force-reload the HTTP
// cache (the cache name already carries the build SHA, so a stale copy is impossible).
// superseded: a page of a NEWER deploy has asked this worker for its files. The network now serves
// that deploy, so anything this worker downloaded from here on would put the new deploy's files
// into this deploy's cache.
let optionalPrecacheStarted=false,lastPageRequest=0,superseded=false;
const idle=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// The precache is opportunistic: it only ever runs while the page is asking for nothing. A user
// who taps a lazily loaded screen must win that race every time — the whole point of this queue
// is offline availability later, not speed now.
async function whenPageIsQuiet(quietMs=1500,maxWaitMs=30000){
  const deadline=Date.now()+maxWaitMs;
  for(;;){
    const quiet=Date.now()-lastPageRequest;
    if(quiet>=quietMs||Date.now()>deadline)return;
    await idle(Math.min(quietMs-quiet,quietMs));
  }
}
async function precacheOptional(){
  const cache=await caches.open(SHELL_CACHE);
  // It stops as soon as a newer deploy is out (a page of it asked for its files, or its worker is
  // installing): the files fetched then would be the new deploy's, and this queue's waitUntil is what
  // holds back the new worker's activation.
  const outdated=()=>superseded||self.registration.installing||self.registration.waiting;
  for(const url of OPTIONAL_PRECACHE){
    await whenPageIsQuiet();
    if(outdated())return;
    try{
      if(await cache.match(url,{ignoreSearch:true}))continue;
      const request=new Request(url);
      const pending=fetch(request).then(async response=>{
        if(response&&response.ok)await cache.put(request,response.clone());
        return response;
      });
      inflightPrecache.set(new URL(url,self.location.href).pathname,pending);
      await pending;
    }catch(_e){/* an optional file that fails simply stays lazy */}
    finally{inflightPrecache.delete(new URL(url,self.location.href).pathname);}
  }
}

self.addEventListener('install',event=>{
  // Take over immediately so a version bump reaches returning users / installed
  // PWAs on the very next visit (with clients.claim() on activate), and older
  // caches are purged — no manual Safari cache clearing. Taking over an open page
  // needs no reload: each page keeps getting its own deploy's files (fromBuild).
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>
    cache.addAll(CORE_PRECACHE.map(url=>new Request(url,{cache:'reload'})))
  ));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // The previous deploy's shell is kept: tabs of that deploy may still be open (nothing reloads them
    // any more) and load their lazy files from it by ?v=<their build>. Every older version goes.
    // caches.keys() lists caches in the order they were created.
    const names=await caches.keys();
    const previous=names.filter(name=>/^loto-shell-v.+-static$/.test(name)&&name!==SHELL_CACHE).pop();
    await Promise.all(names.filter(name=>name!==SHELL_CACHE&&name!==DATA_CACHE&&name!==previous).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  // pwa-runtime.js asks the worker that has just taken over which deploy it serves.
  if(event.data?.type==='BUILD'){
    event.ports?.[0]?.postMessage(BUILT?BUILD:'');
    return;
  }
  if(event.data?.type!=='CACHE_LOCALE')return;
  // A page of another deploy asking: the catalog on the network is not this deploy's.
  if(BUILT&&event.data.build&&event.data.build!==BUILD)return;
  const code=String(event.data.code||'').toLowerCase();
  if(!SUPPORTED_LOCALES.has(code))return;
  // A lazily loaded catalog part (i18n/court-<code>.json) is cached the same way once it was used.
  const part=String(event.data.part||'');
  if(part&&!LOCALE_PARTS.has(part))return;
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>
    cache.add(new Request(part?`./i18n/${part}-${code}.json`:`./i18n/${code}.json`))
  ).catch(()=>undefined));
});

function cacheable(request,response){
  if(!response||!response.ok||response.type==='opaque')return false;
  if(request.headers.has('authorization'))return false;
  return!NEVER_CACHE.test(request.url);
}

async function networkFirst(request,cacheName,mode='no-store'){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request,{cache:mode});
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
  if(cached)return cached;
  // Nothing cached yet and the optional precache is already downloading this exact file: wait for
  // it and serve the copy it just stored, instead of queueing a duplicate request behind it. The
  // cache entry is read back rather than the response shared, so no body is ever consumed twice.
  const pending=inflightPrecache.get(new URL(request.url).pathname);
  if(pending){
    try{
      await pending;
      const filled=await cache.match(request,{ignoreSearch:true});
      if(filled)return filled;
    }catch(_e){}
  }
  const network=await fetch(request).then(async response=>{
    if(cacheable(request,response))await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  return network||Response.error();
}

// The deploy a request belongs to when it is NOT this worker's: its ?v=<build> (a short git SHA).
function foreignBuild(url){
  if(!BUILT)return '';
  const build=url.searchParams.get('v')||'';
  return build&&build!==BUILD&&/^[0-9a-f]{7,40}$/i.test(build)?build:'';
}
// A page of another deploy gets that deploy's files, never this worker's copies (which would run
// two deploys' code in one page — the reason a deploy used to reload every open page):
//  · a NEWER page (the first visit after a deploy, while this older worker still controls it) finds
//    them in the new worker's cache once that has installed, otherwise on the network, which serves
//    the newest deploy;
//  · an OLDER page (a tab left open across a deploy) finds them in its deploy's cache, kept by
//    `activate` for exactly this.
// Nothing is stored here: this worker's cache holds this deploy only.
async function fromBuild(request,build){
  const name=shellCacheOf(build);
  if(await caches.has(name)){
    const cached=await (await caches.open(name)).match(request,{ignoreSearch:true});
    if(cached)return cached;
  }else{
    // No cache of that deploy: a newer one whose worker has not installed yet (activate keeps the
    // previous deploy's cache; only a tab two or more deploys old can also land here, and stopping the
    // optional precache for it costs nothing but a later retry).
    superseded=true;
  }
  try{
    return await fetch(request);
  }catch(error){
    const cached=await caches.match(request,{ignoreSearch:true});
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  // The optional precache is started from the FIRST request the page makes, not from `activate`:
  // an activation that is still open queues every fetch event behind it, so awaiting a multi-file
  // download there would stall the very page it is meant to speed up. `waitUntil` on a fetch event
  // keeps the worker alive for it without delaying this — or any other — response.
  lastPageRequest=Date.now();
  if(!optionalPrecacheStarted){optionalPrecacheStarted=true;event.waitUntil(precacheOptional());}
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||NEVER_CACHE.test(url.pathname+url.search)||request.headers.has('authorization'))return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,SHELL_CACHE).catch(()=>caches.match('./index.html')));
    return;
  }
  if(/\/(?:results|jackpots|prizes|commercial-metadata)\.json$/i.test(url.pathname)){
    // Revalidated on every read (no-cache): an unchanged file costs a 304, a new one arrives at once.
    event.respondWith(networkFirst(request,DATA_CACHE,'no-cache'));
    return;
  }
  const build=foreignBuild(url);
  if(build){
    event.respondWith(fromBuild(request,build));
    return;
  }
  // 3D-drum CODE (audio.js / main.js and the whole module graph) must NEVER be served
  // stale: a cached old audio path is exactly "sound works in the standalone Demo but not
  // here". These modules are imported without a ?v= cache-buster, so stale-while-revalidate
  // (which also matches ignoreSearch and revalidates through the HTTP cache) could keep
  // returning the previous audio implementation across deploys. Fetch them network-first
  // with no-store when online; fall back to cache only offline. Heavy, rarely-changing
  // vendor libs and audio sample assets stay stale-while-revalidate for load speed.
  if(/\/demo-drum\//.test(url.pathname)&&!/\/demo-drum\/(?:vendor|assets)\//.test(url.pathname)){
    event.respondWith(networkFirst(request,SHELL_CACHE));
    return;
  }
  // Owner Analytics map: owner-map.js is a dynamic import and vendor/world/countries.json a fetch.
  // Both carry a ?v= build revision, but the ignoreSearch match above would still hand back the
  // previous deploy first. Owner-only, loaded lazily, small: network-first, cache only offline.
  // owner-i18n.js (the panel's ru/en/no catalog) likewise, so a deploy's new strings arrive at once.
  if(/\/owner-map\.js$|\/owner-notifications\.js$|\/owner-i18n\.js$|\/vendor\/world\//.test(url.pathname)){
    event.respondWith(networkFirst(request,SHELL_CACHE));
    return;
  }
  // commercial-config.js carries the billing flags/environment and is rebuilt from deploy vars, so
  // it can change while the commit (and therefore CACHE_VERSION and this worker) stays the same.
  // Served from the shell cache it would keep a returning visitor on the previous config for good:
  // billing could neither be switched on nor killed. Tiny file: network-first, cache only offline.
  if(/\/commercial-config\.js$/.test(url.pathname)){
    event.respondWith(networkFirst(request,SHELL_CACHE));
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
  system_message:'simulator',
  owner_event:'owner'
};

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?event.data.json():{};}catch(_e){try{payload={body:event.data&&event.data.text()};}catch(__e){payload={};}}
  const type=payload.notificationType||payload.eventType||payload.type||'';
  const destination=payload.destination||PUSH_DESTINATIONS[type]||'simulator';
  const title=payload.title||'Lotto Simulator';
  // Custom icon when the payload carries one, the app icon otherwise. Decoration only — see
  // the showNotification() fallback below: an icon must never cost the user the notification.
  const icon=typeof payload.icon==='string'&&/^(https:|\.\/)/.test(payload.icon)?payload.icon:'./icon-192.png';
  const options={
    body:payload.body||'',
    icon:icon,
    badge:'./favicon-64.png',
    tag:payload.tag||(payload.notificationId||[type,payload.lotteryId||'',payload.drawId||payload.date||''].join('-')),
    data:{notificationId:payload.notificationId||payload.id||'',notificationType:type,eventType:type,lotteryId:payload.lotteryId||'',drawId:payload.drawId||payload.date||'',destination:destination,deepLink:payload.deepLink||payload.deeplink||destination,createdAt:payload.createdAt||new Date().toISOString(),title:title,body:payload.body||'',payload:payload.payload||payload},
  };
  const full={notificationId:payload.notificationId||payload.id||'',notificationType:type,eventType:type,lotteryId:payload.lotteryId||'',drawId:payload.drawId||payload.date||'',destination:destination,deepLink:payload.deepLink||payload.deeplink||destination,title:title,body:payload.body||'',createdAt:payload.createdAt||new Date().toISOString(),unread:payload.unread,payload:payload.payload||payload};
  // If the icon/badge cannot be fetched or decoded, show the notification again with no
  // decoration at all rather than letting the whole handler reject — a rejected push handler
  // is what makes Chrome replace the message with its generic "site updated in the background".
  const bare=Object.assign({},options); delete bare.icon; delete bare.badge;
  event.waitUntil(Promise.all([
    self.registration.showNotification(title,options)
      .catch(()=>self.registration.showNotification(title,bare))
      .catch(()=>self.registration.showNotification(title,{body:options.body})),
    // Also hand the payload to any open window so the in-app center + bell badge update live.
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:'LOTO_PUSH_RECEIVED',data:full})))
  ]));
});

// The browser rotated this device's push endpoint. Re-subscribe with the same server key and
// tell every open tab, so notifications-runtime hands the NEW endpoint to the backend; the old
// row is disabled by the sender the first time it answers 410.
self.addEventListener('pushsubscriptionchange',event=>{
  event.waitUntil((async()=>{
    const old=event.oldSubscription||null;
    const key=(event.newSubscription&&event.newSubscription.options&&event.newSubscription.options.applicationServerKey)||(old&&old.options&&old.options.applicationServerKey)||null;
    try{if(!event.newSubscription)await self.registration.pushManager.subscribe(key?{userVisibleOnly:true,applicationServerKey:key}:{userVisibleOnly:true});}catch(_e){}
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of all){try{client.postMessage({type:'LOTO_PUSH_RESUBSCRIBE'});}catch(_e){}}
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{};
  const params=new URLSearchParams();
  if(data.destination)params.set('n_dest',data.destination);
  if(data.lotteryId)params.set('n_lot',data.lotteryId);
  if(data.notificationType)params.set('n_type',data.notificationType);
  if(data.drawId)params.set('n_draw',data.drawId);
  // Owner notifications carry a panel deep link (#owner?d=…&s=…): keep it across a cold start.
  if(data.deepLink&&/^#owner/.test(String(data.deepLink)))params.set('n_link',String(data.deepLink).slice(0,200));
  const target='./index.html?'+params.toString();
  event.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    // If a Lotto Simulator tab is already open: focus it FIRST (bring to front), then hand it
    // the deep-link so the in-app center navigates to the exact lottery/screen. A click must
    // never be a no-op that just dismisses the toast (the reported macOS bug).
    const client=all.find(c=>'focus'in c);
    if(client){
      try{await client.focus();}catch(e){}
      try{client.postMessage({type:'LOTO_PUSH_OPEN',data:data});}catch(e){}
      // If the focused tab is not on the app itself, drive it to the deep-link URL so the
      // cold-start router (n_dest/n_lot/n_type/n_draw) opens the right place.
      try{ if('navigate'in client && !/index\.html($|\?)|\/$/.test(client.url)) await client.navigate(target); }catch(e){}
      return;
    }
    // No open tab → open the app straight at the deep-link URL (routed on cold start).
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
