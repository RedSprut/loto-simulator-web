(function(){
  'use strict';
  const catalog=window.LOTO_I18N_CATALOG;
  if(!catalog)throw new Error('LOTO_I18N_CATALOG is not loaded');
  const localeCodes=Object.keys(catalog.locales);
  const localeIndex=new Map(localeCodes.map((code,index)=>[code,index]));
  const normalize=value=>String(value??'').replace(/[\u00a0\s]+/g,' ').trim();
  const isCanonicalLotteryNumber=value=>/^(?:[1-9]|[1-8]\d|90)$/.test(value);
  const canRegisterAlias=(alias,source)=>alias&&(!isCanonicalLotteryNumber(alias)||alias===source);
  const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const wordTokens=value=>[...String(value).toLocaleLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map(match=>match[0]);
  const candidateKey=value=>wordTokens(value).reduce((best,token)=>token.length>best.length?token:best,'');
  const entries=new Map();
  const aliases=new Map();
  const loadedLocales=new Set();
  const loadingLocales=new Map();
  const translationCaches=new Map();

  const patternBuckets=new Map(),patternFallback=[];
  const phraseBuckets=new Map();
  // The lookup index of the app catalog. A scoped catalog (LotoI18n.createTranslator — the Owner
  // Panel's ru/en/no rows, loaded with the panel) gets its own index of the same shape and is
  // matched by the same addEntry / translateCore.
  const appIndex={localeIndex,entries,aliases,patternBuckets,patternFallback,phraseBuckets,translationCaches};
  const addBucket=(buckets,key,item)=>{
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(item);
  };
  // One entry into the lookup: exact map, reverse aliases, and the template / phrase indexes. Used
  // for the startup catalog and, later, for a lazily loaded catalog part (see loadPart). Candidates
  // are ranked at lookup time, so the order entries arrive in does not matter.
  function addEntry(source,sourceLocale,translations,idx=appIndex){
    const normalized=normalize(source);
    if(idx.entries.has(normalized))return idx.entries.get(normalized);
    const entry={source:normalized,sourceLocale,translations};
    idx.entries.set(normalized,entry);
    for(const translation of translations||[]){
      const alias=normalize(translation);
      if(canRegisterAlias(alias,normalized)&&!idx.aliases.has(alias))idx.aliases.set(alias,entry);
    }
    if(/{{\d+}}/.test(normalized)){
      const slots=[];
      const pieces=normalized.split(/({{\d+}})/g);
      const regex='^'+pieces.map(piece=>{
        const match=piece.match(/^{{(\d+)}}$/);
        if(match){slots.push(Number(match[1]));return '(.+?)';}
        return escapeRegExp(piece);
      }).join('')+'$';
      const pattern={...entry,regex:new RegExp(regex,'u'),slots,weight:normalized.replace(/{{\d+}}/g,'').length};
      const key=candidateKey(pattern.source.replace(/{{\d+}}/g,' '));
      if(key)addBucket(idx.patternBuckets,key,pattern);
      else idx.patternFallback.push(pattern);
    }else if(normalized.length>=2&&/[A-Za-zА-Яа-яЁё]/.test(normalized)){
      entry.beginsWithWord=/^[\p{L}\p{N}]/u.test(normalized);
      entry.endsWithWord=/[\p{L}\p{N}]$/u.test(normalized);
      const key=candidateKey(entry.source);
      if(key)addBucket(idx.phraseBuckets,key,entry);
    }
    return entry;
  }
  for(const [source,sourceLocale,translations] of catalog.entries)addEntry(source,sourceLocale,translations);
  if(!catalog.chunksBase)localeCodes.forEach(code=>loadedLocales.add(code));

  // Определение языка живёт в ОДНОМ месте — lang-detect.js (LotoLang): сохранённый выбор →
  // exact locale → base language → English, одинаково на Web, iOS и Android. Здесь остаётся
  // только аварийный путь на случай, если lang-detect.js не загрузился.
  function initialLanguage(){
    const detected=globalThis.LotoLang?.detect?.();
    if(detected&&localeIndex.has(detected))return detected;
    let stored='';
    try{
      if(typeof localStorage!=='undefined')stored=String(localStorage.getItem('loto_lang')||'').trim().toLowerCase();
    }catch(_error){}
    if(localeIndex.has(stored))return stored;
    const tags=[...(globalThis.navigator?.languages||[]),globalThis.navigator?.language||''];
    for(const tag of tags){
      const base=String(tag||'').toLowerCase().split(/[-_]/)[0];
      if(localeIndex.has(base))return base;
    }
    return 'en';
  }

  let language=initialLanguage();
  let languageRequest=0;
  const textSources=new WeakMap(),textLast=new WeakMap();
  const attributeState=new WeakMap();
  const translatedAttrs=['placeholder','title','aria-label','aria-description','alt'];

  function valueFor(entry,code=language,idx=appIndex){
    const index=idx.localeIndex.get(code);
    return index===undefined?entry.source:(entry.translations[index]||entry.source);
  }

  function fillTemplate(value,captures,slots,code=language,idx=appIndex){
    return value.replace(/{{(\d+)}}/g,(_,slot)=>{
      const position=slots.indexOf(Number(slot));
      return position>=0?translateCore(captures[position],code,idx):'';
    });
  }

  function candidateList(core,buckets,fallback=[]){
    const found=new Set(fallback);
    for(const token of new Set(wordTokens(core))){
      for(const candidate of buckets.get(token)||[])found.add(candidate);
    }
    return[...found];
  }

  function cachedTranslation(code,core,compute,idx=appIndex){
    let cache=idx.translationCaches.get(code);
    if(!cache){cache=new Map();idx.translationCaches.set(code,cache);}
    if(cache.has(core))return cache.get(core);
    const value=compute();
    if(cache.size>=4000)cache.clear();
    cache.set(core,value);
    return value;
  }

  function phraseRegex(entry){
    if(!entry.phraseRegex)entry.phraseRegex=new RegExp(
      (entry.beginsWithWord?'(?<![\\p{L}\\p{N}])':'')+escapeRegExp(entry.source)+(entry.endsWithWord?'(?![\\p{L}\\p{N}])':''),
      'gu'
    );
    return entry.phraseRegex;
  }

  function translateCore(core,code=language,idx=appIndex){
    if(!core||code==='ru'&&/[А-Яа-яЁё]/.test(core))return core;
    return cachedTranslation(code,core,()=>{
      const exact=idx.entries.get(core)||idx.aliases.get(core);
      if(exact)return valueFor(exact,code,idx);
      const patternCandidates=candidateList(core,idx.patternBuckets,idx.patternFallback).sort((a,b)=>b.weight-a.weight);
      for(const pattern of patternCandidates){
        const match=core.match(pattern.regex);
        if(match)return fillTemplate(valueFor(pattern,code,idx),match.slice(1),pattern.slots,code,idx);
      }
      let output=core;
      const phraseCandidates=candidateList(core,idx.phraseBuckets).sort((a,b)=>b.source.length-a.source.length);
      for(const phrase of phraseCandidates)output=output.replace(phraseRegex(phrase),valueFor(phrase,code,idx));
      return output;
    },idx);
  }

  function translate(value,code=language,idx=appIndex){
    const raw=String(value??'');
    const leading=raw.match(/^\s*/)?.[0]||'';
    const trailing=raw.match(/\s*$/)?.[0]||'';
    const core=normalize(raw);
    return leading+translateCore(core,code,idx)+trailing;
  }

  function skipTextNode(node){
    const parent=node.parentElement;
    return !parent||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName)||parent.closest('[data-i18n-ignore]');
  }

  // The web build (scripts/prerender-en-shell.mjs) ships the static pages in English. Where one
  // English word belongs to entries with different translations («Retry» = «Повторить» and
  // «Повторить загрузку»), the element names its entry: data-i18n-entry="<catalog index>" for its
  // first text node, data-i18n-entry-<attribute> for an attribute. Read once, for the English the
  // build wrote; text a script puts there later is its own source. Native bundles never carry it.
  function hintedEntry(element,name,current){
    const hint=element&&typeof element.getAttribute==='function'?element.getAttribute(name):null;
    if(hint===null||hint===undefined||!normalize(current))return null;
    element.removeAttribute(name);
    const entry=catalog.entries[Number(hint)];
    return entry&&!/[А-Яа-яЁё]/.test(current)?entry[0]:null;
  }
  function hintedSource(node,current){
    const source=hintedEntry(node.parentElement,'data-i18n-entry',current);
    return source===null?current:current.match(/^\s*/)[0]+source+current.match(/\s*$/)[0];
  }

  function localizeTextNode(node,force=false){
    if(skipTextNode(node))return;
    const current=node.nodeValue||'';
    let source=textSources.get(node);
    const last=textLast.get(node);
    if(source===undefined||current!==last){
      source=source===undefined?hintedSource(node,current):current;textSources.set(node,source);
    }
    const target=translate(source);
    textLast.set(node,target);
    if(current!==target)node.nodeValue=target;
  }

  function localizeAttribute(element,name,force=false){
    if(!element.hasAttribute(name)||element.closest('[data-i18n-ignore]'))return;
    let state=attributeState.get(element);
    if(!state){state=new Map();attributeState.set(element,state);}
    const current=element.getAttribute(name)||'';
    let item=state.get(name);
    if(!item||current!==item.last)item={source:item?current:(hintedEntry(element,`data-i18n-entry-${name}`,current)??current),last:current};
    const target=translate(item.source);
    item.last=target;state.set(name,item);
    if(current!==target)element.setAttribute(name,target);
  }

  function localizeTree(root=document,force=false){
    if(root.nodeType===Node.TEXT_NODE){localizeTextNode(root,force);return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    if(root.nodeType===Node.ELEMENT_NODE)translatedAttrs.forEach(name=>localizeAttribute(root,name,force));
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(node.nodeType===Node.TEXT_NODE)localizeTextNode(node,force);
      else translatedAttrs.forEach(name=>localizeAttribute(node,name,force));
    }
  }

  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')localizeTextNode(record.target);
      else if(record.type==='attributes')localizeAttribute(record.target,record.attributeName);
      else for(const node of record.addedNodes)localizeTree(node);
    }
  });

  function persistLocale(code,values,part=''){
    const serviceWorker=globalThis.navigator?.serviceWorker;
    if(!serviceWorker||!Array.isArray(values))return;
    const message=part?{type:'CACHE_LOCALE',code,part}:{type:'CACHE_LOCALE',code,values};
    if(serviceWorker.controller)serviceWorker.controller.postMessage(message);
    else serviceWorker.ready?.then(registration=>registration.active?.postMessage(message)).catch(()=>{});
  }

  function loadLanguage(code){
    if(loadedLocales.has(code)||!catalog.chunksBase)return Promise.resolve();
    if(loadingLocales.has(code))return loadingLocales.get(code);
    const pending=(async()=>{
      const response=await fetch(`${catalog.chunksBase}${encodeURIComponent(code)}.json`,{cache:'no-cache'});
      if(!response.ok)throw new Error(`locale_http_${response.status}`);
      const values=await response.json();
      if(!Array.isArray(values)||values.length!==catalog.entries.length)throw new Error('invalid_locale_chunk');
      const index=localeIndex.get(code);
      catalog.entries.forEach((entry,entryIndex)=>{entry[2][index]=values[entryIndex]||entry[0];});
      for(const [entryIndex,value] of values.entries()){
        const alias=normalize(value);
        const source=normalize(catalog.entries[entryIndex][0]);
        if(canRegisterAlias(alias,source)&&!aliases.has(alias)){
          aliases.set(alias,entries.get(source));
        }
      }
      translationCaches.clear();
      loadedLocales.add(code);
      persistLocale(code,values);
    })().finally(()=>loadingLocales.delete(code));
    loadingLocales.set(code,pending);
    return pending;
  }

  // ── Catalog parts ──
  // Copy that only a lazily loaded screen shows (the analytical court) is not in the startup
  // catalog at all: the build moves it into i18n/<part>-<code>.json, `{sources, values}` for one
  // locale. The screen asks for its part before it renders; once asked for, a part follows every
  // later language switch, so the screen never shows another language's copy.
  const parts=catalog.parts||{};
  const requestedParts=new Set();
  const loadedParts=new Set(),loadingParts=new Map();
  function loadPartFor(part,code){
    const base=parts[part];
    const key=`${part}|${code}`;
    if(!base||loadedParts.has(key))return Promise.resolve();
    if(loadingParts.has(key))return loadingParts.get(key);
    const pending=(async()=>{
      const response=await fetch(`${base}${encodeURIComponent(code)}.json`,{cache:'no-cache'});
      if(!response.ok)throw new Error(`locale_part_http_${response.status}`);
      const data=await response.json();
      if(!data||!Array.isArray(data.sources)||!Array.isArray(data.values)||data.sources.length!==data.values.length)throw new Error('invalid_locale_part');
      const index=localeIndex.get(code);
      data.sources.forEach((source,position)=>{
        const entry=addEntry(source,'ru',new Array(localeCodes.length));
        if(!entry.translations[index])entry.translations[index]=data.values[position]||source;
        const alias=normalize(data.values[position]);
        if(canRegisterAlias(alias,entry.source)&&!aliases.has(alias))aliases.set(alias,entry);
      });
      translationCaches.clear();
      loadedParts.add(key);
      persistLocale(code,data.values,part);
    })().finally(()=>loadingParts.delete(key));
    loadingParts.set(key,pending);
    return pending;
  }
  function loadPart(part){
    if(!parts[part])return Promise.resolve();
    requestedParts.add(part);
    return loadPartFor(part,language);
  }
  const loadRequestedParts=code=>Promise.all([...requestedParts].map(part=>loadPartFor(part,code).catch(error=>console.warn('Locale part failed',part,error))));

  async function setLanguage(code){
    const target=localeIndex.has(code)?code:'en';
    const request=++languageRequest;
    language=target;
    try{await loadLanguage(target);}catch(error){console.warn('Locale chunk failed',error);}
    await loadRequestedParts(target);
    if(request!==languageRequest||language!==target)return false;
    document.documentElement.lang=target;
    document.documentElement.dir='ltr';
    localizeTree(document,true);
    document.documentElement.classList.remove('i18n-pending');
    window.dispatchEvent(new CustomEvent('loto:languagechange',{detail:{language:target}}));
    return true;
  }

  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  void loadLanguage(language).catch(error=>console.warn('Initial locale chunk failed',error));
  async function start(){
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:translatedAttrs});
    try{await setLanguage(language);}
    finally{
      // Сигнал для splash-прелоадера (boot-runtime): интерфейс уже переведён на выбранный язык,
      // приложение можно показывать. Без этого пользователь с польским браузером мог на миг
      // увидеть исходный русский текст, если чанк локали приехал позже конца splash-анимации.
      // Ставится и при ошибке загрузки чанка — иначе splash завис бы навсегда.
      window.__lotoI18nApplied=true;
      resolveReady();
    }
  }

  // ── Jackpot amounts ──
  // Every jackpot the app holds (jackpots.json `amount`, a draw's `payload.jackpot`, the
  // notification payloads built from them) is a number of MILLIONS in the operator's currency.
  // Formatting that number as a plain currency amount showed «298,00 $» for a $298 million
  // Powerball jackpot. This is the single formatter for a jackpot amount everywhere (hero,
  // notification centre, analysis modals): the value is untouched, the unit is spelled out in
  // the requested language (the catalog's own translation of «млн»), the currency stays the
  // source's — a symbol before the number for $/€/£, the ISO code after it otherwise.
  //   ru: $298 млн · €29,6 млн · 23,5 млн NOK · 55 млн CAD
  //   en: $298 million · €29.6 million · 23.5 million NOK · 55 million CAD
  // A value in currency units (≥ 100 000, e.g. 55000000) is converted to millions first.
  const CURRENCY_SYMBOL={USD:'$',EUR:'€',GBP:'£'};
  const intlLocale=code=>code==='no'?'nb-NO':code==='en'?'en-GB':code;
  function formatJackpot(value,currency,code=language,numberLocale=''){
    const raw=String(value??'').replace(',','.').trim();
    if(raw==='')return '';
    let n=typeof value==='number'?value:Number(raw);
    if(!Number.isFinite(n)||n<0)return '';
    if(n>=1e5)n=n/1e6;
    const cur=String(currency||'').toUpperCase().trim();
    let num;
    try{num=new Intl.NumberFormat(numberLocale||intlLocale(code),{maximumFractionDigits:2}).format(n);}
    catch(_e){num=String(n);}
    const unit=translateCore('млн',code);
    return CURRENCY_SYMBOL[cur]?`${CURRENCY_SYMBOL[cur]}${num} ${unit}`:`${num} ${unit}${cur?' '+cur:''}`;
  }

  // A translator over a separate catalog of the same format ({locales, entries}) — for copy that
  // must not live in the startup catalog and follows its own language (the Owner Panel).
  function createTranslator(scoped){
    const codes=Object.keys(scoped.locales);
    const idx={localeIndex:new Map(codes.map((code,index)=>[code,index])),entries:new Map(),aliases:new Map(),
      patternBuckets:new Map(),patternFallback:[],phraseBuckets:new Map(),translationCaches:new Map()};
    for(const [source,sourceLocale,translations] of scoped.entries)addEntry(source,sourceLocale,translations,idx);
    return(value,code)=>translate(value,code,idx);
  }

  window.LotoI18n={
    catalog,
    createTranslator,
    formatJackpot,
    intlLocale,
    get language(){return language;},
    ready,
    setLanguage,
    loadPart,
    translate,
    localizeTree,
    localeInfo:code=>catalog.locales[code],
    localeCodes:()=>[...localeCodes]
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void start();},{once:true});
  else void start();
})();
