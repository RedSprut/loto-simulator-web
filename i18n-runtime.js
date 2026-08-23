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
  const patterns=[];
  const phrases=[];
  const loadedLocales=new Set();
  const loadingLocales=new Map();
  const translationCaches=new Map();

  for(const [source,sourceLocale,translations] of catalog.entries){
    const normalized=normalize(source);
    const entry={source:normalized,sourceLocale,translations};
    entries.set(normalized,entry);
    for(const translation of translations||[]){
      const alias=normalize(translation);
      if(canRegisterAlias(alias,normalized)&&!aliases.has(alias))aliases.set(alias,entry);
    }
    if(/{{\d+}}/.test(normalized)){
      const slots=[];
      const pieces=normalized.split(/({{\d+}})/g);
      const regex='^'+pieces.map(piece=>{
        const match=piece.match(/^{{(\d+)}}$/);
        if(match){slots.push(Number(match[1]));return '(.+?)';}
        return escapeRegExp(piece);
      }).join('')+'$';
      patterns.push({...entry,regex:new RegExp(regex,'u'),slots,weight:normalized.replace(/{{\d+}}/g,'').length});
    }else if(normalized.length>=2&&/[A-Za-zА-Яа-яЁё]/.test(normalized)){
      entry.beginsWithWord=/^[\p{L}\p{N}]/u.test(normalized);
      entry.endsWithWord=/[\p{L}\p{N}]$/u.test(normalized);
      phrases.push(entry);
    }
  }
  patterns.sort((a,b)=>b.weight-a.weight);
  phrases.sort((a,b)=>b.source.length-a.source.length);
  const patternBuckets=new Map(),patternFallback=[];
  const phraseBuckets=new Map();
  const addBucket=(buckets,key,item)=>{
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(item);
  };
  for(const pattern of patterns){
    const key=candidateKey(pattern.source.replace(/{{\d+}}/g,' '));
    if(key)addBucket(patternBuckets,key,pattern);
    else patternFallback.push(pattern);
  }
  for(const phrase of phrases){
    const key=candidateKey(phrase.source);
    if(key)addBucket(phraseBuckets,key,phrase);
  }
  if(!catalog.chunksBase)localeCodes.forEach(code=>loadedLocales.add(code));

  function initialLanguage(){
    let stored='';
    try{
      if(typeof localStorage!=='undefined')stored=String(localStorage.getItem('loto_lang')||'').trim().toLowerCase();
    }catch(_error){}
    const browser=String(globalThis.navigator?.languages?.[0]||globalThis.navigator?.language||'en').toLowerCase().split(/[-_]/)[0];
    return localeIndex.has(stored)?stored:(localeIndex.has(browser)?browser:'en');
  }

  let language=initialLanguage();
  let languageRequest=0;
  const textSources=new WeakMap(),textLast=new WeakMap();
  const attributeState=new WeakMap();
  const translatedAttrs=['placeholder','title','aria-label','aria-description'];

  function valueFor(entry,code=language){
    const index=localeIndex.get(code);
    return index===undefined?entry.source:(entry.translations[index]||entry.source);
  }

  function fillTemplate(value,captures,slots,code=language){
    return value.replace(/{{(\d+)}}/g,(_,slot)=>{
      const position=slots.indexOf(Number(slot));
      return position>=0?translateCore(captures[position],code):'';
    });
  }

  function candidateList(core,buckets,fallback=[]){
    const found=new Set(fallback);
    for(const token of new Set(wordTokens(core))){
      for(const candidate of buckets.get(token)||[])found.add(candidate);
    }
    return[...found];
  }

  function cachedTranslation(code,core,compute){
    let cache=translationCaches.get(code);
    if(!cache){cache=new Map();translationCaches.set(code,cache);}
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

  function translateCore(core,code=language){
    if(!core||code==='ru'&&/[А-Яа-яЁё]/.test(core))return core;
    return cachedTranslation(code,core,()=>{
      const exact=entries.get(core)||aliases.get(core);
      if(exact)return valueFor(exact,code);
      const patternCandidates=candidateList(core,patternBuckets,patternFallback).sort((a,b)=>b.weight-a.weight);
      for(const pattern of patternCandidates){
        const match=core.match(pattern.regex);
        if(match)return fillTemplate(valueFor(pattern,code),match.slice(1),pattern.slots,code);
      }
      let output=core;
      const phraseCandidates=candidateList(core,phraseBuckets).sort((a,b)=>b.source.length-a.source.length);
      for(const phrase of phraseCandidates)output=output.replace(phraseRegex(phrase),valueFor(phrase,code));
      return output;
    });
  }

  function translate(value,code=language){
    const raw=String(value??'');
    const leading=raw.match(/^\s*/)?.[0]||'';
    const trailing=raw.match(/\s*$/)?.[0]||'';
    const core=normalize(raw);
    return leading+translateCore(core,code)+trailing;
  }

  function skipTextNode(node){
    const parent=node.parentElement;
    return !parent||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName)||parent.closest('[data-i18n-ignore]');
  }

  function localizeTextNode(node,force=false){
    if(skipTextNode(node))return;
    const current=node.nodeValue||'';
    let source=textSources.get(node);
    const last=textLast.get(node);
    if(source===undefined||current!==last){
      source=current;textSources.set(node,source);
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
    if(!item||current!==item.last)item={source:current,last:current};
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

  function persistLocale(code,values){
    const serviceWorker=globalThis.navigator?.serviceWorker;
    if(!serviceWorker||!Array.isArray(values))return;
    const message={type:'CACHE_LOCALE',code,values};
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

  async function setLanguage(code){
    const target=localeIndex.has(code)?code:'en';
    const request=++languageRequest;
    language=target;
    try{await loadLanguage(target);}catch(error){console.warn('Locale chunk failed',error);}
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
    finally{resolveReady();}
  }

  window.LotoI18n={
    catalog,
    get language(){return language;},
    ready,
    setLanguage,
    translate,
    localizeTree,
    localeInfo:code=>catalog.locales[code],
    localeCodes:()=>[...localeCodes]
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void start();},{once:true});
  else void start();
})();
