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
  const appIndex={localeIndex,entries,aliases,patternBuckets,patternFallback,phraseBuckets,translationCaches};
  const addBucket=(buckets,key,item)=>{
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(item);
  };
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
      window.__lotoI18nApplied=true;
      resolveReady();
    }
  }

  const APP_LOCALES={ru:'ru-RU',en:'en-GB',no:'nb-NO',sv:'sv-SE',da:'da-DK',fi:'fi-FI',de:'de-DE',fr:'fr-FR',es:'es-ES',it:'it-IT',pt:'pt-PT',pl:'pl-PL',nl:'nl-NL',et:'et-EE',lv:'lv-LV',lt:'lt-LT',uk:'uk-UA'};
  const intlLocale=code=>APP_LOCALES[code]||code;
  const SCALE_WORDS={
    ru:['млн','млрд','трлн'],
    uk:['млн','млрд','трлн'],
    en:['million','billion','trillion'],
    no:[['million','millioner'],['milliard','milliarder'],['billion','billioner']],
    sv:[['miljon','miljoner'],['miljard','miljarder'],['biljon','biljoner']],
    da:['mio.','mia.','bio.'],
    fi:[['miljoona','miljoonaa'],['miljardi','miljardia'],['biljoona','biljoonaa']],
    de:[['Million','Millionen'],['Milliarde','Milliarden'],['Billion','Billionen']],
    fr:[['million','millions'],['milliard','milliards'],['billion','billions']],
    es:[['millón','millones'],'mil millones',['billón','billones']],
    it:[['milione','milioni'],['miliardo','miliardi'],['mille miliardi','mila miliardi']],
    pt:[['milhão','milhões'],'mil milhões',['bilião','biliões']],
    pl:['mln','mld','bln'],
    nl:['miljoen','miljard','biljoen'],
    et:[['miljon','miljonit'],['miljard','miljardit'],['triljon','triljonit']],
    lv:['milj.','mljrd.','trilj.'],
    lt:['mln.','mlrd.','trln.'],
  };
  const CURRENCY_SYMBOL={USD:'$',EUR:'€',GBP:'£'};
  const NBSP=' ';
  const moneyLanguage=code=>{
    const base=String(code||language).toLowerCase().split(/[-_]/)[0];
    const mapped=base==='nb'||base==='nn'?'no':base;
    return SCALE_WORDS[mapped]?mapped:'en';
  };
  const numberText=(n,locale,min,max)=>{
    try{return new Intl.NumberFormat(locale,{minimumFractionDigits:min,maximumFractionDigits:max}).format(n);}
    catch(_e){return n.toFixed(min);}
  };
  function scaleWord(forms,n,code,min){
    if(typeof forms==='string')return forms;
    let one=n===1;
    try{one=new Intl.PluralRules(intlLocale(code),{minimumFractionDigits:min,maximumFractionDigits:2}).select(n)==='one';}catch(_e){}
    return one?forms[0]:forms[1];
  }
  function withCurrency(amount,cur,code){
    if(!cur)return amount;
    const symbol=CURRENCY_SYMBOL[cur];
    const token=code==='no'&&cur==='NOK'?'kr':(symbol||cur);
    if(symbol&&code==='en')return symbol+amount;
    if(symbol&&code==='nl')return symbol+NBSP+amount;
    return amount+NBSP+token;
  }
  function formatAmount(units,opts={}){
    const n=typeof units==='number'?units:Number(String(units??'').replace(',','.').trim());
    if(String(units??'').trim()===''||!Number.isFinite(n)||n<0)return '';
    const code=moneyLanguage(opts.code);
    const locale=opts.numberLocale||intlLocale(code);
    const cur=String(opts.currency||'').toUpperCase().trim();
    const round2=v=>Math.round(v*100)/100;
    let text,approx=Boolean(opts.approx);
    if(opts.exact||n<1e6){
      const fraction=Math.abs(n-Math.round(n))>=0.005;
      text=numberText(fraction?round2(n):Math.round(n),locale,fraction?2:0,2);
      if(Math.abs((fraction?round2(n):Math.round(n))-n)>1e-6)approx=true;
    }else{
      let step=n>=1e12?2:n>=1e9?1:0;
      let value=round2(n/Math.pow(1000,step+2));
      if(value>=1000&&step<2){step++;value=round2(n/Math.pow(1000,step+2));}
      const scale=Math.pow(1000,step+2);
      if(Math.abs(value*scale-n)>Math.max(1e-6,n*1e-12))approx=true;
      const min=code==='no'&&step>0&&value%1?2:0;
      text=numberText(value,locale,min,2)+NBSP+scaleWord(SCALE_WORDS[code][step],value,code,min);
    }
    const out=withCurrency(text,cur,code);
    return approx?(code==='no'?'Ca.':'≈')+NBSP+out:out;
  }
  function formatJackpot(value,currency,code=language,numberLocale='',opts={}){
    const raw=String(value??'').replace(',','.').trim();
    if(raw==='')return '';
    const n=typeof value==='number'?value:Number(raw);
    if(!Number.isFinite(n)||n<0)return '';
    return formatAmount(n>=1e5?n:n*1e6,{...opts,currency,code,numberLocale});
  }
  function formatMoney(value,currency,code=language,numberLocale=''){
    return formatAmount(value,{currency,code,numberLocale,exact:true});
  }

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
    formatAmount,
    formatJackpot,
    formatMoney,
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
