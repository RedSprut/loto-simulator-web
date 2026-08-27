// ═══════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════
const LOTTERY_CONFIG={
  powerball:{name:'Powerball',range:{min:1,max:69},ballCount:5,extraBall:{count:1,range:{min:1,max:26}}},
  megaMillions:{name:'Mega Millions',range:{min:1,max:70},ballCount:5,extraBall:{count:1,range:{min:1,max:24}}},
  euroMillions:{name:'EuroMillions',range:{min:1,max:50},ballCount:5,extraBall:{count:2,range:{min:1,max:12}}},
  eurojackpot:{name:'Eurojackpot',range:{min:1,max:50},ballCount:5,extraBall:{count:2,range:{min:1,max:12}}},
  superEnalotto:{name:'SuperEnalotto',range:{min:1,max:90},ballCount:6,extraBall:{count:1,range:{min:1,max:90}}},
  vikinglotto:{name:'Vikinglotto',range:{min:1,max:48},ballCount:6,extraBall:{count:1,range:{min:1,max:5}}},
  lottoMax:{name:'Lotto Max',range:{min:1,max:52},ballCount:7,extraBall:{count:1,range:{min:1,max:52}}},
  powerballAustralia:{name:'Powerball Australia',range:{min:1,max:35},ballCount:7,extraBall:{count:1,range:{min:1,max:20}}}
};
const LOTTERY_APP_KEYS={
  powerball:'powerball',
  megaMillions:'mega',
  euroMillions:'euromillions',
  eurojackpot:'euro',
  superEnalotto:'superenalotto',
  vikinglotto:'viking',
  lottoMax:'lottomax',
  powerballAustralia:'powerballau'
};
const APP_LOTTERY_KEYS=Object.fromEntries(Object.entries(LOTTERY_APP_KEYS).map(([configKey,appKey])=>[appKey,configKey]));
// Native apps (iOS/Android via Capacitor) bundle a static results/prizes snapshot at
// build time, so without this they show whatever was frozen at the last store build.
// The web build stays fresh because its same-origin results.json is republished by the
// results pipeline. To give native the same auto-update, fetch the published data over
// the network on native (Pages serves it with Access-Control-Allow-Origin: *), and fall
// back to the bundled copy when offline. Web is unchanged (same-origin, already fresh).
const IS_NATIVE_APP=(()=>{try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch(_e){return false;}})();
const NATIVE_DATA_BASE=String(window.LOTO_COMMERCIAL_CONFIG?.nativeDataBaseUrl||'https://redsprut.github.io/loto-simulator-web/').replace(/\/*$/,'/');
function resolveControlledResultsEndpoint(fallback){
  const configured=String(window.LOTO_COMMERCIAL_CONFIG?.resultsReadEndpoint||'').trim();
  if(!configured)return fallback;
  try{
    const endpoint=new URL(configured,window.location.href);
    if(endpoint.protocol!=='https:'&&endpoint.origin!==window.location.origin)return fallback;
    return endpoint.href;
  }catch(_error){return fallback;}
}
const RESULTS_JSON_URL=resolveControlledResultsEndpoint(IS_NATIVE_APP?`${NATIVE_DATA_BASE}results.json`:'./results.json');
const RESULTS_ARCHIVE_URL='./results-archive.json';
const PRIZES_JSON_URL=IS_NATIVE_APP?`${NATIVE_DATA_BASE}prizes.json`:'./prizes.json';
const RESULTS_JSON_BUNDLED='./results.json';   // offline fallback for native
const PRIZES_JSON_BUNDLED='./prizes.json';     // offline fallback for native
// Jackpot/draw metadata comes from the same remote pipeline (Pages) on native, so all
// four surfaces show identical fresh jackpots; the bundled copy is the offline fallback.
const JACKPOTS_JSON_URL=IS_NATIVE_APP?`${NATIVE_DATA_BASE}jackpots.json`:'./jackpots.json';
const JACKPOTS_JSON_BUNDLED='./jackpots.json';
let resultsJsonCache=null;
let resultsArchiveJsonCache=null;
let resultsJsonPending=null;
let resultsArchiveJsonPending=null;
let prizesJsonCache=null;

const LOTS={
  lotto:{id:'lotto',name:'LOTTO',short:'Lotto',region:'Norway',flag:'🇳🇴',activeClass:'ol',cls:'lotto',mB:34,pM:7,bB:34,pBo:0,offBo:1,price:5,currency:'NOK',minR:2,day:'Суббота',dl:'18:00',timeZone:'Europe/Oslo',tzLabel:'Oslo',res:'20:00 Oslo',combos:5379616,plm:'Velg 7 tall',plb:'',bonusName:'Tilleggstall',drawDays:[6],officialProvider:'norsk',officialSourceName:'Norsk Tipping',officialGame:'lotto',officialUrl:'https://www.norsk-tipping.no/lotteri/lotto/resultater',
    tiers:[{match:'7',label:'7 rette'},{match:'6+1',label:'6 + tillegg'},{match:'6',label:'6 rette'},{match:'5',label:'5 rette'},{match:'4',label:'4 rette'}]},
  viking:{id:'viking',name:'VIKINGLOTTO',short:'Viking',region:'Nordic/Baltic',flag:'🏔️',activeClass:'ov',cls:'viking',mB:48,pM:6,bB:5,pBo:1,offBo:1,price:8,currency:'NOK',minR:2,day:'Среда',dl:'18:00',timeZone:'Europe/Oslo',tzLabel:'Oslo',res:'21:00 Oslo',combos:61357560,plm:'Velg 6 hovedtall',plb:'1 vikingtall',bonusName:'Vikingtall',drawDays:[3],officialProvider:'norsk',officialSourceName:'Norsk Tipping',officialGame:'vikinglotto',officialUrl:'https://www.norsk-tipping.no/lotteri/vikinglotto/resultater',
    tiers:[{match:'6+1',label:'6+1'},{match:'6+0',label:'6+0'},{match:'5+1',label:'5+1'},{match:'5+0',label:'5+0'},{match:'4',label:'4 rette'},{match:'3',label:'3 rette'}]},
  euro:{id:'euro',name:'EUROJACKPOT',short:'EuroJackpot',region:'Europe',flag:'🇪🇺',activeClass:'oe',cls:'euro',mB:50,pM:5,bB:12,pBo:2,offBo:2,price:25,currency:'NOK',minR:1,day:'Вт и Пт',dl:'19:00',timeZone:'Europe/Oslo',tzLabel:'Oslo',res:'после 21:00 Oslo',combos:139838160,plm:'Velg 5 hovedtall',plb:'2 stjernetall',bonusName:'Звёздные числа',drawDays:[2,5],officialProvider:'norsk',officialSourceName:'Norsk Tipping',officialGame:'eurojackpot all',officialUrl:'https://www.norsk-tipping.no/lotteri/eurojackpot/resultater',
    tiers:[{match:'5+2',label:'5+2'},{match:'5+1',label:'5+1'},{match:'5+0',label:'5+0'},{match:'4+2',label:'4+2'},{match:'4+1',label:'4+1'},{match:'3+2',label:'3+2'},{match:'4+0',label:'4+0'},{match:'2+2',label:'2+2'},{match:'3+1',label:'3+1'},{match:'3+0',label:'3+0'},{match:'1+2',label:'1+2'},{match:'2+1',label:'2+1'}]},
  powerball:{id:'powerball',name:'POWERBALL',short:'Powerball',region:'USA',flag:'🇺🇸',activeClass:'ow',cls:'lotto',mB:69,pM:5,bB:26,pBo:1,offBo:1,price:2,currency:'USD',minR:1,day:'Пн, Ср, Сб',dl:'22:00',timeZone:'America/New_York',tzLabel:'ET',res:'23:00 ET',combos:292201338,plm:'5 white balls',plb:'1 Powerball',bonusName:'Powerball',drawDays:[1,3,6],officialProvider:'socrata-powerball',officialSourceName:'NY Open Data / Powerball',officialUrl:'https://www.powerball.com/previous-results',tiers:[{match:'5+1',label:'5+Powerball'},{match:'5+0',label:'5+0'},{match:'4+1',label:'4+Powerball'},{match:'4+0',label:'4+0'},{match:'3+1',label:'3+Powerball'},{match:'3+0',label:'3+0'},{match:'2+1',label:'2+Powerball'},{match:'1+1',label:'1+Powerball'},{match:'0+1',label:'Powerball'}]},
  mega:{id:'mega',name:'MEGA MILLIONS',short:'Mega Millions',region:'USA',flag:'🇺🇸',activeClass:'ow',cls:'euro',mB:70,pM:5,bB:24,pBo:1,offBo:1,price:5,currency:'USD',minR:1,day:'Вт и Пт',dl:'22:45',timeZone:'America/New_York',tzLabel:'ET',res:'23:00 ET',combos:290472336,plm:'5 white balls',plb:'1 Mega Ball',bonusName:'Mega Ball',drawDays:[2,5],officialProvider:'socrata-mega',officialSourceName:'NY Open Data / Mega Millions',officialUrl:'https://www.megamillions.com/winning-numbers/previous-drawings',tiers:[{match:'5+1',label:'5+Mega Ball'},{match:'5+0',label:'5+0'},{match:'4+1',label:'4+Mega Ball'},{match:'4+0',label:'4+0'},{match:'3+1',label:'3+Mega Ball'},{match:'3+0',label:'3+0'},{match:'2+1',label:'2+Mega Ball'},{match:'1+1',label:'1+Mega Ball'},{match:'0+1',label:'Mega Ball'}]},
  euromillions:{id:'euromillions',name:'EUROMILLIONS',short:'EuroMillions',region:'Europe',flag:'🇪🇺',activeClass:'oe',cls:'euro',mB:50,pM:5,bB:12,pBo:2,offBo:2,price:2.5,currency:'EUR',minR:1,day:'Вт и Пт',dl:'20:00',timeZone:'Europe/Paris',tzLabel:'CET/CEST',res:'после 21:00 CET/CEST',combos:139838160,plm:'5 main numbers',plb:'2 Lucky Stars',bonusName:'Lucky Stars',drawDays:[2,5],officialSourceName:'EuroMillions',officialUrl:'https://www.euro-millions.com/results',tiers:[{match:'5+2',label:'5+2'},{match:'5+1',label:'5+1'},{match:'5+0',label:'5+0'},{match:'4+2',label:'4+2'},{match:'4+1',label:'4+1'},{match:'3+2',label:'3+2'},{match:'4+0',label:'4+0'},{match:'2+2',label:'2+2'},{match:'3+1',label:'3+1'},{match:'3+0',label:'3+0'},{match:'1+2',label:'1+2'},{match:'2+1',label:'2+1'},{match:'2+0',label:'2+0'}]},
  superenalotto:{id:'superenalotto',name:'SUPERENALOTTO',short:'SuperEnalotto',region:'Italy',flag:'🇮🇹',activeClass:'ow',cls:'lotto',mB:90,pM:6,bB:90,pBo:0,offBo:1,price:1,currency:'EUR',minR:1,day:'Вт, Чт, Пт, Сб',dl:'19:30',timeZone:'Europe/Rome',tzLabel:'CET/CEST',res:'20:00 CET/CEST',combos:622614630,plm:'6 numeri',plb:'Jolly отдельно',bonusName:'Jolly',drawDays:[2,4,5,6],officialSourceName:'SuperEnalotto',officialUrl:'https://www.superenalotto.it/estrazioni',tiers:[{match:'6',label:'6'},{match:'5+1',label:'5+Jolly'},{match:'5+0',label:'5'},{match:'4',label:'4'},{match:'3',label:'3'},{match:'2',label:'2'}]},
  lottomax:{id:'lottomax',name:'LOTTO MAX',short:'Lotto Max',region:'Canada',flag:'🇨🇦',activeClass:'ow',cls:'viking',mB:52,pM:7,bB:52,pBo:0,offBo:1,price:1.5,packagePrice:6,currency:'CAD',minR:4,day:'Вт и Пт',dl:'22:30',timeZone:'America/Toronto',tzLabel:'ET',res:'после 22:30 ET',combos:133784560,plm:'7 numbers',plb:'Bonus отдельно',bonusName:'Bonus',drawDays:[2,5],officialSourceName:'WCLC Lotto Max',officialUrl:'https://www.wclc.com/winning-numbers/lotto-max-extra.htm',tiers:[{match:'7',label:'7/7'},{match:'6+1',label:'6+Bonus'},{match:'6+0',label:'6/7'},{match:'5+1',label:'5+Bonus'},{match:'5+0',label:'5/7'},{match:'4+1',label:'4+Bonus'},{match:'4+0',label:'4/7'},{match:'3+1',label:'3+Bonus'},{match:'3+0',label:'3/7'}]},
  powerballau:{id:'powerballau',name:'POWERBALL AUSTRALIA',short:'Powerball AU',region:'Australia',flag:'🇦🇺',activeClass:'ow',cls:'viking',mB:35,pM:7,bB:20,pBo:1,offBo:1,price:1.35,currency:'AUD',minR:1,day:'Четверг',dl:'19:30',timeZone:'Australia/Brisbane',tzLabel:'AEST',res:'20:30 AEST',combos:134490400,plm:'7 main numbers',plb:'1 Powerball',bonusName:'Powerball',drawDays:[4],officialProvider:'thelott-powerball-au',officialSourceName:'The Lott',officialUrl:'https://www.thelott.com/powerball/results',tiers:[{match:'7+1',label:'№1 · 7+PB'},{match:'7+0',label:'№2 · 7+0'},{match:'6+1',label:'№3 · 6+PB'},{match:'6+0',label:'№4 · 6+0'},{match:'5+1',label:'№5 · 5+PB'},{match:'4+1',label:'№6 · 4+PB'},{match:'5+0',label:'№7 · 5+0'},{match:'3+1',label:'№8 · 3+PB'},{match:'2+1',label:'№9 · 2+PB'}]}
};
function resolveGameKey(gameKey){
  return LOTS[gameKey]?gameKey:LOTTERY_APP_KEYS[gameKey]||null;
}
function resolveConfigKey(gameKey){
  if(LOTTERY_CONFIG[gameKey])return gameKey;
  const appKey=resolveGameKey(gameKey);
  return APP_LOTTERY_KEYS[appKey]||null;
}
function getCurrentGameKey(){return cur;}
function getLotteryConfig(gameKey){
  const configKey=resolveConfigKey(gameKey);
  if(LOTTERY_CONFIG[configKey])return LOTTERY_CONFIG[configKey];
  const appKey=resolveGameKey(gameKey),l=LOTS[appKey];
  if(!l)return null;
  return{name:l.name,range:{min:1,max:l.mB},ballCount:l.pM,extraBall:(l.offBo||l.pBo)?{count:l.offBo||l.pBo,range:{min:1,max:l.bB}}:{count:0,range:{min:1,max:0}}};
}
function syncRulesFromConfig(gameKey){
  const appKey=resolveGameKey(gameKey),cfg=getLotteryConfig(gameKey);
  if(!appKey||!cfg||!LOTS[appKey])return null;
  const rules=LOTS[appKey];
  rules.mB=cfg.range.max;
  rules.pM=cfg.ballCount;
  rules.bB=cfg.extraBall?.range?.max||cfg.range.max;
  if(rules.pBo>0)rules.pBo=cfg.extraBall?.count||0;
  rules.offBo=cfg.extraBall?.count||rules.offBo||rules.pBo||0;
  rules.plm=rules.plm||`${cfg.ballCount} numbers`;
  rules.plb=rules.pBo>0?(rules.plb||`${cfg.extraBall.count} extra`):rules.plb;
  return rules;
}
function normalizeResultDraw(draw){
  return{
    date:draw.date||draw.drawDate||'',
    main:uniqValid(draw.main||draw.numbers||draw.mainNumbers||[],Number.MAX_SAFE_INTEGER),
    bonus:uniqValid(draw.bonus||draw.extra||draw.extraBall||draw.extraNumbers||[],Number.MAX_SAFE_INTEGER),
    jackpot:draw.jackpot??null,
    payoutTiers:draw.payoutTiers||null,
    lotteryId:draw.lotteryId||'',
    lotteryName:draw.lotteryName||'',
    source:draw.source||'',
    sourceUrl:draw.sourceUrl||'',
    drawId:draw.drawId??null,
    ruleVersion:draw.ruleVersion||'',
    ruleEra:draw.ruleEra||'',
    extraGroups:Array.isArray(draw.extraGroups)?draw.extraGroups.map(group=>({label:group.label||'',numbers:[...(group.numbers||[])]})):null
  };
}
async function fetchResultsJson(url=RESULTS_JSON_URL){
  if(url===RESULTS_JSON_URL&&resultsJsonCache)return resultsJsonCache;
  if(url===RESULTS_ARCHIVE_URL&&resultsArchiveJsonCache)return resultsArchiveJsonCache;
  if(url===RESULTS_JSON_URL&&resultsJsonPending)return resultsJsonPending;
  if(url===RESULTS_ARCHIVE_URL&&resultsArchiveJsonPending)return resultsArchiveJsonPending;
  const pending=(async()=>{
    let data;
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)throw new Error(`${url.split('/').pop()} HTTP ${res.status}`);
      data=await res.json();
    }catch(err){
      // Native offline: a failed remote results fetch falls back to the bundled snapshot.
      if(IS_NATIVE_APP&&url===RESULTS_JSON_URL){
        const fb=await fetch(RESULTS_JSON_BUNDLED,{cache:'no-store'});
        if(!fb.ok)throw err;
        data=await fb.json();
      }else throw err;
    }
    if(url===RESULTS_JSON_URL)resultsJsonCache=data;
    if(url===RESULTS_ARCHIVE_URL)resultsArchiveJsonCache=data;
    return data;
  })();
  if(url===RESULTS_JSON_URL)resultsJsonPending=pending;
  if(url===RESULTS_ARCHIVE_URL)resultsArchiveJsonPending=pending;
  try{return await pending;}
  finally{
    if(url===RESULTS_JSON_URL&&resultsJsonPending===pending)resultsJsonPending=null;
    if(url===RESULTS_ARCHIVE_URL&&resultsArchiveJsonPending===pending)resultsArchiveJsonPending=null;
  }
}
async function loadHistoricalResults(gameKey,url=RESULTS_JSON_URL){
  const db=await fetchResultsJson(url);
  const configKey=resolveConfigKey(gameKey),appKey=resolveGameKey(gameKey);
  const source=db.games?.[configKey]||db.games?.[appKey]||db[configKey]||db[appKey]||[];
  return Array.isArray(source)?source.map(normalizeResultDraw):[];
}
function normalizePrizeResult(draw){
  return{
    date:String(draw.date||''),
    jackpot:draw.jackpot??null,
    currency:draw.currency||'',
    payoutTiers:Array.isArray(draw.payoutTiers)?draw.payoutTiers.map(tier=>({
      match:String(tier.match||''),
      label:String(tier.label||tier.match||''),
      prizeAmount:tier.prizeAmount??tier.prizeNOK??null,
      winners:tier.winners??null
    })):[],
    source:draw.source||'',
    sourceUrl:draw.sourceUrl||''
  };
}
async function loadPublicPrizes(gameKey){
  if(!prizesJsonCache){
    try{
      const res=await fetch(PRIZES_JSON_URL,{cache:'no-store'});
      if(!res.ok)throw new Error(`prizes.json HTTP ${res.status}`);
      prizesJsonCache=await res.json();
    }catch(err){
      // Native offline: fall back to the bundled prizes snapshot.
      if(IS_NATIVE_APP&&PRIZES_JSON_URL!==PRIZES_JSON_BUNDLED){
        const fb=await fetch(PRIZES_JSON_BUNDLED,{cache:'no-store'});
        if(!fb.ok)throw err;
        prizesJsonCache=await fb.json();
      }else throw err;
    }
  }
  const configKey=resolveConfigKey(gameKey),appKey=resolveGameKey(gameKey);
  const source=prizesJsonCache.games?.[configKey]||prizesJsonCache.games?.[appKey]||[];
  return Array.isArray(source)?source.map(normalizePrizeResult).sort((a,b)=>b.date.localeCompare(a.date)):[];
}
async function loadArchivePackage(gameKey){
  const db=await fetchResultsJson(RESULTS_ARCHIVE_URL);
  const configKey=resolveConfigKey(gameKey),appKey=resolveGameKey(gameKey);
  const source=db.games?.[configKey]||db.games?.[appKey]||[];
  const eras=db.ruleVersions?.[configKey]||db.ruleVersions?.[appKey]||[];
  return{draws:Array.isArray(source)?source.map(normalizeResultDraw):[],eras:Array.isArray(eras)?eras:[],updatedAt:db.updatedAt||''};
}
function ruleEraForDraw(draw,eras=[]){
  return eras.find(era=>era.id===draw.ruleVersion)
    ||eras.find(era=>draw.date>=era.from&&(!era.to||draw.date<=era.to))
    ||null;
}
async function loadFullHistory(gameKey){
  const current=await loadD(gameKey);
  const archive=await loadArchivePackage(gameKey).catch(()=>({draws:[],eras:[],updatedAt:''}));
  const merged=mergeDrawLists(archive.draws,current).merged;
  return{draws:merged,eras:archive.eras,updatedAt:archive.updatedAt,currentCount:current.length,currentDates:new Set(current.map(draw=>draw.date))};
}
function analyzeData(gameKey,historicalData=[]){
  const cfg=getLotteryConfig(gameKey);
  if(!cfg)throw new Error(`Unknown lottery: ${gameKey}`);
  const mainFrequency=new Map();
  const extraFrequency=new Map();
  for(let n=cfg.range.min;n<=cfg.range.max;n++)mainFrequency.set(n,0);
  if(cfg.extraBall?.count){
    for(let n=cfg.extraBall.range.min;n<=cfg.extraBall.range.max;n++)extraFrequency.set(n,0);
  }
  for(let i=0;i<historicalData.length;i++){
    const draw=normalizeResultDraw(historicalData[i]);
    for(let j=0;j<draw.main.length;j++){
      const n=draw.main[j];
      if(mainFrequency.has(n))mainFrequency.set(n,mainFrequency.get(n)+1);
    }
    for(let j=0;j<draw.bonus.length;j++){
      const n=draw.bonus[j];
      if(extraFrequency.has(n))extraFrequency.set(n,extraFrequency.get(n)+1);
    }
  }
  const byHot=(a,b)=>b[1]-a[1]||a[0]-b[0];
  const byCold=(a,b)=>a[1]-b[1]||a[0]-b[0];
  return{
    gameKey:resolveConfigKey(gameKey),
    totalDraws:historicalData.length,
    mainFrequency,
    extraFrequency,
    hotNumbers:[...mainFrequency.entries()].sort(byHot),
    coldNumbers:[...mainFrequency.entries()].sort(byCold),
    hotExtraNumbers:[...extraFrequency.entries()].sort(byHot)
  };
}

let cur='euro',curPage='sim',curAT='inp',sgAlgo='freq';
let rows=[],act=0,lastDraw=null,sgGen=[];
let drawsCache=Object.fromEntries(Object.keys(LOTS).map(id=>[id,[]]));
let favsCache=[];
let wheelPools=Object.fromEntries(Object.keys(LOTS).map(id=>[id,[]]));
let lifeRunning=false;
const MAX_ROWS=50;
const WHEEL_POOL_MAX=18;
const L=()=>LOTS[cur];
const LOTTERY_LABELS=Object.fromEntries(Object.entries(LOTS).map(([id,l])=>[id,l.short||l.name]));
const OFFICIAL_LOTS=Object.keys(LOTS);
const lotteryName=id=>LOTTERY_LABELS[id]||LOTS[id]?.name||String(id||'').toUpperCase();
const appText=value=>window.LotoI18n?.translate?window.LotoI18n.translate(value):String(value??'');
let groupAnalysisState={active:false,limit:0,total:0};
function hasConfirmedPro(){
  try{return window.LotoCommercial?.access?.accessLevel==='pro';}catch(e){return false;}
}
function groupAnalysisFreeLimit(){
  try{return Number(window.LotoCommercial?.access?.freeLimits?.groupAnalysisRows||window.LotoCommercial?.freeGroupAnalysisRows||3)||3;}catch(e){return 3;}
}
function clearGroupAnalysisState(){
  groupAnalysisState={active:false,limit:0,total:0};
}
function prepareRowsForGroupAnalysis(sourceRows,feature){
  const all=(sourceRows||[]).map(row=>({m:[...(row.m||row.main||[])],b:[...(row.b||row.bonus||[])]}));
  const limit=groupAnalysisFreeLimit();
  if(hasConfirmedPro()||all.length<=limit){groupAnalysisState={active:false,limit,total:all.length};return all;}
  groupAnalysisState={active:true,limit,total:all.length};
  renderSim();
  showFeedback('FREE-лимит анализа',`В FREE можно обработать ${limit} комбинации. Сейчас будут обработаны первые ${limit} из ${all.length}. Для анализа остальных требуется PRO.`,'🔒',7200,{secondaryText:'Оформить PRO',secondaryAction:()=>window.LotoCommercial?.openPaywall(feature||'judge')});
  return all.slice(0,limit);
}
const drawLotteryName=(d,id=cur)=>d?.lotteryId?lotteryName(d.lotteryId):(d?.lotteryName||lotteryName(id));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
const KEY=id=>'loto_private_draws_v2_'+id;
const FAV_KEY=()=>'favs';
const ROI_KEY=()=>'loto_roi_'+cur; // ROI stays personal (per-device, not shared)
function getBackendActionContext(){
  const l=L();
  let pool=[...(wheelPools[cur]||[])];
  if(pool.length<l.pM){
    pool=[...new Set(rows.flatMap(row=>row.m||[]))];
    for(let number=1;pool.length<Math.min(l.mB,l.pM+8)&&number<=l.mB;number++)if(!pool.includes(number))pool.push(number);
  }
  return{
    gameId:resolveConfigKey(cur)||cur,
    count:Math.max(1,Math.min(MAX_ROWS,Number(getGenCount?.()||5))),
    rows:rows.filter(row=>Array.isArray(row.m)&&row.m.length===l.pM).map(row=>({main:[...row.m],bonus:[...(row.b||[])]})),
    pool:pool.slice(0,WHEEL_POOL_MAX),
  };
}
function applyBackendRows(result,label){
  const next=(Array.isArray(result)?result:[]).map(row=>({m:[...(row.main||[])],b:[...(row.bonus||[])]}));
  if(!next.length){showFeedback('Нет результата','Backend не вернул допустимых рядов.','⚠️',3200);return false;}
  rows=next;act=0;renderSim();resetBanner();goToRows();
  revealResult(document.getElementById('rows-c'),'start');
  return true;
}
function renderBackendJudge(result,mountId,target,handlers){
  const mount=document.getElementById(mountId)||document.getElementById('judge-mount')||document.getElementById('jc-mount');
  if(!mount)return false;
  const l=L(),inputRows=Array.isArray(target?.inputRows)?target.inputRows:[];
  const plan=(Array.isArray(result)?result:[]).map((item,pos)=>{
    const index=Number.isFinite(Number(item?.index))?Number(item.index):pos;
    const source=item?.row||inputRows[index]||inputRows[pos]||{};
    const row=normalizeGeneratedRow({m:source.main||source.m,b:source.bonus||source.b},l);
    return{
      index,
      orig:[...row.m],
      b:[...row.b],
      swaps:(Array.isArray(item?.swaps)?item.swaps:[]).map(swap=>({
        from:Number(swap.from),to:Number(swap.to),
        sf:Math.round(Number(swap.fromScore??swap.sf??0)),
        st:Math.round(Number(swap.toScore??swap.st??0)),
        apply:false
      })).filter(swap=>Number.isInteger(swap.from)&&Number.isInteger(swap.to)&&swap.from!==swap.to)
    };
  }).filter(item=>item.orig.length===l.pM).sort((a,b)=>a.index-b.index).map(({index,...item})=>item);
  if(!plan.length){mount.innerHTML='<div class="if-empty">⚖️ Backend не вернул допустимых рядов для судьи.</div>';return false;}
  const ns=target?.namespace||handlers?.namespace||String(mountId||'judge').replace(/[^a-z0-9_-]/gi,'')||'judge';
  const defaultApply=(finalRows,meta)=>{
    const choice=JUDGE_choiceText(meta);
    if(mountId==='jc-mount')window.JC_close?.();
    setGeneratedRows(finalRows,choice+'. Комбинация применена в билете. ⚖️');
  };
  JUDGE_state[ns]={
    plan,l,
    drawsN:Number(target?.drawsN||handlers?.drawsN||0),
    mountId,
    intro:handlers?.intro||target?.intro||'',
    applyLabel:handlers?.applyLabel||target?.applyLabel||'',
    onApply:handlers?.onApply||defaultApply
  };
  // Fail-closed: a structural verdict must never be shown for zero drawn history.
  if(!(JUDGE_state[ns].drawsN>0)){mount.innerHTML='<div class="if-empty">⚖️ Анализ невозможен: история тиражей не загружена. Обновите официальные результаты.</div>';return false;}
  JUDGE_render(ns);
  const resultOverlay=mount.closest?.('[id$="-ov"]');
  if(resultOverlay&&window.LotoModals)window.LotoModals.openModal(resultOverlay.id);
  else if(resultOverlay)resultOverlay.classList.add('show');
  mount.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  return true;
}
// Result modal for math-model generations: shows the generated rows and lets the
// user either apply them to the main screen or send exactly these rows to the
// existing Верховный судья (Judge), which keeps its own per-feature access budget.
const MODEL_LABELS={freq:'горячие числа',bal:'комбинированный анализ',man:'сегментный охват',rnd:'pure random',markov:'цепи Маркова',gauss:'Гаусс · ЦПТ',delta:'интервальная модель Δ',bayes:'Байес · Дирихле',overdue:'gap-анализ',phys:'физическая модель лототрона',chaos:'детерминированный хаос',quantum:'квантовый коллапс',paradox:'система парадоксов',consensus:'консенсус моделей',qastro:'квантово-астрологическая модель',wheel:'колёсная матрица','world-hot':'мировой горячий профиль','world-mix':'мировой комбинированный профиль'};
const modelLabel=model=>MODEL_LABELS[model]||model||'модель';
let mresRows=[];
function showModelResult(result,model){
  const list=(Array.isArray(result)?result:[]).map(r=>({main:[...(r.main||r.m||[])],bonus:[...(r.bonus||r.b||[])]})).filter(r=>r.main.length);
  if(!list.length){showFeedback('Нет результата','Модель не вернула допустимых рядов.','⚠️',3200);return false;}
  mresRows=list;
  const cls=L().cls;const mount=document.getElementById('mres-rows');
  if(mount){
    mount.replaceChildren();
    list.forEach((r,i)=>{
      // One centred row block: label sits above the balls, left-aligned to the first
      // ball, so label + ball group read as a single unit (see .mres-row CSS).
      const rowEl=document.createElement('div');rowEl.className='mres-row';
      const heading=document.createElement('div');heading.className='if-seclbl mres-rlabel';heading.textContent='Ряд '+(i+1);
      const balls=document.createElement('div');balls.className='if-rowballs mres-rballs';
      for(const n of r.main){const b=document.createElement('div');b.className='if-rball rb-m-'+cls;b.textContent=String(n);balls.appendChild(b);}
      if(r.bonus.length){const sep=document.createElement('div');sep.style.width='6px';balls.appendChild(sep);}
      for(const n of r.bonus){const b=document.createElement('div');b.className='if-rball rb-b-'+cls;b.textContent=String(n);balls.appendChild(b);}
      rowEl.append(heading,balls);
      mount.appendChild(rowEl);
    });
  }
  const title=document.getElementById('mres-title');if(title)title.textContent='🎯 '+modelLabel(model);
  const sub=document.getElementById('mres-sub');if(sub)sub.textContent=list.length+' '+rowWord(list.length);
  const useBtn=document.querySelector('[data-mres-use]');
  if(useBtn)useBtn.onclick=()=>{window.LotoModals?window.LotoModals.closeModal('mres-ov'):document.getElementById('mres-ov')?.classList.remove('show');applyBackendRows(mresRows,'🎯 '+modelLabel(model));};
  const judgeBtn=document.querySelector('[data-mres-judge]');
  if(judgeBtn)judgeBtn.onclick=()=>{window.judgeGeneratedRows?.(mresRows.map(r=>({main:[...r.main],bonus:[...r.bonus]})));};
  const closeBtn=document.querySelector('[data-mres-close]');
  if(closeBtn)closeBtn.onclick=()=>{window.LotoModals?window.LotoModals.closeModal('mres-ov'):document.getElementById('mres-ov')?.classList.remove('show');};
  if(window.LotoModals)window.LotoModals.openModal('mres-ov');else document.getElementById('mres-ov')?.classList.add('show');
  return true;
}
window.showModelResult=showModelResult;
function showPreviewResultStatus(message){
  const activeId=window.LotoModals?.active;
  const active=activeId?document.getElementById(activeId):document.querySelector('[id$="-ov"].show:not(#prev-ov):not(#pro-ov):not(#fb-ov):not(#cc-ov)');
  if(!active||['prev-ov','pro-ov','fb-ov','cc-ov','busy-ov'].includes(active.id))return false;
  const host=active.querySelector('.if-sheet,.sg-sheet,.lang-box,.horo-sheet,.pro-sheet')||active.firstElementChild;
  if(!host)return false;
  let status=host.querySelector('[data-preview-result-state]');
  if(!status){status=document.createElement('div');status.className='preview-result-state';status.dataset.previewResultState='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.appendChild(status);}
  status.textContent=appText(message);
  status.hidden=false;
  return true;
}
window.showPreviewResultStatus=showPreviewResultStatus;
function clearProtectedHistoryView(){
  Object.keys(drawsCache||{}).forEach(key=>{drawsCache[key]=[];});
  const freeLimit=Number(window.LOTO_COMMERCIAL_CONFIG?.freeRecentDrawsByGame?.[resolveConfigKey(cur)]||0);
  loadHistoricalResults(cur).then(recent=>{
    draws=(recent||[]).slice(0,freeLimit);
    drawsCache[cur]=draws;
    if(typeof renderHistory==='function')renderHistory();
  }).catch(()=>{});
}
window.clearProtectedHistoryView=clearProtectedHistoryView;
function renderBackendWorldAnalysis(analysis,targetId='world-analysis-out'){
  const target=document.getElementById(targetId);if(!target)return false;
  target.replaceChildren();
  target.style.display='';
  const title=document.createElement('b');title.textContent='Защищённый PRO-анализ полной истории';
  const summary=document.createElement('p');
  summary.textContent=`Тиражей: ${analysis.drawCount||0} · период: ${analysis.firstDrawDate||'—'} — ${analysis.lastDrawDate||'—'} · χ²: ${analysis.currentRules?.chiSquare?.statistic??'—'}.`;
  target.append(title,summary);
  return true;
}

// ─── SHARED STORAGE (draws + favorites — visible to everyone with the link) ───
// Timeout wrapper: prevents storage calls from hanging forever and freezing the UI
function withTimeout(promise,ms=5000){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Storage timeout')),ms))
  ]);
}
function hasSharedStorage(){
  return !!(window.storage&&typeof window.storage.get==='function'&&typeof window.storage.set==='function');
}
function storageScopeText(){return hasSharedStorage()?'Данные доступны через подключённое общее хранилище.':'Данные сохранены только на этом устройстве.';}
async function storageGet(key,shared=true){
  if(hasSharedStorage()){
    try{ return await window.storage.get(key,shared); }
    catch(e){ return null; } /* ключа ещё нет (первый запуск) — это не ошибка */
  }
  const value=localStorage.getItem(key);
  return value===null?null:{value};
}
function storageSet(key,value,shared=true){
  if(hasSharedStorage())return window.storage.set(key,value,shared);
  localStorage.setItem(key,value);
  return Promise.resolve(true);
}

async function loadD(id){
  try{
    const r=await withTimeout(storageGet(KEY(id),true));
    const stored=r?JSON.parse(r.value):[];
    const remote=await loadHistoricalResults(id).catch(()=>[]);
    const v=remote.length?mergeDrawLists(stored,remote).merged:stored;
    drawsCache[id]=v;
    return v;
  }catch(e){ console.error('loadD failed',e); drawsCache[id]=drawsCache[id]||[]; return drawsCache[id]; }
}
async function saveD(id,arr){
  drawsCache[id]=arr; // optimistic local update so UI never freezes
  try{ await withTimeout(storageSet(KEY(id),JSON.stringify(arr),true)); }
  catch(e){ console.error('Storage save failed',e); showFeedback('Не сохранилось в общую базу','Таймаут хранилища. Данные остались только на этом экране; перезагрузка может их сбросить.','⚠️',4200); }
}
function mergeDrawLists(oldArr,newArr){
  const byDate=new Map((oldArr||[]).filter(d=>d&&d.date).map(d=>[d.date,d]));
  let added=0,updated=0,unchanged=0;
  (newArr||[]).filter(d=>d&&d.date).forEach(d=>{
    const prev=byDate.get(d.date);
    if(!prev)added++;
    else if(sameDrawCore(prev,d))unchanged++;
    else updated++;
    byDate.set(d.date,{...prev,...d});
  });
  const incomingDates=new Set((newArr||[]).filter(d=>d&&d.date).map(d=>d.date));
  const preserved=(oldArr||[]).filter(d=>d&&d.date&&!incomingDates.has(d.date)).length;
  return{merged:[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date)),added,updated,unchanged,preserved};
}
async function loadFav(){
  try{
    const r=await withTimeout(storageGet(FAV_KEY(),true));
    const v=r?JSON.parse(r.value):[];
    favsCache=v;
    return v;
  }catch(e){ console.error('loadFav failed',e); return favsCache||[]; }
}
async function saveFavs(arr){
  favsCache=arr;
  try{ await withTimeout(storageSet(FAV_KEY(),JSON.stringify(arr),true)); }
  catch(e){ console.error('Storage save failed',e); showFeedback('Избранное не сохранилось','Хранилище ответило таймаутом. Попробуйте ещё раз через несколько секунд.','⚠️',3800); }
}

// ─── PERSONAL STORAGE (ROI — stays only on this device) ───
const loadROI=()=>{try{return JSON.parse(localStorage.getItem(ROI_KEY()))||{spent:0,won:0}}catch{return{spent:0,won:0}}};
const saveROI=o=>localStorage.setItem(ROI_KEY(),JSON.stringify(o));

// ═══════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════
function initTheme(){
  const saved=localStorage.getItem('loto_theme');
  const prefersDark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  if(saved==='dark'||(saved===null&&prefersDark)){applyDark();}
  else applyLight();
}
function applyDark(){document.body.classList.add('dark');document.getElementById('theme-btn').textContent='☀️';localStorage.setItem('loto_theme','dark');updateThemeColor();}
function applyLight(){document.body.classList.remove('dark');document.getElementById('theme-btn').textContent='🌙';localStorage.setItem('loto_theme','light');updateThemeColor();}
function toggleDark(){document.body.classList.contains('dark')?applyLight():applyDark();}

// ═══════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════
function selPage(p){
  curPage=p;
  // On the Simulator home screen the round Back control is redundant (it only resets
  // rows), so hide it there and let the logo sit far-left with the bell beside it.
  try{document.documentElement.classList.toggle('on-sim',p==='sim');}catch(e){}
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('show'));
  document.getElementById('pg-'+p).classList.add('show');
  document.querySelectorAll('.bn').forEach(x=>x.classList.remove('on'));
  document.getElementById('bn-'+p).classList.add('on');
  const shell=document.getElementById('lot-nav-shell');
  if(shell)shell.hidden=p!=='sim';
  if(p==='ana'){updateAnaHdr();renderAna();}
  else{updateHdr();}
}
function bottomNavRoute(p){
  if(p==='drum3d'){if(typeof openDrum3D==='function')openDrum3D();return;}
  if(document.body.classList.contains('drum3d-open')){
    if(typeof closeDrum3D!=='function')return;
    closeDrum3D();
    if(document.body.classList.contains('drum3d-open'))return;
  }
  selPage(p);
}
async function handleBack(){
  if(curPage==='ana')selPage('sim');
  else if(await customConfirm('Сбросить ряды?')){initRows();renderSim();resetBanner();}
}

// ═══════════════════════════════════════════════
//  LOT SELECT
// ═══════════════════════════════════════════════
function formatPrice(l){
  if(!l.price)return '—';
  return `${l.price} ${l.currency||'NOK'}`;
}
function updateLotteryNavArrows(){
  const el=document.getElementById('lot-tabs'),prev=document.getElementById('lot-scroll-prev'),next=document.getElementById('lot-scroll-next');
  if(!el||!prev||!next)return;
  const max=Math.max(0,el.scrollWidth-el.clientWidth);
  prev.disabled=max<2||el.scrollLeft<=2;
  next.disabled=max<2||el.scrollLeft>=max-2;
}
function centerNavItem(scroller,item){
  if(!scroller||!item||scroller.scrollWidth<=scroller.clientWidth+2)return;
  const left=item.offsetLeft-(scroller.clientWidth-item.offsetWidth)/2;
  scroller.scrollTo({left:Math.max(0,left),behavior:'smooth'});
}
function scrollLotteryNav(dir){
  const el=document.getElementById('lot-tabs');if(!el)return;
  el.scrollBy({left:dir*Math.max(150,el.clientWidth*.72),behavior:'smooth'});
  setTimeout(updateLotteryNavArrows,320);
}
function enableHorizontalScroller(el,manualTouch=false){
  if(!el||el.dataset.dragReady==='1')return;
  el.dataset.dragReady='1';
  let dragging=false,moved=false,suppressUntil=0,startX=0,startY=0,startLeft=0,pointerId=null;
  el.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.pointerType!=='mouse'||e.button!==0)return;
    dragging=true;moved=false;pointerId=e.pointerId;startX=e.clientX;startY=e.clientY;startLeft=el.scrollLeft;
  });
  el.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!moved&&Math.abs(dx)>4&&Math.abs(dx)>Math.abs(dy)){
      moved=true;
      el.classList.add('dragging');try{el.setPointerCapture(pointerId);}catch(err){}
    }
    if(moved){e.preventDefault();el.scrollLeft=startLeft-dx;}
  },{passive:false});
  const finish=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    suppressUntil=moved?Date.now()+180:0;dragging=false;pointerId=null;el.classList.remove('dragging');
    try{el.releasePointerCapture(e.pointerId);}catch(err){}
  };
  el.addEventListener('pointerup',finish);
  el.addEventListener('pointercancel',finish);
  el.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}},{capture:true});
  el.addEventListener('wheel',e=>{
    if(el.scrollWidth<=el.clientWidth||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    e.preventDefault();el.scrollLeft+=e.deltaY;
  },{passive:false});
  if(manualTouch){
    let touchId=null,touching=false,touchMoved=false,horizontal=null,touchX=0,touchY=0,touchLeft=0;
    el.addEventListener('touchstart',e=>{
      if(e.touches.length!==1)return;
      const t=e.touches[0];touchId=t.identifier;touching=true;touchMoved=false;horizontal=null;
      touchX=t.clientX;touchY=t.clientY;touchLeft=el.scrollLeft;
    },{passive:true});
    el.addEventListener('touchmove',e=>{
      if(!touching)return;
      const t=[...e.touches].find(x=>x.identifier===touchId);if(!t)return;
      const dx=t.clientX-touchX,dy=t.clientY-touchY;
      if(horizontal===null&&Math.max(Math.abs(dx),Math.abs(dy))>=6)horizontal=Math.abs(dx)>Math.abs(dy);
      if(horizontal===false){touching=false;return;}
      if(horizontal===true){
        e.preventDefault();touchMoved=true;el.classList.add('dragging');
        el.scrollLeft=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,touchLeft-dx));
      }
    },{passive:false});
    const finishTouch=()=>{
      if(touchMoved)suppressUntil=Date.now()+420;
      touching=false;touchMoved=false;horizontal=null;touchId=null;el.classList.remove('dragging');
    };
    el.addEventListener('touchend',finishTouch,{passive:true});
    el.addEventListener('touchcancel',finishTouch,{passive:true});
  }
}
function renderLotteryNav(){
  const tabs=document.getElementById('lot-tabs'),strip=document.getElementById('sched-strip');
  if(tabs){
    tabs.innerHTML=Object.entries(LOTS).map(([id,l])=>`
      <div class="lt ${id===cur?(l.activeClass||'ow'):''}" id="lt-${id}" role="button" tabindex="0" aria-current="${id===cur?'true':'false'}" data-loto-event-click="initLottery('${id}')" data-loto-event-keydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();initLottery('${id}');}">
        <div class="lt-flag">${l.flag||'🎲'}</div>
        <div class="lt-name">${l.short||l.name}</div>
      </div>`).join('');
  }
  if(strip){
    strip.innerHTML=Object.entries(LOTS).map(([id,l],i)=>`
      ${i?'<div class="ss-div"></div>':''}
      <div class="ss-item ${id===cur?'on':''}" id="ss-${id}" role="button" tabindex="0" aria-current="${id===cur?'true':'false'}" data-loto-event-click="initLottery('${id}')" data-loto-event-keydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();initLottery('${id}');}">
        <div class="ss-name" style="color:${mColor(l.cls)}">${l.short||l.name}</div>
        <div class="ss-day"><span>${l.day}</span> · до ${scheduleTime(l)}</div>
        <div class="ss-price">${formatPrice(l)}/ряд</div>
      </div>`).join('');
  }
  requestAnimationFrame(()=>{
    centerNavItem(tabs,document.getElementById('lt-'+cur));
    centerNavItem(strip,document.getElementById('ss-'+cur));
    updateLotteryNavArrows();
  });
}
function updateOfficialControls(){
  const l=L(),provider=getOfficialProvider(cur),source=officialSourceName(l);
  const title=document.getElementById('official-title'),desc=document.getElementById('official-desc');
  const btn=document.getElementById('official-btn'),all=document.getElementById('official-all-btn'),open=document.getElementById('official-open-btn');
  if(title)title.textContent=`Официальные результаты · ${l.short||l.name}`;
  if(desc){
    desc.textContent=provider
      ? `Источник: ${source}. Обновляет последние тиражи и сразу пересчитывает историю, частоты, призы и статистику.`
      : `Источник: ${source}. Прямой браузерный импорт без backend пока не подключён; статистика берётся из общей базы results.json и ручного ввода.`;
  }
  if(btn){
    btn.disabled=false;
    btn.textContent=provider?'↻ Обновить текущую лотерею':'↻ Проверить results.json';
    btn.style.opacity='1';
  }
  if(all)all.textContent=`↻ Все источники (${OFFICIAL_LOTS.length})`;
  if(open){
    open.disabled=!l.officialUrl;
    open.style.opacity=l.officialUrl?'1':'.5';
  }
}
function clearAnalysisUI(){
  ['copy-out','world-analysis-out','draw-check-out','chk-result','life-out','wheel-status','heat-status'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    if('value'in el)el.value='';
    else el.textContent='';
    if(id==='world-analysis-out'||id==='wheel-status')el.style.display='none';
  });
}
function initLottery(gameKey){
  const id=resolveGameKey(gameKey);
  if(!id)throw new Error(`Unknown lottery: ${gameKey}`);
  syncRulesFromConfig(id);
  clearAnalysisUI();
  selLot(id);
  return{gameKey:id,config:getLotteryConfig(id),rules:LOTS[id]};
}
/* ═══ ГЕРОЙСКИЙ БАННЕР: реальные джекпоты со ВСЕХ официальных источников ═══ */
async function fetchTextResilient(url){
  const tryF=async u=>{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text();};
  try{return await tryF(url);}catch(e){}
  throw new Error('источник недоступен');
}
function parseMillions(text,re){
  const m=text.match(re);
  if(!m)return null;
  const v=parseFloat(m[1].replace(/\u00a0|\s/g,'').replace(',','.'));
  return isFinite(v)&&v>0?v:null;
}
/* официальные источники предстоящих джекпотов по каждой игре */
const JACKPOT_FETCHERS={
  lotto:async()=>{
    const t=await fetchTextResilient('https://www.norsk-tipping.no/lotteri/lotto');
    const v=parseMillions(t,/F[øo]rstepremiepott[^\d]{0,80}(\d+(?:[.,]\d+)?)\s*million/i);
    return v?{txt:'Ca. '+v,sub:'MILLIONER NOK',src:'norsk-tipping.no'}:null;
  },
  viking:async()=>{
    const t=await fetchTextResilient('https://www.norsk-tipping.no/lotteri/vikinglotto');
    const v=parseMillions(t,/F[øo]rstepremiepott[^\d]{0,80}(\d+(?:[.,]\d+)?)\s*million/i);
    return v?{txt:'Ca. '+v,sub:'MILLIONER NOK',src:'norsk-tipping.no'}:null;
  },
  euro:async()=>{
    const t=await fetchTextResilient('https://www.norsk-tipping.no/lotteri/eurojackpot');
    const v=parseMillions(t,/F[øo]rstepremiepott[^\d]{0,80}(\d+(?:[.,]\d+)?)\s*million/i);
    return v?{txt:'Ca. '+v,sub:'MILLIONER NOK',src:'norsk-tipping.no'}:null;
  },
  powerball:async()=>{
    try{
      const j=await fetchJsonResilient('https://www.powerball.com/api/v1/estimates/powerball?_format=json');
      const raw=Array.isArray(j)&&j[0]&&(j[0].field_prize_amount||'');
      const v=parseMillions(String(raw),/\$?\s*([\d.,]+)\s*Million/i);
      if(v)return{txt:'$'+v,sub:'MILLION · ESTIMATED',src:'powerball.com'};
      const b=parseMillions(String(raw),/\$?\s*([\d.,]+)\s*Billion/i);
      if(b)return{txt:'$'+b,sub:'BILLION · ESTIMATED',src:'powerball.com'};
    }catch(e){}
    const t=await fetchTextResilient('https://www.powerball.com/');
    const v=parseMillions(t,/Estimated Jackpot[\s\S]{0,120}?\$\s*([\d.,]+)\s*Million/i);
    return v?{txt:'$'+v,sub:'MILLION · ESTIMATED',src:'powerball.com'}:null;
  },
  mega:async()=>{
    const t=await fetchTextResilient('https://www.megamillions.com/');
    let v=parseMillions(t,/Estimated Jackpot[\s\S]{0,200}?\$\s*([\d.,]+)\s*Million/i);
    if(!v)v=parseMillions(t,/\$\s*([\d.,]+)\s*Million/i);
    return v?{txt:'$'+v,sub:'MILLION · ESTIMATED',src:'megamillions.com'}:null;
  },
  euromillions:async()=>{
    const t=await fetchTextResilient('https://www.euro-millions.com/');
    const v=parseMillions(t,/€\s*([\d.,]+)\s*Million/i);
    return v?{txt:'€'+v,sub:'MILLION',src:'euro-millions.com'}:null;
  },
  superenalotto:async()=>{
    const t=await fetchTextResilient('https://www.superenalotto.net/en');
    const v=parseMillions(t,/€\s*([\d.,]+)\s*Million/i);
    return v?{txt:'€'+v,sub:'MILLION',src:'superenalotto.net'}:null;
  },
  lottomax:async()=>{
    const t=await fetchTextResilient('https://www.lottomaxnumbers.com/');
    const v=parseMillions(t,/\$\s*([\d.,]+)\s*Million/i);
    return v?{txt:'$'+v,sub:'MILLION CAD',src:'lottomaxnumbers.com'}:null;
  },
  powerballau:async()=>{
    try{
      const j=await fetchJsonResilient('https://data.api.thelott.com/sales/vmax/web/data/lotto/opendraws',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({CompanyId:'GoldenCasket',MaxDrawCount:1,OptionalProductFilter:['Powerball']})});
      const d=j&&Array.isArray(j.Draws)&&j.Draws[0];
      const amt=d&&(d.ProjectedJackpotAmount||d.JackpotAmount);
      if(amt)return{txt:'$'+Math.round(amt/1e6),sub:'MILLION AUD',src:'thelott.com'};
    }catch(e){}
    const t=await fetchTextResilient('https://australia.national-lottery.com/powerball');
    const v=parseMillions(t,/\$\s*([\d.,]+)\s*Million/i);
    return v?{txt:'$'+v,sub:'MILLION AUD',src:'national-lottery.com'}:null;
  }
};
/* Jackpot/draw metadata from the ONE remote pipeline (jackpots.json). Native reads it
   from the Pages URL (fresh online), falls back to the bundled copy + last cache when
   offline. Web reads same-origin. No client-side scraping of lottery sites. */
async function fetchJackpots(){
  const now=Date.now(),bust='?t='+Math.floor(now/300000);
  try{
    const r=await fetch(JACKPOTS_JSON_URL+bust,{cache:'no-store'});
    if(r.ok){const j=await r.json();try{localStorage.setItem('loto_jp_all',JSON.stringify({at:now,j}));}catch(e){}return j;}
  }catch(e){}
  if(IS_NATIVE_APP){try{const r=await fetch(JACKPOTS_JSON_BUNDLED+bust,{cache:'no-store'});if(r.ok)return await r.json();}catch(e){}}
  try{const c=JSON.parse(localStorage.getItem('loto_jp_all')||'null');if(c)return Object.assign({},c.j,{offline:true});}catch(e){}
  return null;
}
async function getJackpot(id){
  const j=await fetchJackpots();
  const e=j&&j.values&&j.values[id];
  if(!e)return{status:'unavailable'};
  /* Client freshness: a "fresh" amount whose next draw already passed without a refresh
     is stale/pending — the source hasn't published the new draw's jackpot yet. */
  let status=e.status||'unavailable';
  if(status==='fresh'&&e.nextDrawDate){
    const nd=Date.parse(e.nextDrawDate+'T23:59:59Z'),upd=Date.parse(e.updatedAt||j.updated||'');
    if(Number.isFinite(nd)&&Date.now()>nd+6*3600*1000)status=(Number.isFinite(upd)&&upd>nd)?'pending':'stale';
  }
  return{
    status,amount:e.amount||null,
    txt:(e.prefix||'Ca. ')+(e.amount||''),
    sub:(e.sub||('MILLIONER '+(e.cur||'')))+(e.source?' · '+e.source:''),
    nextDrawDate:e.nextDrawDate,lastDrawDate:e.lastDrawDate,updated:j.updated,offline:j.offline===true,
  };
}
let heroToken=0;
async function renderHero(){
  const l=L(),h=document.getElementById('lot-hero');
  if(!h)return;
  const my=++heroToken,myCur=cur;
  h.className='hero hero-'+cur;
  document.getElementById('hero-brand').textContent=l.name;
  document.getElementById('hero-region').textContent=l.flag+' '+l.region;
  const nd=nextDraw(cur);
  {const _hd=document.getElementById('hero-deadline');_hd.textContent='🗓 ';const _hday=document.createElement('span');_hday.textContent=l.day;_hd.appendChild(_hday);_hd.appendChild(document.createTextNode(' · до '+scheduleTime(l)));}
  document.getElementById('hero-price').textContent='🎫 '+l.price+' '+l.currency+'/ряд';
  document.getElementById('hero-count').textContent=nd.countdown+' · '+nd.dateStr;
  /* мгновенно: шанс, чтобы не мигало пусто */
  document.getElementById('hero-pot-lbl').textContent='Джекпот следующего тиража';
  document.getElementById('hero-pot').textContent='…';
  document.getElementById('hero-pot-sub').textContent='загружаю официальные данные';
  const jp=await getJackpot(myCur);
  if(my!==heroToken||myCur!==cur)return; /* защита от гонки при переключении игр */
  const potLbl=document.getElementById('hero-pot-lbl'),potEl=document.getElementById('hero-pot'),potSub=document.getElementById('hero-pot-sub');
  potLbl.textContent='Джекпот следующего тиража';
  if(jp&&jp.status==='fresh'&&jp.amount){
    /* Actual published amount for the NEXT draw. The date/countdown next to it come
       from nextDraw(cur), so last-draw and next-draw are never mixed. */
    potEl.textContent=jp.txt;
    potSub.textContent=jp.sub+(jp.offline?' · офлайн':'');
  }else if(jp&&(jp.status==='pending'||jp.status==='stale')){
    /* Draw window passed but the official next-draw amount isn't published yet — never
       show the previous (now outdated) jackpot as current. */
    potEl.textContent='Обновляется…';
    potSub.textContent='официальная сумма следующего тиража ещё публикуется';
  }else{
    /* Source does not currently provide a confirmed amount. Odds are NOT a jackpot,
       so they are not substituted here. */
    potEl.textContent='—';
    potSub.textContent='сумма пока недоступна';
  }
}

// Keep the browser chrome / iOS status-bar tint neutral. It follows the current
// page background (light/dark), not the active lottery, so mobile Safari/Chrome
// never paint coloured top/bottom browser areas when switching games.
function updateThemeColor(){
  try{
    const cs=getComputedStyle(document.body);
    const bg=cs.getPropertyValue('--bg').trim();
    if(!bg)return;
    // Root canvas (safe areas / overscroll) stays neutral on both edges.
    const root=document.documentElement.style;
    root.setProperty('--shell-top',bg);
    root.setProperty('--shell-bot',bg);
    root.setProperty('--shell-bg',bg);
    // iOS Safari repaints this reliably only when the theme-color node itself changes;
    // re-create it so light/dark theme switches update, while lottery switches remain
    // neutral because `bg` is independent of body[data-game].
    document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{
      if(m.getAttribute('content')===bg&&m.dataset.dyn==='1')return;
      const next=document.createElement('meta');
      next.setAttribute('name','theme-color');
      if(m.hasAttribute('media'))next.setAttribute('media',m.getAttribute('media'));
      next.setAttribute('content',bg);
      next.dataset.dyn='1';
      m.replaceWith(next);
    });
  }catch(e){}
}
window.updateThemeColor=updateThemeColor;
function selLot(id){
  if(!LOTS[id])return;
  syncRulesFromConfig(id);
  cur=id;lastDraw=null;CROWD_cache=null;const _wc=document.getElementById('wb-crowd');if(_wc)_wc.innerHTML='';
  document.body.setAttribute('data-game',id);
  updateThemeColor();
  setTimeout(()=>{try{PERIOD_refreshLabel();}catch(e){}},50);
  IF_reset();CONS_reset();
  renderLotteryNav();
  renderHero();
  initRows();renderSim();resetBanner();buildCheckFields();renderFavs();renderWheelBuilder();renderSavedDrawOptions();updateFilterDefaults();
  const nd=nextDraw(id);
  document.getElementById('ndb-sub').textContent=nd.dateStr+' · '+nd.timeLabel;
  document.getElementById('ndb').className='ndb '+L().cls;
  document.getElementById('wheel-btn').className='ndb '+L().cls;
  document.getElementById('btn-draw').className='btn-draw '+L().cls;
  document.getElementById('chk-btn').className='btn-draw '+L().cls;
  clearWheelStatus();
  updateGenCountUI();
  updateOfficialControls();
  if(curPage==='ana'){updateAnaHdr();renderAna();}
}

// ═══════════════════════════════════════════════
//  ROWS & PICKER
// ═══════════════════════════════════════════════
function initRows(){rows=[nr(),nr()];act=0;}
const nr=()=>({m:[],b:[]});
function drawBonusCount(l){return l.pBo||0;} /* БИЛЕТ: сколько доп-чисел ОТМЕЧАЕТ ИГРОК (lotto/superenalotto/lottomax = 0) */
function drawnBonusCount(l){return l.offBo||l.pBo||0;} /* ТИРАЖ: сколько доп-чисел ВЫТЯГИВАЕТСЯ (tillegg/jolly/bonus) */

function renderSim(){updatePickLabels();renderRows();renderMainGrid();renderBonusCol();renderSimBtns();updateHdr();}

function updatePickLabels(){
  const l=L();
  const dBo=drawBonusCount(l);
  const plm=document.getElementById('plm'),plb=document.getElementById('plb');
  if(plm)plm.textContent=l.plm||`Выберите ${l.pM} из ${l.mB}`;
  if(plb)plb.textContent=dBo>0?(l.plb||`${dBo} из ${l.bB}`):'';
}

function updateHdr(){
  const l=L();
  const dBo=drawBonusCount(l);
  const f=rows.filter(r=>r.m.length===l.pM&&(dBo===0||r.b.length===dBo)).length;
  document.getElementById('hdr-title').textContent=f>0?`${f} ${rowWord(f)}, ${fmtInt(f*l.price)} ${l.currency||'NOK'}`:'Fyll ut minst 2 rekker';
}
function updateAnaHdr(){
  const title=document.getElementById('hdr-title');
  title.innerHTML=`<span class="hdr-main">Аналитика тиражей</span><span class="hdr-sub">${lotteryName(cur)}</span>`;
}

function renderRows(){
  const l=L(),c=document.getElementById('rows-c');c.innerHTML='';
  const dBo=drawBonusCount(l);
  rows.forEach((row,i)=>{
    const div=document.createElement('div');
    div.className='ticket-row'+(i===act?' on-'+l.cls:'')+(groupAnalysisState.active&&i>=groupAnalysisState.limit?' analysis-locked':'');
    div.onclick=()=>{act=i;renderSim();};
    let h=`<div class="rn">${i+1}</div><div class="rballs">`;
    for(let j=0;j<l.pM;j++){const n=row.m[j];h+=n!==undefined?`<div class="rb rb-m-${l.cls}">${n}</div>`:`<div class="rb rb-e-${l.cls}">·</div>`;}
    if(dBo>0){
      h+=l.cls==='euro'?'<div class="rstar">★</div>':'<div class="rpipe"></div>';
      for(let j=0;j<dBo;j++){const n=row.b[j];h+=n!==undefined?`<div class="rb rb-b-${l.cls}">${n}</div>`:`<div class="rb rb-e-${l.cls}">·</div>`;}
    }
    h+='</div>';
    const has=row.m.length>0||row.b.length>0;
    if(i===act&&has)h+=`<button class="ract back-${l.cls}" data-loto-event-click="event.stopPropagation();undo(${i})">←</button>`;
    else if(has)h+=`<button class="ract" data-loto-event-click="event.stopPropagation();clrRow(${i})">×</button>`;
    else h+=`<button class="ract" data-loto-event-click="event.stopPropagation();addRow()">+</button>`;
    if(groupAnalysisState.active&&i>=groupAnalysisState.limit&&has)h+=`<div class="analysis-pro-badge">${appText('Доступно в PRO')}</div>`;
    div.innerHTML=h;c.appendChild(div);
  });
}

function renderMainGrid(){
  const l=L(),g=document.getElementById('main-grid');g.innerHTML='';
  const row=rows[act],full=row.m.length>=l.pM;
  for(let n=1;n<=l.mB;n++){
    const s=row.m.includes(n),btn=document.createElement('button');
    btn.className='nb nb-'+l.cls+(s?' sm-'+l.cls:'')+(full&&!s?' dis':'');
    btn.textContent=n;
    if(!full||s)btn.onclick=()=>togM(n);
    g.appendChild(btn);
  }
}

function renderBonusCol(){
  const l=L(),col=document.getElementById('bonus-col');col.innerHTML='';
  const dBo=drawBonusCount(l);
  if(!dBo){col.style.display='none';return;}
  col.style.display='grid';
  const row=rows[act],mD=row.m.length>=l.pM,bF=row.b.length>=dBo;
  for(let n=1;n<=l.bB;n++){
    const s=row.b.includes(n),btn=document.createElement('button');
    btn.className='nb nb-'+l.cls+(s?' sb-'+l.cls:'')+((!mD||bF)&&!s?' dis':'');
    btn.style.opacity=mD?'1':'0.3';btn.textContent=n;
    if(mD&&(!bF||s))btn.onclick=()=>togB(n);
    col.appendChild(btn);
  }
}

function renderSimBtns(){
  const l=L(),c=document.getElementById('sim-btns');c.innerHTML='';
  const mk=(lbl,fn)=>{const b=document.createElement('button');b.className='btn-s '+l.cls;b.innerHTML=lbl;b.onclick=fn;c.appendChild(b);};
  mk('🔀 Fyll ut rekken',()=>{fillOne();quickRoll();});
  // (The 3D-draw entry point lives in the permanent bottom nav — #bn-drum3d.)
  mk('⠿ Fyll ut resten',()=>{fillAll();quickRoll();});
  mk('🗑 Tøm',async()=>{if(await customConfirm('Вы действительно хотите очистить все ряды?','Удалить',{title:'Очистить ряды?'})){initRows();renderSim();resetBanner();}});
}
function quickRoll(){
  const c=document.getElementById('rows-c');
  if(!c||window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const l=L();
  [...c.querySelectorAll('.rb')].filter(el=>!/rb-e-/.test(el.className)&&/^\d+$/.test(el.textContent.trim())).forEach((el,i)=>{
    const fin=el.textContent;
    const isBonus=el.className.includes('rb-b-');
    const maxN=isBonus?(l.bB||l.mB):l.mB;
    el.classList.add('ballroll');
    const t0=performance.now(),dur=300+Math.min(i*40,900);
    const iv=setInterval(()=>{
      if(performance.now()-t0>=dur){el.textContent=fin;el.classList.remove('ballroll');el.classList.add('balllanded');setTimeout(()=>el.classList.remove('balllanded'),420);clearInterval(iv);return;}
      el.textContent=1+Math.floor(Math.random()*maxN);
    },110);
    rollTimers.push(iv);
  });
}

function togM(n){clearWheelStatus();clearGroupAnalysisState();const l=L(),row=rows[act],i=row.m.indexOf(n);if(i>=0)row.m.splice(i,1);else if(row.m.length<l.pM){row.m.push(n);row.m.sort((a,b)=>a-b);}renderSim();}
function togB(n){clearWheelStatus();clearGroupAnalysisState();const l=L(),dBo=drawBonusCount(l),row=rows[act],i=row.b.indexOf(n);if(i>=0)row.b.splice(i,1);else if(row.b.length<dBo){row.b.push(n);row.b.sort((a,b)=>a-b);}renderSim();}
function undo(i){clearGroupAnalysisState();const l=L(),dBo=drawBonusCount(l),r=rows[i];if(dBo>0&&r.b.length>0)r.b.pop();else if(r.m.length>0)r.m.pop();renderSim();}
async function clrRow(i){
  if(!(await customConfirm('Вы действительно хотите удалить этот ряд?','Удалить',{title:'Удалить ряд?'})))return;
  clearWheelStatus();clearGroupAnalysisState();rows[i]=nr();renderSim();
}
function addRow(){if(rows.length>=MAX_ROWS)return;clearGroupAnalysisState();rows.push(nr());act=rows.length-1;renderSim();}

function secureUint32(){
  const a=new Uint32Array(1);
  if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function')globalThis.crypto.getRandomValues(a);
  else a[0]=Math.floor(Math.random()*4294967296);
  return a[0];
}
function secureInt(max){
  max=Math.floor(max);
  if(max<=1)return 0;
  const range=4294967296,limit=range-(range%max);let x;
  do{x=secureUint32();}while(x>=limit);
  return x%max;
}
function rnd(max,cnt,ex=[]){
  const p=[];for(let i=1;i<=max;i++)if(!ex.includes(i))p.push(i);
  for(let i=p.length-1;i>0;i--){const j=secureInt(i+1);[p[i],p[j]]=[p[j],p[i]];}
  return p.slice(0,cnt).sort((a,b)=>a-b);
}
function chooseBig(n,k){
  if(k<0||k>n)return 0n;
  k=Math.min(k,n-k);let r=1n;
  for(let i=1;i<=k;i++)r=r*BigInt(n-k+i)/BigInt(i);
  return r;
}
function gcdBig(a,b){while(b){const t=a%b;a=b;b=t;}return a;}
function randomBigBelow(limit){
  if(limit<=1n)return 0n;
  const range=1n<<32n,cut=range-(range%limit);let x;
  do{x=BigInt(secureUint32());}while(x>=cut);
  return x%limit;
}
function combinationRank(nums,n,k){
  const a=[...nums].sort((x,y)=>x-y);let rank=0n,prev=0;
  for(let i=0;i<k;i++){
    for(let v=prev+1;v<a[i];v++)rank+=chooseBig(n-v,k-i-1);
    prev=a[i];
  }
  return rank;
}
function combinationUnrank(rank,n,k){
  let r=BigInt(rank),start=1;const out=[];
  for(let i=0;i<k;i++){
    for(let v=start;v<=n-(k-i)+1;v++){
      const block=chooseBig(n-v,k-i-1);
      if(r<block){out.push(v);start=v+1;break;}
      r-=block;
    }
  }
  return out;
}
const UNIQUE_SEQ_MEMORY={};
function nextUniqueMain(l,namespace='simulation'){
  const total=chooseBig(l.mB,l.pM),key='loto_unique_seq_v2_'+namespace+'_'+(l.id||cur);
  let state=null;
  try{state=JSON.parse(localStorage.getItem(key)||'null');}catch(e){state=UNIQUE_SEQ_MEMORY[key]||null;}
  let a,b,pos;
  try{a=BigInt(state.a);b=BigInt(state.b);pos=BigInt(state.pos);if(BigInt(state.total)!==total)throw 0;}catch(e){
    do{a=randomBigBelow(total-1n)+1n;}while(gcdBig(a,total)!==1n);
    b=randomBigBelow(total);pos=0n;
  }
  if(pos>=total){
    do{a=randomBigBelow(total-1n)+1n;}while(gcdBig(a,total)!==1n);
    b=randomBigBelow(total);pos=0n;
  }
  const rank=(a*pos+b)%total;
  const next={total:String(total),a:String(a),b:String(b),pos:String(pos+1n)};
  UNIQUE_SEQ_MEMORY[key]=next;
  try{localStorage.setItem(key,JSON.stringify(next));}catch(e){}
  return combinationUnrank(rank,l.mB,l.pM);
}
const UNIQUE_MODEL_HISTORY_LIMIT=20000;
function modelHistoryKey(l){return'loto_model_rows_v2_'+(l.id||cur);}
function loadModelHistory(l){try{return(localStorage.getItem(modelHistoryKey(l))||'').split(',').filter(Boolean).slice(-UNIQUE_MODEL_HISTORY_LIMIT);}catch(e){return[];}}
function saveModelHistory(l,items){try{localStorage.setItem(modelHistoryKey(l),items.slice(-UNIQUE_MODEL_HISTORY_LIMIT).join(','));}catch(e){}}
function generatedRowKey(row,l){return combinationRank(row.m,l.mB,l.pM).toString(36);}
function freshGeneratedVariant(row,l,seen){
  const original=row&&typeof row==='object'?row:{};
  const base=normalizeGeneratedRow(row,l);
  for(let attempt=0;attempt<420;attempt++){
    let m=base.m.length===l.pM?[...base.m]:rnd(l.mB,l.pM);
    const swaps=attempt<240?1:(attempt<360?Math.min(2,l.pM):l.pM);
    for(let s=0;s<swaps;s++){
      const idx=secureInt(m.length),available=rangeNums(l.mB).filter(n=>!m.includes(n));
      if(available.length)m[idx]=available[secureInt(available.length)];
    }
    m=[...new Set(m)].sort((a,b)=>a-b);
    if(m.length!==l.pM)continue;
    const candidate={...original,...base,m},key=generatedRowKey(candidate,l);
    if(!seen.has(key)){if(Array.isArray(candidate.tags))candidate.tags=m.map(()=>'q');return candidate;}
  }
  for(let guard=0;guard<2000;guard++){
    const candidate={...original,...base,m:nextUniqueMain(l,'model-fallback')},key=generatedRowKey(candidate,l);
    if(!seen.has(key)){if(Array.isArray(candidate.tags))candidate.tags=candidate.m.map(()=>'q');return candidate;}
  }
  throw new Error('Не удалось найти новую комбинацию');
}
function ensureUniqueGeneratedRows(gen,l=L()){
  const history=loadModelHistory(l),seen=new Set(history),added=[];
  const source=(Array.isArray(gen)?gen:[]).slice(0,MAX_ROWS);
  const out=normalizeGeneratedRows(source,l).map((row,i)=>{
    row={...(source[i]||{}),...row};
    let candidate=row,key=row.m.length===l.pM?generatedRowKey(row,l):'';
    if(!key||seen.has(key)){candidate=freshGeneratedVariant(row,l,seen);key=generatedRowKey(candidate,l);}
    candidate._uniqueIssued=true;seen.add(key);added.push(key);return candidate;
  });
  if(gen&&gen.meta)out.meta=gen.meta;
  saveModelHistory(l,[...history,...added]);
  return out;
}
function fillOne(){
  clearWheelStatus();
  const l=L(),row=rows[act];
  const dBo=drawBonusCount(l);
  row.m=rnd(l.mB,l.pM);if(dBo>0)row.b=rnd(l.bB,dBo);
  const nx=rows.findIndex((r,i)=>i>act&&r.m.length===0);if(nx>=0)act=nx;
  renderSim();
}
function fillAll(){
  clearWheelStatus();
  const l=L();
  const dBo=drawBonusCount(l);
  rows.forEach(r=>{
    if(r.m.length<l.pM){const e=rnd(l.mB,l.pM-r.m.length,r.m);r.m=[...r.m,...e].sort((a,b)=>a-b);}
    if(dBo>0&&r.b.length<dBo){const e=rnd(l.bB,dBo-r.b.length,r.b);r.b=[...r.b,...e].sort((a,b)=>a-b);}
  });
  renderSim();
}

// ═══════════════════════════════════════════════
//  GENERATION CONTROLS
// ═══════════════════════════════════════════════
const GEN_COUNT_KEY='loto_gen_count';
function getGenCount(){
  const el=document.getElementById('gen-count');
  const raw=(el&&el.value!=='')?+el.value:(+localStorage.getItem(GEN_COUNT_KEY)||10);
  return Math.max(1,Math.min(MAX_ROWS,Number.isFinite(raw)&&raw>0?raw:10));
}
function onGenCountChange(){
  const c=getGenCount();
  localStorage.setItem(GEN_COUNT_KEY,String(c));
  updateGenCountUI();
  if(document.getElementById('sg-ov')?.classList.contains('show'))generateCombos();
}
function initGenControls(){
  const saved=Math.max(1,Math.min(MAX_ROWS,+localStorage.getItem(GEN_COUNT_KEY)||10));
  const sel=document.getElementById('gen-count');
  if(sel)sel.value=String(saved);
  updateGenCountUI();
  updateFilterDefaults();
}
function updateGenCountUI(){
  const c=getGenCount(),sel=document.getElementById('gen-count'),sub=document.getElementById('wheel-sub');
  const sgBtn=document.getElementById('sg-count-btn');
  if(sgBtn)sgBtn.textContent=c+' ▾';
  if(sel)sel.value=String(c);
  if(sub)sub.textContent=`${c} ${rowWord(c)} · покрытие пар`;
}
function rowWord(n){return n===1?'ряд':(n>=2&&n<=4?'ряда':'рядов');}
function normalizeNumberList(nums,max,limit){
  const out=[];
  (Array.isArray(nums)?nums:[]).forEach(v=>{
    const n=+v;
    if(Number.isInteger(n)&&n>=1&&n<=max&&!out.includes(n))out.push(n);
  });
  return out.slice(0,limit).sort((a,b)=>a-b);
}
function completeBonusList(nums,l){
  const dBo=drawBonusCount(l);
  if(!dBo||!l.bB)return[];
  const out=normalizeNumberList(nums,l.bB,dBo);
  while(out.length<dBo){
    const n=1+Math.floor(Math.random()*l.bB);
    if(!out.includes(n))out.push(n);
  }
  return out.sort((a,b)=>a-b);
}
function normalizeGeneratedRow(row,l=L()){
  return{
    m:normalizeNumberList(row&&row.m,l.mB,l.pM),
    b:completeBonusList(row&&row.b,l)
  };
}
function normalizeGeneratedRows(gen,l=L()){
  return (Array.isArray(gen)?gen:[]).slice(0,MAX_ROWS).map(r=>normalizeGeneratedRow(r,l));
}
function setGeneratedRows(gen,status,unique=false){
  clearGroupAnalysisState();
  const alreadyIssued=Array.isArray(gen)&&gen.length>0&&gen.every(r=>r&&r._uniqueIssued);
  rows=unique&&!alreadyIssued?ensureUniqueGeneratedRows(gen,L()):normalizeGeneratedRows(gen,L());
  if(!rows.length)rows=[nr()];
  act=0;
  renderSim();
  resetBanner();
  showGenStatus(status);
  goToRows();
  return revealResult(document.getElementById('rows-c'),'start');
}
function showGenStatus(msg){
  const el=document.getElementById('world-analysis-out');
  if(!el)return;
  el.style.display='';
  el.textContent=msg;
}
function genBonus(l,draws,mode='bayes'){
  const dBo=drawBonusCount(l);
  if(!dBo||!l.bB)return[];
  const bf=draws.length>=5?buildFreq(draws,'bonus',l.bB):null;
  if(mode==='freq'&&bf){
    const w=rangeNums(l.bB).map(n=>(bf.get(n)||0)+.05);
    return weightedDistinct(w,dBo,l.bB);
  }
  if(mode==='bayes'&&bf){ /* сглаживание Лапласа α=2: данные ведут, но не диктуют */
    const w=rangeNums(l.bB).map(n=>(bf.get(n)||0)+2);
    return weightedDistinct(w,dBo,l.bB);
  }
  return rnd(l.bB,dBo);
}
function rangeNums(max){return Array.from({length:max},(_,i)=>i+1);}
function defaultSumRange(l){
  if(l.officialGame==='lotto')return{min:95,max:150};
  const avg=l.pM*(l.mB+1)/2;
  const spread=Math.max(18,Math.round(l.mB*l.pM*.22));
  return{min:Math.max(l.pM,Math.round(avg-spread)),max:Math.min(l.pM*l.mB,Math.round(avg+spread))};
}
function updateFilterDefaults(force=false){
  const l=L(),r=defaultSumRange(l),minEl=document.getElementById('sum-min'),maxEl=document.getElementById('sum-max'),hint=document.getElementById('sum-hint');
  if(!minEl||!maxEl)return;
  if(force||minEl.dataset.lot!==cur){minEl.value=r.min;maxEl.value=r.max;minEl.dataset.lot=cur;maxEl.dataset.lot=cur;}
  if(hint)hint.textContent=`(${r.min}-${r.max})`;
}
function getFilterSettings(){
  const l=L(),d=defaultSumRange(l);
  const minEl=document.getElementById('sum-min'),maxEl=document.getElementById('sum-max');
  let min=+(minEl?.value||d.min),max=+(maxEl?.value||d.max);
  if(min>max)[min,max]=[max,min];
  return{
    parity:document.getElementById('flt-parity')?.checked!==false,
    sum:document.getElementById('flt-sum')?.checked!==false,
    consecutive:document.getElementById('flt-consec')?.checked!==false,
    min,max
  };
}
function maxConsecutive(nums){
  const a=[...nums].sort((x,y)=>x-y);
  let best=0,run=0,prev=null;
  a.forEach(n=>{run=prev!==null&&n===prev+1?run+1:1;best=Math.max(best,run);prev=n;});
  return best;
}
function passesFilters(row,l=L(),flt=getFilterSettings()){
  const m=[...(row.m||[])].sort((a,b)=>a-b);
  if(m.length!==l.pM)return false;
  if(flt.parity){
    const odd=m.filter(n=>n%2).length;
    if(odd===0||odd===m.length)return false;
  }
  if(flt.sum){
    const sum=m.reduce((s,n)=>s+n,0);
    if(sum<flt.min||sum>flt.max)return false;
  }
  if(flt.consecutive&&maxConsecutive(m)>3)return false;
  return true;
}
function randomFilteredRow(l=L(),draws=[]){
  const flt=getFilterSettings();
  for(let i=0;i<600;i++){
    const row={m:rnd(l.mB,l.pM),b:genBonus(l,draws)};
    if(passesFilters(row,l,flt))return row;
  }
  return{m:rnd(l.mB,l.pM),b:genBonus(l,draws)};
}
function filterGeneratedRows(out,count,l=L(),draws=[]){
  const flt=getFilterSettings();
  const ok=[],seen=new Set();
  (out||[]).forEach(r=>{
    const fixed=normalizeGeneratedRow(r,l),key=fixed.m.join(',');
    if(ok.length<count&&!seen.has(key)&&passesFilters(fixed,l,flt)){seen.add(key);ok.push(fixed);}
  });
  let guard=0;
  while(ok.length<count&&guard++<count*800){
    const row=randomFilteredRow(l,draws);
    const key=row.m.join(',');if(!seen.has(key)){seen.add(key);ok.push(row);}
  }
  return ok.slice(0,count);
}
/* ═══ НОВЫЕ МЕТОДЫ: математика · физика · квантовая механика ═══ */
function weightedDistinct(weights,k,maxN,rng){
  const r=rng||Math.random,w=[...weights],res=[];
  for(let t=0;t<k;t++){
    let tot=0;for(let i=0;i<maxN;i++)tot+=w[i];
    if(tot<=0)break;
    let u=r()*tot;
    for(let i=0;i<maxN;i++){u-=w[i];if(u<=0){res.push(i+1);w[i]=0;break;}}
  }
  while(res.length<k){const n=1+Math.floor(r()*maxN);if(!res.includes(n))res.push(n);}
  return res.sort((a,b)=>a-b);
}
function balancedAllocation(k,rowIndex=0){
  const hot=Math.max(1,Math.round(k*.4)),rest=k-hot;
  const a=Math.floor(rest/2),b=rest-a;
  return rowIndex%2?{hot,mid:a,cold:b}:{hot,mid:b,cold:a};
}
function physicsDraw(maxN,k){throw new Error('backend_only');}
function chaosDraw(maxN,k){throw new Error('backend_only');}
let lastQuantumSrc='';
async function quantumStream(n){throw new Error('backend_only');}
/* ═══ СИСТЕМА ПАРАДОКСОВ · контринтуитивные, но реальные явления лото ═══ */
const PDX_TYPES=[
  {key:'crowd',  name:'Парадокс толпы',        short:'против популярных чисел',
   note:'Числа 1–31 часто связывают с датами, а узоры выбирают вручную. Это не меняет шанс выпадения; менее популярная комбинация лишь может снизить ожидаемое число совладельцев, если она выиграет.'},
  {key:'clash',  name:'Инверсия ошибки игрока', short:'горячее × просроченное',
   note:'Игрок избегает недавних чисел («уже выпадали»). Но у шара нет памяти. Смешиваю самые частые и самые «просроченные» числа выбранного окна.'},
  {key:'cluster',name:'Парадокс кластера',      short:'соседняя пара чисел',
   note:'Соседние числа (например, 23–24) кажутся «неслучайными», но вполне допустимы. Точная вероятность хотя бы одной соседней пары для k из N: 1 − C(N−k+1,k) / C(N,k).'},
  {key:'mirror', name:'Парадокс зеркала',       short:'симметрия n ↔ max+1−n',
   note:'Строю максимально возможную симметрию n ↔ N+1−n: зеркальные пары и, при нечётном N и нечётном k, центральное число. Для нечётного k при чётном N одно число неизбежно остаётся без пары.'},
  {key:'regress',name:'Регрессия к среднему',   short:'ушедшие от нормы числа',
   note:'Модель показывает числа с наибольшим расхождением краткой и длинной частоты. Регрессия описывает статистику повторных выборок, но не означает, что отдельный шар обязан «вернуться» к средней.'}
];
function PDX_ctx(l,draws){throw new Error('backend_only');}
function PDX_finish(m,l){throw new Error('backend_only');}
function PDX_mirrorNumbers(l){throw new Error('backend_only');}
function PDX_clusterProbability(l){throw new Error('backend_only');}
function PDX_row(type,ctx){throw new Error('backend_only');}
function PDX_generate(count,useBase,l,draws,applyFilters=false){throw new Error('backend_only');}

async function generateFreeRowsByAlgo(algo,count){
  if(!['freq','bal','rnd','man'].includes(algo))throw new Error('backend_only_model');
  const l=L(),draws=IF_window(await loadD(cur)),hasHist=draws.length>=5;
  const freq=buildFreq(draws,'main',l.mB);
  const sorted=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  const out=[];
  if(algo==='freq'){
    for(let i=0;i<count;i++){
      const weights=hasHist?rangeNums(l.mB).map(n=>(freq.get(n)||0)+.05):rangeNums(l.mB).map(()=>1);
      out.push({m:weightedDistinct(weights,l.pM,l.mB),b:genBonus(l,draws,'freq')});
    }
  }else if(algo==='bal'){
    const size=Math.ceil(l.mB/3);
    const hot=sorted.slice(0,size).map(entry=>entry[0]);
    const cold=sorted.slice(-size).map(entry=>entry[0]);
    const middle=sorted.slice(size,-size).map(entry=>entry[0]);
    for(let i=0;i<count;i++){
      if(!hasHist){out.push({m:rnd(l.mB,l.pM),b:genBonus(l,draws)});continue;}
      const allocation=balancedAllocation(l.pM,i);
      const main=uniqValid([
        ...shufSlice(hot,allocation.hot),
        ...shufSlice(cold,allocation.cold),
        ...shufSlice(middle,allocation.mid),
      ],l.mB);
      while(main.length<l.pM){main.push(rnd(l.mB,1,main)[0]);main.sort((a,b)=>a-b);}
      out.push({m:main,b:genBonus(l,draws)});
    }
  }else if(algo==='man'){
    const segment=Math.floor(l.mB/l.pM);
    for(let i=0;i<count;i++){
      const main=[];
      for(let part=0;part<l.pM;part++){
        const low=part*segment+1,high=part===l.pM-1?l.mB:(part+1)*segment;
        let number;do{number=Math.floor(Math.random()*(high-low+1))+low;}while(main.includes(number));
        main.push(number);
      }
      out.push({m:main.sort((a,b)=>a-b),b:genBonus(l,draws)});
    }
  }else{
    for(let i=0;i<count;i++)out.push({m:rnd(l.mB,l.pM),b:genBonus(l,draws,'rnd')});
  }
  return filterGeneratedRows(out,count,l,draws);
}

async function generateRowsByAlgo(algo,count){return generateFreeRowsByAlgo(algo,count);}
async function generateSelectedRows(){
  if(GEN_BUSY)return;
  const algo=document.getElementById('direct-algo')?.value||'freq';
  const requestedCount=getGenCount();
  const gen=await withBusy('Генерация '+requestedCount+' '+rowWord(requestedCount),()=>generateRowsByAlgo(algo,requestedCount,{user:true}));
  // null/empty ⇒ the Trial/PRO flow was offered (>5 on FREE) or nothing to show — never a partial result.
  if(!gen?.length)return;
  const count=gen.length;
  // Advanced math models present their rows in the Result modal (Use rows / Judge).
  // The basic free generators (freq/bal/rnd/man) go straight to the main screen.
  if(!['freq','bal','rnd','man'].includes(algo)&&typeof window.showModelResult==='function'){
    window.showModelResult(gen.map(r=>({main:r.m,bonus:r.b})),algo);
    return;
  }
  // Exact-count contract: a successful basic generation returns EXACTLY the requested rows.
  // A mismatch is an error, never a silently-truncated "success".
  if(count!==requestedCount){
    showFeedback('Не получилось',`Не удалось создать ${requestedCount} ${rowWord(requestedCount)}. Попробуйте ещё раз.`,'⚠️',3200);
    return;
  }
  const labels={freq:'горячие числа',bal:'комбинированный анализ',rnd:'pure random',man:'сегментный охват',wheel:'колесная матрица','world-hot':'мировой горячий профиль','world-mix':'мировой комбинированный профиль',markov:'цепи Маркова',gauss:'Гаусс · ЦПТ',delta:'интервальная модель Δ',bayes:'Байес · Дирихле',overdue:'gap-анализ',phys:'физическая модель лототрона',chaos:'детерминированный хаос',quantum:'квантовый коллапс',paradox:'система парадоксов'};
  setGeneratedRows(gen,`Готово: ${count} ${rowWord(count)} · ${labels[algo]||algo} · база сохранённых тиражей не очищается при обновлении.`,true);
}
function rowsToNorskText(){
  const l=L();
  fillAll();
  return rowsToShareText(rows,l,`${lotteryName(cur)} · ${new Date().toLocaleDateString(appLocale())}`);
}
function rowsToShareText(rowList,l=L(),title){
  const dBo=drawBonusCount(l);
  const lines=[title||`${l.name||lotteryName(cur)} · ${new Date().toLocaleDateString(appLocale())}`];
  normalizeGeneratedRows(rowList,l).filter(r=>r.m.length===l.pM).forEach((r,i)=>{
    const bonus=dBo>0&&r.b.length?` | ${bonusLabel(l)}: ${r.b.join(', ')}`:'';
    lines.push(`Ряд ${i+1}: ${r.m.join(', ')}${bonus}`);
  });
  return lines.join('\n');
}
function showCopyToast(message){
  const root=document.getElementById('toast-root');
  if(!root)return;
  const toast=document.createElement('div');
  toast.className='copy-toast';
  toast.textContent=message;
  root.appendChild(toast);
  setTimeout(()=>toast.classList.add('hide'),1820);
  setTimeout(()=>toast.remove(),2000);
}
function setCopyButtonState(btn){
  if(!btn)return;
  clearTimeout(btn._copyTimer);
  const original=btn.dataset.originalText||btn.textContent;
  btn.dataset.originalText=original;
  btn.textContent=btn.classList.contains('btn-fav-copy')?'✓':'Скопировано! ✅';
  btn.classList.add('btn-copied');
  btn._copyTimer=setTimeout(()=>{
    btn.textContent=btn.dataset.originalText;
    btn.classList.remove('btn-copied');
  },1500);
}
async function writeClipboardText(text){
  if(navigator.clipboard?.writeText&&window.isSecureContext){
    try{await navigator.clipboard.writeText(text);return true;}catch(e){}
  }
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.setAttribute('readonly','');
  ta.style.position='fixed';
  ta.style.top='-1000px';
  ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.focus({preventScroll:true});
  ta.select();
  const ok=document.execCommand('copy');
  ta.remove();
  if(!ok)throw new Error('copy failed');
  return true;
}
async function copyRowsForNorsk(btn){
  const text=rowsToNorskText();
  const out=document.getElementById('copy-out');
  const readyCount=rows.filter(r=>r.m.length===L().pM).length;
  try{
    await writeClipboardText(text);
    setCopyButtonState(btn||document.getElementById('copy-rows-btn'));
    showCopyToast(`Скопировано ${readyCount} ${rowWord(readyCount)}`);
    if(out)out.textContent=`Скопировано ${readyCount} ${rowWord(readyCount)}. Можно вставить в заметки, сообщение или личный кабинет.`;
  }catch(e){
    if(out)out.textContent='Не удалось скопировать автоматически. Разрешите доступ к буферу обмена в браузере и попробуйте ещё раз.';
    showFeedback('Не скопировано','Браузер запретил доступ к буферу обмена. Попробуйте ещё раз после разрешения.','⚠️',3400);
  }
}
async function loadAllDraws(){
  const out={};
  for(const id of Object.keys(LOTS))out[id]=await loadD(id);
  return out;
}
function buildWorldScores(l,allData){throw new Error('backend_only');}
function profileBuckets(scores,l){throw new Error('backend_only');}
async function generateWorldRows(mode,count){throw new Error('backend_only');}
async function renderWorldAnalysis(targetId='world-analysis-out'){
  const l=L(),allData=await loadAllDraws(),scores=buildWorldScores(l,allData),b=profileBuckets(scores,l);
  const totals=Object.entries(allData).map(([id,d])=>`${LOTS[id].name}: ${(d||[]).length}`).join(' · ');
  const top=b.sorted.slice(0,10);
  const allNums=Object.values(allData).flatMap(ds=>(ds||[]).flatMap(d=>d.main||[]));
  const odd=allNums.filter(n=>n%2).length,even=allNums.length-odd;
  const target=document.getElementById(targetId);
  if(!target)return;
  target.style.display='';
  target.innerHTML=`<div style="font-size:12px;line-height:1.55;color:var(--warn-c)">
    Профиль построен не из единой мировой официальной базы, а из всех сохранённых игр приложения, нормализованных к диапазону ${l.name}. Это честнее, чем выдумывать внешний мировой архив.
    <div class="world-chip-row">${top.map(([n,s])=>`<span class="world-chip">${n} · ${s.toFixed(1)}</span>`).join('')}</div>
    <div style="margin-top:8px">База: ${totals||'нет данных'} · нечётные/чётные: ${odd}/${even}</div>
  </div>`;
}

// ═══════════════════════════════════════════════
//  WHEEL MATRIX
// ═══════════════════════════════════════════════
function clearWheelStatus(){
  const el=document.getElementById('wheel-status');
  if(!el)return;
  el.style.display='none';
  el.textContent='';
}

function uniqValid(nums,max){
  return [...new Set(nums.filter(n=>Number.isInteger(n)&&n>=1&&n<=max))].sort((a,b)=>a-b);
}

function selectedNums(kind,max){
  return uniqValid(rows.flatMap(r=>r[kind]||[]),max);
}

function chooseCombos(arr,k,start=0,prefix=[],out=[]){
  if(prefix.length===k){out.push([...prefix]);return out;}
  const need=k-prefix.length;
  for(let i=start;i<=arr.length-need;i++){
    prefix.push(arr[i]);
    chooseCombos(arr,k,i+1,prefix,out);
    prefix.pop();
  }
  return out;
}

function pairKeys(nums){
  const keys=[];
  for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)keys.push(nums[i]+'-'+nums[j]);
  return keys;
}
function subsetKeys(nums,k){
  return chooseCombos([...nums].sort((a,b)=>a-b),k).map(c=>c.join('-'));
}
function getWheelGuarantee(){
  const l=L();
  const raw=+document.getElementById('wheel-guarantee')?.value||4;
  return Math.max(2,Math.min(l.pM,raw));
}
function renderWheelBuilder(){
  const l=L(),grid=document.getElementById('wheel-pool-grid'),summary=document.getElementById('wheel-builder-summary');
  if(!grid)return;
  const pool=wheelPools[cur]||[];
  grid.innerHTML='';
  for(let n=1;n<=l.mB;n++){
    const btn=document.createElement('button');
    btn.className='wheel-num'+(pool.includes(n)?' sel':'');
    btn.textContent=n;
    btn.onclick=()=>toggleWheelNumber(n);
    grid.appendChild(btn);
  }
  const t=getWheelGuarantee();
  const lower=pool.length>=l.pM&&pool.length>=t?Math.ceil(comb(pool.length,t)/comb(l.pM,t)):0;
  if(summary){
    summary.textContent=pool.length
      ? `Выбрано ${pool.length}/${WHEEL_POOL_MAX}. ${t} из ${t}: нижняя математическая граница ${lower||'—'} рядов, лимит вывода ${MAX_ROWS}.`
      : `Выберите от ${l.pM} до ${WHEEL_POOL_MAX} чисел или нажмите Автопул.`;
  }
}
function toggleWheelNumber(n){
  const pool=wheelPools[cur]||[];
  const i=pool.indexOf(n);
  if(i>=0)pool.splice(i,1);
  else{
    if(pool.length>=WHEEL_POOL_MAX){showFeedback('Лимит пула',`Для быстрой и честной матрицы лимит пула: ${WHEEL_POOL_MAX} чисел.`,'⚠️',3200);return;}
    pool.push(n);
  }
  wheelPools[cur]=pool.sort((a,b)=>a-b);
  renderWheelBuilder();
}
async function autoWheelPool(){
  const l=L(),draws=await loadD(cur),seed=selectedNums('m',l.mB);
  const freq=draws.length>=5?buildFreq(draws,'main',l.mB):null;
  wheelPools[cur]=buildWheelPool(l.mB,l.pM,Math.min(WHEEL_POOL_MAX,Math.max(14,l.pM+8)),seed,freq);
  renderWheelBuilder();
}
async function clearWheelPool(){
  if(!(await customConfirm('Вы действительно хотите очистить выбранный пул чисел?','Удалить',{title:'Очистить пул?'})))return;
  wheelPools[cur]=[];
  clearWheelStatus();
  renderWheelBuilder();
}
function buildGuaranteedWheel(pool,pick,t,rowLimit=MAX_ROWS){throw new Error('backend_only');}
async function applyWheelBuilder(){
  const l=L(),pool=[...(wheelPools[cur]||[])].sort((a,b)=>a-b),t=getWheelGuarantee();
  if(pool.length<l.pM){showFeedback('Недостаточно чисел',`Выберите минимум ${l.pM} главных чисел для ${lotteryName(cur)}.`,'⚠️',3200);return;}
  const built=buildGuaranteedWheel(pool,l.pM,t,MAX_ROWS);
  const draws=await loadD(cur);
  rows=built.rows.map(m=>({m,b:genBonus(l,draws,'freq')}));
  if(!rows.length)rows=[randomFilteredRow(l,draws)];
  act=0;renderSim();resetBanner();
  revealResult(document.getElementById('rows-c'),'start');
  const pct=built.total?Math.round(built.covered/built.total*100):100;
  const el=document.getElementById('wheel-status');
  el.style.display='';
  el.textContent=built.full
    ? `Wheel готов: ${rows.length} ${rowWord(rows.length)} · полная гарантия ${t} из ${t} для пула ${pool.length} чисел. Нижняя граница: ${built.lowerBound}.`
    : `Wheel готов: ${rows.length} ${rowWord(rows.length)} · покрытие ${built.covered}/${built.total} (${pct}%). Полная гарантия ${t} из ${t} не поместилась в лимит ${MAX_ROWS} рядов.`;
  if(built.usedUnfiltered)el.textContent+=' Фильтры были слишком строгими для пула, часть wheel построена без них.';
}

function buildWheelPool(maxN,pick,poolSize,seed,freq){throw new Error('backend_only');}

function buildCoverageWheel(pool,pick,rowCount){throw new Error('backend_only');}

function wheelCoverage(matrix,pool){throw new Error('backend_only');}

async function buildWheelGenerated(rowCount){throw new Error('backend_only');}

async function applyWheelMatrix(){
  if(GEN_BUSY&&!applyWheelMatrix._inner)return;
  const count=getGenCount(),l=L(),draws=await loadD(cur);
  const built=await withBusy('Колёсная матрица · '+count+' '+rowWord(count),()=>buildWheelGenerated(count));
  if(!built)return;
  rows=filterGeneratedRows(built.rows,count,l,draws);
  if(!rows.length)rows=[nr()];
  act=0;
  renderSim();
  resetBanner();
  goToRows();
  revealResult(document.getElementById('rows-c'),'start');
  const el=document.getElementById('wheel-status');
  el.style.display='';
  el.textContent=`Матрица готова: ${rows.length} ${rowWord(rows.length)} · пары исходной матрицы ${built.cov.covered}/${built.cov.total} · пул ${built.pool.length} чисел · фильтры применены`;
}

// ═══════════════════════════════════════════════
//  DRAW + BANNER
// ═══════════════════════════════════════════════
function doDraw(){
  const l=L();fillAll();
  const dM=nextUniqueMain(l,'simulation'),dB=drawnBonusCount(l)>0?rnd(l.bB,drawnBonusCount(l)):[];
  lastDraw={main:dM,bonus:dB};
  showBanner(dM,dB);renderSim();
  // track ROI: add spending
  const spent=rows.filter(r=>r.m.length===l.pM).length*l.price;
  const roi=loadROI();roi.spent+=spent;saveROI(roi);
}

function resetBanner(){
  lastDraw=null;
  const b=document.getElementById('win-banner');
  b.className='win-banner none';
  document.getElementById('wb-icon').textContent='🎯';
  document.getElementById('wb-title').textContent='Результат симуляции';
  document.getElementById('wb-sub').textContent='Запусти тираж или проверь билет';
  document.getElementById('wb-body').style.display='none';
}

function showBanner(dM,dB){
  const l=L();
  // drawn
  document.getElementById('wb-drawn').innerHTML=dM.map(n=>`<div class="dball ${l.cls}-m">${n}</div>`).join('');
  const bw=document.getElementById('wb-bonus-wrap');
  if(dB.length>0){
    bw.style.display='';
    document.getElementById('wb-blbl').textContent=bonusLabel(l);
    document.getElementById('wb-bonus').innerHTML=dB.map(n=>`<div class="dball ${l.cls}-b">${n}</div>`).join('');
  }else bw.style.display='none';
  // rows
  let best=null;
  let rowsH='';
  rows.forEach((row,i)=>{
    const p=checkPrize(row.m,row.b,dM,dB,l);
    if(p&&(!best||p.lvl>best.lvl))best=p;
    let balls=row.m.map(n=>`<div class="mb ${dM.includes(n)?l.cls+'-m':'miss-'+l.cls}">${n}</div>`).join('');
    if(l.pBo>0&&row.b.length>0){
      balls+=`<span style="font-size:9px;opacity:.4;margin:0 2px">|</span>`;
      balls+=row.b.map(n=>`<div class="mb ${dB.includes(n)?l.cls+'-b':'miss-'+l.cls}">${n}</div>`).join('');
    }
    const bc=p?(p.name.includes('ДЖЕКПОТ')?'jp':'pr'):'ms';
    const bt=p?p.name:`${row.m.filter(n=>dM.includes(n)).length}/${l.pM}`;
    rowsH+=`<div class="check-result-row"><span class="crr-idx">${i+1}</span><div class="crr-balls">${balls}</div><div class="badge ${bc}">${bt}</div></div>`;
  });
  document.getElementById('wb-rows').innerHTML=rowsH;
  document.getElementById('wb-body').style.display='';
  const b=document.getElementById('win-banner');
  if(best?.name.includes('ДЖЕКПОТ')){b.className='win-banner jackpot';document.getElementById('wb-icon').textContent='🏆';document.getElementById('wb-title').textContent='ДЖЕКПОТ!';document.getElementById('wb-sub').textContent='Ряд совпал с выигрышной комбинацией!';}
  else if(best){b.className='win-banner prize';document.getElementById('wb-icon').textContent='🎉';document.getElementById('wb-title').textContent='Есть выигрыш!';document.getElementById('wb-sub').textContent=best.name+' · '+l.name;}
  else{b.className='win-banner miss';document.getElementById('wb-icon').textContent='😔';document.getElementById('wb-title').textContent='Без выигрыша';document.getElementById('wb-sub').textContent='Попробуй ещё раз';}
  revealResult(b,'start');
}

function checkPrizeLegacy(m,b,dM,dB,l){
  const mh=m.filter(n=>dM.includes(n)).length,bh=b.filter(n=>dB.includes(n)).length;
  const P=(name,lvl)=>({name,lvl});
  if(l.officialGame==='lotto'){
    const tillegg=dB.length>0&&m.some(n=>dB.includes(n));
    if(mh===7)return P('ДЖЕКПОТ 🏆',7);
    if(mh===6&&tillegg)return P('2-й приз · 6+tillegg',6);
    if(mh===6)return P('3-й приз · 6 rette',5);
    if(mh===5)return P('4-й приз · 5 rette',4);
    if(mh===4)return P('5-й приз · 4 rette',3);
  }
  else if(l.officialGame==='vikinglotto'){if(mh===6&&bh===1)return P('ДЖЕКПОТ 🏆',7);if(mh===6)return P('2-й приз · 6+0',6);if(mh===5&&bh===1)return P('3-й приз · 5+1',5);if(mh===5)return P('4-й приз · 5+0',4);if(mh===4)return P('5-й приз · 4 rette',3);if(mh===3)return P('6-й приз · 3 rette',2);}
  else if(l.officialGame==='eurojackpot all'){if(mh===5&&bh===2)return P('ДЖЕКПОТ 🏆',7);if(mh===5&&bh===1)return P('2-й приз',6);if(mh===5)return P('3-й приз',5);if(mh===4&&bh===2)return P('4-й приз',4);if(mh===4&&bh===1)return P('5-й приз',3);if(mh===4)return P('6-й приз',2);if(mh===3&&bh===2)return P('7-й приз',1);if(mh===2&&bh===2)return P('8-й приз',1);if(mh===3&&bh===1)return P('9-й приз',1);if(mh===3)return P('10-й приз',1);if(mh===1&&bh===2)return P('11-й приз',1);if(mh===2&&bh===1)return P('12-й приз',1);}
  else{
    if(mh===l.pM&&(l.pBo===0||bh===l.pBo))return P('ДЖЕКПОТ 🏆',7);
    if(l.pBo>0&&mh===l.pM)return P(`${l.pM}+0`,6);
    if(l.pBo>0&&mh===l.pM-1&&bh===l.pBo)return P(`${l.pM-1}+${l.pBo}`,5);
    if(mh>=Math.max(3,l.pM-2))return P(`${mh}/${l.pM}`,Math.max(1,mh));
  }
  return null;
}
function estimatePrizeNokLegacy(p,l){
  if(!p)return 0;
  if(p.name.includes('ДЖЕКПОТ'))return l.combos>200000000?50000000:l.combos>100000000?25000000:10000000;
  if(l.officialGame==='lotto'){
    if(p.name.includes('6+tillegg'))return 500000;
    if(p.name.includes('6 rette'))return 70000;
    if(p.name.includes('5 rette'))return 1200;
    if(p.name.includes('4 rette'))return 50;
  }
  if(l.officialGame==='vikinglotto'){
    if(p.name.includes('6+0'))return 500000;
    if(p.name.includes('5+1'))return 25000;
    if(p.name.includes('5+0'))return 2500;
    if(p.name.includes('4 rette'))return 250;
    if(p.name.includes('3 rette'))return 50;
  }
  if(l.officialGame==='eurojackpot all'){
    if(p.name.startsWith('12-й'))return 75;
    if(p.name.startsWith('11-й'))return 100;
    if(p.name.startsWith('10-й'))return 130;
    if(p.name.startsWith('9-й'))return 180;
    if(p.name.startsWith('8-й'))return 250;
    if(p.name.startsWith('7-й'))return 500;
    if(p.name.startsWith('6-й'))return 1200;
    if(p.name.startsWith('5-й'))return 3500;
    if(p.name.startsWith('4-й'))return 60000;
    if(p.name.startsWith('3-й'))return 180000;
    if(p.name.startsWith('2-й'))return 1000000;
  }
  if(p.lvl>=6)return 1000000;
  if(p.lvl>=5)return 50000;
  if(p.lvl>=4)return 1000;
  if(p.lvl>=3)return 100;
  return 0;
}
function checkPrize(m,b,dM,dB,l){
  const mh=m.filter(n=>dM.includes(n)).length,bh=b.filter(n=>dB.includes(n)).length;
  const addition=dB.length>0&&m.some(n=>dB.includes(n));
  const P=(key,name,lvl)=>({key,name,lvl});
  const id=l.id||'';
  if(id==='lotto'){
    if(mh===7)return P('7','ДЖЕКПОТ 🏆',7);
    if(mh===6&&addition)return P('6+1','2-й приз · 6+tillegg',6);
    if(mh===6)return P('6','3-й приз · 6 rette',5);
    if(mh===5)return P('5','4-й приз · 5 rette',4);
    if(mh===4)return P('4','5-й приз · 4 rette',3);
  }else if(id==='viking'){
    if(mh===6&&bh===1)return P('6+1','ДЖЕКПОТ 🏆',7);
    if(mh===6)return P('6+0','2-й приз · 6+0',6);
    if(mh===5&&bh===1)return P('5+1','3-й приз · 5+1',5);
    if(mh===5)return P('5+0','4-й приз · 5+0',4);
    if(mh===4)return P('4','5-й приз · 4 rette',3);
    if(mh===3)return P('3','6-й приз · 3 rette',2);
  }else if(id==='euro'||id==='euromillions'){
    const names={'5+2':['ДЖЕКПОТ 🏆',7],'5+1':['2-й приз · 5+1',6],'5+0':['3-й приз · 5+0',5],'4+2':['4-й приз · 4+2',4],'4+1':['5-й приз · 4+1',3],'3+2':['6-й приз · 3+2',2],'4+0':['7-й приз · 4+0',1],'2+2':['8-й приз · 2+2',1],'3+1':['9-й приз · 3+1',1],'3+0':['10-й приз · 3+0',1],'1+2':['11-й приз · 1+2',1],'2+1':['12-й приз · 2+1',1],'2+0':['13-й приз · 2+0',1]};
    const key=mh+'+'+bh,hit=names[key];
    if(hit&&(id==='euromillions'||key!=='2+0'))return P(key,hit[0],hit[1]);
  }else if(id==='powerball'||id==='mega'){
    const labels={'5+1':['ДЖЕКПОТ 🏆',7],'5+0':['2-й приз · 5+0',6],'4+1':['3-й приз · 4+1',5],'4+0':['4-й приз · 4+0',4],'3+1':['5-й приз · 3+1',3],'3+0':['6-й приз · 3+0',2],'2+1':['7-й приз · 2+1',1],'1+1':['8-й приз · 1+1',1],'0+1':['9-й приз · 0+1',1]};
    const key=mh+'+'+bh,hit=labels[key];if(hit)return P(key,hit[0],hit[1]);
  }else if(id==='superenalotto'){
    if(mh===6)return P('6','ДЖЕКПОТ 🏆',7);
    if(mh===5&&addition)return P('5+1','2-й приз · 5+Jolly',6);
    if(mh===5)return P('5+0','3-й приз · 5',5);
    if(mh===4)return P('4','4-й приз · 4',4);
    if(mh===3)return P('3','5-й приз · 3',3);
    if(mh===2)return P('2','6-й приз · 2',2);
  }else if(id==='lottomax'){
    const key=mh===7?'7':mh+'+'+(addition?1:0);
    const labels={'7':['ДЖЕКПОТ 🏆',7],'6+1':['2-й приз · 6+Bonus',6],'6+0':['3-й приз · 6/7',5],'5+1':['4-й приз · 5+Bonus',4],'5+0':['5-й приз · 5/7',3],'4+1':['6-й приз · 4+Bonus',2],'4+0':['7-й приз · 4/7',2],'3+1':['8-й приз · 3+Bonus',1],'3+0':['9-й приз · 3/7',1]};
    const hit=labels[key];if(hit)return P(key,hit[0],hit[1]);
  }else if(id==='powerballau'){
    const labels={'7+1':['ДЖЕКПОТ 🏆',7],'7+0':['2-й дивизион · 7+0',6],'6+1':['3-й дивизион · 6+PB',5],'6+0':['4-й дивизион · 6+0',4],'5+1':['5-й дивизион · 5+PB',3],'4+1':['6-й дивизион · 4+PB',2],'5+0':['7-й дивизион · 5+0',2],'3+1':['8-й дивизион · 3+PB',1],'2+1':['9-й дивизион · 2+PB',1]};
    const key=mh+'+'+bh,hit=labels[key];if(hit)return P(key,hit[0],hit[1]);
  }
  return null;
}
function megaMultiplier(){
  const r=Math.random()*32;
  return r<15?2:r<25?3:r<29?4:r<31?5:10;
}
/* Оценки указаны в валюте выбранной игры; для тиражных разрядов это ориентиры. */
function estimatePrizeNok(p,l,simulate=false){
  if(!p)return 0;
  const id=l.id||'',key=p.key||'';
  const tables={
    lotto:{'7':10000000,'6+1':500000,'6':70000,'6+0':70000,'5':1200,'4':50},
    viking:{'6+1':10000000,'6+0':500000,'5+1':25000,'5+0':2500,'4':250,'3':50},
    euro:{'5+2':100000000,'5+1':5000000,'5+0':1000000,'4+2':100000,'4+1':8000,'3+2':2500,'4+0':1500,'2+2':400,'3+1':300,'3+0':180,'1+2':120,'2+1':100},
    powerball:{'5+1':50000000,'5+0':1000000,'4+1':50000,'4+0':100,'3+1':100,'3+0':7,'2+1':7,'1+1':4,'0+1':4},
    mega:{'5+1':50000000,'5+0':1000000,'4+1':10000,'4+0':500,'3+1':200,'3+0':10,'2+1':10,'1+1':7,'0+1':5},
    euromillions:{'5+2':17000000,'5+1':150000,'5+0':15000,'4+2':1200,'4+1':120,'3+2':80,'4+0':40,'2+2':20,'3+1':15,'3+0':10,'1+2':9,'2+1':7,'2+0':4},
    superenalotto:{'6':2000000,'5+1':620000,'5+0':32000,'4':300,'3':25,'2':5},
    lottomax:{'7':10000000,'6+1':200000,'6+0':5000,'5+1':1000,'5+0':100,'4+1':50,'4+0':20,'3+1':20,'3+0':6},
    powerballau:{'7+1':3000000,'7+0':100000,'6+1':10000,'6+0':500,'5+1':200,'4+1':100,'5+0':60,'3+1':40,'2+1':15}
  };
  let value=tables[id]?.[key]||0;
  if(id==='mega'&&key!=='5+1'&&value)value*=simulate?megaMultiplier():3;
  return value;
}
function runLifeSim(){
  if(lifeRunning)return;
  const l=L(),out=document.getElementById('life-out');
  fillAll();
  const ticket=rows.filter(r=>r.m.length===l.pM&&(l.pBo===0||r.b.length===l.pBo)).map(r=>({m:[...r.m],b:[...r.b]}));
  if(!ticket.length){if(out)out.textContent='Нет заполненных рядов для симуляции.';return;}
  lifeRunning=true;
  const drawsPerWeek=Math.max(1,new Set(l.drawDays||[]).size);
  const drawsPerYear=52*drawsPerWeek,total=50*drawsPerYear,batch=50;
  let done=0,spent=0,won=0,best=0,hits=0;
  const wins=[],tierCnt={};
  const paint=(final)=>{
    const years=(done/drawsPerYear).toFixed(1),net=won-spent;
    let html=`<div class="life-big">${final?'Итог 50 лет с этими числами':'Прошло '+years+' лет...'}</div>
      <div class="life-stats">
        <div class="life-stat"><span>Потрачено</span><b>${fmtInt(spent)} ${l.currency||'NOK'}</b></div>
        <div class="life-stat"><span>Выиграно</span><b>${fmtInt(won)} ${l.currency||'NOK'}</b></div>
        <div class="life-stat"><span>Баланс</span><b style="color:${net>=0?'#34c759':'#ff3b30'}">${net>=0?'+':''}${fmtInt(net)} ${l.currency||'NOK'}</b></div>
        <div class="life-stat"><span>Праздников</span><b>${hits} 🎉</b></div>
      </div>`;
    if(final){
      /* золотой серпантин со звёздами — праздник самого путешествия */
      const FEST=['🎊','✨','⭐','🪙','🎉'];
      html='<div class="life-fest">'+Array.from({length:16},()=>{
        const e=FEST[Math.floor(Math.random()*FEST.length)];
        return '<span style="left:'+(Math.random()*96).toFixed(0)+'%;animation-duration:'+(1.6+Math.random()*2).toFixed(2)+'s;animation-delay:'+(Math.random()*1.5).toFixed(2)+'s;font-size:'+(12+Math.random()*10).toFixed(0)+'px">'+e+'</span>';
      }).join('')+'</div>'+html;
      const top=[...wins].sort((a,b)=>b.v-a.v).slice(0,5);
      if(top.length){
        html+='<div class="life-sec">✨ Лучшие моменты этой жизни</div>'+top.map((w,i)=>
          `<div class="life-moment"><div class="life-yr">${['🥇','🥈','🥉','🎖','🎖'][i]} Год ${Math.max(1,Math.round(w.yr))}:</div><div class="life-mname">${w.name}</div><div class="life-mv">+${fmtInt(w.v)} ${l.currency||'NOK'}</div></div>`).join('');
        const tiers=Object.entries(tierCnt).sort((a,b)=>b[1]-a[1]);
        html+='<div class="life-sec">Все выигрыши за 50 лет</div><div class="life-tiers">'+tiers.map(([n,c])=>`<span class="life-tier">${n} × ${c}</span>`).join('')+'</div>';
      }
      /* честная надежда: реальный шанс джекпота именно этих рядов за эти 50 лет */
      const pOne=1/jackpotCombos(l);
      const pJack=1-Math.pow(1-pOne,total*ticket.length);
      const oneIn=Math.round(1/pJack);
      const pPct=pJack*100,pPctText=pPct<0.01?pPct.toFixed(4):pPct.toFixed(2);
      html+=`<div class="life-hope">💫 <b>А джекпот?</b> В этой симуляции он ${wins.some(w=>w.lvl>=7)?'ВЫПАЛ — в этой случайной серии произошло редкое событие.':'не выпал — это ожидаемый результат для большинства таких серий.'} Расчётный шанс получить его за эти 50 лет при ${ticket.length} ${ticket.length===1?'ряде':'рядах'}: <b>${pPctText}%</b> (примерно 1 к ${fmtInt(oneIn)}). Вероятность мала, но не равна нулю; симуляция не повышает вероятность реального выигрыша. 🌠</div>`;
      const perYear=Math.round(hits/50);
      html+=`<div class="life-note">${hits?('Среднее число выигрышей в год: '+(perYear>0?perYear:hits)+'. Маленькие события появлялись регулярно. '):''}${net<0?'Но баланс честный: лотерея за 50 лет почти всегда в минусе и не является источником дохода. Устанавливай заранее небольшой лимит расходов. 💛':'Невероятно: ты в плюсе! Это исключение из правил — один случай на тысячи таких серий. 🍀'}</div>`;
    }else html+=`<div style="margin-top:8px">Лучший приз пока: ${fmtInt(best)} ${l.currency||'NOK'} · рядов: ${ticket.length}</div>`;
    out.innerHTML=html;
  };
  const step=()=>{
    for(let x=0;x<batch&&done<total;x++,done++){
      const dM=rnd(l.mB,l.pM),dB=drawnBonusCount(l)>0?rnd(l.bB,drawnBonusCount(l)):[];
      spent+=ticket.length*l.price;
      ticket.forEach(row=>{
        const p=checkPrize(row.m,row.b,dM,dB,l),v=estimatePrizeNok(p,l,true);
        if(v>0){won+=v;hits++;best=Math.max(best,v);wins.push({yr:done/drawsPerYear,name:p.name,v,lvl:p.lvl});tierCnt[p.name]=(tierCnt[p.name]||0)+1;}
      });
    }
    paint(done>=total);
    if(done<total)setTimeout(step,12);
    else{
      lifeRunning=false;
      const jack=wins.find(w=>w.lvl>=7);
      const big=wins.filter(w=>w.lvl>=6).sort((a,b)=>b.v-a.v)[0];
      if(jack)setTimeout(()=>CELE_show('🏆 ДЖЕКПОТ ЗА 50 ЛЕТ!','На году '+Math.max(1,Math.round(jack.yr))+' эти числа взяли '+jack.name+'!\n+'+fmtInt(jack.v)+' '+(l.currency||'NOK')+'\nЖизнь изменилась бы навсегда. 🌟'),400);
      else if(big)setTimeout(()=>CELE_show('💎 КРУПНЫЙ ПРИЗ В СИМУЛЯЦИИ','Год '+Math.max(1,Math.round(big.yr))+': '+big.name+' · +'+fmtInt(big.v)+' '+(l.currency||'NOK')+'\nЭто редкий случайный результат, а не прогноз. ✨'),400);
    }
  };
  paint(false);
  step();
}

// ═══════════════════════════════════════════════
//  CHECK REAL TICKET
// ═══════════════════════════════════════════════
function buildCheckFields(){
  const l=L();
  const dBo=drawBonusCount(l);
  document.getElementById('chk-lbl-m').textContent=`Выпавшие главные числа (${l.pM} из ${l.mB})`;
  const mi=document.getElementById('chk-main-inp');mi.innerHTML='';mi.className=`check-inp-row ticket-count-${l.pM}`;
  for(let i=0;i<l.pM;i++){
    const inp=document.createElement('input');
    inp.type='number';inp.min=1;inp.max=l.mB;inp.className='binp';inp.placeholder='—';inp.id='chk-m'+i;
    inp.oninput=()=>{const v=+inp.value;inp.className='binp'+(v>=1&&v<=l.mB?' fm-'+l.cls:'');};
    mi.appendChild(inp);
  }
  const bw=document.getElementById('chk-bonus-wrap'),bi=document.getElementById('chk-bonus-inp');bi.innerHTML='';bi.className=`check-inp-row ticket-count-${dBo}`;
  if(dBo>0){
    bw.style.display='';
    document.getElementById('chk-lbl-b').textContent=`${bonusLabel(l)} (${dBo} из ${l.bB})`;
    for(let i=0;i<dBo;i++){
      const inp=document.createElement('input');
      inp.type='number';inp.min=1;inp.max=l.bB;inp.className='binp';inp.placeholder='—';inp.id='chk-b'+i;
      inp.oninput=()=>{const v=+inp.value;inp.className='binp'+(v>=1&&v<=l.bB?' fb-'+l.cls:'');};
      bi.appendChild(inp);
    }
  }else bw.style.display='none';
  document.getElementById('chk-result').innerHTML='';
}

function checkTicket(){
  const l=L();
  const dBo=drawBonusCount(l);
  const dM=[];
  for(let i=0;i<l.pM;i++){
    const v=+document.getElementById('chk-m'+i).value;
    if(!v||v<1||v>l.mB){showFeedback('Проверьте число',`Главное число ${i+1}: введите от 1 до ${l.mB}.`,'⚠️',3200);return;}
    if(dM.includes(v)){showFeedback('Повтор числа',`Число ${v} повторяется.`,'⚠️',2800);return;}
    dM.push(v);
  }
  dM.sort((a,b)=>a-b);
  const dB=[];
  if(dBo>0){
    for(let i=0;i<dBo;i++){
      const v=+document.getElementById('chk-b'+i).value;
      if(!v||v<1||v>l.bB){showFeedback('Проверьте бонус',`Бонус ${i+1}: введите от 1 до ${l.bB}.`,'⚠️',3200);return;}
      if(dB.includes(v)){showFeedback('Повтор бонуса',`Бонус ${v} повторяется.`,'⚠️',2800);return;}
      dB.push(v);
    }
    dB.sort((a,b)=>a-b);
  }
  fillAll();
  showBanner(dM,dB);
  // scroll to banner
  document.getElementById('win-banner').scrollIntoView({behavior:'smooth'});
  document.getElementById('chk-result').innerHTML=`<div style="color:#34c759;font-size:13px;font-weight:600;margin-top:6px">✅ Проверка выполнена — смотри баннер выше</div>`;
}
async function renderSavedDrawOptions(){
  const sel=document.getElementById('saved-draw-select');
  if(!sel)return;
  const draws=await loadD(cur);
  const prev=sel.value;
  sel.innerHTML='<option value="">Выбрать сохранённый тираж</option>';
  draws.slice(0,80).forEach(d=>{
    const opt=document.createElement('option');
    opt.value=d.date;
    opt.textContent=`${d.date} · ${drawLotteryName(d,cur)}`;
    sel.appendChild(opt);
  });
  if([...sel.options].some(o=>o.value===prev))sel.value=prev;
}
async function checkAgainstSavedDraw(){
  const sel=document.getElementById('saved-draw-select'),out=document.getElementById('draw-check-out');
  const date=sel?.value;
  if(!date){if(out)out.textContent='Выберите тираж из базы.';return;}
  const draws=await loadD(cur),d=draws.find(x=>x.date===date);
  if(!d){if(out)out.textContent='Тираж не найден в базе.';await renderSavedDrawOptions();return;}
  fillAll();
  showBanner(d.main||[],d.bonus||[]);
  document.getElementById('win-banner').scrollIntoView({behavior:'smooth'});
  if(out)out.textContent=`Проверено против тиража ${date}: совпадения подсвечены в баннере, как в купоне Norsk Tipping.`;
  showFeedback('Проверено',`Тираж ${date}: совпадения подсвечены вверху, как в купоне Norsk Tipping.`,'🔍',2200);
}

// ═══════════════════════════════════════════════
//  FAVORITES
// ═══════════════════════════════════════════════
async function saveFav(){
  const l=L();
  fillAll();
  const favs=await loadFav();
  const name=`${l.name} · ${new Date().toLocaleDateString(appLocale())}`;
  favs.unshift({name,rows:normalizeGeneratedRows(rows,l).map(r=>({m:[...r.m],b:[...r.b]})),lot:cur});
  await saveFavs(favs.slice(0,10));
  await renderFavs();
  // Keep server-side saved-ticket watches in step if the user opted in.
  try{const st=window.LotoNotifications&&window.LotoNotifications.getState();if(st&&st.prefs.enabled&&st.prefs.saved_ticket_results)NOTIF_syncWatches(true);}catch(e){}
  showFeedback('Сохранено','Комбинации добавлены в Избранное и видны по этой ссылке.','⭐');
}

async function renderFavs(){
  const l=L(),favs=await loadFav(),c=document.getElementById('fav-list');
  const myFavs=favs.filter(f=>f.lot===cur);
  if(!myFavs.length){c.innerHTML='<div class="empty" style="padding:16px">Нет сохранённых</div>';return;}
  c.innerHTML='';
  let changed=false;
  myFavs.forEach((fav,fi)=>{
    const favIndex=favs.indexOf(fav);
    const displayRows=normalizeGeneratedRows(fav.rows,l);
    if(JSON.stringify(displayRows)!==JSON.stringify(fav.rows)){fav.rows=displayRows;changed=true;}
    const div=document.createElement('div');div.className='fav-item';
    let rowsH='';
    displayRows.forEach(row=>{
      let balls=row.m.map(n=>`<div class="hball ${l.cls}-m">${n}</div>`).join('');
      if(row.b&&row.b.length>0){balls+=`<div class="fav-sep" aria-hidden="true">|</div>`;balls+=row.b.map(n=>`<div class="hball ${l.cls}-b">${n}</div>`).join('');}
      rowsH+=`<div class="fav-rowballs">${balls}</div>`;
    });
    div.innerHTML=`<div class="fav-main"><div class="fav-name">${fav.name}</div><div class="fav-rows">${rowsH}</div></div>
      <div class="fav-actions">
        <button class="btn-fav-use" title="Загрузить" aria-label="Загрузить" data-loto-event-click="useFav(${favIndex})">▶</button>
        <button class="btn-fav-copy" title="Копировать" aria-label="Копировать" data-loto-event-click="copyFav(${favIndex},this)">📋</button>
        <button class="btn-fav-del" title="Удалить" aria-label="Удалить" data-loto-event-click="delFav(${favIndex})">🗑</button>
      </div>`;
    c.appendChild(div);
  });
  if(changed)await saveFavs(favs);
}

async function useFav(i){
  const favs=await loadFav();
  if(!favs[i])return;
  rows=normalizeGeneratedRows(favs[i].rows,L());
  act=0;renderSim();
  goToRows();resetBanner();
  showFeedback('Загружено','Комбинации из Избранного снова поставлены в симулятор.','✅');
}

async function copyFav(i,btn){
  const favs=await loadFav();
  if(!favs[i])return;
  const l=LOTS[favs[i].lot]||L();
  try{
    await writeClipboardText(rowsToShareText(favs[i].rows,l,favs[i].name));
    setCopyButtonState(btn);
    showCopyToast('Избранное скопировано');
  }catch(e){
    showFeedback('Не скопировано','Браузер запретил доступ к буферу обмена. Попробуйте ещё раз после разрешения.','⚠️',3400);
  }
}

async function delFav(i){
  if(!(await customConfirm('Удалить из избранного?','Удалить',{title:'Удалить комбинацию?'})))return;
  const favs=await loadFav();favs.splice(i,1);await saveFavs(favs);await renderFavs();
}

// ═══════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════
async function selAT(id){
  curAT=id;
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('vis'));
  document.getElementById('at-'+id).classList.add('vis');
  document.querySelectorAll('.st').forEach(t=>{t.classList.remove('on');t.setAttribute('aria-pressed','false');});
  const activeTab=document.getElementById('st-'+id);
  activeTab.classList.add('on');activeTab.setAttribute('aria-pressed','true');
  await renderAna();
}

async function renderAna(){
  updateAnaHdr();
  buildInpFields();await renderHistory();
  if(curAT==='freq'){await renderFreq();await renderSugg();await renderPairs();}
  if(curAT==='chi')await renderChi();
  if(curAT==='cmp'){renderComparison();renderROI();await renderJackpotChart();}
  if(curAT==='prize')await renderPrizes();
  if(curAT==='man'){renderCombinationAnalysis();await renderMathCheck();await renderStats();}
}

function buildInpFields(){
  const l=L();
  const dBo=drawBonusCount(l);
  if(!document.getElementById('inp-date').value)document.getElementById('inp-date').valueAsDate=new Date();
  document.getElementById('lbl-m-inp').textContent=`Главные числа (${l.pM}) — 1 до ${l.mB}`;
  document.getElementById('btn-add-draw').className='btn-draw '+l.cls;
  document.getElementById('official-btn').className='btn-draw '+l.cls;
  const mi=document.getElementById('inp-main');mi.innerHTML='';
  for(let i=0;i<l.pM;i++){
    const inp=document.createElement('input');inp.type='number';inp.min=1;inp.max=l.mB;inp.className='binp';inp.placeholder='—';inp.id='bm'+i;
    inp.oninput=()=>{const v=+inp.value;inp.className='binp'+(v>=1&&v<=l.mB?' fm-'+l.cls:'');};
    mi.appendChild(inp);
  }
  const bw=document.getElementById('inp-bwrap'),bi=document.getElementById('inp-bonus');bi.innerHTML='';
  if(dBo>0){bw.style.display='';document.getElementById('lbl-b-inp').textContent=bonusLabel(l)+` (${dBo}) — 1 до ${l.bB}`;
    for(let i=0;i<dBo;i++){const inp=document.createElement('input');inp.type='number';inp.min=1;inp.max=l.bB;inp.className='binp';inp.placeholder='—';inp.id='bb'+i;inp.oninput=()=>{const v=+inp.value;inp.className='binp'+(v>=1&&v<=l.bB?' fb-'+l.cls:'');};bi.appendChild(inp);}
  }else bw.style.display='none';
  buildPayoutInp();
}

function togglePayoutInp(){
  const w=document.getElementById('payout-inp-wrap'),ic=document.getElementById('payout-toggle-icon');
  const show=w.style.display==='none';
  w.style.display=show?'':'none';
  ic.textContent=show?'▴':'▾';
}

function buildPayoutInp(){
  const l=L(),w=document.getElementById('payout-inp-wrap');
  w.innerHTML='';
  getPrizeTiers(l).forEach((t,i)=>{
    const row=document.createElement('div');row.className='payout-row';
    row.innerHTML=`
      <div class="payout-match">${t.label}</div>
      <input type="number" class="payout-inp" placeholder="Приз, NOK" id="pt-prize-${i}">
      <input type="number" class="payout-inp payout-winners" placeholder="Побед." id="pt-winners-${i}">`;
    w.appendChild(row);
  });
}

function readPayoutInp(){
  const l=L();
  const tiers=[];
  getPrizeTiers(l).forEach((t,i)=>{
    const prizeEl=document.getElementById('pt-prize-'+i),winEl=document.getElementById('pt-winners-'+i);
    const prize=prizeEl?prizeEl.value.trim():'';
    const win=winEl?winEl.value.trim():'';
    if(prize!==''||win!==''){
      tiers.push({match:t.match,label:t.label,prizeNOK:prize!==''?+prize:null,winners:win!==''?+win:null});
    }
  });
  return tiers.length?tiers:null;
}

function clearPayoutInp(){
  document.querySelectorAll('.payout-inp').forEach(i=>i.value='');
}

// ─── OFFICIAL RESULTS IMPORTS ────────────
function getOfficialProvider(id){
  const l=LOTS[id];
  if(!l)return null;
  return l.officialProvider||(l.officialGame?'norsk':null);
}
function officialSourceName(l=L()){
  return l.officialSourceName||(l.officialGame?'Norsk Tipping':l.name);
}
function ymd(date){
  const d=new Date(date);
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function officialApiUrl(id){
  const l=LOTS[id],to=new Date(),from=new Date();
  if(!l.officialGame)throw new Error(`${l.name}: официальный импорт не подключён`);
  to.setDate(to.getDate()+1);
  from.setDate(from.getDate()-105); // Norsk Tipping exposes lottery results about 15 weeks back.
  return `https://api.norsk-tipping.no/LotteryGameInfo/v2/api/results/${encodeURIComponent(l.officialGame)}?fromDate=${ymd(from)}&toDate=${ymd(to)}`;
}
function socrataApiUrl(id){
  const resource=id==='powerball'?'d6yy-54nr':'5xaw-6ayf';
  const params=new URLSearchParams({'$limit':'80','$order':'draw_date DESC'});
  return `https://data.ny.gov/resource/${resource}.json?${params}`;
}
function showOfficialStatus(msg){
  const el=document.getElementById('official-status');
  if(!el)return;
  el.style.display='';
  el.textContent=msg;
}
function parseNok(v){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?Math.round(n):null;
}
function parseNumberString(s){
  return String(s||'').trim().split(/\s+/).map(n=>+n).filter(Number.isInteger);
}
function officialTierMatch(name,id){
  const s=String(name||'').toLowerCase().replace(/\s+/g,'').replace(/rette/g,'');
  if(id==='lotto'){
    if(s==='7')return'7';
    if(s==='6+1')return'6+1';
    if(s==='6')return'6';
    if(s==='5')return'5';
    if(s==='4')return'4';
  }
  if(id==='viking'){
    if(s==='6+1')return'6+1';
    if(s==='6+0')return'6+0';
    if(s==='5+1')return'5+1';
    if(s==='5+0')return'5+0';
    if(s==='4')return'4';
    if(s==='3')return'3';
  }
  if(id==='euro'&&/^\d\+\d$/.test(s))return s;
  return s;
}
function normalizeOfficialDraw(raw,id){
  const l=LOTS[id];
  const tiers=getPrizeTiers(l);
  const nums=Array.isArray(raw.winnerNumber)?raw.winnerNumber:[];
  const main=uniqValid(nums.filter(n=>+n.type===1).map(n=>+n.number),l.mB);
  const bonus=uniqValid(nums.filter(n=>+n.type===2).map(n=>+n.number),l.bB);
  const firstPrize=(raw.prize||[])[0]||{};
  const jackpotNok=parseNok(firstPrize.jackpotAmount)||parseNok(firstPrize.value)||null;
  const payoutTiers=(raw.prize||[]).map(p=>{
    const match=officialTierMatch(p.name,id);
    const known=tiers.find(t=>t.match===match);
    return{match,label:known?known.label:String(p.name||match),prizeNOK:parseNok(p.value),winners:parseNok(p.winners)};
  }).filter(t=>tiers.some(x=>x.match===t.match));
  return{
    date:String(raw.drawDate||'').slice(0,10),
    main,
    bonus,
    jackpot:jackpotNok?Math.round(jackpotNok/100000)/10:null,
    payoutTiers:payoutTiers.length?payoutTiers:null,
    lotteryId:id,
    lotteryName:lotteryName(id),
    source:'Norsk Tipping',
    sourceUrl:l.officialUrl,
    drawId:raw.drawId??null,
    drawName:raw.drawName||'',
    importedAt:new Date().toISOString()
  };
}
function normalizeSocrataDraw(raw,id){
  const l=LOTS[id];
  const nums=parseNumberString(raw.winning_numbers);
  const main=id==='powerball'?nums.slice(0,5):nums;
  const bonus=id==='powerball'?nums.slice(5,6):parseNumberString(raw.mega_ball);
  return{
    date:String(raw.draw_date||'').slice(0,10),
    main:uniqValid(main,l.mB),
    bonus:uniqValid(bonus,l.bB),
    jackpot:null,
    payoutTiers:null,
    lotteryId:id,
    lotteryName:lotteryName(id),
    source:officialSourceName(l),
    sourceUrl:l.officialUrl,
    drawId:raw.draw_date||null,
    importedAt:new Date().toISOString()
  };
}
function normalizeTheLottDraw(raw,id){
  const l=LOTS[id],tiers=getPrizeTiers(l);
  const payoutTiers=(raw.Dividends||[]).map(d=>{
    const idx=Math.max(0,(+d.Division||1)-1);
    const tier=tiers[idx]||{match:String(d.Division),label:`Division ${d.Division}`};
    return{
      match:tier.match,
      label:tier.label,
      prizeNOK:parseNok(d.BlocDividend),
      winners:parseNok(d.BlocNumberOfWinners)
    };
  }).filter(t=>t.prizeNOK!==null||t.winners!==null);
  return{
    date:String(raw.DrawDate||'').slice(0,10),
    main:uniqValid(raw.PrimaryNumbers||[],l.mB),
    bonus:uniqValid(raw.SecondaryNumbers||[],l.bB),
    jackpot:null,
    payoutTiers:payoutTiers.length?payoutTiers:null,
    lotteryId:id,
    lotteryName:lotteryName(id),
    source:officialSourceName(l),
    sourceUrl:l.officialUrl,
    drawId:raw.DrawNumber??null,
    drawName:raw.DrawDisplayName||'',
    importedAt:new Date().toISOString()
  };
}
function validateDrawRecord(d,id,official=false){
  const l=LOTS[id],errs=[];
  const expBonus=official?(l.offBo||l.pBo):l.pBo;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))errs.push('дата');
  if(!Array.isArray(d.main)||d.main.length!==l.pM)errs.push(`главных ${Array.isArray(d.main)?d.main.length:0}/${l.pM}`);
  if((new Set(d.main||[])).size!==(d.main||[]).length)errs.push('дубли главных');
  if((d.main||[]).some(n=>!Number.isInteger(n)||n<1||n>l.mB))errs.push('диапазон главных');
  if(expBonus>0){
    if(!Array.isArray(d.bonus)||d.bonus.length!==expBonus)errs.push(`бонус ${Array.isArray(d.bonus)?d.bonus.length:0}/${expBonus}`);
    if((new Set(d.bonus||[])).size!==(d.bonus||[]).length)errs.push('дубли бонусных');
    if((d.bonus||[]).some(n=>!Number.isInteger(n)||n<1||n>l.bB))errs.push('диапазон бонусных');
  }
  return errs;
}
/* Только прямой запрос к allowlisted официальному API. Публичные CORS-прокси
   запрещены; при CORS используется контролируемая общая база/backend. */
async function fetchJsonResilient(url,init){
  const attempts=[];
  const tryFetch=async(u,opts)=>{
    const res=await fetch(u,opts);
    if(!res.ok)throw new Error('HTTP '+res.status);
    return res.json();
  };
  /* 1) напрямую */
  try{return await tryFetch(url,init);}catch(e){attempts.push('直:'+e.message);}
  throw new Error('источник недоступен из этой среды. База проекта обновляется автоматическим серверным процессом; этот предпросмотр блокирует внешние запросы.');
}
async function fetchOfficialDraws(id){
  const provider=getOfficialProvider(id);
  if(provider==='norsk'){
    const data=await fetchJsonResilient(officialApiUrl(id),{cache:'no-store',mode:'cors'});
    if(!data||!Array.isArray(data.gameResult))throw new Error(`${LOTS[id].name}: неожиданный формат API`);
    return data.gameResult.map(d=>normalizeOfficialDraw(d,id));
  }
  if(provider==='socrata-powerball'||provider==='socrata-mega'){
    const data=await fetchJsonResilient(socrataApiUrl(id),{cache:'no-store',mode:'cors'});
    if(!Array.isArray(data))throw new Error(`${LOTS[id].name}: неожиданный формат NY Open Data`);
    return data.map(d=>normalizeSocrataDraw(d,id));
  }
  if(provider==='thelott-powerball-au'){
    const data=await fetchJsonResilient('https://data.api.thelott.com/sales/vmax/web/data/lotto/latestresults',{
      method:'POST',
      cache:'no-store',
      mode:'cors',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({CompanyId:'GoldenCasket',MaxDrawCount:80,OptionalProductFilter:['Powerball']})
    });
    if(!data||!Array.isArray(data.DrawResults))throw new Error(`${LOTS[id].name}: неожиданный формат The Lott`);
    return data.DrawResults.filter(d=>d.ProductId==='Powerball').map(d=>normalizeTheLottDraw(d,id));
  }
  throw new Error(`${LOTS[id].name}: живой официальный импорт не подключён`);
}
function sameDrawCore(a,b){
  return JSON.stringify({date:a.date,main:a.main,bonus:a.bonus,payoutTiers:a.payoutTiers,jackpot:a.jackpot})===
    JSON.stringify({date:b.date,main:b.main,bonus:b.bonus,payoutTiers:b.payoutTiers,jackpot:b.jackpot});
}
async function importOfficial(id){
  const normalized=await fetchOfficialDraws(id);
  const valid=[],invalid=[];
  normalized.forEach(d=>{
    const errs=validateDrawRecord(d,id,true);
    if(errs.length)invalid.push({date:d.date,errs});
    else valid.push(d);
  });
  const old=await loadD(id);
  const {merged,added,updated,unchanged,preserved}=mergeDrawLists(old,valid);
  await saveD(id,merged);
  return{lot:id,added,updated,unchanged,preserved,invalid:invalid.length,total:valid.length,totalStored:merged.length,latest:valid[0]?.date||'—'};
}
async function importResultsJson(id){
  const rows=await loadHistoricalResults(id);
  const valid=[],invalid=[];
  rows.forEach(d=>{
    const normalized={...d,lotteryId:id,lotteryName:lotteryName(id),source:d.source||'results.json',sourceUrl:d.sourceUrl||LOTS[id].officialUrl};
    const errs=validateDrawRecord(normalized,id,true);
    if(errs.length)invalid.push({date:normalized.date,errs});
    else valid.push(normalized);
  });
  const old=await loadD(id);
  const {merged,added,updated,unchanged,preserved}=mergeDrawLists(old,valid);
  if(valid.length)await saveD(id,merged);
  return{lot:id,added,updated,unchanged,preserved,invalid:invalid.length,total:valid.length,totalStored:merged.length,latest:valid[0]?.date||'—',cached:true};
}
async function updateOfficialCurrent(){
  try{
    const provider=getOfficialProvider(cur),source=officialSourceName(L());
    const allowLive=window.LOTO_COMMERCIAL_CONFIG?.allowClientNetworkUpdates!==false;
    showOfficialStatus(provider&&allowLive?`Проверяю ${source} для ${L().name}…`:`Проверяю защищённую results.json для ${L().name}…`);
    const r=provider&&allowLive?await importOfficial(cur):await importResultsJson(cur);
    await renderHistory();
    renderHero();
    await renderSavedDrawOptions();
    if(curPage==='ana')await renderAna();
    const empty=r.total===0?' В results.json пока нет сохранённых тиражей для этой игры.':'';
    showOfficialStatus(`${L().name}: добавлено ${r.added}, обновлено ${r.updated}, без изменений ${r.unchanged}, архив сохранён ${r.preserved}. В базе всего ${r.totalStored}. Последний тираж: ${r.latest}.${r.invalid?` Отклонено некорректных: ${r.invalid}.`:''}${empty}`);
    showFeedback('Результаты обновлены',`${L().name}: все последние розыгрыши предоставлены.\nНовых: ${r.added} · обновлено: ${r.updated}\nПоследний тираж: ${r.latest}\nВ базе: ${r.totalStored}`,'✅',3200);
  }catch(e){
    showOfficialStatus(`Ошибка обновления: ${e.message}`);
    showFeedback('Не удалось обновить',`${e.message}`,'⚠️',4200);
  }
}
async function updateOfficialAll(quiet){
  try{
    if(!quiet)showOfficialStatus('Проверяю все источники: live-API и results.json…');
    const out=[];
    const allowLive=window.LOTO_COMMERCIAL_CONFIG?.allowClientNetworkUpdates!==false;
    for(const id of OFFICIAL_LOTS){
      try{out.push(getOfficialProvider(id)&&allowLive?await importOfficial(id):await importResultsJson(id));}
      catch(e){out.push({lot:id,error:e.message});}
    }
    await renderHistory();
    renderHero();
    await renderSavedDrawOptions();
    if(curPage==='ana')await renderAna();
    showOfficialStatus(out.map(r=>r.error?`${LOTS[r.lot].name}: ошибка ${r.error}`:`${LOTS[r.lot].name}: +${r.added}, ↻${r.updated}, =${r.unchanged}, архив ${r.preserved}, всего ${r.totalStored}, последний ${r.latest}`).join(' · '));
    const okList=out.filter(r=>!r.error),addedTotal=okList.reduce((s,r)=>s+(r.added||0),0);
    if(!quiet){
      showFeedback('Все источники проверены',`Обновлено игр: ${okList.length} из ${out.length}.\nНовых тиражей всего: ${addedTotal}.\nВсе последние розыгрыши предоставлены.`,'✅',3400);
    }else if(addedTotal>0&&typeof showCopyToast==='function'){
      showCopyToast(`🔄 Тиражи обновлены автоматически: +${addedTotal}`);
    }
    return{ok:okList.length,added:addedTotal};
  }catch(e){
    showOfficialStatus(`Ошибка обновления: ${e.message}`);
    if(!quiet)showFeedback('Не удалось обновить',`${e.message}`,'⚠️',4200);
    return null;
  }
}
/* автообновление при открытии: не чаще одного раза в 6 часов, тихо в фоне */
async function autoUpdateOnOpen(){
  setTimeout(autoCheckFavorites,1500);
  if(window.LOTO_COMMERCIAL_CONFIG?.allowClientNetworkUpdates===false)return;
  try{
    const last=+localStorage.getItem('loto_autoupd')||0;
    if(Date.now()-last<6*3600*1000)return;
    localStorage.setItem('loto_autoupd',String(Date.now()));
    await updateOfficialAll(true);
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(autoUpdateOnOpen,2500);setTimeout(renderHero,300);});
async function openSourceInfo(){
  const l=L();
  let cnt=0,last='—';
  try{const d=await loadD(cur);cnt=(d||[]).length;if(d&&d[0]&&d[0].date)last=d[0].date;}catch(e){}
  const archive=await loadArchivePackage(cur).catch(()=>({draws:[],eras:[],updatedAt:''}));
  const provider=getOfficialProvider(cur);
  const status=provider?'Живое обновление подключено':'Локальная база (results.json)';
  const rows=[
    ['Оператор',l.officialSourceName||'—'],
    ['Лотерея',l.short||l.name],
    ['Текущие правила',String(cnt)+' тиражей'],
    ['Полный архив',String(archive.draws.length||cnt)+' тиражей'],
    ['Исторических версий правил',String(archive.eras.length||1)],
    ['Последнее обновление',last],
    ['Статус источника',status]
  ].map(r=>`<div class="src-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  document.getElementById('src-body').innerHTML=rows+
    '<div class="src-note">Текущая матрица используется в моделях и симуляциях. Более старые тиражи показываются и считаются отдельно по историческим версиям правил.</div>';
  document.getElementById('src-ov').classList.add('show');
}
function closeSourceInfo(){document.getElementById('src-ov').classList.remove('show');}
function openAbout(){
  const v=window.LOTO_VERSION;
  if(v){document.querySelectorAll('[data-app-version]').forEach(el=>{el.textContent=v.display;});const av=document.getElementById('about-version');if(av)av.textContent=v.display;}
  if(window.LotoModals)window.LotoModals.openModal('about-ov');else document.getElementById('about-ov')?.classList.add('show');
  document.getElementById('about-btn')?.setAttribute('aria-expanded','true');
}
function closeAbout(){if(window.LotoModals)window.LotoModals.closeModal('about-ov');else document.getElementById('about-ov')?.classList.remove('show');document.getElementById('about-btn')?.setAttribute('aria-expanded','false');}
window.openAbout=openAbout;window.closeAbout=closeAbout;
async function openOfficialResults(){
  const url=L().officialUrl;
  if(!url)return;
  closeSourceInfo();
  const ok=await customConfirm('Вы переходите на внешний официальный источник опубликованных результатов.','Перейти');
  if(ok)window.open(url,'_blank','noopener');
}

async function addDraw(){
  const l=L();
  const dBo=drawBonusCount(l);
  const date=document.getElementById('inp-date').value;
  if(!date){showFeedback('Нужна дата','Введите дату тиража.','⚠️',2800);return;}
  const main=[];
  for(let i=0;i<l.pM;i++){const v=+document.getElementById('bm'+i).value;if(!v||v<1||v>l.mB){showFeedback('Проверьте число',`Главное число ${i+1}: 1–${l.mB}.`,'⚠️',3200);return;}if(main.includes(v)){showFeedback('Повтор числа',`Число ${v} повторяется.`,'⚠️',2800);return;}main.push(v);}
  main.sort((a,b)=>a-b);
  const bonus=[];
  if(dBo>0){for(let i=0;i<dBo;i++){const v=+document.getElementById('bb'+i).value;if(!v||v<1||v>l.bB){showFeedback('Проверьте бонус',`Бонус ${i+1}: 1–${l.bB}.`,'⚠️',3200);return;}if(bonus.includes(v)){showFeedback('Повтор бонуса',`Бонус ${v} повторяется.`,'⚠️',2800);return;}bonus.push(v);}bonus.sort((a,b)=>a-b);}
  const jackpot=parseFloat(document.getElementById('inp-jackpot').value)||null;
  const payoutTiers=readPayoutInp();
  const draws=await loadD(cur);
  const ex=draws.findIndex(d=>d.date===date);
  if(ex>=0){if(!(await customConfirm(`Тираж ${date} уже есть. Заменить?`)))return;draws.splice(ex,1);}
  draws.push({date,main,bonus,jackpot,payoutTiers,lotteryId:cur,lotteryName:lotteryName(cur)});draws.sort((a,b)=>b.date.localeCompare(a.date));
  await saveD(cur,draws);
  document.querySelectorAll('.binp').forEach(i=>{i.value='';i.className='binp';});
  document.getElementById('inp-jackpot').value='';
  clearPayoutInp();
  await renderHistory();
  await renderSavedDrawOptions();
}

function renderRuleSummary(draws,eras,currentCount){
  if(!eras.length)return'<div class="rule-era"><b>Текущая база</b>Исторические версии правил для этого источника не заявлены.</div>';
  const blocks=eras.map(era=>{
    const count=draws.filter(draw=>ruleEraForDraw(draw,eras)?.id===era.id).length;
    const range=escapeHtml(era.from)+(era.to?' — '+escapeHtml(era.to):' — сейчас');
    return`<div class="rule-era"><b>${era.current?'Текущие правила':'Изменённые старые правила'} · ${escapeHtml(era.label)}</b>${range} · ${count} тиражей</div>`;
  }).join('');
  return`<div class="rule-era"><b>Как используется архив</b>Показано ${draws.length} тиражей. Математические модели используют только ${currentCount} совместимых с сегодняшними правилами; старые эпохи считаются и показываются отдельно.</div>${blocks}`;
}

// ── Canonical deletion policy (single source of truth for every platform) ──
// An archive draw is OFFICIAL when it carries a source (imported from results.json
// or a named operator feed) — the user never created it, so it must never be
// deletable. Manually added draws (addDraw) are stored WITHOUT a source and ARE
// user-owned, so they stay deletable. Used by both the render (no delete control is
// even created for official draws) and delDraw (re-checks before mutating).
function isOfficialDraw(d){
  if(!d)return false;
  if(d.isOfficialDraw===true)return true;
  const s=String(d.source||'').trim().toLowerCase();
  return s!==''&&s!=='user'&&s!=='manual'&&s!=='custom'&&s!=='вручную';
}
function canDeleteItem(item,ctx){
  ctx=ctx||{};
  if(!item)return false;
  if(isOfficialDraw(item))return false;                        // official draws: never deletable, on any platform
  return ctx.currentDates?ctx.currentDates.has(item.date):(item.isUserOwned===true); // only user-owned entries
}
async function renderHistory(){
  const l=L(),pack=await loadFullHistory(cur),draws=pack.draws,eras=pack.eras;
  document.getElementById('hist-title').textContent=`История (${draws.length} всего · ${pack.currentCount} по текущим правилам)`;
  const summary=document.getElementById('hist-rule-summary');
  if(summary)summary.innerHTML=renderRuleSummary(draws,eras,pack.currentCount);
  const c=document.getElementById('hist-list');
  if(!draws.length){c.innerHTML='<div class="empty">📭 Тиражей нет</div>';return;}
  c.innerHTML='';
  const ms=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  draws.forEach(d=>{
    const div=document.createElement('div');div.className='hist-item';
    let balls=d.main.map(n=>`<div class="hball ${l.cls}-m">${n}</div>`).join('');
    let histBallCount=(d.main||[]).length,histSepCount=0;
    if(d.extraGroups&&d.extraGroups.length){
      d.extraGroups.forEach(group=>{
        histSepCount++;
        histBallCount+=(group.numbers||[]).length;
        balls+=`<div class="hist-sep">|</div><span class="hist-extra-label">${escapeHtml(group.label)}</span>`;
        balls+=(group.numbers||[]).map(n=>`<div class="hball ${l.cls}-b">${n}</div>`).join('');
      });
    }else if(d.bonus&&d.bonus.length){histSepCount=1;histBallCount+=d.bonus.length;balls+=`<div class="hist-sep">|</div>`;balls+=d.bonus.map(n=>`<div class="hball ${l.cls}-b">${n}</div>`).join('');}
    const[y,mo,dy]=d.date.split('-');
    const src=` · ${escapeHtml(drawLotteryName(d,cur))}`;
    const era=ruleEraForDraw(d,eras),isCurrent=era?.current??d.ruleEra!=='legacy';
    const badge=era?`<span class="rule-badge ${isCurrent?'current':''}" title="${escapeHtml(era.label)}">${isCurrent?'текущие правила':'старые правила'}</span>`:'';
    const canDelete=canDeleteItem(d,{currentDates:pack.currentDates});   // official draws → no delete control at all
    const action=canDelete?`<button class="btn-del" data-loto-event-click="delDraw('${d.date}')">🗑</button>`:'<span></span>';
    if(!canDelete)div.classList.add('no-action');
    const ballClass=histBallCount>=8?'hist-balls hist-many':'hist-balls';
    div.innerHTML=`<div class="hist-main"><div class="hist-date">${dy} ${ms[+mo-1]} ${y}${src}${badge}</div><div class="${ballClass}" style="--hist-ball-count:${Math.max(1,histBallCount)};--hist-sep-count:${histSepCount}">${balls}</div></div>${action}`;
    c.appendChild(div);
  });
  try{HIST_filter();}catch(e){}
}

async function delDraw(date){
  const draws=await loadD(cur);
  const item=draws.find(d=>d.date===date);
  // Defence in depth: even a direct/scripted call can never delete an official draw.
  if(item&&isOfficialDraw(item)){showFeedback('Официальный тираж','Официальные тиражи удалять нельзя.','🔒',2600);return;}
  if(!(await customConfirm(`Удалить тираж ${date}?`,'Удалить',{title:'Удалить тираж?'})))return;
  await saveD(cur,draws.filter(d=>d.date!==date));
  await renderHistory();
  await renderSavedDrawOptions();
}

function buildFreq(draws,key,maxN){
  const f=new Map();for(let i=1;i<=maxN;i++)f.set(i,0);
  draws.forEach(d=>(d[key]||[]).forEach(n=>f.set(n,(f.get(n)||0)+1)));return f;
}

const mColor=cls=>cls==='lotto'?'#cc2060':cls==='viking'?'#1e3fbe':'#7ecfc0';
const mText=cls=>cls==='euro'?'#1c1c1e':'#fff';
const bonusLabel=l=>l.bonusName|| (l.cls==='euro'?'Звёздные числа':l.cls==='lotto'?'Tilleggstall':'Vikingtall');
function buildGenericPrizeTiers(l){
  const out=[],seen=new Set();
  const add=(main,bonus=null,label=null)=>{
    if(!Number.isInteger(main)||main<0)return;
    const match=bonus===null?String(main):`${main}+${bonus}`;
    if(seen.has(match))return;
    seen.add(match);
    out.push({match,label:label||match});
  };
  if(l.pBo>0){
    for(let main=l.pM;main>=Math.max(0,l.pM-3);main--){
      for(let bonus=l.pBo;bonus>=0;bonus--)add(main,bonus);
    }
  }else{
    for(let main=l.pM;main>=Math.max(2,l.pM-4);main--)add(main,null,`${main} из ${l.pM}`);
  }
  return out.slice(0,12);
}
function getPrizeTiers(l=L()){
  return Array.isArray(l?.tiers)&&l.tiers.length?l.tiers:buildGenericPrizeTiers(l);
}
function comb(n,k){
  if(k<0||k>n)return 0;
  k=Math.min(k,n-k);
  let r=1;
  for(let i=1;i<=k;i++)r=r*(n-k+i)/i;
  return Math.round(r);
}
function jackpotCombos(l){
  return comb(l.mB,l.pM)*(l.pBo>0?comb(l.bB,l.pBo):1);
}
function tierProbability(l,match){
  const parts=String(match).split('+');
  const mm=Number(parts[0]),bb=parts.length>1?Number(parts[1]):null;
  if(!Number.isInteger(mm)||mm<0||mm>l.pM)return 0;
  const pMain=comb(l.pM,mm)*comb(l.mB-l.pM,l.pM-mm)/comb(l.mB,l.pM);
  if(l.pBo>0){
    if(bb===null)return pMain;
    if(!Number.isInteger(bb)||bb<0||bb>l.pBo)return 0;
    const pBonus=comb(l.pBo,bb)*comb(l.bB-l.pBo,l.pBo-bb)/comb(l.bB,l.pBo);
    return pMain*pBonus;
  }
  if(l.offBo>0&&bb!==null){
    const pExtra=(l.pM-mm)/Math.max(1,l.mB-l.pM);
    return pMain*(bb===1?pExtra:bb===0?1-pExtra:0);
  }
  if(l.id==='lotto'&&match==='6'){
    const pExtra=(l.pM-mm)/Math.max(1,l.mB-l.pM);
    return pMain*(1-pExtra);
  }
  return pMain;
}
function fmtInt(n){return Math.round(n).toLocaleString(appLocale());}
function fmtChance(n){return n>=1000000?(n/1000000).toFixed(n>=10000000?0:1).replace('.',',')+' млн':fmtInt(n);}

async function renderFreq(){
  const l=L(),draws=await loadD(cur);
  const dBo=drawBonusCount(l);
  const analysis=analyzeData(cur,draws);
  const mf=analysis.mainFrequency;
  renderHeatmap(mf,draws.length);
  renderFChart('fc-main',mf,l.mB,draws.length*l.pM,l.cls);
  if(dBo>0){document.getElementById('fc-bc').style.display='';document.getElementById('fc-bt').textContent='Частота '+bonusLabel(l);renderFChart('fc-bonus',analysis.extraFrequency,l.bB,draws.reduce((s,d)=>s+((d.bonus||[]).length),0),l.cls+'-b');}
  else document.getElementById('fc-bc').style.display='none';
  const hc=document.getElementById('hc-grid');
  if(draws.length<5){hc.innerHTML='<div class="empty" style="width:100%">Нужно мин. 5 тиражей</div>';return;}
  const sorted=[...mf.entries()].sort((a,b)=>b[1]-a[1]);
  const hot=sorted.slice(0,5),cold=sorted.slice(-5).reverse();
  const exp=(draws.length*l.pM/l.mB).toFixed(1);
  hc.innerHTML=`<div class="hc-col"><div class="hc-lbl hot">🔥 Горячие</div>${hot.map(([n,c])=>`<div class="hc-row"><div class="hc-ball" style="background:${mColor(l.cls)};color:${mText(l.cls)}">${n}</div><div style="font-size:11px;color:var(--sub2)"><b>${c}×</b> (ожид.${exp})</div></div>`).join('')}</div><div class="hc-col"><div class="hc-lbl cold">❄️ Холодные</div>${cold.map(([n,c])=>`<div class="hc-row"><div class="hc-ball" style="background:var(--bg3);color:var(--sub)">${n}</div><div style="font-size:11px;color:var(--sub2)"><b>${c}×</b> (ожид.${exp})</div></div>`).join('')}</div>`;
}
function heatColor(score){
  const s=Math.max(0,Math.min(1,score));
  const hue=210-(210*s);
  const light=48+(12*(1-Math.abs(s-.5)*2));
  return`hsl(${hue} 78% ${light}%)`;
}
function renderHeatmap(freq,drawCount){
  const l=L(),grid=document.getElementById('heatmap-grid');
  if(!grid)return;
  if(!drawCount){grid.innerHTML='<div class="empty">Нет данных</div>';return;}
  const vals=[...freq.values()],min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);
  grid.innerHTML='';
  freq.forEach((cnt,n)=>{
    const score=(cnt-min)/span;
    const btn=document.createElement('button');
    btn.className='heat-cell';
    btn.style.background=heatColor(score);
    btn.title=`${n}: ${cnt} раз`;
    btn.textContent=n;
    btn.onclick=()=>addHeatNumber(n);
    grid.appendChild(btn);
  });
}
function addHeatNumber(n){
  const l=L();
  if(curPage!=='sim')selPage('sim');
  let row=rows[act]||rows[0];
  if(!row||row.m.length>=l.pM){
    if(rows.length<MAX_ROWS){rows.push(nr());act=rows.length-1;row=rows[act];}
    else{act=0;row=rows[0];}
  }
  if(!row.m.includes(n)&&row.m.length<l.pM)row.m.push(n);
  row.m.sort((a,b)=>a-b);
  renderSim();
  const out=document.getElementById('heat-status');
  if(out)out.textContent=`Число ${n} добавлено в ряд ${act+1}. Готовый ряд можно сохранить в Избранное.`;
}

function renderFChart(elId,freq,maxN,total,cls){
  const el=document.getElementById(elId);el.innerHTML='';
  if(!total){el.innerHTML='<div class="empty">Нет данных</div>';return;}
  const mx=Math.max(...freq.values())||1;
  const mc=cls.includes('b')?'#f4a0b0':mColor(cls);
  freq.forEach((cnt,n)=>{
    const pct=(cnt/mx)*100;
    const color=cnt/total>1.3/maxN?'#ff3b30':cnt/total<0.7/maxN?'#4a7cf7':mc;
    const w=document.createElement('div');w.className='fbw';
    w.innerHTML=`<div class="fbar" style="height:${Math.max(pct,2)}px;background:${color}" data-tip="${n}: ${cnt}×"></div><div class="fn">${n}</div>`;
    el.appendChild(w);
  });
}

async function renderSugg(){
  const l=L(),draws=await loadD(cur),c=document.getElementById('sugg-out');
  document.getElementById('sugg-warn').style.display='none';
  if(draws.length<10){c.innerHTML='<div class="empty">Нужно мин. 10 тиражей</div>';return;}
  document.getElementById('sugg-warn').style.display='';
  const freq=buildFreq(draws,'main',l.mB);
  const top=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>e[0]);
  let html='';
  for(let ci=0;ci<getGenCount();ci++){
    const pool=[...top];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const combo=pool.slice(0,l.pM).sort((a,b)=>a-b);
    html+=`<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--sub2);margin-bottom:6px">Вариант ${ci+1}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${combo.map(n=>`<div class="sg-cball" style="background:${mColor(l.cls)};color:${mText(l.cls)}">${n}</div>`).join('')}</div></div>`;
  }
  c.innerHTML=html;
}

// ─── PAIR ANALYSIS ────────────────────────────
async function renderPairs(){
  const l=L(),draws=await loadD(cur),c=document.getElementById('pair-out');
  if(draws.length<10){c.innerHTML='<div class="empty">Нужно мин. 10 тиражей</div>';return;}
  // Build co-occurrence for top 15 numbers
  const freq=buildFreq(draws,'main',l.mB);
  const top=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>e[0]).sort((a,b)=>a-b);
  const matrix={};
  top.forEach(a=>{matrix[a]={};top.forEach(b=>{matrix[a][b]=0;});});
  draws.forEach(d=>{
    const nums=d.main||[];
    for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++){
      const a=Math.min(nums[i],nums[j]),b=Math.max(nums[i],nums[j]);
      if(matrix[a]&&matrix[a][b]!==undefined)matrix[a][b]++;
    }
  });
  const maxVal=Math.max(...top.flatMap(a=>top.map(b=>a<b?matrix[a]?.[b]||0:0)));
  const heat=['var(--pair-heat0)','var(--pair-heat1)','var(--pair-heat2)','var(--pair-heat3)','var(--pair-heat4)'];
  const getColor=v=>{if(!v)return heat[0];const i=Math.min(4,Math.ceil(v/maxVal*4));return heat[i];};
  let html=`<div style="font-size:12px;color:var(--sub2);margin-bottom:8px">Топ-12 частых чисел · пары</div><div class="pair-wrap"><div class="pair-grid" style="grid-template-columns:22px ${top.map(()=>'22px').join(' ')}">`;
  // header row
  html+=`<div class="pair-axis"></div>${top.map(n=>`<div class="pair-axis">${n}</div>`).join('')}`;
  top.forEach(a=>{
    html+=`<div class="pair-axis">${a}</div>`;
    top.forEach(b=>{
      if(a===b){html+=`<div class="pair-cell" style="background:var(--border)"></div>`;}
      else{const v=a<b?(matrix[a]?.[b]||0):(matrix[b]?.[a]||0);html+=`<div class="pair-cell" style="background:${getColor(v)}" data-tip="${a}+${b}: ${v}×">${v>0?v:''}</div>`;}
    });
  });
  html+='</div></div>';
  c.innerHTML=html;
}

// ─── CHI2 ─────────────────────────────────────
async function renderChi(){
  const l=L(),draws=await loadD(cur),c=document.getElementById('chi-out');
  if(draws.length<10){c.innerHTML='<div class="empty">Нужно мин. 10 тиражей</div>';return;}
  const freq=buildFreq(draws,'main',l.mB);
  const obs=[...freq.values()],tot=obs.reduce((s,v)=>s+v,0),exp=tot/l.mB;
  const pearson=obs.reduce((s,o)=>s+Math.pow(o-exp,2)/exp,0);
  /* В одном тираже k чисел выбираются без возвращения. Обычная мультиномиальная
     χ² занижает статистику; ковариация простой случайной выборки даёт поправку
     (N−1)/(N−k), после которой асимптотически получаем χ²(N−1). */
  const correction=(l.mB-1)/(l.mB-l.pM);
  const chi2=pearson*correction;
  const df=l.mB-1,p=chi2pvalue(chi2,df);
  const pos=POSQ_audit(draws,l);
  let css,icon,verdict;
  if(p>0.05){css='ok';icon='✅';verdict='Значимого отклонения не обнаружено';}
  else if(p>0.01){css='warn';icon='⚠️';verdict='Пограничное отклонение частот';}
  else{css='fail';icon='🚨';verdict='Статистически значимое отклонение';}
  c.innerHTML=`<div class="chi2-box ${css}"><div class="chi2-icon">${icon}</div><div class="chi2-title">${verdict}</div><div class="chi2-desc">На основе ${draws.length} тиражей</div></div>
  <div class="srow"><span>χ² с поправкой без возвращения:</span><span>${chi2.toFixed(3)}</span></div>
  <div class="srow"><span>Исходная Pearson χ²:</span><span>${pearson.toFixed(3)}</span></div>
  <div class="srow"><span>Степени свободы:</span><span>${df}</span></div>
  <div class="srow"><span>p-value:</span><span>${p.toFixed(4)}</span></div>
  <div class="srow"><span>Ожид. частота:</span><span>${exp.toFixed(2)}</span></div>`;
  if(pos){
    const rowsT=pos.ybar.map((y,i)=>'<tr><td style="padding:3px 8px">Y('+(i+1)+')</td><td style="padding:3px 8px">'+pos.mu[i].toFixed(2)+'</td><td style="padding:3px 8px">'+y.toFixed(2)+'</td></tr>').join('');
    const verdict=pos.p>0.05?'не противоречит модели честного тиража ✅':(pos.p>0.01?'пограничное отклонение ⚠️':'сильное отклонение 🚨');
    c.innerHTML+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--srow-border)">'+
      '<div style="font-weight:900;font-size:13px">Позиционный аудит (Q-тест)</div>'+
      '<div style="font-size:11px;color:var(--sub2);margin:3px 0 8px">Многомерный тест средних позиций по Coronel-Brizio et al., arXiv:0806.4595: у честной '+pos.k+'/'+L().mB+' i-е по возрастанию число обязано иметь среднее (N+1)·i/(k+1).</div>'+
      '<table style="font-size:11.5px;border-collapse:collapse"><tr style="color:var(--sub2)"><td style="padding:3px 8px">Позиция</td><td style="padding:3px 8px">Теория</td><td style="padding:3px 8px">Факт ('+pos.m+' тир.)</td></tr>'+rowsT+'</table>'+
      '<div style="margin-top:8px;font-size:12.5px">Q = <b>'+pos.Q.toFixed(2)+'</b> · p = <b>'+(pos.p<0.0001?'<0.0001':pos.p.toFixed(4))+'</b> → '+verdict+'</div></div>';
  }
}

// ─── COMPARISON TABLE ─────────────────────────
function renderComparison(){
  const ids=Object.keys(LOTS);
  const formula=l=>`${l.pM} из ${l.mB}${l.pBo>0?` + ${l.pBo} из ${l.bB}`:''}`;
  const allCost=l=>jackpotCombos(l)*l.price;
  const rows2=[
    ['Название',...ids.map(id=>LOTS[id].name)],
    ['Формула',...ids.map(id=>formula(LOTS[id]))],
    ['Цена 1 ряда',...ids.map(id=>formatPrice(LOTS[id]))],
    ['Комбинаций',...ids.map(id=>fmtInt(jackpotCombos(LOTS[id])))],
    ['Шанс джекпота',...ids.map(id=>'1 : '+fmtChance(jackpotCombos(LOTS[id])))],
    ['День',...ids.map(id=>LOTS[id].day)],
    ['Дедлайн',...ids.map(id=>LOTS[id].dl)],
    ['Стоимость всех комбинаций',...ids.map(id=>'~'+fmtInt(allCost(LOTS[id])/1000000)+' млн '+(LOTS[id].currency||'NOK'))],
    ['Консервативный ориентир ×3',...ids.map(id=>'~'+fmtInt(allCost(LOTS[id])*3/1000000)+' млн '+(LOTS[id].currency||'NOK'))],
    ['Математика',...ids.map(id=>LOTS[id].combos===jackpotCombos(LOTS[id])?'✅ формула OK':'⚠️ проверить')],
  ];
  let html='<thead><tr>'+rows2[0].map((h,i)=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>';
  rows2.slice(1).forEach(row=>{
    html+='<tr>'+row.map((cell,i)=>{
      return`<td ${i===1?'class="cmp-best"':''}>${cell}</td>`;
    }).join('')+'</tr>';
  });
  html+='</tbody>';
  document.getElementById('cmp-table').innerHTML=html;
}

// ─── ROI ──────────────────────────────────────
function renderROI(){
  const c=document.getElementById('roi-out');
  const roi=loadROI(),currency=L().currency||'NOK';
  const net=roi.won-roi.spent;
  c.innerHTML=`<div class="roi-card">
    <div class="roi-card-title">💰 ROI · ${L().name}</div>
    <div class="roi-big ${net>=0?'roi-green':'roi-red'}">${net>=0?'+':''} ${net} ${currency}</div>
    <div class="roi-sub">${net>=0?'Чистая прибыль':'Чистый убыток'}</div>
    <div class="srow"><span>Потрачено (симул.):</span><span class="roi-red">${roi.spent} ${currency}</span></div>
    <div class="srow"><span>Выиграно:</span><span class="roi-green">${roi.won} ${currency}</span></div>
    <div style="margin-top:10px;font-size:11px;color:var(--sub2)">Трата симулируется автоматически. Введи выигрыши вручную:</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <input type="number" id="won-inp" placeholder="Сумма выигрыша ${currency}" class="num-inp" style="flex:1">
      <button data-loto-event-click="addWon()" style="padding:10px 14px;border-radius:10px;background:#34c759;color:#fff;border:none;font-weight:700;cursor:pointer;white-space:nowrap">+ Добавить</button>
    </div>
    <button data-loto-event-click="resetROI()" style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:none;background:var(--bg3);color:var(--sub);font-size:12px;cursor:pointer">Сбросить ROI</button>
  </div>`;
}

function addWon(){const v=+document.getElementById('won-inp').value;if(!v||v<0)return;const roi=loadROI();roi.won+=v;saveROI(roi);renderROI();}
async function resetROI(){if(!(await customConfirm('Сбросить ROI?')))return;saveROI({spent:0,won:0});renderROI();}

// ─── PRIZE TIERS (real payout data) ────────────
const prizeVisibleCounts={};
function prizeTierAmount(tier){return tier?.prizeAmount??tier?.prizeNOK??null;}
function escapePrizeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
async function showMorePrizes(){
  prizeVisibleCounts[cur]=(prizeVisibleCounts[cur]||15)+15;
  await renderPrizes();
}
async function renderPrizes(){
  const l=L();
  const outEl=document.getElementById('prize-out');
  const avgEl=document.getElementById('prize-avg-out');
  let publicRows=[],draws=[];
  try{
    [publicRows,draws]=await Promise.all([loadPublicPrizes(cur),loadD(cur)]);
  }catch(err){
    outEl.innerHTML=`<div class="empty">Не удалось загрузить официальные призовые данные<br><small style="font-size:11px;color:var(--sub)">${escapePrizeHtml(err.message||String(err))}</small></div>`;
    avgEl.innerHTML='<div class="empty">Нет данных</div>';
    return;
  }
  const drawByDate=new Map(draws.map(draw=>[draw.date,draw]));
  const withPayouts=publicRows.filter(d=>d.payoutTiers&&d.payoutTiers.length).map(prize=>({
    ...prize,
    main:drawByDate.get(prize.date)?.main||[],
    bonus:drawByDate.get(prize.date)?.bonus||[]
  }));
  const fmtDate=s=>new Intl.DateTimeFormat(appLocale(),{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${s}T00:00:00Z`));
  const fmtMoney=(v,currency=l.currency||'NOK')=>v===null||v===undefined?'—':new Intl.NumberFormat(appLocale(),{style:'currency',currency,maximumFractionDigits:Number(v)%1?2:0}).format(v);

  if(!withPayouts.length){
    outEl.innerHTML='<div class="empty">Официальная призовая таблица пока не опубликована источником<br><small style="font-size:11px;color:var(--sub)">Обновление выполняется автоматически после каждого тиража</small></div>';
    avgEl.innerHTML='<div class="empty">Нет данных</div>';
    return;
  }

  // per-draw cards
  let html='';
  const visible=prizeVisibleCounts[cur]||15;
  withPayouts.slice(0,visible).forEach(d=>{
    const currency=d.currency||l.currency||'NOK';
    let balls=(d.main||[]).map(n=>`<div class="hball ${l.cls}-m">${n}</div>`).join('');
    if(d.bonus&&d.bonus.length){balls+=`<div style="font-size:9px;opacity:.4;margin:0 2px">|</div>`;balls+=d.bonus.map(n=>`<div class="hball ${l.cls}-b">${n}</div>`).join('');}
    let rowsH='';
    d.payoutTiers.forEach(t=>{
      const known=getPrizeTiers(l).find(item=>item.match===t.match);
      const label=known?.label||t.label||t.match;
      const amount=prizeTierAmount(t);
      const isJackpot=t===d.payoutTiers[0];
      const isJackpotWon=isJackpot&&t.winners>0;
      rowsH+=`<div class="prize-tier-row">
        <div>
          <div class="prize-tier-name">${escapePrizeHtml(label)}${isJackpotWon?'<span class="prize-jackpot-badge">ДЖЕКПОТ</span>':''}</div>
          <div class="prize-tier-stat">${t.winners!==null?t.winners.toLocaleString(appLocale())+' побед.':'—'}</div>
        </div>
        <div class="prize-tier-amt">${fmtMoney(amount,currency)}${isJackpot&&t.winners===0?'<div style="font-size:9px;color:var(--sub)">не разыгран</div>':''}</div>
      </div>`;
    });
    html+=`<div class="prize-draw-card" data-draw-date="${escapePrizeHtml(d.date)}" data-draw-id="${escapePrizeHtml(d.drawId||d.date)}">
      <div class="prize-draw-date">${fmtDate(d.date)}</div>
      ${balls?`<div class="prize-draw-balls">${balls}</div>`:''}
      ${rowsH}
    </div>`;
  });
  if(visible<withPayouts.length){
    const moreText=`Показать ещё · ${Math.min(15,withPayouts.length-visible)} из ${withPayouts.length-visible}`;
    html+=`<button type="button" data-loto-event-click="showMorePrizes()" style="width:100%;padding:12px;border-radius:12px;border:1px solid var(--gold);background:var(--bg2);color:var(--fg);font-weight:800;cursor:pointer">${moreText}</button>`;
  }
  html+=`<div style="font-size:10px;color:var(--sub2);margin-top:10px;text-align:center">Призы и победители открыты бесплатно · ${withPayouts.length} тиражей</div>`;
  outEl.innerHTML=html;

  // averages per tier
  const tierAgg={};
  const prizeTiers=getPrizeTiers(l);
  prizeTiers.forEach(t=>{tierAgg[t.match]={label:t.label,prizes:[],winners:[]};});
  withPayouts.forEach(d=>{
    d.payoutTiers.forEach(t=>{
      if(tierAgg[t.match]){
        const amount=prizeTierAmount(t);
        if(amount!==null&&amount!==undefined)tierAgg[t.match].prizes.push(amount);
        if(t.winners!==null&&t.winners!==undefined)tierAgg[t.match].winners.push(t.winners);
      }
    });
  });
  let avgHtml='';
  prizeTiers.forEach(t=>{
    const agg=tierAgg[t.match];
    if(!agg.prizes.length&&!agg.winners.length)return;
    const avgPrize=agg.prizes.length?Math.round(agg.prizes.reduce((s,v)=>s+v,0)/agg.prizes.length):null;
    const avgWin=agg.winners.length?Math.round(agg.winners.reduce((s,v)=>s+v,0)/agg.winners.length):null;
    avgHtml+=`<div class="srow"><span>${t.label}:</span><span>${avgPrize!==null?fmtMoney(avgPrize,l.currency||'NOK'):'—'} · ~${avgWin??'—'} побед.</span></div>`;
  });
  avgEl.innerHTML=avgHtml||'<div class="empty">Нет данных</div>';
}

// ─── PRECISE PER-DRAW NAVIGATION (from notifications) ─────────────────────────
// Opens the EXACT draw a notification refers to (gameId+drawId/date), never the last
// draw. Reuses the notification-center 17-locale dictionary via LotoNotifCenter._t so
// no user-visible string is added outside a fully-translated key set.
function _ncText(key,arg){try{return(window.LotoNotifCenter&&window.LotoNotifCenter._t)?window.LotoNotifCenter._t(key,arg):key;}catch(e){return key;}}
function _normDrawDate(v){if(!v)return null;const m=String(v).match(/\d{4}-\d{2}-\d{2}/);return m?m[0]:null;}
function _focusPrizeCard(card){
  if(!card)return;
  try{card.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){card.scrollIntoView();}
  card.classList.remove('nc-draw-highlight');void card.offsetWidth; // restart animation
  card.classList.add('nc-draw-highlight');
  setTimeout(()=>{try{card.classList.remove('nc-draw-highlight');}catch(e){}},2800);
}
async function _showPrizeAwaitingOrNotFound(gameId,date,outEl){
  if(!outEl)return;
  let known=false;
  try{const draws=await loadD(cur);known=!!(date&&draws.some(d=>d.date===date));}catch(e){}
  let lot=gameId||cur||'';try{lot=(L&&L().name)||lot;}catch(e){}
  const label=lot+(date?(' · '+date):'');
  const msg=known?_ncText('nc.status.awaitingData'):_ncText('nc.notFound',label);
  const banner=document.createElement('div');
  banner.className='prize-draw-card';
  banner.setAttribute('data-draw-date',date||'');
  banner.setAttribute('role','status');
  banner.innerHTML='<div class="prize-draw-date">'+escapePrizeHtml(label)+'</div>'+
    '<div style="font-size:13px;color:var(--sub);padding:6px 0">'+escapePrizeHtml(msg)+'</div>';
  outEl.insertBefore(banner,outEl.firstChild);
  _focusPrizeCard(banner);
}
async function revealPrizeDraw(gameId,drawId,dateStr,cb){
  const done=()=>{try{if(typeof cb==='function')cb();}catch(e){}};
  try{
    const date=_normDrawDate(dateStr)||_normDrawDate(drawId);
    if(gameId&&window.selLot&&cur!==gameId)selLot(gameId);
    if(window.selPage)selPage('ana');
    if(window.selAT)await selAT('prize');else await renderPrizes();
    const outEl=document.getElementById('prize-out');
    const sel=date?'.prize-draw-card[data-draw-date="'+date+'"]':null;
    let card=(date&&outEl)?outEl.querySelector(sel):null;
    // Reveal more pages until the target draw's card is materialised (or all shown).
    let guard=0;
    while(!card&&date&&outEl&&outEl.querySelector('button[onclick="showMorePrizes()"]')&&guard++<50){
      prizeVisibleCounts[cur]=(prizeVisibleCounts[cur]||15)+15;
      await renderPrizes();
      card=outEl.querySelector(sel);
    }
    if(card){_focusPrizeCard(card);return done();}
    await _showPrizeAwaitingOrNotFound(gameId,date,outEl);
    return done();
  }catch(e){done();}
}
async function revealUpcomingDraw(gameId,drawId,dateStr,cb){
  const done=()=>{try{if(typeof cb==='function')cb();}catch(e){}};
  try{
    if(gameId&&window.selLot&&cur!==gameId)selLot(gameId);
    if(window.selPage)selPage('sim');
  }catch(e){}
  done();
}
window.revealPrizeDraw=revealPrizeDraw;
window.revealUpcomingDraw=revealUpcomingDraw;

// ─── JACKPOT CHART ────────────────────────────
async function renderJackpotChart(){
  let all=[];
  try{all=await loadPublicPrizes(cur);}catch{all=await loadD(cur);}
  const draws=all.filter(d=>d.jackpot).sort((a,b)=>a.date.localeCompare(b.date));
  const c=document.getElementById('jackpot-chart-out');
  if(!draws.length){c.innerHTML='<div class="empty">Официальные данные о джекпоте пока не опубликованы</div>';return;}
  const max=Math.max(...draws.map(d=>d.jackpot));
  let html='<div class="freq-wrap"><div class="freq-chart" style="align-items:flex-end">';
  draws.slice(-60).forEach(d=>{
    const pct=(d.jackpot/max)*100;
    const[y,mo,dy]=d.date.split('-');
    html+=`<div class="fbw" style="width:34px"><div class="fbar" style="height:${Math.max(pct,3)}px;width:26px;background:#f0a500" data-tip="${d.jackpot}М ${d.currency||L().currency||'NOK'} · ${dy}.${mo}"></div><div class="fn">${dy}/${mo}</div></div>`;
  });
  html+='</div></div>';
  html+=`<div class="srow" style="margin-top:8px"><span>Максимальный джекпот:</span><span>${max} млн ${L().currency||'NOK'}</span></div>`;
  html+=`<div class="srow"><span>Записей:</span><span>${draws.length}</span></div>`;
  c.innerHTML=html;
}

// ─── КАЛЬКУЛЯТОР ОХВАТА ──────────────────────
function renderCombinationAnalysis(){
  const l=L();
  const currency=l.currency||'NOK',combos=jackpotCombos(l),totalCost=combos*l.price,totalCostM=(totalCost/1e6).toFixed(1);
  const conservativeTarget=(totalCost*3/1e6).toFixed(1);
  const jv=parseFloat(document.getElementById('jackpot-inp').value)||0;
  const ratioNum=jv>0?jv/(totalCost/1e6):null,ratio=ratioNum?ratioNum.toFixed(2):null;
  const conservative=ratioNum!==null&&ratioNum>=3,breakEven=ratioNum!==null&&ratioNum>=1;
  const verdict=conservative?'✅ Джекпот покрывает ориентир ×3':breakEven?'⚠️ Джекпот покрывает цену комбинаций, но не гарантирует прибыль':'⏳ Джекпот ниже стоимости всех комбинаций';
  const jl=document.getElementById('jackpot-currency-label');if(jl)jl.textContent='Текущий джекпот (млн '+currency+')';
  document.getElementById('man-out').innerHTML=`<div class="mbox">
    <div class="mbox-t">📐 ${l.name} · Комбинаторный анализ</div>
    <div class="mrow"><span>Комбинаций:</span><span>${fmtInt(combos)}</span></div>
    <div class="mrow"><span>Цена 1 ряда:</span><span>${l.price} ${currency}</span></div>
    <div class="mrow"><span>Мин. покупка:</span><span>${l.minR} ряд(а) = ${l.minR*l.price} ${currency}</span></div>
    <div class="mrow"><span>Стоимость ВСЕХ комбинаций:</span><span>~${totalCostM} млн ${currency}</span></div>
    <div class="mrow"><span>Консервативный ориентир ×3:</span><span style="color:#ff9f0a">~${conservativeTarget} млн ${currency}</span></div>
    <div class="mrow"><span>Текущий джекпот:</span><span>${jv||'—'} млн ${currency}</span></div>
    <div class="mrow"><span>Джекпот / стоимость:</span><span style="color:${conservative?'#34c759':'#ff9f0a'}">${ratio?ratio+'×':'введи джекпот'}</span></div>
    <div class="mverdict ${conservative?'go':'wait'}">${verdict}</div>
    <div class="warn-note">Без учёта налогов, деления приза между победителями, лимитов продаж и стоимости организации покупки. Расчёт не является гарантией дохода.</div>
  </div>
  <div style="background:var(--bg2);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-top:12px">
    <div class="card-t">🗓 Расписание ${l.name}</div>
    <div class="info-row"><span>📅 Дни:</span><span>${l.day}</span></div>
    <div class="info-row"><span>⏰ Дедлайн:</span><span>до ${scheduleTime(l)}</span></div>
    <div class="info-row"><span>🎰 Trekning:</span><span>${l.res}</span></div>
    <div class="info-row"><span>💰 Цена ряда:</span><span>${l.price} ${currency}</span></div>
  </div>`;
}

async function renderMathCheck(){
  const l=L(),draws=await loadD(cur),c=document.getElementById('math-check-out');
  const archive=await loadArchivePackage(cur).catch(()=>({draws:[],eras:[]}));
  const computed=jackpotCombos(l);
  const packageRows=l.packagePrice&&l.minR>1?l.minR:1;
  const constantOk=l.combos===computed;
  const dateCounts={};
  draws.forEach(d=>{dateCounts[d.date]=(dateCounts[d.date]||0)+1;});
  const dupDates=Object.values(dateCounts).filter(n=>n>1).length;
  const invalid=draws.map((d,i)=>({i,date:d.date,errs:validateDrawRecord(d,cur,d.source==='Norsk Tipping')})).filter(x=>x.errs.length);
  const sourced=draws.filter(d=>d.source).length;
  const expFreq=draws.length?draws.length*l.pM/l.mB:0;
  const chiReady=expFreq>=5;
  const formula=`C(${l.mB},${l.pM})${l.pBo>0?` × C(${l.bB},${l.pBo})`:''}`;
  c.innerHTML=`
    <div class="srow"><span>Формула джекпота:</span><span>${formula}</span></div>
    <div class="srow"><span>Комбинаций по формуле:</span><span>${fmtInt(computed)}</span></div>
    <div class="srow"><span>Константа LOTS:</span><span style="color:${constantOk?'#34c759':'#ff3b30'}">${constantOk?'OK':'НЕ СОВПАДАЕТ'} · ${fmtInt(l.combos)}</span></div>
    <div class="srow"><span>Шанс джекпота:</span><span>1 : ${fmtChance(computed)}</span></div>
    ${packageRows>1?`<div class="srow"><span>Шанс минимального пакета (${packageRows} строки):</span><span>1 : ${fmtChance(computed/packageRows)}</span></div>`:''}
    <div class="srow"><span>Тиражей текущих правил:</span><span>${draws.length}</span></div>
    <div class="srow"><span>Полный исторический архив:</span><span>${archive.draws.length||draws.length}</span></div>
    <div class="srow"><span>Версий правил в архиве:</span><span>${archive.eras.length||1}</span></div>
    <div class="srow"><span>С указанием источника:</span><span>${sourced}/${draws.length}</span></div>
    <div class="srow"><span>Ошибок формата базы:</span><span style="color:${invalid.length?'#ff3b30':'#34c759'}">${invalid.length}</span></div>
    <div class="srow"><span>Дубли дат:</span><span style="color:${dupDates?'#ff3b30':'#34c759'}">${dupDates}</span></div>
    <div class="srow"><span>χ² ожидаемая частота:</span><span style="color:${chiReady?'#34c759':'#ff9f0a'}">${expFreq.toFixed(2)} ${chiReady?'OK':'мало данных'}</span></div>
    ${invalid.length?`<div class="warn-note">Первые ошибки: ${invalid.slice(0,3).map(x=>`${x.date||'#'+(x.i+1)}: ${x.errs.join(', ')}`).join(' · ')}</div>`:''}
    <div class="warn-note">Математика проверяет корректность формул и данных. Она не превращает прошлые тиражи в прогноз: каждый официальный тираж независим.</div>`;
}

async function renderStats(){
  const l=L(),draws=await loadD(cur),pack=await loadFullHistory(cur),c=document.getElementById('stats-out');
  if(!draws.length){c.innerHTML='<div class="empty">Нет данных</div>';return;}
  const all=draws.flatMap(d=>d.main);
  const avg=(all.reduce((s,v)=>s+v,0)/all.length).toFixed(1);
  const freq=buildFreq(draws,'main',l.mB);
  const maxF=[...freq.entries()].sort((a,b)=>b[1]-a[1])[0];
  const minF=[...freq.entries()].sort((a,b)=>a[1]-b[1])[0];
  const ms=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const fmt=s=>{const[y,mo,d]=s.split('-');return`${d} ${ms[+mo-1]} ${y}`;};
  const eraStats=pack.eras.map(era=>{
    const rows=pack.draws.filter(draw=>ruleEraForDraw(draw,pack.eras)?.id===era.id);
    if(!rows.length)return'';
    const freq=new Map(Array.from({length:era.mainMax},(_,i)=>[i+1,0]));
    rows.forEach(draw=>draw.main.forEach(n=>freq.set(n,(freq.get(n)||0)+1)));
    const hot=[...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,3).map(([n,v])=>`№${n} (${v}×)`).join(', ');
    return`<div class="rule-era"><b>${era.current?'Текущая эпоха':'Старые правила'} · ${era.label}</b>${era.from}${era.to?' — '+era.to:' — сейчас'} · ${rows.length} тиражей<br>Чаще в этой эпохе: ${hot}</div>`;
  }).join('');
  c.innerHTML=`<div class="srow"><span>Тиражей текущих правил:</span><span>${draws.length}</span></div>
  <div class="srow"><span>Полный архив:</span><span>${pack.draws.length}</span></div>
  <div class="srow"><span>Первый:</span><span>${fmt(draws[draws.length-1].date)}</span></div>
  <div class="srow"><span>Последний:</span><span>${fmt(draws[0].date)}</span></div>
  <div class="srow"><span>Среднее число:</span><span>${avg} (ожид. ${((l.mB+1)/2).toFixed(1)})</span></div>
  <div class="srow"><span>Самое частое:</span><span>№${maxF[0]} (${maxF[1]}×)</span></div>
  <div class="srow"><span>Самое редкое:</span><span>№${minF[0]} (${minF[1]}×)</span></div>
  <div style="font-weight:900;font-size:13px;margin:14px 0 8px">Историческая статистика по версиям правил</div>
  <div class="rule-summary">${eraStats||'<div class="rule-era">Исторические эпохи не найдены.</div>'}</div>`;
}

// ─── EXPORT/IMPORT ────────────────────────────
async function doExport(){
  const data={};
  for(const id of Object.keys(LOTS)){ data[id]=await loadD(id); }
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`loto_simulator_${new Date().toISOString().slice(0,10)}.json`;a.click();
}
function toggleTextImport(){
  const w=document.getElementById('text-import-wrap'),ic=document.getElementById('text-import-icon');
  const show=w.style.display==='none';
  w.style.display=show?'':'none';
  ic.textContent=show?'▴':'▾';
}

async function handleTextImport(){
  const ta=document.getElementById('text-import-area');
  const raw=ta.value.trim();
  if(!raw){ showFeedback('Нет текста','Вставьте JSON текст сначала.','⚠️',2800); return; }
  let d;
  try{
    d=validateImportedPayload(raw);
  }catch(err){
    showFeedback('Небезопасный или неверный JSON',err.message,'⚠️',5200);
    return;
  }
  try{
    const imported=await importValidatedDraws(d);
    if(imported===0){
      showFeedback('Тиражи не найдены','В тексте ожидаются ключи lotto/viking/euro с массивами.','⚠️',4200);
      return;
    }
    ta.value='';
    await renderHistory();
    await renderSavedDrawOptions();
    showFeedback('Импорт готов',`Импортировано ${imported} тиражей.\n${storageScopeText()}`,'✅');
  }catch(err){
    showFeedback('Ошибка сохранения',err.message,'⚠️',4200);
  }
}

function doImport(){
  const inp=document.getElementById('imp-file');
  inp.value='';
  inp.click();
}
function handleImp(e){
  const f=e.target.files&&e.target.files[0];
  if(!f){ showFeedback('Файл не выбран','Выберите JSON-файл для импорта.','⚠️',2800); return; }
  if(f.size>2_000_000){showFeedback('Файл слишком большой','Максимальный размер безопасного импорта — 2 МБ.','⚠️',4200);return;}
  const r=new FileReader();
  r.onerror=()=>showFeedback('Не удалось прочитать файл','Попробуйте выбрать файл ещё раз.','⚠️',3600);
  r.onload=async ev=>{
    let d;
    try{
      d=validateImportedPayload(String(ev.target.result||''));
    }catch(err){
      showFeedback('Небезопасный или неверный JSON',err.message,'⚠️',5200);
      return;
    }
    try{
      const imported=await importValidatedDraws(d);
      if(imported===0){
        showFeedback('Тиражи не найдены','В файле ожидаются ключи lotto/viking/euro с массивами.','⚠️',4200);
        return;
      }
      await renderHistory();
      await renderSavedDrawOptions();
      showFeedback('Импорт готов',`Импортировано ${imported} тиражей.\n${storageScopeText()}`,'✅');
    }catch(err){
      showFeedback('Ошибка сохранения',err.message,'⚠️',4200);
    }
  };
  r.readAsText(f);
}

const IMPORT_MAX_BYTES=2_000_000;
const IMPORT_MAX_DRAWS=5000;
const IMPORT_DRAW_KEYS=new Set([
  'date','main','bonus','jackpot','payoutTiers','lotteryId','lotteryName','source','sourceUrl',
  'drawId','drawName','importedAt','ruleEra','currentRules','extraGroups',
]);
function importError(message){throw new Error(message);}
function validIsoDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function normalizeImportedNumbers(value,count,max,label,allowEmpty=false){
  if(!Array.isArray(value))importError(`${label}: ожидается массив`);
  if((allowEmpty&&value.length!==0&&value.length!==count)||(!allowEmpty&&value.length!==count))importError(`${label}: неверное количество чисел`);
  const numbers=value.map(Number);
  if(numbers.some(number=>!Number.isInteger(number)||number<1||number>max))importError(`${label}: число вне допустимого диапазона`);
  if(new Set(numbers).size!==numbers.length)importError(`${label}: повторяющиеся числа`);
  return numbers.sort((a,b)=>a-b);
}
function normalizeImportedDraw(value,id,index){
  if(!value||typeof value!=='object'||Array.isArray(value))importError(`${id}[${index}]: ожидается объект`);
  const unknown=Object.keys(value).filter(key=>!IMPORT_DRAW_KEYS.has(key));
  if(unknown.length)importError(`${id}[${index}]: неизвестные поля ${unknown.slice(0,3).join(', ')}`);
  const l=LOTS[id],date=String(value.date||'');
  if(!validIsoDate(date))importError(`${id}[${index}]: неверная дата`);
  const main=normalizeImportedNumbers(value.main,l.pM,l.mB,`${id}[${index}].main`);
  const bonusCount=l.offBo||l.pBo||0;
  const bonus=normalizeImportedNumbers(value.bonus||[],bonusCount,l.bB,`${id}[${index}].bonus`,true);
  const jackpot=value.jackpot===null||value.jackpot===undefined?null:Number(value.jackpot);
  if(jackpot!==null&&(!Number.isFinite(jackpot)||jackpot<0||jackpot>1e12))importError(`${id}[${index}].jackpot: неверное значение`);
  let payoutTiers=null;
  if(value.payoutTiers!==null&&value.payoutTiers!==undefined){
    if(!Array.isArray(value.payoutTiers)||value.payoutTiers.length>30)importError(`${id}[${index}].payoutTiers: неверный массив`);
    payoutTiers=value.payoutTiers.map((tier,tierIndex)=>{
      if(!tier||typeof tier!=='object'||Array.isArray(tier))importError(`${id}[${index}].payoutTiers[${tierIndex}]: неверный объект`);
      const match=String(tier.match||'').slice(0,20);
      const label=String(tier.label||'').slice(0,80);
      if(!/^[\p{L}\p{N} +/.,_-]{0,80}$/u.test(label)||!/^[0-9+/_-]{0,20}$/.test(match))importError(`${id}[${index}].payoutTiers[${tierIndex}]: неверный текст`);
      const prizeNOK=tier.prizeNOK===null||tier.prizeNOK===undefined?null:Number(tier.prizeNOK);
      const winners=tier.winners===null||tier.winners===undefined?null:Number(tier.winners);
      if(prizeNOK!==null&&(!Number.isFinite(prizeNOK)||prizeNOK<0||prizeNOK>1e15))importError(`${id}[${index}]: неверный приз`);
      if(winners!==null&&(!Number.isInteger(winners)||winners<0||winners>1e9))importError(`${id}[${index}]: неверное число победителей`);
      return{match,label,prizeNOK,winners};
    });
  }
  return{
    date,main,bonus,jackpot,payoutTiers,
    lotteryId:id,lotteryName:lotteryName(id),source:'Личный импорт',
    importedAt:new Date().toISOString(),
  };
}
function validateImportedPayload(raw){
  if(new Blob([raw]).size>IMPORT_MAX_BYTES)importError('Максимальный размер импорта — 2 МБ');
  let parsed;try{parsed=JSON.parse(raw);}catch(error){importError(`Ошибка JSON: ${error.message}`);}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))importError('Корень JSON должен быть объектом');
  const allowedRoot=new Set([...Object.keys(LOTS),'schemaVersion']);
  const unknown=Object.keys(parsed).filter(key=>!allowedRoot.has(key));
  if(unknown.length)importError(`Неизвестные разделы: ${unknown.slice(0,5).join(', ')}`);
  const normalized={};let total=0;
  for(const id of Object.keys(LOTS)){
    const values=parsed[id];
    if(values===undefined)continue;
    if(!Array.isArray(values))importError(`${id}: ожидается массив`);
    total+=values.length;
    if(total>IMPORT_MAX_DRAWS)importError(`Разрешено не более ${IMPORT_MAX_DRAWS} тиражей`);
    normalized[id]=values.map((draw,index)=>normalizeImportedDraw(draw,id,index));
  }
  return normalized;
}
async function importValidatedDraws(data){
  let imported=0;
  for(const id of Object.keys(LOTS)){
    if(!data[id]?.length)continue;
    const old=await loadD(id);
    const {merged}=mergeDrawLists(old,data[id]);
    await saveD(id,merged);
    imported+=data[id].length;
  }
  return imported;
}

// ═══════════════════════════════════════════════
//  SMART GEN
// ═══════════════════════════════════════════════
function zonedParts(date,timeZone){
  const out={};
  new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).forEach(p=>{if(p.type!=='literal')out[p.type]=p.value;});
  return{year:+out.year,month:+out.month,day:+out.day,weekday:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[out.weekday],hour:+out.hour,minute:+out.minute};
}
function zonedDateTimeToUtc(year,month,day,hour,minute,timeZone){
  const target=Date.UTC(year,month-1,day,hour,minute);let guess=new Date(target);
  for(let i=0;i<3;i++){const p=zonedParts(guess,timeZone),shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);guess=new Date(guess.getTime()+target-shown);}
  return guess;
}
function scheduleTime(l){return l.dl+(l.tzLabel?' '+l.tzLabel:'');}
function nextDraw(lotId){
  const now=new Date(),l=LOTS[lotId],tz=l.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local=zonedParts(now,tz),[hh,mm]=l.dl.split(':').map(Number);
  let nd=null;
  for(const weekday of l.drawDays){
    let diff=(weekday-local.weekday+7)%7;
    let base=new Date(Date.UTC(local.year,local.month-1,local.day+diff));
    let cand=zonedDateTimeToUtc(base.getUTCFullYear(),base.getUTCMonth()+1,base.getUTCDate(),hh,mm,tz);
    if(cand<=now){base=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()+7));cand=zonedDateTimeToUtc(base.getUTCFullYear(),base.getUTCMonth()+1,base.getUTCDate(),hh,mm,tz);}
    if(!nd||cand<nd)nd=cand;
  }
  const p=zonedParts(nd,tz),ms=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'],dn=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const mins=Math.max(0,Math.ceil((nd-now)/60000)),dLeft=Math.floor(mins/1440),hLeft=Math.floor((mins%1440)/60),mLeft=mins%60;
  const left=(dLeft?dLeft+' д. ':'')+(hLeft?hLeft+' ч. ':'')+(!dLeft&&mLeft?mLeft+' мин.':'');
  return{date:nd,dateStr:`${dn[p.weekday]}, ${p.day} ${ms[p.month-1]} ${p.year}`,countdown:'⏳ До дедлайна: '+left.trim(),timeLabel:scheduleTime(l)};
}

async function openSG(){
  const l=L();
  document.getElementById('sg-icon').textContent=l.flag||'🎯';
  document.getElementById('sg-name').textContent=l.name;
  const cd=document.getElementById('sg-cd');cd.className='sg-cd '+l.cls;
  document.getElementById('sg-left').className='sg-cd-left '+l.cls;
  document.getElementById('sg-use').className='sg-use '+l.cls;
  const nd=nextDraw(cur);
  document.getElementById('sg-date').textContent=nd.dateStr;
  document.getElementById('sg-time').textContent='Дедлайн: до '+nd.timeLabel;
  document.getElementById('sg-left').textContent=nd.countdown;
  sgAlgo=null;sgGen=[];
  document.querySelectorAll('.sg-algo').forEach(a=>a.classList.remove('sel'));
  document.getElementById('sg-result').innerHTML='<div class="empty">👆 Выбери метод — и шары закрутятся прямо здесь</div>';
  const useBtn0=document.getElementById('sg-use');if(useBtn0)useBtn0.style.display='none';
  document.getElementById('sg-ov').classList.add('show');
}

async function selAlgo(id){
  if(GEN_BUSY)return;
  sgAlgo=id;
  document.querySelectorAll('.sg-algo').forEach(a=>a.classList.remove('sel'));
  document.getElementById('al-'+id).classList.add('sel');
  const name=(document.querySelector('#al-'+id+' .sg-algo-name')||{}).textContent||'Модель';
  const generated=await withBusy(name,generateCombos);
  if(!generated)return;
  const useBtn=document.getElementById('sg-use');if(useBtn)useBtn.style.display='';
  const res=document.getElementById('sg-result');
  if(res)setTimeout(()=>res.scrollIntoView({behavior:'smooth',block:'start'}),60);
}

async function generateCombos(){
  if(!sgAlgo)return;
  const generated=await generateRowsByAlgo(sgAlgo,getGenCount(),{user:true});
  if(!generated?.length)return false;
  sgGen=generated;
  renderGen();
  return true;
}

function shufSlice(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,n).sort((a,b)=>a-b);}

let rollTimers=[];
/* ═══ МУЛЬТИЯЗЫЧНОСТЬ: страны всех лотерей каталога ═══ */
const LOCALE_CATALOG=window.LOTO_I18N_CATALOG?.locales||{};
const LANG_ORDER=Object.keys(LOCALE_CATALOG);
const LANG_FLAGS=Object.fromEntries(LANG_ORDER.map(code=>[code,LOCALE_CATALOG[code].flag]));
let curLang=localStorage.getItem('loto_lang')||(navigator.language||'ru').slice(0,2);
if(!LOCALE_CATALOG[curLang])curLang='en';
const APP_LOCALES={ru:'ru-RU',en:'en-GB',no:'nb-NO',sv:'sv-SE',da:'da-DK',fi:'fi-FI',de:'de-DE',fr:'fr-FR',es:'es-ES',it:'it-IT',pt:'pt-PT',pl:'pl-PL',nl:'nl-NL',et:'et-EE',lv:'lv-LV',lt:'lt-LT',uk:'uk-UA'};
function appLocale(){return APP_LOCALES[curLang]||'en-GB';}
async function applyLang(){
  document.documentElement.lang=curLang;
  if(window.LotoI18n)await window.LotoI18n.setLanguage(curLang);
  const lb=document.getElementById('lang-btn');if(lb)lb.textContent=(LANG_FLAGS[curLang]||'')+' '+curLang.toUpperCase();
}
function openLangPicker(){
  const grid=document.getElementById('lang-grid');
  grid.innerHTML=LANG_ORDER.map(c=>
    `<button class="lang-opt${c===curLang?' cur':''}" data-loto-event-click="selectLang('${c}')">
      <span class="lang-flag">${LANG_FLAGS[c]}</span>
      <span class="lang-name">${escapeHtml(LOCALE_CATALOG[c].name)}</span>
      ${c===curLang?'<span class="lang-check">✓</span>':''}
    </button>`).join('');
  document.getElementById('lang-ov').classList.add('show');
}
function closeLangPicker(){document.getElementById('lang-ov').classList.remove('show');}
async function selectLang(code){
  if(!LOCALE_CATALOG[code])return;
  curLang=code;
  localStorage.setItem('loto_lang',code);
  await applyLang();
  closeLangPicker();
  if(curPage==='ana')await renderAna();
  else{
    renderLotteryNav();
    renderHero();
    renderSim();
    updateHdr();
    renderSavedDrawOptions();
  }
  if(window.LotoI18n)window.LotoI18n.localizeTree(document,true);
  if(typeof showCopyToast==='function')showCopyToast(LANG_FLAGS[code]+' '+LOCALE_CATALOG[code].name);
}
function cycleLang(){openLangPicker();}
document.addEventListener('DOMContentLoaded',()=>{void applyLang();});
function stopRolls(){rollTimers.forEach(clearInterval);rollTimers=[];}
/* универсальный эффект для любых результатов: прокрутка к блоку + вращение шаров.
   Возвращает длительность анимации (мс), чтобы модалки ждали её окончания. */
function revealResult(rootEl,scrollBlock){
  if(!rootEl)return 0;
  setTimeout(()=>rootEl.scrollIntoView({behavior:'smooth',block:scrollBlock||'center'}),80);
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)return 0;
  const l=L();
  const balls=[...rootEl.querySelectorAll('.dball,.mb,.rb,.hball')].filter(el=>{
    const c=el.className;
    return !(/miss-|rb-e-/.test(c))&&/^\d+$/.test(el.textContent.trim());
  });
  let maxDur=0;
  balls.forEach((el,i)=>{
    const fin=el.textContent;
    const isBonus=/(?:^|\s|-)(?:[a-z]+-b|rb-b-[a-z]+)(?:\s|$)/.test(' '+el.className+' ');
    const maxN=isBonus?(l.bB||l.mB):l.mB;
    el.style.animationDelay=(-Math.random()*700).toFixed(0)+'ms';
    el.classList.add('ballroll');
    const t0=performance.now(),dur=380+Math.min(i*52,1500)+Math.random()*90;
    maxDur=Math.max(maxDur,dur);
    const iv=setInterval(()=>{
      if(performance.now()-t0>=dur){
        el.textContent=fin;el.style.animationDelay='';
        el.classList.remove('ballroll');el.classList.add('balllanded');
        setTimeout(()=>el.classList.remove('balllanded'),420);
        clearInterval(iv);return;
      }
      el.textContent=1+Math.floor(Math.random()*maxN);
    },110);
    rollTimers.push(iv);
  });
  return Math.round(maxDur+450);
}
function rollBalls(){
  /* «слот-машина»: шары кувыркаются и останавливаются один за другим */
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const l=L();
  const combos=[...document.querySelectorAll('#sg-result .sg-combo')];
  combos.forEach((combo,row)=>{
    combo.querySelectorAll('.sg-cball').forEach((el,idx)=>{
      const span=el.querySelector('.bnum')||el;
      const fin=span.textContent;
      span.style.animationDelay=(-Math.random()*700).toFixed(0)+'ms';
      el.classList.add('rolling');
      const t0=performance.now(),dur=420+idx*95+row*75+Math.random()*90;
      const iv=setInterval(()=>{
        if(performance.now()-t0>=dur){
          span.textContent=fin;
          span.style.animationDelay='';
          el.classList.remove('rolling');el.classList.add('landed');
          clearInterval(iv);
          return;
        }
        span.textContent=1+Math.floor(Math.random()*l.mB);
      },110);
      rollTimers.push(iv);
    });
  });
}

function renderGen(){
  stopRolls();
  const l=L();
  const notes={freq:'Частоты базы: вес f(n)+0,05',bal:'Около 40/30/30: горячие, средние и холодные',rnd:'Равномерный выбор без возвращения',man:'По одному числу из каждого сегмента',wheel:'Комбинаторное покрытие',markov:'Марков: P(b|a) со сглаживанием α=1',gauss:'Гаусс/ЦПТ: сумма около μ базы',delta:'Интервальная модель Δ: bootstrap соседних разностей',bayes:'Байес · Дирихле: α=3',overdue:'Gap-анализ: текущий пропуск / ожидаемый',phys:'Упрощённая 2D-физика лототрона',chaos:'Логистическое отображение r=3,99',quantum:'Квантовый коллапс · '+(lastQuantumSrc||'источник устройства'),paradox:'Парадоксы: контринтуитивная структура','world-hot':'Мировой горячий профиль','world-mix':'Мировой комбинированный профиль'};
  const bc=l.cls==='euro'?'#f4a0b0':'#10183a',bt2=l.cls==='euro'?'#1c1c1e':'#fff';
  let html='';
  sgGen.forEach((c,i)=>{
    const balls=c.m.map(n=>`<div class="sg-cball ${l.cls}-m"><span class="bnum">${n}</span></div>`).join('');
    let bonus='';
    if(c.b&&c.b.length>0){bonus=`<div style="font-size:11px;color:var(--sub2);margin:6px 0 4px">${bonusLabel(l)}:</div><div style="display:flex;gap:6px">${c.b.map(n=>`<div class="sg-cball ${l.cls}-b"><span class="bnum">${n}</span></div>`).join('')}</div>`;}
    html+=`<div class="sg-combo"><div class="sg-combo-lbl">Вариант ${i+1} · ${notes[sgAlgo]}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${balls}</div>${bonus}</div>`;
  });
  document.getElementById('sg-result').innerHTML=html;
  rollBalls();
}

function useGen(){
  rows=ensureUniqueGeneratedRows(sgGen.map(g=>({m:[...g.m],b:[...g.b]})),L());
  if(!rows.length)rows=[nr()];
  act=0;closeSG();renderSim();resetBanner();
  goToRows();
  showGenStatus('Числа перенесены в билет — удачи! 🍀');
}

function sgOut(e){if(e.target===document.getElementById('sg-ov'))closeSG();}
function closeSG(){document.getElementById('sg-ov').classList.remove('show');}

// ═══════════════════════════════════════════════
//  CHI² MATH
// ═══════════════════════════════════════════════
function chi2cdf(x,k){if(x<=0)return 0;return gammp(k/2,x/2);}
function chi2pvalue(x,k){if(x<=0)return 1;return gammq(k/2,x/2);}
function gammp(a,x){
  if(x<0||a<=0)return NaN;
  if(x===0)return 0;
  return x<a+1?gser(a,x):1-gcf(a,x);
}
function gammq(a,x){
  if(x<0||a<=0)return NaN;
  if(x===0)return 1;
  return x<a+1?1-gser(a,x):gcf(a,x);
}
function gser(a,x){
  let sum=1/a,del=sum,ap=a;
  for(let n=1;n<=200;n++){
    ap++;
    del*=x/ap;
    sum+=del;
    if(Math.abs(del)<Math.abs(sum)*1e-12)break;
  }
  return Math.min(1,Math.max(0,sum*Math.exp(-x+a*Math.log(x)-lgamma(a))));
}
function gcf(a,x){
  const fpmin=1e-300;
  let b=x+1-a,c=1/fpmin;
  if(Math.abs(b)<fpmin)b=fpmin;
  let d=1/b,h=d;
  for(let i=1;i<=200;i++){
    const an=-i*(i-a);
    b+=2;
    d=an*d+b;if(Math.abs(d)<fpmin)d=fpmin;
    c=b+an/c;if(Math.abs(c)<fpmin)c=fpmin;
    d=1/d;
    const del=d*c;
    h*=del;
    if(Math.abs(del-1)<1e-12)break;
  }
  return Math.min(1,Math.max(0,Math.exp(-x+a*Math.log(x)-lgamma(a))*h));
}
function lgamma(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,1.208650973866179e-3,-5.395239384953e-6];let y=x,t=x+5.5;t-=(x+.5)*Math.log(t);let s=1.000000000190015;for(let j=0;j<6;j++){y++;s+=c[j]/y;}return -t+Math.log(2.5066282746310005*s/x);}

// ═══════════════════════════════════════════════
//  CUSTOM CONFIRM (replaces native confirm() which can be blocked in sandboxed iframes)
// ═══════════════════════════════════════════════
let _ccResolve=null,_ccEsc=null;
function customConfirm(msg,okLabel,options={}){
  return new Promise(resolve=>{
    if(_ccResolve)ccAnswer(false);
    _ccResolve=resolve;
    const ov=document.getElementById('cc-ov');
    const title=options.title||'Подтверждение';
    const cancelLabel=options.cancelLabel||'Отмена';
    const okText=okLabel||options.okLabel||'Удалить';
    document.getElementById('cc-title').textContent=appText(title);
    document.getElementById('cc-msg').textContent=appText(msg);
    const cancelBtn=document.getElementById('cc-cancel');
    const okBtn=document.getElementById('cc-ok');
    const closeBtn=ov.querySelector('.cc-x');
    if(cancelBtn)cancelBtn.textContent=appText(cancelLabel);
    if(okBtn)okBtn.textContent=appText(okText);
    if(closeBtn)closeBtn.setAttribute('aria-label',appText('Закрыть'));
    ov.__lotoClose=()=>ccAnswer(false);
    if(window.LotoModals)window.LotoModals.openModal('cc-ov');else ov.classList.add('show');
  });
}
function ccAnswer(val){
  const ov=document.getElementById('cc-ov');
  if(ov)ov.__lotoClose=null;
  ov?.classList.remove('show');
  if(_ccEsc){document.removeEventListener('keydown',_ccEsc);_ccEsc=null;}
  if(_ccResolve){_ccResolve(val);_ccResolve=null;}
}
function ccOut(){}
window.customConfirm=customConfirm;

function showFeedback(title,msg,icon='✅',autoMs=2200,options){
  const ov=document.getElementById('fb-ov');
  if(!ov)return;
  document.getElementById('fb-icon').textContent=icon;
  document.getElementById('fb-title').textContent=appText(title);
  document.getElementById('fb-msg').textContent=appText(msg);
  const actions=document.querySelector('#fb .fb-actions');
  const primary=document.getElementById('fb-primary');
  const secondary=document.getElementById('fb-secondary');
  if(actions)actions.classList.remove('has-secondary');
  if(primary){primary.textContent=appText(options?.primaryText||'OK');primary.onclick=()=>closeFeedback();}
  if(secondary){
    if(options?.secondaryText&&typeof options.secondaryAction==='function'){
      secondary.hidden=false;
      if(actions)actions.classList.add('has-secondary');
      secondary.textContent=appText(options.secondaryText);
      secondary.onclick=()=>{closeFeedback();options.secondaryAction();};
    }else{
      secondary.hidden=true;
      secondary.onclick=null;
      secondary.textContent=appText('OK');
    }
  }
  ov.__lotoClose=closeFeedback;
  if(window.LotoModals)window.LotoModals.openModal('fb-ov');else ov.classList.add('show');
}
function closeFeedback(){
  const ov=document.getElementById('fb-ov');
  if(ov)ov.__lotoClose=null;
  ov?.classList.remove('show');
  document.querySelector('#fb .fb-actions')?.classList.remove('has-secondary');
}
function fbOut(){}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
initTheme();
initGenControls();
selLot('euro');
selPage('sim');
buildCheckFields();
window.addEventListener('DOMContentLoaded',()=>{
  const mark=()=>{try{document.body&&document.body.classList.add('ready');window.__lotoMarkAppReady&&window.__lotoMarkAppReady();}catch(e){}};
  const settle=()=>requestAnimationFrame(()=>requestAnimationFrame(mark));
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(settle).catch(settle);
  else settle();
});

// ── Canonical bottom-nav definition + read-only build diagnostics (§nav / §diag) ──
// One nav definition for every platform (this same index.html is served to desktop,
// mobile browser, PWA and both Capacitor apps). assertBottomNav() fails loudly if a
// stale cache ever serves an old 2-item nav; __APP_DIAGNOSTICS__ lets us tell exactly
// which bundle a device loaded (build SHA, bundle type, nav routes, i18n, policy).
const NAV_ITEMS=[
  {id:'bn-sim',route:'sim',labelKey:'nav.simulator',icon:'simulator'},
  {id:'bn-drum3d',route:'drum3d',labelKey:'nav.drum3d',icon:'die'},
  {id:'bn-ana',route:'ana',labelKey:'nav.analytics',icon:'analytics'}
];
function assertBottomNav(){
  const nav=document.querySelector('.bnav');
  const routes=nav?[...nav.children].map(k=>k.dataset.route):[];
  const ok=routes.length===NAV_ITEMS.length&&NAV_ITEMS.every((it,i)=>routes[i]===it.route);
  if(!ok)console.error('NAV ASSERT FAIL: expected',NAV_ITEMS.map(i=>i.route),'got',routes);
  return{ok,routes};
}
(async function initAppDiagnostics(){
  const nav=assertBottomNav();
  let lang='?';try{lang=(window.LotoI18n&&window.LotoI18n.language)||document.documentElement.lang;}catch(e){}
  const build=document.documentElement.getAttribute('data-build')||'dev';
  // Read the active service-worker cache name so a device can PROVE which bundle it
  // is really running (a stale phone shows an old shell version ≠ this page's build).
  let swVersion='n/a';const swControlled=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
  try{if(window.caches){const ks=await caches.keys();const shell=ks.find(k=>/^loto-shell-/.test(k));if(shell)swVersion=shell.replace(/-(static|data)$/,'');}}catch(e){}
  const swMismatch=swVersion!=='n/a'&&swVersion.indexOf(build)===-1;
  const diag={
    buildSha:build,
    buildTimestamp:document.documentElement.getAttribute('data-build-ts')||'',
    bundleType:(window.Capacitor||window.LotoNativeBilling?.isNative?'capacitor':((window.matchMedia&&window.matchMedia('(display-mode:standalone)').matches)||navigator.standalone?'pwa':'web')),
    sourceBranch:'main',
    navVersion:'static-3-canonical',navItemCount:nav.routes.length,navItems:nav.routes.length,navRoutes:nav.routes,navOk:nav.ok,
    locale:lang,i18nLanguage:lang,
    i18nVersion:build,i18nCatalogVersion:(window.LOTO_I18N_CATALOG&&window.LOTO_I18N_CATALOG.version)||build,
    modelRegistryVersion:(typeof MODEL_REGISTRY_VERSION!=='undefined'?MODEL_REGISTRY_VERSION:build),
    analyticsPolicyVersion:'canDeleteItem-v1',
    serviceWorkerVersion:swVersion,serviceWorkerControlled:swControlled,serviceWorkerMismatch:swMismatch
  };
  try{Object.defineProperty(window,'__APP_DIAGNOSTICS__',{value:Object.freeze(diag),writable:false,configurable:false});}catch(e){window.__APP_DIAGNOSTICS__=diag;}
  try{if(/[?&]debug-build=1\b/.test(location.search))console.log('APP DIAGNOSTICS',diag);}catch(e){}
  if(swMismatch)console.warn('[APP] stale shell: SW cache '+swVersion+' ≠ page build '+build+' — a fresh service worker should take over shortly.');
})();

/* ═══════════════════════════════════════════════════════════
   СТРУКТУРНОЕ ПОЛЕ ДАННЫХ · метамодель Loto Simulator
   Сервисы: контекст анализа, окно тиражей, Field Strength Score,
   парные связи, энтропия, 10 исследовательских строк, экран.
   ═══════════════════════════════════════════════════════════ */

/* ── Сервис 1: окно последних тиражей (единая точка для ВСЕХ моделей) ── */
function IF_getWin(){const v=parseInt(localStorage.getItem('loto_win')||'0');return isFinite(v)?v:0;}
function IF_setWin(v){localStorage.setItem('loto_win',String(parseInt(v)||0));localStorage.removeItem('loto_range');IF_state=null;}
function IF_getRange(){try{const r=JSON.parse(localStorage.getItem('loto_range'));return(r&&r.from&&r.to)?r:null;}catch(e){return null;}}
function IF_setRange(from,to){localStorage.setItem('loto_range',JSON.stringify({from,to}));localStorage.setItem('loto_win','0');IF_state=null;}
function IF_window(draws){
  if(!Array.isArray(draws))return[];
  const r=IF_getRange();
  if(r)return draws.filter(d=>d&&d.date&&d.date>=r.from&&d.date<=r.to);
  const w=IF_getWin();
  return w>0?draws.slice(0,w):draws.slice();
}

/* ── Сервис 2: LotteryAnalysisContext — единственная точка входа моделей ── */
async function IF_ctx(){
  const l=L();
  const all=await loadD(cur);
  const draws=IF_window(all);
  return{
    lotteryId:cur,
    lotteryName:l.short||l.name,
    ruleVersion:1,
    mainPoolRange:[1,l.mB],
    mainNumbersCount:l.pM,
    bonusPoolRange:l.bB?[1,l.bB]:null,
    bonusNumbersCount:drawBonusCount?drawBonusCount(l):(l.pBo||0),
    bonusLabel:l.bonusName||'',
    currentDraws:draws,
    selectedDrawWindow:IF_getWin(),
    availableDrawsCount:all.length,
    lastDrawDate:all[0]&&all[0].date||null,
    sourceStatus:getOfficialProvider(cur)?'live':'local'
  };
}
var IF_state=null; /* var: селЛот вызывает IF_reset при инициализации до объявления */

/* ── Сервис 3: парные связи (lift) — раздельно для основных и бонусных ── */
function IF_pairs(draws,key,maxN){throw new Error('backend_only');}

/* ── Сервис 4: энтропия распределения ── */
function IF_entropy(cnt,maxN){throw new Error('backend_only');}

/* ── Сервис 5: Field Strength Score (25/15/15/20/15/10) ── */
function IF_scores(draws,key,maxN,perDraw){throw new Error('backend_only');}

/* ── Сервис 6: генерация 10 типизированных строк поля ── */
function IF_weightsFrom(scores,pow){throw new Error('backend_only');}
function IF_pickBonus(bScores,l,type,rng){throw new Error('backend_only');}
function IF_buildRows(A,Ab,l,ctx){throw new Error('backend_only');}

/* ── Сервис 7: запуск отдельного Информационного поля ── */
async function IF_run(){
  const ctx=await IF_ctx();
  const l=L();
  if(typeof closeSG==='function'){try{closeSG();}catch(e){}}
  document.getElementById('if-ov').classList.add('show');
  const body=document.getElementById('if-body');
  document.getElementById('if-ctx').textContent=ctx.lotteryName+' · '+(ctx.selectedDrawWindow>0&&ctx.availableDrawsCount>=ctx.selectedDrawWindow?('последние '+ctx.currentDraws.length+' тиражей'):('все доступные '+ctx.currentDraws.length+' тиражей'));
  if(ctx.currentDraws.length<5){
    document.getElementById('if-summary').innerHTML='';
    body.innerHTML='<div class="if-empty">📭 Недостаточно данных для анализа.<br>Для '+ctx.lotteryName+' доступно '+ctx.currentDraws.length+' тиражей — нужно минимум 5.<br><br>Обнови официальные результаты на вкладке «Аналитика».</div>';
    IF_state=null;return;
  }
  body.innerHTML='<div class="if-empty">🧬 Анализирую структуру поля…</div>';
  await new Promise(r=>setTimeout(r,60));
  const A=IF_scores(ctx.currentDraws,'main',l.mB,l.pM);
  const bonusCnt=drawBonusCount?drawBonusCount(l):(l.pBo||0);
  const Ab=(l.bB&&bonusCnt)?IF_scores(ctx.currentDraws,'bonus',l.bB,bonusCnt):null;
  const rows=ensureUniqueGeneratedRows(IF_buildRows(A,Ab,l,ctx),l);
  const strongBalls=A.scores.filter(s=>s.score>=70).length;
  const strongLinks=[...A.pairs.lift.values()].filter(p=>p.lift>=1.5&&p.obs>=2).length;
  IF_state={ctx,A,Ab,rows,strongBalls,strongLinks,lot:cur,tab:'field'};
  /* сохранить эксперимент локально */
  try{localStorage.setItem('loto_if_exp',JSON.stringify({lottery:cur,window:ctx.selectedDrawWindow,drawsUsed:ctx.currentDraws.length,date:new Date().toISOString(),rows:rows.map(r=>({type:r.type,m:r.m,b:r.b,score:r.fieldScore}))}));}catch(e){}
  const sum=[[ctx.currentDraws.length,'тиражей в анализе'],[rows.length,'строк создано'],[strongBalls,'сильных шаров'],[strongLinks,'сильных связей']];
  document.getElementById('if-summary').innerHTML=sum.map(x=>'<div class="if-sumcard"><div class="if-sumv">'+x[0]+'</div><div class="if-suml">'+x[1]+'</div></div>').join('')+
    '<div class="if-sumcard" style="grid-column:1/-1"><span class="if-status">'+A.entropy.status+'</span><div class="if-suml" style="margin-top:6px">'+A.entropy.desc+' Концентрация поля описывает структуру модели на выбранном историческом окне, а не уменьшение случайности будущего тиража.</div></div>';
  IF_tab('field');
}
function IF_close(){document.getElementById('if-ov').classList.remove('show');}
function IF_reset(){IF_state=null;}

/* ── Экран: вкладки ── */
function IF_tab(t){
  if(!IF_state)return;
  IF_state.tab=t;
  ['field','links','div','rows'].forEach(x=>document.getElementById('ift-'+x).classList.toggle('on',x===t));
  const{A,Ab,rows,ctx}=IF_state,l=LOTS[IF_state.lot],body=document.getElementById('if-body');
  const glow=s=>'box-shadow:inset 0 -.3em .45em rgba(0,0,0,.28),inset 0 .1em .16em rgba(255,255,255,.4),0 0 '+(2+s.score/8)+'px '+(s.score/28)+'px rgba(233,180,76,'+(0.08+s.score/140)+')';
  const ballCls='rb-m-'+l.cls,bBallCls='rb-b-'+l.cls;
  if(t==='field'){
    body.innerHTML='<div class="if-grid">'+A.scores.map(s=>'<div class="if-ball '+ballCls+'" style="'+glow(s)+';opacity:'+(0.55+s.score/220)+'" data-loto-event-click="IF_ballInfo('+s.n+',false)">'+s.n+'</div>').join('')+'</div>'+
      (Ab?'<div class="if-seclbl">'+(l.bonusName||'Дополнительные шары')+'</div><div class="if-grid">'+Ab.scores.map(s=>'<div class="if-ball '+bBallCls+'" style="'+glow(s)+';opacity:'+(0.55+s.score/220)+'" data-loto-event-click="IF_ballInfo('+s.n+',true)">'+s.n+'</div>').join('')+'</div>':'')+
      '<div class="if-note">Нажми на шар — увидишь его структурный балл и связи. Свечение отражает Structure Score. <b data-loto-event-click="IF_scoreInfo()" style="color:var(--gold);cursor:pointer">ⓘ Что такое структурный балл</b></div>';
  }
  if(t==='links'){
    const top=[...A.pairs.lift.values()].filter(p=>p.obs>=2).sort((a,b)=>b.lift-a.lift).slice(0,14);
    body.innerHTML='<div class="if-seclbl">Связи в поле</div><div class="if-note" style="margin:0 0 8px">Какие пары чисел чаще образуют связи внутри выбранного периода.</div>'+
      (top.length?top.map(p=>'<div class="if-pair"><b>'+p.a+' — '+p.b+'</b><div class="if-bar"><i style="width:'+Math.min(p.lift/2*100,100)+'%"></i></div><span style="color:var(--sub2);font-size:12px">×'+p.obs+'</span></div>').join(''):'<div class="if-empty">Пар с повторной встречаемостью пока нет — период слишком короткий.</div>')+
      '<div class="if-note">Связи показывают структуру совместной встречаемости чисел в выбранных тиражах и исследовательских строках. Это не прогноз будущего тиража.</div>';
  }
  if(t==='div'){
    const S=[...A.scores].sort((a,b)=>b.score-a.score);
    const topN=S.slice(0,8),lowN=S.slice(-8).reverse();
    const goodP=[...A.pairs.lift.values()].sort((a,b)=>b.obs-a.obs).slice(0,5);
    const total=l.mB*(l.mB-1)/2,covered=A.pairs.lift.size;
    body.innerHTML='<div class="if-seclbl">Представлены сильнее</div><div class="if-rowballs if-ball-list">'+topN.map(s=>'<div class="if-rball '+ballCls+'">'+s.n+'</div>').join('')+'</div>'+
      '<div class="if-seclbl">Представлены слабее</div><div class="if-rowballs if-ball-list">'+lowN.map(s=>'<div class="if-rball '+ballCls+'" style="opacity:.55">'+s.n+'</div>').join('')+'</div>'+
      '<div class="if-seclbl">Хорошо покрытые пары</div>'+goodP.map(p=>'<div class="if-pair"><b>'+p.a+' — '+p.b+'</b><span style="color:var(--sub2);font-size:12px">встречались ×'+p.obs+'</span></div>').join('')+
      '<div class="if-seclbl">Покрытие пар периода</div><div class="if-pair"><b>'+covered+' / '+total+'</b><div class="if-bar"><i style="width:'+(covered/total*100)+'%"></i></div><span style="color:var(--sub2);font-size:12px">'+Math.round(covered/total*100)+'%</span></div>'+
      '<div class="if-note">Следующая строка улучшит разнообразие, если добавит числа из слабо представленной группы и новые, ещё не встречавшиеся пары — так работает «Поле покрытия».</div>';
  }
  if(t==='rows'){
    body.innerHTML=rows.map((r,i)=>'<div class="if-rowcard"><div style="display:flex;justify-content:space-between;align-items:center"><span class="if-rowtype">'+(i+1)+' · '+r.typeName+'</span><span class="if-rowscore">Structure Score '+r.fieldScore+'</span></div>'+
      '<div class="if-rowballs">'+r.m.map(n=>'<div class="if-rball '+ballCls+'">'+n+'</div>').join('')+(r.b&&r.b.length?'<div style="width:6px"></div>'+r.b.map(n=>'<div class="if-rball '+bBallCls+'">'+n+'</div>').join(''):'')+'</div>'+
      '<div class="if-rowexp">'+r.explanation+' Новых пар: '+r.newPairs+(r.maxOverlap?' · пересечение с другими строками: до '+r.maxOverlap+' чисел':'')+'</div></div>').join('')+
      '<button class="btn-draw '+l.cls+'" style="margin-top:6px" data-loto-event-click="IF_useRows()">Использовать 10 строк в симуляторе</button>';
  }
}
function IF_ballInfo(n,isBonus){
  const st=IF_state;if(!st)return;
  const A=isBonus?st.Ab:st.A;if(!A)return;
  const s=A.scores[n-1];
  const lvl=x=>x>=0.66?'высокая':(x>=0.33?'средняя':'низкая');
  const lvl2=x=>x>=0.66?'сильные':(x>=0.33?'средние':'слабые');
  const lvl3=x=>x>=0.66?'высокий':(x>=0.33?'средний':'низкий');
  const links=[...A.pairs.lift.values()].filter(p=>(p.a===n||p.b===n)&&p.obs>=2).sort((a,b)=>b.lift-a.lift).slice(0,3);
  const linkTxt=links.length?'\nСильные связи:\n'+links.map(p=>n+' — '+(p.a===n?p.b:p.a)).join('\n'):'';
  showFeedback('Шар '+n+' · '+(s.score>=70?'Высокий':(s.score>=40?'Средний':'Низкий'))+' структурный балл',
    'Структурный балл: '+s.score+'/100\nЧастота в периоде: '+lvl(s.sig.freq)+'\nНедавняя активность: '+lvl(s.sig.recent)+'\nСвязи с другими шарами: '+lvl2(s.sig.conn)+'\nСтруктурный вклад: '+lvl3(s.sig.struct)+'\nВклад в разнообразие: '+lvl3(s.sig.div)+linkTxt,'🧬',6000);
}
function IF_scoreInfo(){
  showFeedback('Структурный балл','Структурный балл объединяет статистику выбранного периода, интервалы, связи между числами и вклад в разнообразие комбинаций. Он описывает только доступные данные выбранной лотереи, а не вероятность будущего независимого тиража.','ⓘ',7000);
}
function IF_useRows(){
  if(!IF_state)return;
  IF_close();
  setGeneratedRows(IF_state.rows,'Готово: 10 исследовательских строк · Структурное поле данных · '+IF_state.ctx.lotteryName+' · '+IF_state.ctx.currentDraws.length+' тиражей.',true);
}
/* инициализация селектора окна */
document.addEventListener('DOMContentLoaded',()=>{
  const sel=document.getElementById('if-win');
  if(sel)sel.value=String(IF_getWin());
});


/* ═══════════════════════════════════════════════════════════
   КОНСЕНСУС МОДЕЛЕЙ · структурный анализ итоговых строк
   ═══════════════════════════════════════════════════════════ */

/* ── Реестр базовых моделей с семействами (динамический; world-* исключены —
      они смешивают лотереи, что запрещено принципом контекста) ── */
const CONS_MODELS=[
  {id:'freq',   name:'Частотный анализ',      family:'Историческая частотность'},
  {id:'bal',    name:'Балансированный',       family:'Горячие / холодные числа'},
  {id:'overdue',name:'Gap-анализ',            family:'Интервалы и gap-анализ'},
  {id:'markov', name:'Цепи Маркова',          family:'Последовательности и переходы'},
  {id:'bayes',  name:'Байес · Дирихле',       family:'Байесовские и вероятностные'},
  {id:'gauss',  name:'Гаусс · ЦПТ',           family:'Байесовские и вероятностные'},
  {id:'delta',  name:'Интервальная модель Δ', family:'Структура комбинации'},
  {id:'man',    name:'Сегментный охват',      family:'Структура комбинации'},
  {id:'wheel',  name:'Колёсная матрица',      family:'Комбинаторное покрытие'},
  {id:'rnd',    name:'Pure random',           family:'Равномерная случайность'},
  {id:'phys',   name:'Физическая модель лототрона',family:'Физическая симуляция'},
  {id:'chaos',  name:'Детерминированный хаос',family:'Авторские экспериментальные'},
  {id:'quantum',name:'Квантовый коллапс',       family:'Квантовая / криптографическая случайность'},
  {id:'qastro', name:'Квантово-астральный',    family:'Астрологическая интерпретация'}
];
const CONS_ROWS_PER_MODEL=10;
var CONS_state=null;
function CONS_reset(){CONS_state=null;}

/* ── Запуск: все модели × 10 строк через единый контекст ── */
async function CONS_run(){
  const ctx=await IF_ctx();
  const l=L();
  document.getElementById('cons-ov').classList.add('show');
  const body=document.getElementById('cons-body');
  document.getElementById('cons-ctx').textContent=ctx.lotteryName+' · '+(ctx.selectedDrawWindow>0&&ctx.availableDrawsCount>=ctx.selectedDrawWindow?('последние '+ctx.currentDraws.length+' тиражей'):('все доступные '+ctx.currentDraws.length+' тиражей'));
  if(ctx.currentDraws.length<5){
    document.getElementById('cons-summary').innerHTML='';
    document.getElementById('cons-pick-btn').style.display='none';
    body.innerHTML='<div class="if-empty">📭 Недостаточно данных для консенсуса.<br>Для '+ctx.lotteryName+' доступно '+ctx.currentDraws.length+' тиражей — нужно минимум 5.</div>';
    return;
  }
  document.getElementById('cons-pick-btn').style.display='';
  body.innerHTML='<div class="if-empty">🧠 Модели создают исследовательские строки…</div>';
  await new Promise(r=>setTimeout(r,60));
  /* 1) строки всех базовых моделей */
  const modelRows=[];
  for(const M of CONS_MODELS){
    let rows=[];
    try{rows=await generateRowsByAlgo(M.id,CONS_ROWS_PER_MODEL);}catch(e){rows=[];}
    rows.slice(0,CONS_ROWS_PER_MODEL).forEach((r,i)=>{
      const fixed=normalizeGeneratedRow(r,l);
      modelRows.push({
        modelId:M.id,modelName:M.name,family:M.family,rowNumber:i+1,
        lotteryId:ctx.lotteryId,window:ctx.currentDraws.length,
        m:fixed.m,b:fixed.b,
        generatedAt:new Date().toISOString()
      });
    });
    body.innerHTML='<div class="if-empty">🧠 '+M.name+' — готово…</div>';
    await new Promise(r=>setTimeout(r,10));
  }
  /* 2) Consensus Score: только базовые модели (40/25/20/15) */
  const maxN=l.mB;
  const byNum=Array.from({length:maxN+1},()=>({models:new Set(),fams:new Set(),freq:0,perModel:new Map()}));
  for(const r of modelRows)for(const n of r.m){
    const e=byNum[n];e.models.add(r.modelId);e.fams.add(r.family);e.freq++;
    e.perModel.set(r.modelId,(e.perModel.get(r.modelId)||0)+1);
  }
  const totModels=CONS_MODELS.length,totFams=new Set(CONS_MODELS.map(m=>m.family)).size;
  const maxFreq=Math.max(...byNum.slice(1).map(e=>e.freq),1);
  const cons=[];
  for(let n=1;n<=maxN;n++){
    const e=byNum[n];
    /* устойчивость: среднее появлений на поддержавшую модель, норм. к 10 строкам */
    const stab=e.models.size?[...e.perModel.values()].reduce((a,b)=>a+b,0)/e.models.size/CONS_ROWS_PER_MODEL:0;
    const score=100*(0.40*(e.models.size/totModels)+0.25*(e.fams.size/totFams)+0.20*(e.freq/maxFreq)+0.15*Math.min(stab,1));
    cons.push({n,score:Math.round(score),models:e.models.size,fams:e.fams.size,freq:e.freq,stab});
  }
  /* 3) Структурное поле данных: анализ + 10 строк с учётом консенсуса */
  const A=IF_scores(ctx.currentDraws,'main',l.mB,l.pM);
  const bonusCnt=drawBonusCount?drawBonusCount(l):(l.pBo||0);
  const Ab=(l.bB&&bonusCnt)?IF_scores(ctx.currentDraws,'bonus',l.bB,bonusCnt):null;
  /* поле видит консенсус: подмешиваем Consensus Score в веса поля (но не в сам Consensus Score!) */
  const blended={...A,scores:A.scores.map(s=>({...s,score:Math.round(0.6*s.score+0.4*((cons[s.n-1]||{}).score||0))}))};
  const fieldRows=IF_buildRows(blended,Ab,l,ctx).map(r=>{const fixed=normalizeGeneratedRow(r,l);return{modelId:'field',modelName:'Структурное поле данных',family:'Исследовательская meta-модель',rowNumber:0,lotteryId:ctx.lotteryId,window:ctx.currentDraws.length,m:fixed.m,b:fixed.b,typeName:r.typeName,explanation:r.explanation,generatedAt:r.generatedAt};});
  CONS_state={ctx,l,modelRows,fieldRows,cons,A,Ab,lot:cur,pickN:5,pickMode:'mixed'};
  /* сохранить эксперимент */
  try{localStorage.setItem('loto_cons_exp',JSON.stringify({lottery:cur,window:ctx.selectedDrawWindow,drawsUsed:ctx.currentDraws.length,models:CONS_MODELS.map(m=>m.id),date:new Date().toISOString()}));}catch(e){}
  /* 4) сводка + топ чисел */
  const sum=[[CONS_MODELS.length,'базовых моделей'],[modelRows.length,'строк моделей'],[fieldRows.length,'строк структурного анализа'],[modelRows.length+fieldRows.length,'всего кандидатов'],[totFams,'семейств моделей'],[ctx.currentDraws.length,'тиражей использовано']];
  document.getElementById('cons-summary').innerHTML=sum.map(x=>'<div class="if-sumcard"><div class="if-sumv">'+x[0]+'</div><div class="if-suml">'+x[1]+'</div></div>').join('');
  const top=[...cons].sort((a,b)=>b.score-a.score).slice(0,12);
  const cat=s=>s>=65?['высокий консенсус','hi']:(s>=40?['средний консенсус','mid']:['распределённая поддержка','dist']);
  body.innerHTML='<div class="if-seclbl">Топ чисел по консенсусу</div>'+
    top.map(t=>{const c=cat(t.score);return '<div class="cons-num"><div class="if-rball rb-m-'+l.cls+'">'+t.n+'</div><div style="flex:1"><b style="font-size:13.5px">Score '+t.score+'</b><div style="font-size:11.5px;color:var(--sub2)">'+t.models+' моделей · '+t.fams+' семейств · '+t.freq+' появлений</div></div><span class="cons-cat '+c[1]+'">'+c[0]+'</span></div>';}).join('')+
    '<div class="if-note" style="margin-top:10px">Консенсус показывает согласие моделей на последних тиражах выбранной лотереи. Он не является вероятностью будущего тиража.</div>'+
    '<div class="if-seclbl" style="margin-top:16px">Роль Информационного поля</div>'+
    '<div class="if-note" style="margin-top:0">Структурный анализ сравнивает голоса моделей, связи между числами, повторы и разнообразие матрицы. Он помогает сформировать итоговый набор исследовательских строк, но не считается отдельным независимым голосом в Consensus Score и не прогнозирует выигрыш.</div>';
}
function CONS_close(){document.getElementById('cons-ov').classList.remove('show');}

/* ── Модал «Собрать итоговую выборку» ── */
const PICK_MODES=[
  ['consensus','Максимальный консенсус','Строки с высокой поддержкой среди разных моделей и математических семейств.'],
  ['balance','Баланс и разнообразие','Строки с контролем диапазонов, суммы, чётности и минимизацией повторов.'],
  ['coverage','Матрица покрытия','Строки, которые увеличивают покрытие уникальных пар чисел.'],
  ['minoverlap','Минимум повторов','Строки подбираются так, чтобы меньше пересекаться между собой.'],
  ['mixed','Смешанная выборка','Набор разных типов: консенсус, баланс, покрытие, диверсификация и контрольная структура.'],
  ['random','Контрольная random-выборка','Равномерно случайные строки для честного сравнения с аналитическими моделями.']
];
function CONS_openPick(){
  if(!CONS_state)return;
  document.getElementById('cons-ov').classList.remove('show');
  document.getElementById('pick-counts').innerHTML=[1,3,5,10,20].map(n=>'<button class="pick-cnt'+(n===CONS_state.pickN?' on':'')+'" data-loto-event-click="PICK_setN('+n+')">'+n+'</button>').join('');
  document.getElementById('pick-modes').innerHTML=PICK_MODES.map(m=>'<div class="pick-mode'+(m[0]===CONS_state.pickMode?' on':'')+'" data-loto-event-click="PICK_setMode(\''+m[0]+'\')"><div><div class="pick-mode-t">'+m[1]+'</div><div class="pick-mode-d">'+m[2]+'</div></div></div>').join('');
  document.getElementById('pick-go').textContent='Сформировать '+CONS_state.pickN+' '+rowWord(CONS_state.pickN);
  document.getElementById('pick-ov').classList.add('show');
}
function PICK_setN(n){CONS_state.pickN=n;CONS_openPick();}
function PICK_setMode(m){CONS_state.pickMode=m;CONS_openPick();}
function PICK_close(){document.getElementById('pick-ov').classList.remove('show');}

/* ── Candidate Score + двухэтапный диверсифицированный отбор ── */
function CONS_candidateScore(row,st){throw new Error('backend_only');}
async function PICK_go(){
  const st=CONS_state;if(!st)return;
  PICK_close();
  CONS_close();
  const body=document.getElementById('matrix-body');
  const judgeMount=document.getElementById('matrix-jmount');
  if(judgeMount)judgeMount.innerHTML='';
  document.getElementById('matrix-ov').classList.add('show');
  const phrases=['Модели передают результаты…','Структурный анализ проверяет связи…','Проверяем разнообразие…','Формируем итоговую матрицу…'];
  for(let i=0;i<phrases.length;i++){body.innerHTML='<div class="if-empty">'+phrases[i]+'</div>';await new Promise(r=>setTimeout(r,260));}
  const{l,ctx,cons}=st;
  const pairKey=(a,b)=>Math.min(a,b)+'-'+Math.max(a,b);
  /* кандидаты: строки моделей + строки поля; контрольный режим — свежий random */
  let pool;
  if(st.pickMode==='random'){
    pool=Array.from({length:st.pickN},()=>({modelId:'control',modelName:'Контрольная random',family:'Равномерная случайность',m:rnd(l.mB,l.pM).sort((a,b)=>a-b),b:(drawBonusCount(l)&&l.bB)?rnd(l.bB,drawBonusCount(l)).sort((a,b)=>a-b):[],typeName:'Контрольная random-строка'}));
  }else{
    pool=[...st.modelRows,...st.fieldRows].map(r=>{const fixed=normalizeGeneratedRow(r,l);return{...r,m:fixed.m,b:fixed.b};});
  }
  pool.forEach(r=>{r.cs=CONS_candidateScore(r,st);});
  /* режим-зависимый детерминированный порядок: при равных целях режимы выбирают разное */
  {let seed=0;for(const ch of st.pickMode)seed=(seed*31+ch.charCodeAt(0))>>>0;
   const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}}
  /* Этап 2: последовательный диверсифицированный выбор */
  const chosen=[],usedPairs=new Set();
  const dedup=new Set();
  pool=pool.filter(r=>{const k=r.m.join(',');if(dedup.has(k))return false;dedup.add(k);return true;});
  while(chosen.length<st.pickN&&pool.length){
    let best=null,bv=-1e9;
    for(const r of pool){
      let maxOv=0,newP=0;
      const prs=[];
      for(let i=0;i<r.m.length;i++)for(let j=i+1;j<r.m.length;j++)prs.push(pairKey(r.m[i],r.m[j]));
      newP=prs.filter(p=>!usedPairs.has(p)).length;
      for(const c of chosen){const ov=c.m.filter(x=>r.m.includes(x)).length;if(ov>maxOv)maxOv=ov;}
      let v=r.cs;
      if(st.pickMode==='consensus')v=r.cs*1.4-maxOv*6;
      if(st.pickMode==='balance'){const ev=r.m.filter(x=>x%2===0).length;v=r.cs-Math.abs(ev-r.m.length/2)*10-maxOv*8;}
      if(st.pickMode==='coverage')v=newP*1000+r.cs;
      if(st.pickMode==='minoverlap')v=-maxOv*1000+r.cs;
      if(st.pickMode==='mixed'){
        const want=['consensus','balanced','coverage','diverse','control'][chosen.length%5];
        v=r.cs-maxOv*8+((r.typeName||'').toLowerCase().includes(want)||r.modelId==='field'?12:0);
      }
      if(st.pickMode==='random')v=Math.random();
      if(v>bv){bv=v;best=r;}
    }
    if(!best)break;
    const prs=[];for(let i=0;i<best.m.length;i++)for(let j=i+1;j<best.m.length;j++)prs.push(pairKey(best.m[i],best.m[j]));
    best.newPairs=prs.filter(p=>!usedPairs.has(p)).length;
    best.overlapPrev=chosen.length?Math.max(...chosen.map(c=>c.m.filter(x=>best.m.includes(x)).length)):0;
    prs.forEach(p=>usedPairs.add(p));
    chosen.push(best);
    pool=pool.filter(r=>r!==best);
  }
  const matrixRows=ensureUniqueGeneratedRows(chosen.map(r=>{const fixed=normalizeGeneratedRow(r,l);return{...r,m:fixed.m,b:fixed.b};}),l);
  st.matrix=matrixRows;
  try{localStorage.setItem('loto_matrix_exp',JSON.stringify({lottery:cur,mode:st.pickMode,n:st.pickN,date:new Date().toISOString(),rows:matrixRows.map(r=>({m:r.m,b:r.b,model:r.modelId,cs:r.cs}))}));}catch(e){}
  /* рендер итоговой матрицы */
  const totalCand=st.modelRows.length+st.fieldRows.length;
  document.getElementById('matrix-sub').textContent=matrixRows.length+' '+rowWord(matrixRows.length)+' из '+totalCand+' исследовательских результатов';
  document.getElementById('matrix-ctx').textContent=ctx.lotteryName+' · последние '+ctx.currentDraws.length+' доступных тиражей · режим: '+(PICK_MODES.find(m=>m[0]===st.pickMode)||[])[1];
  body.innerHTML=matrixRows.map((r,i)=>{
    const who=r.modelId==='field'?('Структурное поле данных · '+(r.typeName||'')):(r.modelName+(r.family?' · '+r.family:''));
    const supModels=new Set(),supFams=new Set();
    r.m.forEach(n=>{st.modelRows.forEach(mr=>{if(mr.m.includes(n)){supModels.add(mr.modelId);supFams.add(mr.family);}});});
    r._exp='Числа строки поддержали '+supModels.size+' моделей из '+CONS_MODELS.length+' ('+supFams.size+' семейств). '+(r.explanation||'')+' Включена в матрицу за '+(st.pickMode==='coverage'?'вклад в покрытие пар':(st.pickMode==='minoverlap'?'минимальное пересечение':'сочетание Candidate Score и разнообразия'))+'. Анализ выполнен по '+ctx.currentDraws.length+' последним тиражам '+ctx.lotteryName+'.';
    return '<div class="if-rowcard"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="if-rowtype">Строка '+(i+1)+' · '+who+'</span><span class="if-rowscore">CS '+r.cs+'<span class="mx-info" data-loto-event-click="MATRIX_info('+i+')">ⓘ</span></span></div>'+
      '<div class="if-rowballs">'+r.m.map(n=>'<div class="if-rball rb-m-'+l.cls+'">'+n+'</div>').join('')+(r.b&&r.b.length?'<div style="width:6px"></div>'+r.b.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>'+
      '<div class="if-rowexp">Добавляет '+r.newPairs+' новых пар'+(i?' · пересечение с предыдущими: до '+r.overlapPrev+' чисел':'')+'</div></div>';
  }).join('');
}
function MATRIX_info(i){
  const r=CONS_state&&CONS_state.matrix&&CONS_state.matrix[i];
  if(r)showFeedback('Строка '+(i+1),r._exp,'💠',8000);
}
async function MATRIX_copy(btn){
  const st=CONS_state;
  if(!st||!st.matrix||!st.matrix.length)return;
  try{
    await writeClipboardText(rowsToShareText(st.matrix,st.l,st.ctx.lotteryName+' · итоговая матрица консенсуса'));
    setCopyButtonState(btn||document.getElementById('matrix-copy-btn'));
    showCopyToast('Матрица скопирована');
  }catch(e){
    showFeedback('Не скопировано','Браузер запретил доступ к буферу обмена. Попробуйте ещё раз после разрешения.','⚠️',3400);
  }
}
function MATRIX_close(){document.getElementById('matrix-ov').classList.remove('show');}
function MATRIX_use(){
  const st=CONS_state;if(!st||!st.matrix)return;
  MATRIX_close();CONS_close();
  setGeneratedRows(st.matrix,'Готово: '+st.matrix.length+' '+rowWord(st.matrix.length)+' · Итоговая матрица консенсуса · '+st.ctx.lotteryName+'.',true);
}
function MATRIX_judge(){
  const st=CONS_state;
  if(!st||!st.matrix||!st.matrix.length){showFeedback('Матрица пуста','Сначала сформируй итоговую матрицу.','✋',2400);return;}
  JUDGE_open('matrix',st.matrix.map(r=>({m:[...r.m],b:[...(r.b||[])]})),'matrix-jmount',(finalRows,meta)=>{
    MATRIX_close();CONS_close();
    const decision=JUDGE_choiceText(meta);
    setGeneratedRows(finalRows,'Проверенная судьёй матрица перенесена в симулятор. '+decision+'.');
  },{
    intro:'Судья проверяет уже собранную итоговую матрицу и только предлагает точечные замены. Нажми на любую замену, чтобы принять или отклонить её; остальные строки сохранятся как есть.',
    applyLabel:'Использовать проверенную матрицу'
  });
}


/* ═══════════════ ПОДЕЛИТЬСЯ (Web Share API + буфер) ═══════════════ */
function rowsAsText(rws,l){
  return rws.map((r,i)=>(i+1)+') '+r.m.join(' ')+(r.b&&r.b.length?' | '+r.b.join(' '):'')).join('\n');
}
async function shareText(title,text){
  const appUrl=location.href.split(/[?#]/)[0];
  const payload={title,text:text+'\n\n🎰 Loto Simulator · '+appUrl};
  if(navigator.share){try{await navigator.share(payload);return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(payload.text);showCopyToast('📋 Скопировано — вставь в любой мессенджер');}
  catch(e){showFeedback('Поделиться','Скопируй вручную:\n\n'+payload.text,'📤',9000);}
}
function shareRows(){
  const l=L();fillAll();
  const good=rows.filter(r=>r.m.length===l.pM);
  if(!good.length){showFeedback('Пусто','Сначала заполни хотя бы один ряд.','✋',2400);return;}
  shareText('Мои ряды · '+l.name,'Мои ряды · '+l.name+'\n'+rowsAsText(good,l));
}
function shareMatrix(){
  const st=CONS_state;
  if(!st||!st.matrix){showFeedback('Матрица пуста','Сначала сформируй выборку.','✋',2400);return;}
  shareText('Матрица консенсуса · '+st.ctx.lotteryName,'Итоговая матрица консенсуса · '+st.ctx.lotteryName+'\n'+rowsAsText(st.matrix,st.l));
}

/* ═══════════════ ПОБЕДНАЯ КОМБИНАЦИЯ + БИЛЕТ ═══════════════ */
function ticketOrCombo(ev){
  if(ev&&ev.target&&ev.target.closest('button'))return;
  if(lastDraw)TK_open();else WC_open();
}
var WC_draw=null;
async function WC_open(){
  const l=L();
  const draws=await loadD(cur);
  if(!draws.length){
    showFeedback('База пуста','Обнови официальные результаты на вкладке «Аналитика» — и здесь появится последний опубликованный результат '+(l.short||l.name)+'.','📭',4200);
    return;
  }
  const d=draws[0];WC_draw=d;
  document.getElementById('wc-title').textContent='🎯 Результат симуляции · '+(l.short||l.name);
  document.getElementById('wc-date').textContent='Тираж '+d.date;
  document.getElementById('wc-balls').innerHTML=
    (d.main||[]).map(n=>'<div class="if-rball rb-m-'+l.cls+'">'+n+'</div>').join('')+
    ((d.bonus&&d.bonus.length)?'<div style="width:8px"></div>'+d.bonus.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'');
  let info='Официально опубликованные числа последнего тиража.';
  if(d.prizes&&d.prizes.length){
    const top=d.prizes.find(x=>x&&(x.winners>0)&&x.prizeNOK)||d.prizes[0];
    if(top&&top.prizeNOK)info+=' Лучший выплаченный приз: '+Number(top.prizeNOK).toLocaleString(appLocale())+' '+l.currency+'.';
  }
  document.getElementById('wc-info').textContent=info;
  document.getElementById('wc-ov').classList.add('show');
}
function WC_close(){document.getElementById('wc-ov').classList.remove('show');}
function WC_check(){
  if(!WC_draw)return;
  WC_close();
  try{
    const openBtn=document.querySelector('[onclick="toggleChk()"]');
    document.getElementById('chk-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){}
  showCopyToast('🔍 Заполни свои числа в «Проверить билет» — сравнение с тиражом '+WC_draw.date);
}
async function WC_fav(){
  if(!WC_draw)return;
  const l=L(),favs=await loadFav();
  favs.unshift({name:'🎯 Тираж '+WC_draw.date+' · '+(l.short||l.name),rows:[{m:[...(WC_draw.main||[])],b:[...(WC_draw.bonus||[])]}],lot:cur});
  await saveFavs(favs.slice(0,10));
  await renderFavs();
  showCopyToast('⭐ Комбинация сохранена в Избранное');
}
function WC_share(){
  if(!WC_draw)return;
  const l=L();
  shareText('Результат симуляции · '+(l.short||l.name),
    '🎯 Результат симуляции '+(l.short||l.name)+' · тираж '+WC_draw.date+'\n'+
    (WC_draw.main||[]).join(' ')+((WC_draw.bonus&&WC_draw.bonus.length)?' | '+WC_draw.bonus.join(' '):''));
}
function TK_open(){
  if(!lastDraw)return;
  const l=L();
  document.getElementById('tk-sub').textContent=l.name+' · симуляция тиража';
  document.getElementById('tk-body').innerHTML=
    '<div class="if-seclbl" style="margin-top:0">Выпавшие числа</div><div class="if-rowballs">'+
    lastDraw.main.map(n=>'<div class="if-rball rb-m-'+l.cls+'">'+n+'</div>').join('')+
    (lastDraw.bonus.length?'<div style="width:8px"></div>'+lastDraw.bonus.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>'+
    '<div class="if-seclbl">Мои ряды · '+rows.length+'</div>'+document.getElementById('wb-rows').innerHTML;
  document.getElementById('ticket-ov').classList.add('show');
}
function TK_close(){document.getElementById('ticket-ov').classList.remove('show');}

/* ═══════════════ ВЕРХОВНЫЙ СУДЬЯ ═══════════════ */
var SUP_state=null;
function SUP_open(src){
  const l=L();
  let srcRows=[],label='';
  if(src==='sim'){fillAll();srcRows=rows.filter(r=>r.m.length===l.pM).map(r=>({m:[...r.m],b:[...(r.b||[])]}));label=`Анализирую ${srcRows.length} ${rowWord(srcRows.length)} из симулятора · ${l.short||l.name}`;}
  else{const st=CONS_state;if(st&&st.matrix)srcRows=st.matrix.map(r=>({m:[...r.m],b:[...(r.b||[])]}));label=`Анализирую ${srcRows.length} ${rowWord(srcRows.length)} итоговой матрицы · ${l.short||l.name}`;}
  if(srcRows.length<2){showFeedback('Мало данных','Судье нужно минимум 2 заполненных ряда.','⚖️',3000);return;}
  const processingRows=prepareRowsForGroupAnalysis(srcRows,'judge');
  SUP_state={src,srcRows:processingRows,n:Math.min(3,processingRows.length)};
  document.getElementById('sup-src').textContent=label;
  document.getElementById('sup-counts').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>'<button class="pick-cnt'+(n===SUP_state.n?' on':'')+'" data-loto-event-click="SUP_setN('+n+',this)">'+n+'</button>').join('');
  document.getElementById('sup-result').innerHTML='';
  document.getElementById('sup-go').style.display='';
  document.getElementById('sup-ov').classList.add('show');
}
function SUP_setN(n,el){SUP_state.n=n;document.querySelectorAll('#sup-counts .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));}
function SUP_close(){document.getElementById('sup-ov').classList.remove('show');}
async function SUP_go(){
  const st=SUP_state;if(!st)return;
  const l=L(),res=document.getElementById('sup-result');
  res.innerHTML='<div class="if-empty" style="padding:20px">⚖️ Судья взвешивает голоса рядов и структуру поля…</div>';
  await new Promise(r=>setTimeout(r,60));
  const ctx=await IF_ctx();
  /* голоса чисел в переданных рядах */
  const support=new Array(l.mB+1).fill(0),supB=new Array((l.bB||0)+1).fill(0);
  st.srcRows.forEach(r=>{r.m.forEach(n=>{if(n>=1&&n<=l.mB)support[n]++;});(r.b||[]).forEach(n=>{if(l.bB&&n>=1&&n<=l.bB)supB[n]++;});});
  /* сила поля по выбранному периоду */
  let A=null,Ab=null;
  if(ctx.currentDraws.length>=5){
    A=IF_scores(ctx.currentDraws,'main',l.mB,l.pM);
    const bc=drawBonusCount(l);
    Ab=(l.bB&&bc)?IF_scores(ctx.currentDraws,'bonus',l.bB,bc):null;
  }
  const maxSup=Math.max(...support,1);
  const w=new Array(l.mB+1).fill(0);
  for(let n=1;n<=l.mB;n++){
    const sup=support[n]/maxSup;
    const fld=A?((A.scores[n-1]||{}).score||0)/100:0.5;
    w[n]=Math.pow(0.55*sup+0.45*fld,2.4);
  }
  const bc=drawBonusCount(l);
  const maxSupB=Math.max(...supB,1);
  const wb=new Array((l.bB||0)+1).fill(0);
  if(l.bB)for(let n=1;n<=l.bB;n++){
    const sup=supB[n]/maxSupB;
    const fld=Ab?((Ab.scores[n-1]||{}).score||0)/100:0.5;
    wb[n]=Math.pow(0.55*sup+0.45*fld,2.2)||0.01;
  }
  const verdict=[];
  for(let i=0;i<st.n;i++){
    const used=new Set(verdict.flatMap(r=>r.m));
    const wi=w.map((x,idx)=>used.has(idx)?x*0.25:x);
    const m=weightedDistinct(wi,l.pM,l.mB,Math.random).sort((a,b)=>a-b);
    const b=(l.bB&&bc)?weightedDistinct(wb,bc,l.bB,Math.random).sort((a,b)=>a-b):[];
    verdict.push({m,b});
  }
  st.verdict=ensureUniqueGeneratedRows(verdict,l);
  const issued=st.verdict;
  res.innerHTML='<div class="if-seclbl">Вердикт судьи · '+verdict.length+' '+rowWord(verdict.length)+'</div>'+
    issued.map((r,i)=>'<div class="if-rowballs">'+r.m.map(n=>'<div class="if-rball rb-m-'+l.cls+'">'+n+'</div>').join('')+(r.b.length?'<div style="width:6px"></div>'+r.b.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>').join('')+
    '<div class="if-note">Судья объединил голоса твоих рядов ('+st.srcRows.length+') со структурным баллом последних '+(ctx.currentDraws.length)+' тиражей и собрал разнообразный вердикт. Это исследовательские строки, а не прогноз.</div>'+
    '<button class="btn-draw '+l.cls+'" style="margin-top:10px" data-loto-event-click="SUP_use()">Использовать в симуляторе</button>'+
    '<button class="btn-exp" style="margin-top:8px" data-loto-event-click="SUP_share()">📤 Поделиться вердиктом</button>';
  document.getElementById('sup-go').style.display='none';
}
function SUP_use(){
  const st=SUP_state;if(!st||!st.verdict)return;
  SUP_close();try{MATRIX_close();CONS_close();}catch(e){}
  setGeneratedRows(st.verdict,'Готово: '+st.verdict.length+' '+rowWord(st.verdict.length)+' · Верховный судья.',true);
}
function SUP_share(){
  const st=SUP_state;if(!st||!st.verdict)return;
  shareText('Вердикт Верховного судьи · '+L().name,'⚖️ Вердикт Верховного судьи · '+L().name+'\n'+rowsAsText(st.verdict,L()));
}

/* ═══════════════ ПЕРИОД АНАЛИЗА: динамические пресеты от базы ═══════════════ */
async function PERIOD_range(){
  const from=document.getElementById('period-from').value,to=document.getElementById('period-to').value;
  if(!from||!to||from>to){showCopyToast('Укажи корректный диапазон: «от» раньше «до»');return;}
  const cnt=IF_window(await loadD(cur)).length; /* предпросчёт по текущим значениям невозможен до set — считаем вручную */
  const draws=await loadD(cur);
  const inRange=draws.filter(d=>d&&d.date&&d.date>=from&&d.date<=to).length;
  if(inRange<5){showCopyToast('В этом диапазоне только '+inRange+' тиражей — нужно минимум 5');return;}
  IF_setRange(from,to);CONS_reset();
  PERIOD_close();PERIOD_refreshLabel();
  showCopyToast('🗓 Диапазон: '+from+' — '+to+' · '+inRange+' тиражей');
}
async function PERIOD_open(){
  const l=L(),draws=await loadD(cur),n=draws.length;
  /* заполняем границы дат из базы */
  if(n){
    const newest=draws[0].date,oldest=draws[n-1].date;
    const pf=document.getElementById('period-from'),pt=document.getElementById('period-to');
    pf.min=oldest;pf.max=newest;pt.min=oldest;pt.max=newest;
    const r=IF_getRange();
    pf.value=r?r.from:oldest;pt.value=r?r.to:newest;
  }
  const y=d=>{const now=Date.now();return draws.filter(x=>x&&x.date&&(now-new Date(x.date).getTime())<=d*365.25*24*3600*1000).length;};
  const presets=[[0,'Вся база · '+n+' тиражей']];
  [[1,'За 1 год'],[2,'За 2 года'],[3,'За 3 года']].forEach(([yy,lbl])=>{const c=y(yy);if(c>=10&&c<n)presets.push([c,lbl+' · '+c]);});
  [150,100,50].forEach(k=>{if(n>k)presets.push([k,'Последние '+k]);});
  document.getElementById('period-note').textContent='Для '+(l.short||l.name)+' доступно '+n+' тиражей. Все модели, структурный анализ и консенсус будут считать по выбранному периоду.';
  const curW=IF_getRange()?-1:IF_getWin();
  document.getElementById('period-presets').innerHTML=presets.map(([v,lbl])=>'<div class="pick-mode'+(v===curW?' on':'')+'" data-loto-event-click="PERIOD_set('+v+')"><div class="pick-mode-t">'+lbl+'</div></div>').join('');
  document.getElementById('period-custom').max=n;
  document.getElementById('period-ov').classList.add('show');
}
function PERIOD_close(){document.getElementById('period-ov').classList.remove('show');}
function PERIOD_set(v){
  IF_setWin(v);CONS_reset();
  PERIOD_close();
  PERIOD_refreshLabel();
  showCopyToast('🗓 Период: '+(v>0?'последние '+v+' тиражей':'вся база'));
}
function PERIOD_custom(){
  const v=parseInt(document.getElementById('period-custom').value);
  if(!isFinite(v)||v<5){showCopyToast('Минимум 5 тиражей');return;}
  PERIOD_set(v);
}
async function PERIOD_refreshLabel(){
  const w=IF_getWin(),r=IF_getRange(),draws=await loadD(cur),n=draws.length;
  const btn=document.getElementById('if-win-btn'),note=document.getElementById('if-win-note');
  if(r){
    const cnt=draws.filter(d=>d&&d.date&&d.date>=r.from&&d.date<=r.to).length;
    if(btn)btn.textContent='Диапазон ▾';
    if(note)note.textContent=r.from+' — '+r.to+' · '+cnt+' тиражей';
    return;
  }
  if(btn)btn.textContent=(w>0?w+' тиражей':'Вся база')+' ▾';
  if(note)note.textContent=w>0?('Последние '+Math.min(w,n)+' из '+n+' доступных'):('Вся доступная база · '+n+' тиражей');
}

/* ═══════════════ АВТОПРОВЕРКА БИЛЕТОВ + ПРАЗДНИК ═══════════════ */
function CELE_show(title,msg,icon){
  const burst=document.getElementById('cele-burst');
  const EMO=['🎉','✨','💰','🪙','⭐','🏆','🎊'];
  burst.innerHTML=Array.from({length:36},()=>{
    const e=EMO[Math.floor(Math.random()*EMO.length)];
    const left=Math.random()*100,dur=(2.2+Math.random()*2.4).toFixed(2),delay=(Math.random()*1.2).toFixed(2),size=(14+Math.random()*14).toFixed(0);
    return '<span class="cele-p" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;font-size:'+size+'px">'+e+'</span>';
  }).join('');
  document.getElementById('cele-icon').textContent=icon||'🏆';
  document.getElementById('cele-title').textContent=title;
  document.getElementById('cele-msg').textContent=msg;
  document.getElementById('cele-ov').classList.add('show');
}
function CELE_close(){document.getElementById('cele-ov').classList.remove('show');}
function notifyAllowed(){return localStorage.getItem('loto_notify')==='1'&&typeof Notification!=='undefined'&&Notification.permission==='granted';}
/* Shared 🔔 Notifications section — thin UI over LotoNotifications (one engine for
   iOS/APNs, Android/FCM, Web Push). The legacy in-app "win alert" is folded into the
   saved_ticket_results category; loto_notify is kept mirrored so autoCheckFavorites still
   works as a local fallback while the app is open. */
function NOTIF_lotList(){try{return Object.keys(LOTS);}catch(e){return[];}}
/* selected_lotteries tri-state, shared with notification-center.js: [] = all, ['__none__'] = none, [ids...] = subset. The sentinel matches no real lottery, so the backend delivers nothing for it. */
var NOTIF_NONE='__none__';
function NOTIF_selectedGames(sel){sel=sel||[];if(sel.indexOf(NOTIF_NONE)>=0)return[];const all=NOTIF_lotList();if(!sel.length)return all.slice();return all.filter(id=>sel.indexOf(id)>=0);}
function NOTIF_canonLots(ids){const all=NOTIF_lotList();const uniq=all.filter(id=>ids.indexOf(id)>=0);if(!uniq.length)return[NOTIF_NONE];if(uniq.length===all.length)return[];return uniq;}
function NOTIF_boot(){
  if(!window.LotoNotifications)return;
  window.LotoNotifications.onChange(NOTIF_render);
  window.LotoNotifications.init();
  window.addEventListener('loto-push-open',e=>NOTIF_openDestination(e.detail||{}));
  try{navigator.serviceWorker&&navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='LOTO_PUSH_OPEN')NOTIF_openDestination(e.data.data||{});});}catch(e){}
  NOTIF_consumeUrlDeepLink();
}
function NOTIF_openDestination(d){
  try{
    const lot=d.lotteryId;
    if(lot&&LOTS[lot])selLot(lot);                 // preserve chosen lottery; never reset to Lotto
    const dest=d.destination||'simulator';
    selPage(dest==='analytics'?'ana':'sim');        // check + simulator both live on the sim page
  }catch(e){}
}
function NOTIF_consumeUrlDeepLink(){
  try{const q=new URLSearchParams(location.search);if(q.get('n_dest')){NOTIF_openDestination({destination:q.get('n_dest'),lotteryId:q.get('n_lot'),notificationType:q.get('n_type'),drawId:q.get('n_draw')});history.replaceState(null,'',location.pathname);}}catch(e){}
}
function NOTIF_master(on){
  if(on){document.getElementById('notif-explain').style.display='block';const m=document.getElementById('notif-master');if(m)m.checked=false;}
  else{window.LotoNotifications.disableMaster().then(NOTIF_mirrorLegacy);}
}
function NOTIF_allow(){document.getElementById('notif-explain').style.display='none';window.LotoNotifications.enableMaster().then(NOTIF_mirrorLegacy);}
function NOTIF_notNow(){document.getElementById('notif-explain').style.display='none';}
function NOTIF_cat(k,v){window.LotoNotifications.setCategory(k,v).then(()=>{NOTIF_mirrorLegacy();if(k==='saved_ticket_results')NOTIF_syncWatches(v);});}
/* Saved tickets live only on-device. When saved_ticket_results is ON, register the local
   favorites as minimal server-side watches so results can be checked while the app is closed;
   OFF clears them. Numbers only, no extra data. */
async function NOTIF_collectWatches(){
  try{
    const favs=await loadFav();const out=[];
    favs.forEach(f=>{const lot=f.lot;if(!lot||!LOTS[lot])return;(f.rows||[]).forEach(r=>{if(r&&Array.isArray(r.m)&&r.m.length)out.push({lotteryId:lot,main:r.m,special:Array.isArray(r.b)?r.b:[]});});});
    return out;
  }catch(e){return[];}
}
async function NOTIF_syncWatches(enabled){
  if(!window.LotoNotifications)return;
  const watches=enabled?await NOTIF_collectWatches():[];
  window.LotoNotifications.syncWatches(watches,enabled);
}
function NOTIF_allLots(on){window.LotoNotifications.setSelectedLotteries(on?[]:[NOTIF_NONE]);}
function NOTIF_toggleLot(id){const s=window.LotoNotifications.getState();const sel=NOTIF_selectedGames(s.prefs.selected_lotteries);const i=sel.indexOf(id);if(i>=0)sel.splice(i,1);else sel.push(id);window.LotoNotifications.setSelectedLotteries(NOTIF_canonLots(sel));}
function NOTIF_openSettings(){if(!window.LotoNotifications.openAppSettings())showFeedback('Настройки','Откройте настройки устройства → приложение → Уведомления.','🔔',4200);}
function NOTIF_mirrorLegacy(){const s=window.LotoNotifications.getState();const on=s.prefs.enabled&&s.prefs.saved_ticket_results&&s.permission==='granted';try{localStorage.setItem('loto_notify',on?'1':'0');}catch(e){}}
function NOTIF_render(s){
  const card=document.getElementById('notif-card');if(!card)return;
  card.style.display='';
  const P=window.LotoNotifications.PHASE;
  const native=s.platform==='ios'||s.platform==='android'||window.LotoNativeBilling?.isNative;
  const show=(id,on)=>{const el=document.getElementById(id);if(el)el.style.display=on?'':'none';};
  const unsupported=document.getElementById('notif-unsupported');
  if(unsupported)unsupported.textContent=native
    ?'Push-уведомления недоступны в этой сборке приложения. Обновите приложение или проверьте системные разрешения.'
    :'Push-уведомления недоступны в этом браузере';
  show('notif-unsupported',s.phase===P.NOT_SUPPORTED);
  show('notif-install',s.phase===P.NEEDS_INSTALL);
  show('notif-denied',s.phase===P.DENIED);
  show('notif-main',s.supported&&s.phase!==P.NEEDS_INSTALL&&s.phase!==P.DENIED);
  const master=document.getElementById('notif-master');if(master)master.checked=s.prefs.enabled&&s.permission==='granted';
  show('notif-cats',s.prefs.enabled&&s.permission==='granted');
  ['draw_results','jackpot_updates','prize_breakdown','deadline_reminders','saved_ticket_results'].forEach(k=>{const el=document.getElementById('notif-cat-'+k);if(el)el.checked=s.prefs[k]!==false;});
  const picked=NOTIF_selectedGames(s.prefs.selected_lotteries);const all=picked.length===NOTIF_lotList().length;const allEl=document.getElementById('notif-all-lots');if(allEl)allEl.checked=all;
  const wrap=document.getElementById('notif-lot-chips');
  if(wrap){wrap.style.display=all?'none':'flex';wrap.innerHTML='';NOTIF_lotList().forEach(id=>{const l=LOTS[id];const chip=document.createElement('div');chip.className='notif-lot-chip'+(picked.indexOf(id)>=0?' on':'');chip.textContent=(l.flag||'')+' '+(l.short||l.name||id);chip.onclick=()=>NOTIF_toggleLot(id);wrap.appendChild(chip);});}
  const lbl=document.getElementById('notif-state-label');
  if(lbl){
    const preparing=s.phase===P.GRANTED&&s.prefs.enabled&&!s.transportReady;
    lbl.textContent=s.phase===P.ACTIVE?'· Включены':preparing?'· Готовим уведомления':s.phase===P.DENIED?'· Отключены системой':s.phase===P.NOT_SUPPORTED?(native?'· Недоступны в приложении':'· Недоступны в этом браузере'):'';
  }
}
/* сверка избранного с новыми тиражами всех игр */
async function autoCheckFavorites(){
  try{
    const favs=await loadFav();
    if(!favs.length)return;
    const wins=[],misses=[];
    for(const id of Object.keys(LOTS)){
      const myFavs=favs.filter(f=>f.lot===id&&f.rows&&f.rows.length);
      if(!myFavs.length)continue;
      const draws=await loadD(id);
      if(!draws.length)continue;
      const lastKey='loto_lastchk_'+id;
      const lastChecked=localStorage.getItem(lastKey)||'';
      const fresh=draws.filter(d=>d&&d.date&&d.date>lastChecked);
      if(!fresh.length)continue;
      localStorage.setItem(lastKey,draws[0].date);
      const l=LOTS[id];
      for(const d of fresh){
        for(const f of myFavs){
          for(const r of f.rows){
            const p=checkPrize(r.m||[],r.b||[],d.main||[],d.bonus||[],l);
            if(p)wins.push({game:l.short||l.name,date:d.date,name:p.name,row:r,cur:l.currency,lvl:p.lvl});
          }
        }
      }
      misses.push(l.short||l.name);
    }
    if(wins.length){
      wins.sort((a,b)=>b.lvl-a.lvl);
      const top=wins[0];
      const msg=wins.slice(0,4).map(w=>w.game+' · тираж '+w.date+'\n'+w.name+'\nРяд: '+w.row.m.join(' ')+(w.row.b&&w.row.b.length?' | '+w.row.b.join(' '):'')).join('\n\n')+(wins.length>4?'\n\n…и ещё '+(wins.length-4):'');
      CELE_show(top.lvl>=7?'🏆 ДЖЕКПОТ!':'🎉 ЕСТЬ ВЫИГРЫШ!',msg,top.lvl>=7?'🏆':'💰');
      if(notifyAllowed())try{new Notification('🎰 Loto Simulator: есть выигрыш!',{body:top.game+' · '+top.name});}catch(e){}
    }else if(misses.length){
      showCopyToast('🎫 Избранное сверено с новыми тиражами ('+misses.join(', ')+') — побед в этом туре нет');
    }
  }catch(e){}
}
/* праздник и в симуляторе при реальном призовом уровне */
const _origShowBanner=showBanner;
showBanner=function(dM,dB){
  _origShowBanner(dM,dB);
  try{renderCrowd(dM,dB);}catch(e){}
  try{
    const l=L();let best=null;
    rows.forEach(row=>{const p=checkPrize(row.m,row.b,dM,dB,l);if(p&&(!best||p.lvl>best.lvl))best=p;});
    if(best&&best.lvl>=4){
      /* средний реальный приз этого уровня из базы, если есть */
      let extra='';
      try{
        const tiers=getPrizeTiers(l);
      }catch(e){}
      setTimeout(()=>CELE_show(best.lvl>=7?'🏆 ДЖЕКПОТ!':'🎉 КРУПНЫЙ ПРИЗ!',l.name+'\n'+best.name+(extra?'\n'+extra:''),best.lvl>=7?'🏆':'💎'),900);
    }
  }catch(e){}
};
/* хуки */
document.addEventListener('DOMContentLoaded',()=>{
  const lotTabs=document.getElementById('lot-tabs');
  enableHorizontalScroller(lotTabs,true);
  enableHorizontalScroller(document.getElementById('sched-strip'));
  if(lotTabs)lotTabs.addEventListener('scroll',updateLotteryNavArrows,{passive:true});
  window.addEventListener('resize',updateLotteryNavArrows,{passive:true});
  setTimeout(updateLotteryNavArrows,80);
  setTimeout(()=>{PERIOD_refreshLabel();NOTIF_boot();},500);
  setTimeout(autoCheckFavorites,4500);
  let saRaf=0;
  const saUpd=()=>{
    if(saRaf)return; /* защита от каскада мутаций: не чаще кадра */
    saRaf=requestAnimationFrame(()=>{
      saRaf=0;
      const sa=document.getElementById('scroll-anchors'),btn=document.getElementById('sa-btn');
      if(!sa||!btn)return;
      const doc=document.documentElement;
      const full=Math.max(doc.scrollHeight,document.body.scrollHeight);
      const need=full>window.innerHeight*2;
      if(sa.classList.contains('show')!==need)sa.classList.toggle('show',need); /* пишем только при изменении */
      if(!need)return;
      const maxTop=Math.max(0,full-window.innerHeight);
      const mid=(window.scrollY||doc.scrollTop||0)<maxTop/2;
      const want=mid?'↓':'↑';
      if(btn.textContent!==want)btn.textContent=want;
      const dir=mid?'down':'up';
      if(btn.dataset.dir!==dir)btn.dataset.dir=dir;
    });
  };
  /* Собственная плавная прокрутка: видимые шары, стоп касанием */
  let saAnim=0;
  const SA_stop=()=>{if(saAnim){cancelAnimationFrame(saAnim);saAnim=0;document.body.classList.remove('sa-flight');saUpd();}};
  ['touchstart','pointerdown','wheel'].forEach(ev=>window.addEventListener(ev,e=>{
    if(saAnim&&!(e.target&&e.target.closest&&e.target.closest('.sa-btn')))SA_stop();
  },{passive:true}));
  window.SA_go=function(){
    SA_stop();
    const btn=document.getElementById('sa-btn');
    const doc=document.documentElement;
    const full=Math.max(doc.scrollHeight,document.body.scrollHeight);
    const maxTop=Math.max(0,full-window.innerHeight);
    const from=window.scrollY||doc.scrollTop||0;
    const to=btn&&btn.dataset.dir==='down'?maxTop:0;
    const dist=Math.abs(to-from);
    if(dist<2)return;
    /* постоянная крейсерская скорость: мобильный рендер успевает рисовать */
    const V=3.0;                       /* px за мс ≈ 3000 px/с */
    const ramp=260;                    /* мс мягкого разгона и торможения */
    const dur=Math.max(600,Math.min(12000,dist/V+ramp));
    const t0=performance.now();
    const pos=t=>{                     /* трапеция скорости: разгон-крейсер-торможение */
      if(dur<=2*ramp){const x=t/dur;return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}
      const a=ramp/dur, plateau=1-2*a, vNorm=1/(plateau+a);
      const x=t/dur;
      if(x<a)return vNorm*(x*x)/(2*a);
      if(x>1-a){const y=1-x;return 1-vNorm*(y*y)/(2*a);}
      return vNorm*(x-a/2);
    };
    document.body.classList.add('sa-flight'); /* лёгкая графика на время полёта */
    const step=now=>{
      const t=Math.min(dur,now-t0);
      window.scrollTo(0,from+(to-from)*pos(t));
      if(t<dur)saAnim=requestAnimationFrame(step);
      else{saAnim=0;document.body.classList.remove('sa-flight');saUpd();}
    };
    saAnim=requestAnimationFrame(step);
  };
  window.addEventListener('scroll',saUpd,{passive:true});
  window.addEventListener('resize',saUpd);
  new MutationObserver(()=>saUpd()).observe(document.body,{childList:true,subtree:true});
  setTimeout(saUpd,800);
});


/* ═══ ПОДПИСКА: безопасный runtime загружается после основного приложения ═══ */
function openSubInfo(){window.LotoCommercial?.openPaywall('');document.getElementById('pro-ov').classList.add('show');}
function PRO_close(){document.getElementById('pro-ov').classList.remove('show');}
function PRO_showPlans(){window.LotoCommercial?.openPaywall('');}
function PRO_selectPlan(){window.LotoCommercial?.purchase();}
function PRO_selectMethod(){}
function PRO_continueCheckout(){window.LotoCommercial?.purchase();}


/* ═══ Картина тиража: сколько «соседей» выиграло бы (по реальной статистике базы) ═══ */
var CROWD_cache=null,CROWD_lot=null;
async function crowdStats(){
  if(CROWD_cache&&CROWD_lot===cur)return CROWD_cache;
  const l=L();
  let draws=[];
  try{draws=await loadPublicPrizes(cur);}catch{draws=await loadD(cur);}
  const agg={};let n=0;
  for(const d of draws.slice(0,60)){
    const payouts=d&&(d.payoutTiers||d.prizes);
    if(!Array.isArray(payouts)||!payouts.length)continue;
    n++;
    for(const p of payouts){
      if(!p||!p.label)continue;
      (agg[p.label]=agg[p.label]||{w:[],v:[]});
      if(isFinite(p.winners))agg[p.label].w.push(p.winners);
      const amount=prizeTierAmount(p);
      if(isFinite(amount)&&amount>0)agg[p.label].v.push(amount);
    }
  }
  let tiers=Object.entries(agg).map(([label,a])=>({
    label,
    avgW:a.w.length?a.w.reduce((s,x)=>s+x,0)/a.w.length:0,
    avgV:a.v.length?a.v.reduce((s,x)=>s+x,0)/a.v.length:0
  })).filter(t=>t.avgV>0||t.avgW>0);
  let src='real';
  if(!tiers.length){
    /* фолбэк: вероятности уровней × типичный объём проданных рядов */
    src='calc';n=0;
    const vol=Math.max(200000,Math.round(jackpotCombos(l)*0.08)); /* объём рынка: джекпот берётся в ~8% тиражей */
    tiers=getPrizeTiers(l).map(t=>{
      const prob=tierProbability(l,t.match);
      const v=estimatePrizeNok({key:t.match,name:t.label,lvl:0},l)||0;
      return{label:t.label,avgW:prob>0?vol*prob:0,avgV:v};
    }).filter(t=>t.avgW>=0.05&&t.avgV>0);
  }
  tiers.sort((a,b)=>b.avgV-a.avgV);
  CROWD_cache={tiers,n,src};CROWD_lot=cur;
  return CROWD_cache;
}
async function renderCrowd(dM,dB){
  const box=document.getElementById('wb-crowd');
  if(!box)return;
  const l=L();
  const {tiers,n,src}=await crowdStats();
  if(!tiers.length||(src==='real'&&n<3)){box.innerHTML='';return;}
  /* мой лучший уровень в этом тираже */
  let my=null;
  rows.forEach(r=>{const p=checkPrize(r.m,r.b,dM,dB,l);if(p&&(!my||p.lvl>my.lvl))my=p;});
  const jitter=x=>Math.max(0,Math.round(x*(0.82+Math.random()*0.36)));
  box.innerHTML='<div class="crowd-t">🌍 Картина тиража</div>'+
    tiers.slice(0,10).map(t=>{
      const isMe=my&&my.name&&t.label&&my.name.replace(/\s/g,'')===t.label.replace(/\s/g,'');
      const w=jitter(t.avgW);
      return '<div class="crowd-row'+(isMe?' me':'')+'"><span class="crowd-tier">'+t.label+(isMe?' · + ты! 🎉':'')+'</span><span class="crowd-n">'+(w>0?w.toLocaleString(appLocale())+' чел.':'—')+'</span><span class="crowd-p">'+(t.avgV?fmtInt(t.avgV)+' '+(l.currency||'NOK'):'')+'</span></div>';
    }).join('')+
    '<div class="crowd-note">'+(src==='real'?('Смоделировано по средним из '+n+' последних реальных тиражей '+(l.short||l.name)+'.'):'Оценка по вероятностям уровней и типичному объёму продаж — живые призовые появятся после обновления официальных результатов.')+'</div>';
}


/* ═══════════ КВАНТОВО-АСТРАЛЬНЫЙ ГЕНЕРАТОР ═══════════
   Криптографическая энтропия устройства +
   настоящая астрономия (фаза Луны, Луна в знаке на дату тиража).
   Символическая интерпретация, не предсказание — шансы не меняет. */
var QA_state=null;
var QA_skipSession=false; /* «пропустить» действует только до следующего открытия генератора */
const QA_ZODIAC=[['♈','Овен'],['♉','Телец'],['♊','Близнецы'],['♋','Рак'],['♌','Лев'],['♍','Дева'],['♎','Весы'],['♏','Скорпион'],['♐','Стрелец'],['♑','Козерог'],['♒','Водолей'],['♓','Рыбы']];
const QA_PHASES=[['🌑','Новолуние'],['🌒','Растущий серп'],['🌓','Первая четверть'],['🌔','Растущая Луна'],['🌕','Полнолуние'],['🌖','Убывающая Луна'],['🌗','Последняя четверть'],['🌘','Убывающий серп']];
function QA_daysJ2000(d){return (d.getTime()/86400000)-10957.5;}
function QA_moonPhase(d){
  const syn=29.530588853;
  const age=((QA_daysJ2000(d)-5.597)%syn+syn)%syn; /* от новолуния 06.01.2000 18:14 UTC */
  const idx=Math.floor((age/syn)*8+0.5)%8;
  const illum=Math.round((1-Math.cos(2*Math.PI*age/syn))/2*100);
  return{idx,age,illum,emoji:QA_PHASES[idx][0],name:QA_PHASES[idx][1]};
}
function QA_moonSign(d){
  /* Низкоточная астрономическая модель орбиты Луны с основными возмущениями (~0.5–1°). */
  const day=d.getTime()/86400000-10956;
  const rad=Math.PI/180,norm=x=>((x%360)+360)%360,sin=x=>Math.sin(x*rad);
  const node=norm(125.1228-.0529538083*day),peri=norm(318.0634+.1643573223*day);
  const M=norm(115.3654+13.0649929509*day),e=.0549;
  const E=(M+e*(180/Math.PI)*sin(M)*(1+e*Math.cos(M*rad)))*rad;
  const xv=Math.cos(E)-e,yv=Math.sqrt(1-e*e)*Math.sin(E);
  const trueAnomaly=Math.atan2(yv,xv)/rad;
  let lon=norm(trueAnomaly+peri+node);
  const Ms=norm(356.0470+.9856002585*day),Ls=norm(282.9404+.0000470935*day+Ms);
  const Lm=norm(node+peri+M),D=norm(Lm-Ls),F=norm(Lm-node);
  lon+=-1.274*sin(M-2*D)+.658*sin(2*D)-.186*sin(Ms)-.059*sin(2*M-2*D)
    -.057*sin(M-2*D+Ms)+.053*sin(M+2*D)+.046*sin(2*D-Ms)+.041*sin(M-Ms)
    -.035*sin(D)-.031*sin(M+Ms)-.015*sin(2*F-2*D)+.011*sin(M-4*D);
  return Math.floor(norm(lon)/30);
}
function QA_nextDrawDate(){
  return nextDraw(cur).date;
}
function QA_getSign(){const v=parseInt(localStorage.getItem('loto_zsign'));return isFinite(v)&&v>=0&&v<12?v:null;}
async function QA_rows(count,opts){throw new Error('backend_only');}
function QA_open(){
  const l=L();
  QA_state={n:parseInt(localStorage.getItem('loto_qa_n'))||3};
  const dd=QA_nextDrawDate(),ph=QA_moonPhase(dd),ms=QA_moonSign(dd);
  document.getElementById('qa-ctx').textContent=l.name+' · тираж '+dd.toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'});
  const zs=QA_getSign();
  document.getElementById('qa-signs').innerHTML=QA_ZODIAC.map((z,i)=>'<div class="qa-sign'+(i===zs?' on':'')+'" data-loto-event-click="QA_setSign('+i+',this)"><div class="z">'+z[0]+'</div><div class="zn">'+z[1]+'</div></div>').join('');
  document.getElementById('qa-moon').innerHTML=ph.emoji+' <b>'+ph.name+'</b> · освещённость '+ph.illum+'%<br>Луна в знаке <b>'+QA_ZODIAC[ms][0]+' '+QA_ZODIAC[ms][1]+'</b> на момент тиража';
  document.getElementById('qa-counts').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>'<button class="pick-cnt'+(n===QA_state.n?' on':'')+'" data-loto-event-click="QA_setN('+n+',this)">'+n+'</button>').join('');
  document.getElementById('qa-result').innerHTML='';
  QA_refreshBirthUI();
  document.getElementById('qa-ov').classList.add('show');
  QA_skipSession=false;
  if(QA_getSign()!==null&&!QA_birth())setTimeout(QAB_open,350);
}
function QA_close(){document.getElementById('qa-ov').classList.remove('show');}
function QA_setSign(i,el){
  localStorage.setItem('loto_zsign',i);
  document.querySelectorAll('.qa-sign').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');
  if(!QA_birth()){QA_skipSession=false;setTimeout(QAB_open,300);}
}
function QA_setN(n,el){
  QA_state.n=n;localStorage.setItem('loto_qa_n',n);
  document.querySelectorAll('#qa-counts .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));
}
async function QA_go(){
  const st=QA_state;if(!st)return;
  if(QA_getSign()===null){showCopyToast('✨ Сначала выбери свой знак зодиака');return;}
  if(!QA_birth()&&!QA_skipSession){QAB_open();showCopyToast('🎂 Укажи дату рождения — или нажми «Пропустить»');return;}
  const res=document.getElementById('qa-result');
  res.innerHTML='<div class="if-empty" style="color:#C9B8E8;padding:22px">🔭 Запрашиваю квантовый поток и считаю положение Луны…</div>';
  const l=L();
  const rows=ensureUniqueGeneratedRows(await QA_rows(st.n),l);
  st.rows=rows;
  const{ph,ms,zs,src,drawDate}=rows.meta;
  res.innerHTML=rows.map((r,ri)=>
    '<div class="qa-row"><div class="qa-balls">'+
    r.m.map((n,i)=>'<div class="qa-ball '+(r.tags[i]==='z'?'zres':(r.tags[i]==='m'?'mres':'qb'))+'" style="animation-delay:'+(ri*0.12+i*0.07).toFixed(2)+'s,'+(ri*0.12+i*0.07+0.5).toFixed(2)+'s">'+n+'</div>').join('')+
    (r.b.length?'<div style="width:6px"></div>'+r.b.map((n,bi)=>'<div class="qa-ball bonus" style="width:34px;height:34px;font-size:13px;animation-delay:'+(ri*0.12+(r.m.length+bi)*0.07).toFixed(2)+'s,'+(ri*0.12+(r.m.length+bi)*0.07+0.5).toFixed(2)+'s">'+n+'</div>').join(''):'')+
    '</div></div>').join('')+
    '<div class="qa-legend"><span><span class="qa-dot" style="background:#3DBB8A"></span>звёздные/бонус</span><span><span class="qa-dot" style="background:#E9B44C"></span>твой знак</span><span><span class="qa-dot" style="background:#6BB8E8"></span>фаза Луны</span><span><span class="qa-dot" style="background:#E86BA8"></span>персональный профиль</span><span><span class="qa-dot" style="background:#9B6BE8"></span>случайный источник</span></div>'+
    '<div class="qa-pass">🪪 <b>Звёздный паспорт</b><br>Знак: '+QA_ZODIAC[zs][0]+' '+QA_ZODIAC[zs][1]+' · Луна тиража: '+ph.emoji+' '+ph.name+' ('+ph.illum+'%) в '+QA_ZODIAC[ms][1]+
    (rows.meta.natal?'<br>Натальная Луна: '+QA_ZODIAC[rows.meta.natal.moonSign][0]+' '+QA_ZODIAC[rows.meta.natal.moonSign][1]+(rows.meta.natal.hasTime?' (по времени рождения)':' (~полдень)')+' · Число судьбы: '+rows.meta.natal.lifePath:'')+
    '<br>Тираж: '+drawDate.toLocaleString(appLocale(),{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'<br>Источник случайности: '+src+
    (rows.meta.baseN?'<br>Данные базы: структурные веса рассчитаны по '+rows.meta.baseN+' тиражам':'')+'</div>'+
    '<button class="btn-draw euro qa-go" style="margin-top:12px" data-loto-event-click="QA_use()">Использовать в симуляторе</button>'+
    '<button class="btn-exp" style="margin-top:8px;border-color:#C9A55A;color:#F5CE7B" data-loto-event-click="HORO_open()">📜 Гороскоп на сегодня</button>'+
    '<button class="btn-exp" style="margin-top:8px;border-color:#6B4BA8;color:#E8DEFA" data-loto-event-click="QA_share()">📤 Поделиться со Вселенной</button>';
}
function QA_use(){
  const st=QA_state;if(!st||!st.rows)return;
  QA_close();
  setGeneratedRows(st.rows,'Готово: '+st.rows.length+' '+rowWord(st.rows.length)+' · Квантово-астральный режим.',true);
}
function QA_share(){
  const st=QA_state;if(!st||!st.rows)return;
  const{ph,ms,zs}=st.rows.meta;
  shareText('Квантово-астральный ряд · '+L().name,
    '🔮 Мой квантово-астральный ряд · '+L().name+'\n'+
    rowsAsText(st.rows,L())+'\n'+
    QA_ZODIAC[zs][0]+' '+QA_ZODIAC[zs][1]+' · '+ph.emoji+' '+ph.name+' · Луна в '+QA_ZODIAC[ms][1]);
}


/* ═══ Натальные данные: дата/время рождения → глубокий анализ ═══ */
function QA_birth(){try{const v=JSON.parse(localStorage.getItem('loto_birth'));return v&&v.y?v:null;}catch(e){return null;}}
function QA_zodiacFromDate(d,m){
  /* границы западного зодиака */
  const B=[[3,21,4,19,0],[4,20,5,20,1],[5,21,6,20,2],[6,21,7,22,3],[7,23,8,22,4],[8,23,9,22,5],[9,23,10,22,6],[10,23,11,21,7],[11,22,12,21,8],[12,22,1,19,9],[1,20,2,18,10],[2,19,3,20,11]];
  for(const[m1,d1,m2,d2,z]of B){
    if((m===m1&&d>=d1)||(m===m2&&d<=d2))return z;
  }
  return 9; /* козерог на стыке года */
}
function QA_lifePath(d,m,y){
  let n=String(d)+String(m)+String(y);
  let sum=[...n].reduce((s,c)=>s+ +c,0);
  while(sum>9&&sum!==11&&sum!==22)sum=[...String(sum)].reduce((s,c)=>s+ +c,0);
  return sum;
}
function QA_birthDateObj(b){
  return new Date(b.y,b.m-1,b.d,b.hh!=null?b.hh:12,b.mm!=null?b.mm:0);
}
async function QAB_clear(){
  if(!(await customConfirm('Удалить сохранённую дату рождения?','Удалить',{title:'Удалить сохранённую дату?'})))return;
  localStorage.removeItem('loto_birth');
  ['qab-d','qab-m','qab-y','qab-t'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('qab-clear').style.display='none';
  QA_refreshBirthUI();
  showCopyToast('🗑 Дата рождения удалена');
}
function QAB_open(){
  const b=QA_birth();
  document.getElementById('qab-clear').style.display=b?'':'none';
  if(b){
    document.getElementById('qab-d').value=b.d;
    document.getElementById('qab-m').value=b.m;
    document.getElementById('qab-y').value=b.y;
    document.getElementById('qab-t').value=b.hh!=null?String(b.hh).padStart(2,'0')+':'+String(b.mm).padStart(2,'0'):'';
  }
  document.getElementById('qab-ov').classList.add('show');
}
function QAB_close(){document.getElementById('qab-ov').classList.remove('show');}
function QAB_skip(){QA_skipSession=true;QAB_close();showCopyToast('✨ Хорошо, в этот раз без даты — спрошу снова в следующий');}
function QAB_save(withTime){
  const d=parseInt(document.getElementById('qab-d').value);
  const m=parseInt(document.getElementById('qab-m').value);
  const y=parseInt(document.getElementById('qab-y').value);
  if(!d||!m||!y||d<1||d>31||y<1920||y>2020){showCopyToast('Проверь день, месяц и год');return;}
  const days=[31,((y%4===0&&y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  if(d>days[m-1]){showCopyToast('В этом месяце нет такого дня');return;}
  let hh=null,mm=null;
  if(withTime){
    const t=document.getElementById('qab-t').value;
    if(!t){showCopyToast('Введи время или выбери «Время неизвестно»');return;}
    [hh,mm]=t.split(':').map(Number);
  }
  localStorage.setItem('loto_birth',JSON.stringify({d,m,y,hh,mm}));
  /* автокоррекция знака по дате */
  const realSign=QA_zodiacFromDate(d,m);
  const chosen=QA_getSign();
  if(chosen!==realSign){
    localStorage.setItem('loto_zsign',realSign);
    showCopyToast('По дате рождения твой знак — '+QA_ZODIAC[realSign][0]+' '+QA_ZODIAC[realSign][1]+', обновил ✨');
  }else{
    showCopyToast('🎂 Сохранено — анализ станет глубже');
  }
  QAB_close();
  QA_refreshBirthUI();
  if(document.getElementById('qa-ov').classList.contains('show'))QA_open();
}
function QA_refreshBirthUI(){
  const el=document.getElementById('qa-birthval');
  if(!el)return;
  const b=QA_birth();
  el.textContent=b?(String(b.d).padStart(2,'0')+'.'+String(b.m).padStart(2,'0')+'.'+b.y+(b.hh!=null?' · '+String(b.hh).padStart(2,'0')+':'+String(b.mm).padStart(2,'0'):'')):'не указана';
}


/* iOS: без touchstart-слушателя Safari игнорирует :active на кнопках */
document.addEventListener('touchstart',function(){},{passive:true});
/* Барабан лет + авто-переход полей даты рождения */
document.addEventListener('DOMContentLoaded',()=>{
  const ys=document.getElementById('qab-y');
  if(ys&&ys.options.length<=1){
    let html='<option value="">Год</option>';
    for(let y=2020;y>=1920;y--)html+='<option value="'+y+'">'+y+'</option>';
    ys.innerHTML=html;
  }
  const dEl=document.getElementById('qab-d'),mEl=document.getElementById('qab-m'),tEl=document.getElementById('qab-t');
  if(dEl){
    dEl.addEventListener('input',()=>{
      let v=dEl.value.replace(/\D/g,'').slice(0,2);
      if(dEl.value!==v)dEl.value=v;
      /* 2 цифры — или одна, но однозначная (4-9): дальше день продолжаться не может */
      if(v.length===2||(v.length===1&&+v>3)){mEl.focus();}
    });
  }
  if(mEl)mEl.addEventListener('change',()=>{if(mEl.value)ys.focus();});
  if(ys)ys.addEventListener('change',()=>{if(ys.value&&tEl)tEl.focus();});
});


/* ═══════════ ГОРОСКОП НА ПЕРГАМЕНТЕ ═══════════ */
var HORO_sign=0;
const HORO_FLAVOR=[
 ['Твой огонь Овна сегодня — двигатель:','Импульс первопроходца ведёт тебя:','Марс подмигивает Овну:','Твоя овенская прямота — сила дня:'],
 ['Упорство Тельца — твой якорь:','Земная основательность Тельца шепчет:','Венера греет Тельца:','Твоё телецкое терпение окупается:'],
 ['Живой ум Близнецов искрит:','Две твои стороны сегодня заодно:','Меркурий разгоняет мысли Близнецов:','Лёгкость Близнецов открывает двери:'],
 ['Интуиция Рака сегодня — компас:','Лунная чуткость Рака слышит больше слов:','Домашний огонь Рака греет:','Забота Рака возвращается к тебе:'],
 ['Львиное сердце сегодня на троне:','Солнце подсвечивает Льва:','Твоя львиная щедрость заразительна:','Гордость Льва — в достоинстве, не в громкости:'],
 ['Точность Девы сегодня — суперсила:','Дева видит деталь, которую все пропустили:','Меркурий наводит порядок для Девы:','Скромная работа Девы даёт громкий результат:'],
 ['Весы держат баланс там, где другие падают:','Твоя весовская дипломатия творит чудеса:','Венера красит день Весов:','Гармония Весов — заразительна:'],
 ['Глубина Скорпиона видит суть:','Скорпионья воля сегодня непробиваема:','Плутон даёт Скорпиону второе дыхание:','Тихая сила Скорпиона громче криков:'],
 ['Стрела Стрельца летит дальше обычного:','Оптимизм Стрельца — топливо дня:','Юпитер расширяет горизонты Стрельца:','Свобода Стрельца — в лёгком шаге:'],
 ['Козерог строит там, где другие мечтают:','Твоя козерожья дисциплина — тихий козырь:','Сатурн уважает упорство Козерога:','Вершина ближе, чем кажется Козерогу:'],
 ['Водолей видит завтра раньше всех:','Твоя водолейская странность — это дар:','Уран искрит идеями для Водолея:','Свежий взгляд Водолея нужен именно сегодня:'],
 ['Рыбы чувствуют течение дня без карты:','Нептун шепчет Рыбам верное направление:','Мягкость Рыб — не слабость, а мудрость:','Воображение Рыб сегодня пророческое:']
];
const HORO_POOL={
  energy:['Энергия дня на твоей стороне — начатое сегодня получит разгон.','День просит размеренного темпа: сила в спокойствии, а не в спешке.','Утро задаёт тон: одно смелое действие до полудня окрасит весь день.','Сегодня твоя интуиция громче логики — прислушайся к первому импульсу.','Волна дня переменчива: гибкость принесёт больше, чем упрямство.','Отличный день, чтобы закрыть хвосты — завершения дадут прилив сил.','Космос подсвечивает новое: пробуй то, чего ещё не делал.','Твоя харизма сегодня заметнее обычного — используй её в переговорах.','День наблюдателя: лучшие ходы придут, если сначала осмотреться.','Внутренний огонь ровный и сильный — бери задачи, которые откладывал.','Пик твоей энергии — после обеда: планируй главное туда.','Сегодня побеждает не скорость, а точность первого шага.','Прилив сил придёт от завершённого маленького дела.','Тело просит движения — десять минут прогулки перезагрузят день.','Твоё спокойствие сегодня — заразительное: им ты ведёшь других.','Смена обстановки на час даст идей на неделю.'],
  money:['В финансах день аккуратной точности: пересчитай, прежде чем соглашаться.','Возможна приятная мелочь — бонус, скидка или возврат, который забылся.','Не лучший день для крупных трат, зато отличный для планирования.','Деньги любят сегодня системность: одна маленькая привычка сбережёт многое.','Хороший день обсудить доход: разговор, отложенный давно, пройдёт легче.','Импульсивная покупка будет манить — дай ей сутки на раздумье.','Финансовая идея, записанная сегодня, через месяц покажет свою цену.','Звёзды за бережливость: сэкономленное сегодня удвоит завтрашние возможности.','Неожиданный совет о деньгах окажется дельным — выслушай.','День щедрости: небольшой подарок близкому вернётся сторицей.','Пересмотри одну подписку — найдёшь утечку, о которой забыл.','Хороший день сравнить цены: разница удивит.','Отложи сегодня символическую сумму — привычка дороже суммы.','Разговор о деньгах веди письменно: цифры любят точность.','Твоя вещь, лежащая без дела, может стать чьей-то находкой — и твоей выгодой.','Инвестиция в знание сегодня надёжнее любой другой.'],
  heart:['В отношениях день тёплых мелочей: одно сообщение изменит чей-то день.','Старый друг вспомнит о тебе — или вспомни первым.','Искренность сегодня обезоруживает: говори просто, без брони.','Домашний вечер даст больше сил, чем шумная компания.','Чьё-то молчание — не холод, а усталость. Прояви терпение.','Комплимент, сказанный вслух, запустит цепочку хорошего.','День семьи: общее дело, даже маленькое, сблизит сильнее слов.','Новое знакомство может оказаться неслучайным — будь открыт.','Прощение, даже мысленное, снимет камень с плеч.','Слушай сегодня вдвое больше, чем говоришь — узнаешь важное.','Общий ужин без телефонов сблизит больше, чем выходные порознь.','Скажи «спасибо» конкретно — за что именно, и увидишь глаза.','Старший родственник ждёт звонка, даже если не признаётся.','Небольшая уступка сегодня — большая победа отношений.','Смех — твой мост сегодня: поделись смешным с близким.','Чужой успех рядом — повод порадоваться, а не сравнивать.'],
  advice:['Совет дня: одна страница книги лучше часа ленты.','Совет дня: выпей воды и выйди на 15 минут под небо.','Совет дня: запиши три вещи, за которые благодарен.','Совет дня: наведи порядок в одном ящике — в мыслях тоже прояснится.','Совет дня: позвони тому, о ком подумал прямо сейчас.','Совет дня: сделай сложное дело первым — остальное покажется лёгким.','Совет дня: сегодня хорошо мечтать письменно — план начинается с фантазии.','Совет дня: улыбнись незнакомцу — эхо вернётся.','Совет дня: отложи телефон за час до сна, звёзды оценят.','Совет дня: маленький шаг к большой цели важнее идеального плана.','Совет дня: съешь что-то зелёное и хрустящее — телу понравится.','Совет дня: разгрузи голову — выпиши всё в один список.','Совет дня: сделай фото момента, который хочется запомнить.','Совет дня: одна страница дневника вечером соберёт день воедино.','Совет дня: похвали себя за то, что уже сделано.','Совет дня: тишина 10 минут — лучший подарок нервной системе.']
};
function HORO_seedRng(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};}
function HORO_text(sign){
  const now=new Date();
  const doy=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
  const rng=HORO_seedRng(sign*7919+doy*104729+now.getFullYear());
  const pick=a=>a[Math.floor(rng()*a.length)];
  const ph=QA_moonPhase(now),ms=QA_moonSign(now);
  const l=L();
  const lucky=[];while(lucky.length<3){const n=1+Math.floor(rng()*l.mB);if(!lucky.includes(n))lucky.push(n);}
  lucky.sort((a,b)=>a-b);
  const flavor=HORO_FLAVOR[sign][Math.floor(rng()*HORO_FLAVOR[sign].length)];
  const en=pick(HORO_POOL.energy);
  return{
    moon:ph.emoji+' '+ph.name+' · Луна в знаке '+QA_ZODIAC[ms][1],
    energy:flavor+' '+en.charAt(0).toLowerCase()+en.slice(1),
    money:pick(HORO_POOL.money),heart:pick(HORO_POOL.heart),advice:pick(HORO_POOL.advice),
    lucky
  };
}
function HORO_open(sign){
  HORO_sign=(sign!=null?sign:(QA_getSign()||0));
  document.getElementById('horo-signs').innerHTML=QA_ZODIAC.map((z,i)=>'<div class="horo-schip'+(i===HORO_sign?' on':'')+'" data-loto-event-click="HORO_open('+i+')">'+z[0]+'</div>').join('');
  document.getElementById('horo-glyph').textContent=QA_ZODIAC[HORO_sign][0];
  const sg=document.getElementById('horo-seal-glyph');if(sg)sg.textContent=QA_ZODIAC[HORO_sign][0];
  document.getElementById('horo-title').textContent=QA_ZODIAC[HORO_sign][1];
  document.getElementById('horo-date').textContent=new Date().toLocaleDateString(appLocale(),{weekday:'long',day:'numeric',month:'long'});
  const t=HORO_text(HORO_sign);
  document.getElementById('horo-body').innerHTML=
    '<div class="horo-sec"><div class="horo-sec-t">🌙 Небо сегодня</div><div class="horo-sec-b">'+t.moon+'</div></div>'+
    '<div class="horo-sec"><div class="horo-sec-t">⚡ Энергия</div><div class="horo-sec-b">'+t.energy+'</div></div>'+
    '<div class="horo-sec"><div class="horo-sec-t">💰 Финансы</div><div class="horo-sec-b">'+t.money+'</div></div>'+
    '<div class="horo-sec"><div class="horo-sec-t">💛 Отношения</div><div class="horo-sec-b">'+t.heart+'</div></div>'+
    '<div class="horo-sec"><div class="horo-sec-t">✨ Совет</div><div class="horo-sec-b">'+t.advice+'</div></div>'+
    '<div class="horo-sec"><div class="horo-sec-t">🍀 Числа удачи</div><div class="horo-lucky">'+t.lucky.map(n=>'<div class="horo-lball">'+n+'</div>').join('')+'</div></div>';
  document.getElementById('horo-ov').classList.add('show');
}
function HORO_close(){document.getElementById('horo-ov').classList.remove('show');}
function HORO_share(){
  const t=HORO_text(HORO_sign);
  shareText('Гороскоп · '+QA_ZODIAC[HORO_sign][1],
    '📜 '+QA_ZODIAC[HORO_sign][0]+' '+QA_ZODIAC[HORO_sign][1]+' · '+new Date().toLocaleDateString(appLocale(),{day:'numeric',month:'long'})+'\n'+
    t.moon+'\n\n⚡ '+t.energy+'\n💰 '+t.money+'\n💛 '+t.heart+'\n'+t.advice+'\n🍀 Числа удачи: '+t.lucky.join(' '));
}


/* ═══ После любой генерации/загрузки — на главный экран к рядам ═══ */
function goToRows(){
  try{
    if(typeof curPage!=='undefined'&&curPage!=='sim'&&typeof selPage==='function')selPage('sim');
    const land=()=>{
      const el=document.getElementById('rows-c');
      if(!el)return;
      const top=el.getBoundingClientRect().top+(window.scrollY||0)-100;
      window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    };
    setTimeout(()=>{
      land();
      const el=document.getElementById('rows-c');
      if(el){el.classList.remove('rows-flash');void el.offsetWidth;el.classList.add('rows-flash');setTimeout(()=>el.classList.remove('rows-flash'),1800);}
    },150);
    setTimeout(land,700); /* докоррекция после закрытия листа и анимаций */
  }catch(e){}
}


/* ═══ Выбор количества рядов (1–50) для колеса и моделей ═══ */
var GENN_mode='wheel';
function setGenCount(n){
  n=Math.max(1,Math.min(MAX_ROWS,parseInt(n)||10));
  localStorage.setItem(GEN_COUNT_KEY,String(n));
  const sel=document.getElementById('gen-count');
  if(sel){
    if(![...sel.options].some(o=>o.value===String(n))){
      const o=document.createElement('option');
      o.value=String(n);o.textContent=n+' '+rowWord(n);
      /* вставляем по порядку */
      const after=[...sel.options].find(x=>+x.value>n);
      sel.insertBefore(o,after||null);
    }
    sel.value=String(n);
  }
  updateGenCountUI();
  return n;
}
function GENN_open(mode){
  GENN_mode=mode||'wheel';
  const cur=getGenCount();
  document.getElementById('genn-note').textContent=GENN_mode==='wheel'?'Колёсная матрица построит покрытие пар на выбранное число рядов.':'Количество применится ко всем моделям генерации.';
  document.getElementById('genn-chips').innerHTML=[1,3,5,10,15,20,30,40,50].map(n=>'<button class="pick-cnt'+(n===cur?' on':'')+'" data-loto-event-click="GENN_set('+n+',this)">'+n+'</button>').join('');
  document.getElementById('genn-custom').value='';
  document.getElementById('genn-go').textContent=GENN_mode==='wheel'?'📐 Сформировать матрицу':'Применить';
  document.getElementById('genn-ov').classList.add('show');
}
function GENN_close(){document.getElementById('genn-ov').classList.remove('show');}
function GENN_set(n,el){
  setGenCount(n);
  document.querySelectorAll('#genn-chips .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));
}
function GENN_custom(){
  const v=parseInt(document.getElementById('genn-custom').value);
  if(!isFinite(v)||v<1||v>50){showCopyToast('Число от 1 до 50');return;}
  setGenCount(v);
  document.querySelectorAll('#genn-chips .pick-cnt').forEach(b=>b.classList.toggle('on',+b.textContent===v));
  showCopyToast('Рядов: '+v);
}
function GENN_go(){
  GENN_close();
  if(GENN_mode==='wheel')applyWheelMatrix();
  else if(document.getElementById('sg-ov').classList.contains('show'))onGenCountChange();
}


/* ═══ Занятость генерации: песочные часы, прогресс, защита от двойного тапа ═══ */
var GEN_BUSY=false,BUSY_t0=0,BUSY_timer=null;
function BUSY_show(label){
  BUSY_t0=performance.now();
  document.getElementById('busy-label').textContent=label||'Генерация…';
  const fill=document.getElementById('busy-fill');
  fill.style.width='4%';
  clearInterval(BUSY_timer);
  let p=4;
  BUSY_timer=setInterval(()=>{p=Math.min(90,p+(92-p)*0.16);fill.style.width=p.toFixed(0)+'%';},140);
  document.getElementById('busy-ov').classList.add('show');
}
async function BUSY_hide(){
  clearInterval(BUSY_timer);
  document.getElementById('busy-fill').style.width='100%';
  const shown=performance.now()-BUSY_t0;
  await new Promise(r=>setTimeout(r,Math.max(220,480-shown))); /* минимум показа — глазом видно */
  document.getElementById('busy-ov').classList.remove('show');
}
async function withBusy(label,fn){
  if(GEN_BUSY)return; /* двойной тап игнорируем — генерация уже идёт */
  GEN_BUSY=true;
  BUSY_show(label);
  try{return await fn();}
  finally{GEN_BUSY=false;await BUSY_hide();}
}


/* ═══════════ ИССЛЕДОВАТЕЛЬСКИЙ НАБОР + ВЕРДИКТ СУДЬИ-СЛЕДОВАТЕЛЯ ═══════════ */
var ADV_state=null;
const ADV_NAMES={freq:'Частотный анализ',bal:'Сбалансированный',man:'Сегментный охват',markov:'Цепи Маркова',gauss:'Гаусс · ЦПТ',delta:'Интервальная модель Δ',bayes:'Байес · Дирихле',overdue:'Gap-анализ',phys:'Физическая модель лототрона',chaos:'Детерминированный хаос',quantum:'Квантовый коллапс',rnd:'Pure random','world-hot':'Мировой горячий','world-mix':'Мировой смешанный',qastro:'Квантово-астральный',wheel:'Колёсная матрица',paradox:'Система парадоксов'};
function ADV_injectButtons(){
  document.querySelectorAll('.sg-algo').forEach(card=>{
    if(card.querySelector('.sg-adv'))return;
    const id=(card.id||'').replace(/^al-/,'');
    if(!id)return;
    const b=document.createElement('button');
    b.className='sg-adv';b.textContent='💬 Совет';
    b.onclick=e=>{e.stopPropagation();ADV_open(id);};
    card.appendChild(b);
  });
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(ADV_injectButtons,400));
async function ADV_open(algo){
  const l=L();
  ADV_state={algo,n:Math.min(5,getGenCount()),rows:null,verdict:null};
  document.getElementById('adv-title').textContent='💬 Совет · '+(ADV_NAMES[algo]||algo);
  const dd=QA_nextDrawDate();
  const days=Math.round((dd-new Date())/86400000);
  const when=days<=0?'сегодня':days===1?'завтра':'через '+days+' дн.';
  document.getElementById('adv-draw').innerHTML='🎯 Исследовательский набор для выбранной даты:<br><b>'+dd.toLocaleString(appLocale(),{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+'</b> · '+when;
  const draws=IF_window(await loadD(cur));
  document.getElementById('adv-sub').textContent=l.name+' · анализ по '+draws.length+' тиражам выбранного периода';
  document.getElementById('adv-counts').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>'<button class="pick-cnt'+(n===ADV_state.n?' on':'')+'" data-loto-event-click="ADV_setN('+n+',this)">'+n+'</button>').join('');
  document.getElementById('adv-result').innerHTML='';
  document.getElementById('adv-go').style.display='';
  document.getElementById('adv-ov').classList.add('show');
}
function ADV_setN(n,el){ADV_state.n=n;document.querySelectorAll('#adv-counts .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));}
function ADV_close(){document.getElementById('adv-ov').classList.remove('show');}
function ADV_ballsHtml(r,l,swaps){
  return '<div class="if-rowballs">'+
    r.m.map(n=>'<div class="if-rball rb-m-'+l.cls+(swaps&&swaps.has(n)?' adv-swap':'')+'">'+n+'</div>').join('')+
    ((r.b&&r.b.length)?'<div style="width:6px"></div>'+r.b.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>';
}
async function ADV_go(){
  const st=ADV_state;if(!st)return;
  const l=L();
  const rows=await withBusy((ADV_NAMES[st.algo]||st.algo)+' · совет',()=>generateRowsByAlgo(st.algo,st.n));
  if(!rows?.length)return;
  st.rows=ensureUniqueGeneratedRows(rows,l);st.verdict=null;
  const dd=QA_nextDrawDate();
  document.getElementById('adv-go').style.display='none';
  if(SUPC_pending&&SUPC_pending.algo===st.algo){
    /* пришли по направлению судьи — автоматически в его кабинет */
    setTimeout(()=>{showCopyToast('⚖️ Переношу дело в кабинет судьи…');ADV_judge();},900);
  }
  document.getElementById('adv-result').innerHTML=
    '<div class="if-seclbl">Совет модели · '+st.rows.length+' '+rowWord(st.rows.length)+'</div>'+
    st.rows.map(r=>'<div class="adv-row">'+ADV_ballsHtml(r,l)+'</div>').join('')+
    '<div class="if-note" style="margin-top:8px">«'+(ADV_NAMES[st.algo]||st.algo)+'» советую применить эти числа на тираж '+dd.toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'})+'.</div>'+
    '<button class="btn-draw '+l.cls+'" style="margin-top:12px" data-loto-event-click="ADV_use()">Использовать в билете</button>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'+
    '<button class="btn-exp" style="margin:0" data-loto-event-click="ADV_share()">📤 Поделиться</button>'+
    '<button class="btn-exp" style="margin:0" data-loto-event-click="ADV_judge()">⚖️ Вердикт судьи</button></div>';
}
/* Судья-следователь: проверяет каждое число совета силой поля и исправляет слабые */
async function ADV_judge(){
  const st=ADV_state;if(!st||!st.rows)return;
  const l=L();
  const data=await withBusy('Судья расследует…',async()=>{
    const draws=IF_window(await loadD(cur));
    if(draws.length<5)return{err:'Мало данных: судье нужно минимум 5 тиражей.'};
    return{plan:JUDGE_plan(st.rows.map(r=>({m:r.m,b:r.b})),l,draws),drawsN:draws.length};
  });
  if(!data)return;
  if(data.err){showFeedback('Судья',data.err,'⚖️',3200);return;}
  const proposed=data.plan.reduce((s,p)=>s+p.swaps.length,0);
  const checked=st.rows.length*l.pM;
  const agreed=checked-proposed;
  const uniq=new Set();data.plan.forEach(p=>p.orig.forEach(n=>uniq.add(n)));
  const covPct=Math.round(uniq.size/l.mB*100);
  const swapsList=[];data.plan.forEach(p=>p.swaps.forEach(s=>swapsList.push(s)));
  const covLine=' Ваши '+st.rows.length+' '+rowWord(st.rows.length)+' покрывают '+uniq.size+' из '+l.mB+' чисел ('+covPct+'%) — '+(covPct>=45?'широкое покрытие.':covPct>=22?'умеренное покрытие; 5–10 рядов раскрыли бы поле шире.':'узкое покрытие: для охвата поля берите больше рядов.');
  let intro='';
  if(SUPC_pending&&SUPC_pending.algo===st.algo){intro='<b>⚖️ Кабинет судьи.</b> Вы вернулись по моему направлению. '+SUPC_pending.reason+'<br><br>';SUPC_pending=null;}
  intro+='<b>Расследование судьи.</b> Проверил '+checked+' чисел по силе поля из '+data.drawsN+' тиражей (частота, пары, пропуски, зоны, чётность, суммы). '+
    'Согласен с <b>'+agreed+'</b>. '+(proposed?('Предлагаю заменить <b>'+proposed+'</b>: '+swapsList.slice(0,8).map(x=>x.from+'→'+x.to).join(', ')+(proposed>8?' и ещё '+(proposed-8):'')+'. Реши сам, какие замены применить.'):'Возражений нет — совет выдержал проверку поля полностью. ✅')+covLine;
  JUDGE_state['adv']={plan:data.plan,l,drawsN:data.drawsN,mountId:'adv-result',intro,applyLabel:'Использовать в билете',onApply:(finalRows,meta)=>{ADV_close();closeSG();setGeneratedRows(finalRows,JUDGE_choiceText(meta)+'. Ряды перенесены в билет. ⚖️🍀');}};
  JUDGE_render('adv');
  const mp=document.getElementById('adv-result');if(mp)try{mp.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}
}
function ADV_use(){
  const st=ADV_state;if(!st||!st.rows)return;
  ADV_close();closeSG();
  setGeneratedRows(st.rows,'Набор «'+(ADV_NAMES[st.algo]||st.algo)+'» перенесён в симулятор. Это не прогноз. 🍀',true);
}
function ADV_useVerdict(){
  const st=ADV_state;if(!st||!st.verdict)return;
  ADV_close();closeSG();
  setGeneratedRows(st.verdict.map(r=>({m:r.m,b:r.b})),'Вердикт судьи перенесён в билет. ⚖️🍀');
}
function ADV_share(){
  const st=ADV_state;if(!st||!st.rows)return;
  const dd=QA_nextDrawDate();
  shareText('Исследовательский набор · '+L().name,'💬 Набор «'+(ADV_NAMES[st.algo]||st.algo)+'» для даты '+dd.toLocaleDateString(appLocale(),{day:'numeric',month:'short'})+' · '+L().name+'\n'+rowsAsText(st.rows,L())+'\nЭто исследование истории, а не прогноз.');
}
function ADV_shareVerdict(){
  const st=ADV_state;if(!st||!st.verdict)return;
  shareText('Вердикт судьи · '+L().name,'⚖️ Вердикт судьи на тираж '+QA_nextDrawDate().toLocaleDateString(appLocale(),{day:'numeric',month:'short'})+' · '+L().name+'\n'+rowsAsText(st.verdict,L()));
}


/* ═══════════ ПЕРСОНАЛЬНЫЙ СОВЕТ СУДЬИ: звёзды + натал + база → направление → вердикт ═══════════ */
var SUPC_pending=null; /* {algo, reason} — активное направление судьи */
function SUPC_open(){
  setTimeout(()=>SUPC_way('astro'),30);
  const zs=QA_getSign();
  document.getElementById('supc-signs').innerHTML=QA_ZODIAC.map((z,i)=>'<div class="supc-sign'+(i===zs?' on':'')+'" data-loto-event-click="SUPC_setSign('+i+',this)"><div>'+z[0]+'</div><div class="zn">'+z[1]+'</div></div>').join('');
  const b=QA_birth();
  document.getElementById('supc-birthval').textContent=b?(String(b.d).padStart(2,'0')+'.'+String(b.m).padStart(2,'0')+'.'+b.y+(b.hh!=null?' · '+String(b.hh).padStart(2,'0')+':'+String(b.mm).padStart(2,'0'):'')):'не указана';
  document.getElementById('supc-result').innerHTML='';
  document.getElementById('supc-ov').classList.add('show');
}
function SUPC_close(){document.getElementById('supc-ov').classList.remove('show');}
function SUPC_setSign(i,el){
  localStorage.setItem('loto_zsign',i);
  document.querySelectorAll('.supc-sign').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');
  if(!QA_birth()){QA_skipSession=false;setTimeout(QAB_open,300);}
}
const SUPC_ELEMENTS=[['огня','смелые стратегии против течения'],['земли','основательные стратегии по данным'],['воздуха','стратегии связей и покрытия'],['воды','интуитивные стратегии распределений']];
async function SUPC_route(){
  const zs=QA_getSign();
  if(zs===null){showCopyToast('⚖️ Сначала выберите знак зодиака');return;}
  const l=L();
  const data=await withBusy('Судья изучает вас и базу…',async()=>{
    const draws=IF_window(await loadD(cur));
    let cv=0;
    if(draws.length>=5){
      const A=IF_scores(draws,'main',l.mB,l.pM);
      const sc=A.scores.map(x=>x.score||0);
      const mean=sc.reduce((a,b)=>a+b,0)/sc.length||1;
      cv=Math.sqrt(sc.reduce((a,b)=>a+(b-mean)*(b-mean),0)/sc.length)/mean;
    }
    return{draws:draws.length,cv};
  });
  if(!data)return;
  const elem=zs%4; /* стихия знака */
  const birth=QA_birth();
  const lp=birth?QA_lifePath(birth.d,birth.m,birth.y):null;
  const ph=QA_moonPhase(QA_nextDrawDate());
  const structured=data.cv>0.28; /* поле выражено или ровное */
  /* направление: стихия × состояние поля × луна/число судьбы */
  const routes={
    0:structured?['overdue','структура неравномерна — профиль огня выбрал числа с большим относительным пропуском']:['quantum','структура ровная — профиль огня выбрал квантовый коллапс'],
    1:structured?['freq','поле выражено — земля доверяет фактам: частотный анализ по вашей базе']:['bayes','поле ровное — земле подойдёт байесовская осторожность: данные ведут, но не диктуют'],
    2:structured?['markov','поле неровное — воздух читает связи: цепи Маркова по переходам тиражей']:['wheel','поле ровное — воздуху важна широта: колёсная матрица покроет пары'],
    3:structured?['delta','поле выражено — вода чувствует ритм: интервальная модель Δ по соседним разностям базы']:['gauss','поле ровное — воде подойдёт колокол распределения сумм: Гаусс']
  };
  let[algo,why]=routes[elem];
  if(lp&&(lp===7||lp===11)&&!structured){algo='qastro';why='в астрологическом профиле число '+lp+' связано с интуицией: выбран Квантово-астральный режим';}
  const reason='Вы — '+QA_ZODIAC[zs][0]+' '+QA_ZODIAC[zs][1]+', знак '+SUPC_ELEMENTS[elem][0]+': вам идут '+SUPC_ELEMENTS[elem][1]+'.'+
    (birth?' Натальная Луна в '+QA_ZODIAC[QA_moonSign(QA_birthDateObj(birth))][1]+(lp?', число судьбы '+lp:'')+'.':' (дата рождения углубила бы анализ)')+
    ' База: '+data.draws+' тиражей, вариация структурного балла '+(data.cv*100).toFixed(0)+'% — '+(structured?'структура выражена':'структура ровная')+'. Фаза Луны: '+ph.emoji+' '+ph.name+'.';
  SUPC_pending={algo,reason};
  document.getElementById('supc-result').innerHTML=
    '<div class="supc-route"><b>⚖️ Моё направление: '+(ADV_NAMES[algo]||algo)+'</b><br>'+reason+'<br><br>'+why.charAt(0).toUpperCase()+why.slice(1)+'.<br><br>Идите к этой модели, выберите количество рядов, получите её совет — и <b>возвращайтесь ко мне за решающим вердиктом</b>: я рассмотрю дело сам.</div>'+
    '<button class="btn-draw '+l.cls+'" style="margin-top:12px" data-loto-event-click="SUPC_goModel()">Перейти к модели →</button>';
}
function SUPC_goModel(){
  if(!SUPC_pending)return;
  SUPC_close();
  ADV_open(SUPC_pending.algo);
}


/* ═══ Судья: две роли. Роль «Только база» — лидеры пар/троек/четвёрок ═══ */
var SUPC_dbN=3;
function SUPC_way(w){
  document.getElementById('supc-astro-block').style.display=w==='astro'?'':'none';
  document.getElementById('supc-db-block').style.display=w==='db'?'':'none';
  document.getElementById('supc-way-astro').classList.toggle('on',w==='astro');
  document.getElementById('supc-way-db').classList.toggle('on',w==='db');
  document.getElementById('supc-result').innerHTML='';
  if(w==='db'){
    document.getElementById('supcdb-counts').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>'<button class="pick-cnt'+(n===SUPC_dbN?' on':'')+'" data-loto-event-click="SUPC_dbSetN('+n+',this)">'+n+'</button>').join('');
  }
}
function SUPC_dbSetN(n,el){SUPC_dbN=n;document.querySelectorAll('#supcdb-counts .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));}
function SUPC_kTuples(draws,k){
  const M=new Map();
  for(const d of draws){
    const a=[...(d.main||[])].sort((x,y)=>x-y);
    const comb=(start,cur)=>{
      if(cur.length===k){const key=cur.join('-');M.set(key,(M.get(key)||0)+1);return;}
      for(let i=start;i<a.length;i++)comb(i+1,[...cur,a[i]]);
    };
    comb(0,[]);
  }
  return[...M.entries()].sort((x,y)=>y[1]-x[1]);
}
async function SUPC_db(){
  const l=L();
  const data=await withBusy('Судья ищет лидеров базы…',async()=>{
    const draws=IF_window(await loadD(cur));
    if(draws.length<10)return{err:'Нужно минимум 10 тиражей в выбранном периоде.'};
    const pairs=SUPC_kTuples(draws,2);
    const triples=SUPC_kTuples(draws,3);
    const quads=l.pM>=5?SUPC_kTuples(draws,4).filter(q=>q[1]>=2):[];
    const pairMap=new Map(pairs.map(([k,c])=>[k,c]));
    const pc=(a,b)=>pairMap.get(a<b?a+'-'+b:b+'-'+a)||0;
    const dBo=drawBonusCount(l);
    let bonusPairs=[],bonusTop=[];
    if(dBo>=2){
      const BM=new Map();
      draws.forEach(d=>{const b=[...(d.bonus||[])].sort((x,y)=>x-y);for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const k2=b[i]+'-'+b[j];BM.set(k2,(BM.get(k2)||0)+1);}});
      bonusPairs=[...BM.entries()].sort((x,y)=>y[1]-x[1]);
    }else if(dBo===1){
      const bf=buildFreq(draws,'bonus',l.bB);
      bonusTop=[...bf.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
    }
    /* сборка рядов вокруг лидеров: четвёрка → тройки → пары */
    const seeds=[];
    quads.slice(0,2).forEach(q=>seeds.push(q[0].split('-').map(Number)));
    triples.slice(0,6).forEach(t=>seeds.push(t[0].split('-').map(Number)));
    pairs.slice(0,12).forEach(pr=>seeds.push(pr[0].split('-').map(Number)));
    const rows=[];
    for(let i=0;i<SUPC_dbN;i++){
      const m=[...(seeds[i%seeds.length]||[])];
      while(m.length<l.pM){
        let best=null,bs=-1;
        for(let n=1;n<=l.mB;n++){
          if(m.includes(n))continue;
          const sc=m.reduce((a,x)=>a+pc(n,x),0)+Math.random()*0.5;
          if(sc>bs){bs=sc;best=n;}
        }
        m.push(best);
      }
      let b=[];
      if(dBo>=2&&bonusPairs.length)b=bonusPairs[i%bonusPairs.length][0].split('-').map(Number);
      else if(dBo===1&&bonusTop.length)b=[bonusTop[i%Math.min(3,bonusTop.length)]];
      else if(dBo>0)b=rnd(l.bB,dBo);
      rows.push({m:m.sort((a,b)=>a-b),b});
    }
    return{rows,pairs:pairs.slice(0,3),triples:triples.slice(0,2),quads:quads.slice(0,1),bonusPairs:bonusPairs.slice(0,2),drawsN:draws.length,dBo};
  });
  if(!data)return;
  if(data.err){showFeedback('Судья',data.err,'⚖️',3200);return;}
  data.rows=ensureUniqueGeneratedRows(data.rows,l);
  window.SUPC_dbRows=data.rows;
  const lead=[];
  if(data.quads.length)lead.push('четвёрка <b>'+data.quads[0][0].split('-').join('·')+'</b> ('+data.quads[0][1]+' раз)');
  data.triples.forEach(t=>lead.push('тройка <b>'+t[0].split('-').join('·')+'</b> ('+t[1]+')'));
  data.pairs.forEach(pr=>lead.push('пара <b>'+pr[0].split('-').join('·')+'</b> ('+pr[1]+')'));
  if(data.bonusPairs.length)lead.push('звёздная пара <b>'+data.bonusPairs[0][0].split('-').join('·')+'</b> ('+data.bonusPairs[0][1]+')');
  document.getElementById('supc-result').innerHTML=
    '<div class="supc-route"><b>📊 Расследование по базе.</b> Изучил '+data.drawsN+' тиражей. Лидеры совместных выпадений: '+lead.join(', ')+'. Собираю ряды вокруг лидеров, достраивая числами с сильнейшими парными связями.</div>'+
    '<div class="if-seclbl">Совет судьи · '+data.rows.length+' '+rowWord(data.rows.length)+'</div>'+
    data.rows.map(r=>'<div class="adv-row">'+ADV_ballsHtml(r,l)+'</div>').join('')+
    '<div class="if-note" style="margin-top:8px">Лидеры прошлого не повышают шанс будущего тиража — гарантий не существует. Это исследование структуры базы.</div>'+
    '<button class="btn-draw '+l.cls+'" style="margin-top:12px" data-loto-event-click="SUPC_dbUse()">Использовать в билете</button>'+
    '<button class="btn-exp" style="margin-top:8px" data-loto-event-click="SUPC_dbShare()">📤 Поделиться</button>';
}
function SUPC_dbUse(){
  if(!window.SUPC_dbRows)return;
  SUPC_close();closeSG();
  setGeneratedRows(window.SUPC_dbRows,'Совет судьи по лидерам базы перенесён в билет. 📊🍀',true);
}
function SUPC_dbShare(){
  if(!window.SUPC_dbRows)return;
  shareText('Совет судьи · '+L().name,'⚖️📊 Совет судьи по лидерам базы · '+L().name+' · тираж '+QA_nextDrawDate().toLocaleDateString(appLocale(),{day:'numeric',month:'short'})+'\n'+rowsAsText(window.SUPC_dbRows,L()));
}
/* ═══ Поиск по истории ═══ */
function HIST_filter(){
  const q=(document.getElementById('hist-search')?.value||'').trim().toLowerCase();
  const list=document.getElementById('hist-list');
  if(!list)return;
  let shown=0;
  [...list.children].forEach(el=>{
    const hit=!q||el.textContent.toLowerCase().includes(q);
    el.style.display=hit?'':'none';
    if(hit)shown++;
  });
}


/* ═══ Позиционный аудит честности: Coronel-Brizio, Hernández-Montoya, Rapallo, Scalas (arXiv:0806.4595) ═══
   У честной k/N-лотереи i-е по возрастанию число имеет E[Y(i)]=(N+1)i/(k+1),
   Cov[Y(i),Y(j)]=i(k−j+1)(N+1)(N−k)/((k+1)²(k+2)), i≤j.
   Q = m·(ȳ−μ)ᵀV⁻¹(ȳ−μ) ~ χ²(k). */
function POSQ_invert(A){
  const n=A.length,M=A.map((row,i)=>[...row,...row.map((_,j)=>i===j?1:0)]);
  for(let c=0;c<n;c++){
    let piv=c;
    for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[piv][c]))piv=r;
    [M[c],M[piv]]=[M[piv],M[c]];
    const d=M[c][c];if(Math.abs(d)<1e-12)return null;
    for(let j=0;j<2*n;j++)M[c][j]/=d;
    for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c];for(let j=0;j<2*n;j++)M[r][j]-=f*M[c][j];}
  }
  return M.map(row=>row.slice(n));
}
function POSQ_audit(draws,l){
  const k=l.pM,N=l.mB,m=draws.length;
  if(m<30)return null;
  const ybar=new Array(k).fill(0);
  let used=0;
  for(const d of draws){
    const a=[...(d.main||[])].sort((x,y)=>x-y);
    if(a.length!==k)continue;
    used++;
    for(let i=0;i<k;i++)ybar[i]+=a[i];
  }
  if(used<30)return null;
  for(let i=0;i<k;i++)ybar[i]/=used;
  const mu=Array.from({length:k},(_,i)=>(N+1)*(i+1)/(k+1));
  const V=Array.from({length:k},(_,ii)=>Array.from({length:k},(_,jj)=>{
    const i=Math.min(ii,jj)+1,j=Math.max(ii,jj)+1;
    return i*(k-j+1)*(N+1)*(N-k)/((k+1)*(k+1)*(k+2));
  }));
  const Vi=POSQ_invert(V);
  if(!Vi)return null;
  const dlt=ybar.map((y,i)=>y-mu[i]);
  let Q=0;
  for(let i=0;i<k;i++)for(let j=0;j<k;j++)Q+=dlt[i]*Vi[i][j]*dlt[j];
  Q*=used;
  return{Q,p:chi2pvalue(Q,k),k,m:used,ybar,mu};
}

/* ═══════════════ ВЕРХОВНЫЙ СУДЬЯ · интерактивный разбор (для всех систем) ═══════════════
   Судья оценивает силой поля каждый шар и ПРЕДЛАГАЕТ замены. Решает пользователь:
   каждую замену можно включить или отключить. Работает с любым набором рядов. */
const JUDGE_state={};
function JUDGE_plan(rows,l,draws){throw new Error('backend_only');}
function JUDGE_effective(p){
  const m=[...p.orig],gold=new Set();
  p.swaps.forEach(s=>{if(s.apply){const i=m.indexOf(s.from);if(i>=0){m[i]=s.to;gold.add(s.to);}}});
  return {m:m.slice().sort((a,b)=>a-b),gold};
}
function JUDGE_ballsHtml(p,l){
  const e=JUDGE_effective(p);
  return '<div class="if-rowballs">'+e.m.map(n=>'<div class="if-rball rb-m-'+l.cls+(e.gold.has(n)?' adv-swap':'')+'">'+n+'</div>').join('')+
    ((p.b&&p.b.length)?'<div style="width:6px"></div>'+p.b.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>';
}
function JUDGE_render(ns){
  const st=JUDGE_state[ns];if(!st)return;const l=st.l;
  const proposed=st.plan.reduce((s,p)=>s+p.swaps.length,0);
  const active=st.plan.reduce((s,p)=>s+p.swaps.filter(x=>x.apply).length,0);
  const applyBase=st.applyLabel||'Использовать проверенные ряды';
  const judgeNote=`Судья проверил каждый шар по структурному баллу из ${st.drawsN} тиражей (частота, пары, пропуски, зоны, чётность, суммы). Ниже — какие шары и в каких рядах он предлагает заменить. Реши сам: нажми на замену, чтобы включить или отключить её. Можно поменять только одну, а остальное оставить. Золотом отмечены изменённые числа. Это не прогноз и не гарантия.`;
  let html=(st.intro?'<div class="adv-invest" style="margin:0 0 4px">'+st.intro+'</div>':'')+
    '<div class="if-seclbl">⚖️ Разбор Верховного судьи</div>'+
    '<div class="if-note" style="margin:0 0 12px">'+judgeNote+'</div>';
  st.plan.forEach((p,ri)=>{
    html+='<div class="pdx-jrow"><div class="pdx-jhead">Ряд '+(ri+1)+'</div>'+JUDGE_ballsHtml(p,l);
    if(p.swaps.length){
      html+='<div class="pdx-swaps">'+p.swaps.map((s,si)=>'<button class="pdx-swap'+(s.apply?' on':'')+'" aria-pressed="'+(s.apply?'true':'false')+'" data-loto-event-click="JUDGE_toggle(\''+ns+'\','+ri+','+si+')">'+(s.apply?'✓ ':'')+s.from+' → '+s.to+'<span class="pdx-sd">балл '+s.sf+'→'+s.st+'</span></button>').join('')+'</div>';
    }else{
      html+='<div class="pdx-ok">Возражений нет — ряд выдержал проверку поля ✅</div>';
    }
    html+='</div>';
  });
  let choiceTitle,choiceText,applyText;
  if(proposed===0){
    choiceTitle='Твой выбор: исходные числа';
    choiceText='Судья не предложил замен; исходная комбинация сохранится.';
    applyText='✅ '+applyBase;
  }else if(active===0){
    choiceTitle='Твой выбор: без судейских замен';
    choiceText=`Ты не выбрал ни одной из ${proposed} предложенных замен; исходные числа останутся без изменений.`;
    applyText=`↩ ${applyBase} без замен`;
  }else if(active===proposed){
    choiceTitle=`Твой выбор: все ${proposed} ${proposed===1?'изменение':'изменения'}`;
    choiceText='Будут применены все предложенные судьёй замены.';
    applyText=`✅ ${applyBase} · все замены (${proposed})`;
  }else{
    choiceTitle=`Твой выбор: ${active} ${active===1?'изменение':'изменения'} из ${proposed}`;
    choiceText='Будут применены только выбранные тобой замены; остальные числа останутся исходными.';
    applyText=`✅ ${applyBase} · ${active} из ${proposed} замен`;
  }
  html+='<div class="judge-choice-summary"><div><b>'+choiceTitle+'</b><span>'+choiceText+'</span></div><div class="judge-choice-count">'+active+' / '+proposed+'</div></div>'+
    '<div class="judge-action-panel">';
  if(proposed>0){
    html+='<div class="judge-bulk">'+
      '<button class="btn-exp" style="margin:0" data-loto-event-click="JUDGE_setAll(\''+ns+'\',true)">Включить все замены</button>'+
      '<button class="btn-exp" style="margin:0" data-loto-event-click="JUDGE_setAll(\''+ns+'\',false)">Снять все замены</button></div>';
  }
  html+='<button class="btn-draw '+l.cls+'" data-loto-event-click="JUDGE_apply(\''+ns+'\')">'+applyText+'</button>';
  html+='</div>';
  document.getElementById(st.mountId).innerHTML=html;
}
function JUDGE_rerender(ns,change){
  const st=JUDGE_state[ns];if(!st)return;
  const mount=document.getElementById(st.mountId),scroller=mount?.closest('.if-sheet,.sg-sheet');
  const top=scroller?scroller.scrollTop:0;
  change();JUDGE_render(ns);
  if(scroller)requestAnimationFrame(()=>{scroller.scrollTop=top;});
}
function JUDGE_toggle(ns,ri,si){const s=JUDGE_state[ns]?.plan?.[ri]?.swaps?.[si];if(!s)return;JUDGE_rerender(ns,()=>{s.apply=!s.apply;});}
function JUDGE_setAll(ns,val){const st=JUDGE_state[ns];if(!st)return;JUDGE_rerender(ns,()=>{st.plan.forEach(p=>p.swaps.forEach(s=>s.apply=val));});}
function JUDGE_finalRows(ns){return JUDGE_state[ns].plan.map(p=>{const e=JUDGE_effective(p);return{m:e.m,b:p.b};});}
function JUDGE_choiceText(meta){
  if(!meta||!meta.proposed)return'Твой выбор: исходные числа; судья не предложил замен';
  if(!meta.active)return'Твой выбор: оставить исходные числа без судейских замен';
  if(meta.active===meta.proposed)return`Твой выбор: применить все ${meta.active} ${meta.active===1?'изменение':'изменения'} судьи`;
  return`Твой выбор: применить ${meta.active} ${meta.active===1?'изменение':'изменения'} из ${meta.proposed}`;
}
function JUDGE_apply(ns){
  const st=JUDGE_state[ns];if(!st||!st.onApply)return;
  const proposed=st.plan.reduce((sum,p)=>sum+p.swaps.length,0);
  const active=st.plan.reduce((sum,p)=>sum+p.swaps.filter(s=>s.apply).length,0);
  st.onApply(JUDGE_finalRows(ns),{active,proposed,partial:active>0&&active<proposed});
}
async function JUDGE_open(ns,rows,mountId,onApply,opts){
  opts=opts||{};
  const l=L();
  const data=await withBusy('Судья изучает ряды…',async()=>{
    const draws=IF_window(await loadD(cur));
    if(draws.length<5)return{err:'Судье нужно минимум 5 тиражей выбранного периода. Обнови результаты во вкладке «Аналитика» или расширь окно.'};
    return{plan:JUDGE_plan(rows,l,draws),drawsN:draws.length};
  });
  if(!data)return;
  if(data.err){showFeedback('Верховный судья',data.err,'⚖️',3800);return;}
  JUDGE_state[ns]={plan:data.plan,l,drawsN:data.drawsN,mountId,onApply,intro:opts.intro||'',applyLabel:opts.applyLabel||''};
  JUDGE_render(ns);
  const mp=document.getElementById(mountId);if(mp&&mp.scrollIntoView)try{mp.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}
}

/* ═══════════════ СИСТЕМА ПАРАДОКСОВ · модальное окно ═══════════════ */
var PDX_state=null;
function PDX_open(){
  const l=L();
  PDX_state={useBase:true,n:Math.min(5,getGenCount()),rows:null};
  document.getElementById('pdx-sub').textContent=lotteryName(cur)+' · 5 контринтуитивных парадоксов лото';
  PDX_renderMode();
  document.getElementById('pdx-counts').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>'<button class="pick-cnt'+(n===PDX_state.n?' on':'')+'" data-loto-event-click="PDX_setN('+n+',this)">'+n+'</button>').join('');
  document.getElementById('pdx-result').innerHTML='';
  document.getElementById('pdx-go').style.display='';
  document.getElementById('pdx-ov').classList.add('show');
}
function PDX_close(){document.getElementById('pdx-ov').classList.remove('show');}
function PDX_setMode(useBase){PDX_state.useBase=useBase;PDX_renderMode();}
function PDX_renderMode(){
  const on=PDX_state.useBase;
  document.getElementById('pdx-mode-base').classList.toggle('on',on);
  document.getElementById('pdx-mode-free').classList.toggle('on',!on);
}
function PDX_setN(n,el){PDX_state.n=n;document.querySelectorAll('#pdx-counts .pick-cnt').forEach(b=>b.classList.toggle('on',b===el));}
async function PDX_go(){
  const st=PDX_state;if(!st)return;const l=L();
  const data=await withBusy('Собираю парадоксы…',async()=>{
    const draws=IF_window(await loadD(cur));
    if(st.useBase&&draws.length<5)return{warn:true,draws};
    return{draws};
  });
  if(!data)return;
  let useBase=st.useBase;
  if(data.warn){useBase=false;showFeedback('Мало данных для базы','Для «с базой» нужно минимум 5 тиражей. Собираю парадоксы без базы — по чистой структуре.','♾️',3200);st.useBase=false;PDX_renderMode();}
  st.rows=PDX_generate(st.n,useBase,l,data.draws);
  document.getElementById('pdx-go').style.display='none';
  PDX_renderRows();
}
function PDX_rowHtml(r,l){
  const note=r.pdx.key==='cluster'
    ?`${r.pdx.note} Для ${l.name}: ${(PDX_clusterProbability(l)*100).toFixed(2).replace('.',',')}%.`
    :r.pdx.note;
  return '<div class="pdx-row">'+
    '<div class="pdx-rlbl">♾️ '+r.pdx.name+' <span class="pdx-rtag">'+r.pdx.short+'</span></div>'+
    '<div class="if-rowballs">'+r.m.map(n=>'<div class="if-rball rb-m-'+l.cls+'">'+n+'</div>').join('')+
    ((r.b&&r.b.length)?'<div style="width:6px"></div>'+r.b.map(n=>'<div class="if-rball rb-b-'+l.cls+'">'+n+'</div>').join(''):'')+'</div>'+
    '<div class="pdx-rnote">'+note+'</div></div>';
}
function PDX_renderRows(){
  const st=PDX_state,l=L();
  document.getElementById('pdx-result').innerHTML=
    '<div class="if-seclbl">♾️ Парадоксы · '+st.rows.length+' '+rowWord(st.rows.length)+' '+(st.useBase?'(с базой тиражей)':'(без базы)')+'</div>'+
    st.rows.map(r=>PDX_rowHtml(r,l)).join('')+
    '<button class="btn-draw '+l.cls+'" style="margin-top:12px" data-loto-event-click="PDX_use()">Использовать в билете</button>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'+
    '<button class="btn-exp" style="margin:0" data-loto-event-click="PDX_copy(this)">📋 Копировать</button>'+
    '<button class="btn-exp" style="margin:0" data-loto-event-click="PDX_share()">📤 Поделиться</button></div>'+
    '<button class="btn-exp" style="margin-top:8px" data-loto-event-click="PDX_judge()">⚖️ Что скажет Верховный судья</button>'+
    '<div id="pdx-jmount" style="margin-top:6px"></div>'+
    '<button class="btn-exp" style="margin-top:10px" data-loto-event-click="PDX_go()">🔄 Пересобрать парадоксы</button>';
}
function PDX_use(){
  const st=PDX_state;if(!st||!st.rows)return;
  PDX_close();
  setGeneratedRows(st.rows,'Парадоксы перенесены в билет. ♾️ Это исследование структуры, а не прогноз — вероятность тиража не меняется.',true);
}
function PDX_copy(btn){
  const st=PDX_state;if(!st||!st.rows)return;
  writeClipboardText(rowsToShareText(st.rows.map(r=>({m:r.m,b:r.b})),L(),lotteryName(cur)+' · парадоксы'))
    .then(()=>{setCopyButtonState(btn);showCopyToast('Скопировано '+st.rows.length+' '+rowWord(st.rows.length));})
    .catch(()=>showFeedback('Не скопировано','Браузер запретил доступ к буферу обмена.','⚠️',3000));
}
function PDX_share(){
  const st=PDX_state;if(!st||!st.rows)return;
  shareText(lotteryName(cur)+' · парадоксы',lotteryName(cur)+' · парадоксы\n'+rowsAsText(st.rows.map(r=>({m:r.m,b:r.b})),L()));
}
function PDX_judge(){
  const st=PDX_state;if(!st||!st.rows)return;
  JUDGE_open('pdx',st.rows.map(r=>({m:r.m,b:r.b})),'pdx-jmount',(finalRows,meta)=>{
    PDX_close();
    const choice=JUDGE_choiceText(meta);
    setGeneratedRows(finalRows,choice+'. Парадоксы перенесены в билет. ⚖️♾️ Гарантий нет.');
  });
}

/* ═══ РАЗБОР МОЕЙ КОМБИНАЦИИ · судья о выбранных рядах ═══ */
let JC_pending=null;
function JC_close(){
  const ov=document.getElementById('jc-ov');
  if(!ov)return;
  ov.classList.remove('show','jc-intro-mode');
  JC_pending=null;
}
async function JC_open(){
  const l=L();fillAll();
  const good=rows.filter(r=>r.m.length===l.pM);
  if(!good.length){showFeedback('Пусто','Сначала заполни хотя бы один ряд в билете — тогда судья сможет его разобрать.','✋',2800);return;}
  const nd=(typeof QA_nextDrawDate==='function')?QA_nextDrawDate():new Date();
  document.getElementById('jc-sub').textContent=l.name+' · твоя комбинация на тираж '+nd.toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'});
  JC_pending={l,good};
  document.getElementById('jc-mount').innerHTML=
    '<div class="jc-intro"><b>'+escapeHtml(appText('Разбор моей комбинации'))+'</b><br>'+
    escapeHtml(appText('Судья проверит заполненные ряды по истории выбранного периода: частота, пары, пропуски, зоны, чётность и суммы. Анализ начнётся только после подтверждения. Закройте окно, если хотите отменить без запуска.'))+
    '</div><div class="jc-actions">'+
    '<button type="button" class="btn-close2" data-loto-event-click="JC_close()">'+escapeHtml(appText('Отмена'))+'</but'+'ton>'+
    '<button type="button" class="btn-draw" data-loto-event-click="JC_continue()">'+escapeHtml(appText('Понятно / Продолжить'))+'</but'+'ton>'+
    '</div>';
  document.getElementById('jc-ov').classList.add('show','jc-intro-mode');
}
async function JC_continue(){
  const pending=JC_pending;if(!pending)return;
  const l=pending.l,good=pending.good;
  JC_pending=null;
  const ov=document.getElementById('jc-ov');
  if(ov)ov.classList.remove('jc-intro-mode');
  document.getElementById('jc-mount').innerHTML='<div class="if-empty">'+escapeHtml(appText('Судья изучает твои ряды…'))+'</div>';
  const data=await withBusy('Судья изучает вашу комбинацию…',async()=>{
    const draws=IF_window(await loadD(cur));
    if(draws.length<5)return{err:'Судье нужно минимум 5 тиражей выбранного периода. Обнови результаты во вкладке «Аналитика» или расширь окно анализа.'};
    return{plan:JUDGE_plan(good.map(r=>({m:r.m,b:r.b})),l,draws),drawsN:draws.length};
  });
  if(!data)return;
  if(data.err){document.getElementById('jc-mount').innerHTML='<div class="if-empty">⚖️ '+data.err+'</div>';return;}
  const proposed=data.plan.reduce((s,p)=>s+p.swaps.length,0);
  const checked=good.length*l.pM;
  const agreed=checked-proposed;
  const uniq=new Set();data.plan.forEach(p=>p.orig.forEach(n=>uniq.add(n)));
  const covPct=Math.round(uniq.size/l.mB*100);
  const swapsList=[];data.plan.forEach(p=>p.swaps.forEach(s=>swapsList.push(s)));
  let verdict;
  if(proposed===0)verdict='<b>Вердикт: оставить как есть.</b> Все твои числа сидят в сильной зоне поля — переделывать нечего.';
  else if(proposed<=Math.max(1,Math.round(checked*0.18)))verdict='<b>Вердикт: почти идеально.</b> Достаточно точечной правки '+proposed+' '+(proposed===1?'числа':'чисел')+', остальное трогать не советую.';
  else if(proposed<=Math.round(checked*0.4))verdict='<b>Вердикт: крепкая основа, но есть слабые места.</b> Предлагаю заменить '+proposed+' чисел — реши сам, что применить.';
  else verdict='<b>Вердикт: стоит пересобрать.</b> Слабых по полю чисел много ('+proposed+'). Замени часть вручную ниже или собери ряды заново умной генерацией.';
  const covLine=' Твои '+good.length+' '+rowWord(good.length)+' покрывают '+uniq.size+' из '+l.mB+' чисел поля ('+covPct+'%) — '+(covPct>=45?'широкий охват.':covPct>=22?'умеренный охват; больше рядов раскрыли бы поле шире.':'узкий охват: для покрытия поля возьми больше рядов.');
  const intro='<b>Дело о твоей комбинации.</b> Проверил '+checked+' чисел по силе поля из '+data.drawsN+' тиражей (частота, пары, пропуски, зоны, чётность, суммы). Согласен с <b>'+agreed+'</b>. '+
    (proposed?('Под подозрением <b>'+proposed+'</b>: '+swapsList.slice(0,8).map(x=>x.from+'→'+x.to).join(', ')+(proposed>8?' и ещё '+(proposed-8):'')+'.'):'Возражений нет.')+covLine+'<br><br>'+verdict;
  JUDGE_state['jc']={plan:data.plan,l,drawsN:data.drawsN,mountId:'jc-mount',intro,applyLabel:'Применить в билете',onApply:(finalRows,meta)=>{JC_close();const choice=JUDGE_choiceText(meta);setGeneratedRows(finalRows,choice+'. Комбинация применена в билете. ⚖️');}};
  JUDGE_render('jc');
}
/* ═══════════════ MODAL MANAGER ═══════════════
 * Invariant: one user action → at most ONE visible top-level overlay.
 * Every top-level modal is a body-level element whose id ends in "-ov" and is
 * toggled with the .show class. There is no single open()/close() call site
 * (23+ inline functions toggle .show directly), and opening one never closed
 * the others → overlays stacked (e.g. Верховный судья sup-ov over jc-ov).
 * This observer centralises the invariant WITHOUT touching those call sites:
 * whenever an overlay gains .show, every other visible content overlay is
 * closed. busy-ov (loading spinner) is transient and may briefly overlay. */
(function(){
  var TRANSIENT={'busy-ov':1};
  var CRITICAL={
    'cc-ov':1,'fb-ov':1,'prev-ov':1,'pro-ov':1,'mres-ov':1,'jc-ov':1,
    'cons-ov':1,'qa-ov':1,'adv-ov':1,'sup-ov':1,'pdx-ov':1,'matrix-ov':1,
    'if-ov':1,'ticket-ov':1
  };
  function tops(){return Array.prototype.slice.call(document.querySelectorAll('[id$="-ov"]')).filter(function(el){return el.parentElement===document.body;});}
  function isContentModal(el){return el&&!TRANSIENT[el.id];}
  function visibleContent(){return tops().filter(function(el){return el.classList.contains('show')&&isContentModal(el);});}
  function labelModal(el){
    if(!el.hasAttribute('role'))el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    if(el.hasAttribute('aria-label')||el.hasAttribute('aria-labelledby'))return;
    var title=el.querySelector('.if-title,.sg-title,.lang-title,.fb-title,.cc-title,.pro-title,.horo-title,.card-t');
    if(!title)return;
    if(!title.id)title.id=el.id+'-title';
    el.setAttribute('aria-labelledby',title.id);
  }
  function focusable(el){
    return Array.prototype.slice.call(el.querySelectorAll('button:not([disabled]):not([hidden]),a[href]:not([hidden]),input:not([disabled]):not([hidden]),select:not([disabled]):not([hidden]),textarea:not([disabled]):not([hidden]),[tabindex]:not([tabindex="-1"])')).filter(function(node){return node.offsetParent!==null||node===document.activeElement;});
  }
  function closeOverlay(el,reason){
    if(!el||!el.classList.contains('show'))return;
    if(typeof el.__lotoClose==='function'){try{el.__lotoClose(reason||'close');return;}catch(e){}}
    if(el.id==='pro-ov'&&typeof window.PRO_close==='function'){try{window.PRO_close();return;}catch(e){}}
    el.classList.remove('show');
  }
  var activeModal=null,lastTrigger=null,guard=false,locked=false,lockY=0,openers={};
  function lockBody(){
    if(locked)return;
    locked=true;lockY=window.scrollY||window.pageYOffset||0;
    document.body.style.top='-'+lockY+'px';
    document.body.classList.add('loto-modal-open');
  }
  function unlockBody(){
    if(!locked)return;
    locked=false;document.body.classList.remove('loto-modal-open');document.body.style.top='';
    window.scrollTo(0,lockY);
  }
  function restoreFocus(id){
    var target=openers[id];delete openers[id];
    if(target&&document.contains(target)){try{target.focus({preventScroll:true});}catch(_){try{target.focus();}catch(__){}}}
  }
  function focusInitial(el){
    requestAnimationFrame(function(){
      if(!el.classList.contains('show'))return;
      var items=focusable(el),target=el.querySelector('[autofocus]')||items[0];
      if(!target){el.tabIndex=-1;target=el;}
      try{target.focus({preventScroll:true});}catch(_){try{target.focus();}catch(__){}}
    });
  }
  function activate(opened){
    if(!opened||!isContentModal(opened))return;
    if(!openers[opened.id]){
      var candidate=document.activeElement;
      if(candidate&&candidate!==document.body&&!opened.contains(candidate))openers[opened.id]=candidate;
      else if(lastTrigger&&!opened.contains(lastTrigger))openers[opened.id]=lastTrigger;
    }
    guard=true;
    try{tops().forEach(function(el){
      if(el===opened||!isContentModal(el)||!el.classList.contains('show'))return;
      if(openers[el.id]&&!openers[opened.id])openers[opened.id]=openers[el.id];
      delete openers[el.id];closeOverlay(el,'replace');
    });}
    finally{guard=false;}
    labelModal(opened);activeModal=opened.id;lockBody();focusInitial(opened);
  }
  function recomputeActive(closedId){
    var v=visibleContent();activeModal=v.length?v[v.length-1].id:null;
    if(activeModal){lockBody();return;}
    unlockBody();if(closedId)requestAnimationFrame(function(){restoreFocus(closedId);});
  }
  var obs=new MutationObserver(function(recs){
    if(guard)return;
    var opened=null,closedId=null;
    for(var i=0;i<recs.length;i++){
      var el=recs[i].target,old=recs[i].oldValue||'';
      var wasShown=/(^|\s)show(\s|$)/.test(old),isShown=el.classList.contains('show');
      if(!wasShown&&isShown&&isContentModal(el))opened=el; /* last open in the batch wins */
      if(wasShown&&!isShown&&isContentModal(el))closedId=el.id;
    }
    if(opened)activate(opened);
    else recomputeActive(closedId);
  });
  function attach(){tops().forEach(function(el){labelModal(el);obs.observe(el,{attributes:true,attributeFilter:['class'],attributeOldValue:true});});}
  /* remember the control that triggered a modal so focus can return to it */
  document.addEventListener('pointerdown',function(e){var t=e.target&&e.target.closest&&e.target.closest('button,a,[onclick],[role="button"]');if(t)lastTrigger=t;},true);
  document.addEventListener('keydown',function(e){
    if(!activeModal)return;
    var el=document.getElementById(activeModal);if(!el)return;
    if(e.key==='Tab'){
      var items=focusable(el);if(!items.length){e.preventDefault();el.focus();return;}
      var first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      return;
    }
    if(e.key!=='Escape'&&e.key!=='Esc')return;
    e.preventDefault();closeOverlay(el,'escape');recomputeActive(el.id);
  });
  document.addEventListener('click',function(e){
    if(!activeModal||!CRITICAL[activeModal])return;
    var el=document.getElementById(activeModal);
    if(e.target===el){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  function nativeBack(e){
    if(!activeModal)return;
    e.preventDefault();var el=document.getElementById(activeModal);closeOverlay(el,'back');recomputeActive(el.id);
  }
  window.addEventListener('loto:nativeback',nativeBack);
  document.addEventListener('backbutton',nativeBack,false);
  window.LotoModals={
    openModal:function(id){var el=document.getElementById(id);if(!el)return;el.classList.add('show');activate(el);},
    closeModal:function(id){var el=document.getElementById(id);if(!el)return;closeOverlay(el,'close');recomputeActive(id);},
    closeActiveModal:function(){if(activeModal)this.closeModal(activeModal);},
    replaceModal:function(from,to){this.closeModal(from);this.openModal(to);},
    visibleTopLevelModals:function(){return visibleContent().map(function(el){return el.id;});},
    managesBodyScroll:true,
    get active(){return activeModal;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();
