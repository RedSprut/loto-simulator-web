(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
  const FREE_FEATURES=['simulator','ticket_check','recent_results','basic_frequency','basic_random'];
  const FREE_GENERATION_MODELS=new Set(['freq','bal','rnd','man']);
  const FREE_GENERATION_ROWS_PER_RUN=5;
  const FREE_GROUP_ANALYSIS_ROWS=Number(config.freeGroupAnalysisRows||3);
  const FEATURE_POLICY=Object.freeze({
    simulator:{free:'unlimited',dataset:'none'},ticket_check:{free:'unlimited',dataset:'free'},recent_results:{free:20,dataset:'free'},
    basic_frequency:{free:'unlimited',dataset:'free'},basic_random:{free:'unlimited',dataset:'free'},share:{free:'unlimited',dataset:'none'},
    saved_combinations:{free:3,trial:'unlimited',pro:'unlimited'},basic_generation:{free:FREE_GENERATION_ROWS_PER_RUN,dataset:'free'},
    full_history:{free:'preview',trial:'full',pro:'full',dataset:'pro'},advanced_models:{free:'preview',trial:'metered',pro:'unlimited',dataset:'pro'},
    wheel:{free:'preview',trial:'metered',pro:'unlimited',dataset:'pro'},world_analysis:{free:'preview',trial:'metered',pro:'unlimited',dataset:'pro'},
    judge:{free:'preview',trial:'metered',pro:'unlimited',dataset:'pro'},paradoxes:{free:'preview',trial:'metered',pro:'unlimited',dataset:'pro'},
    exports:{free:'none',trial:'metered',pro:'unlimited',dataset:'pro'},data_management:{free:'none',trial:'metered',pro:'unlimited',dataset:'pro'},
    cloud_sync:{free:'none',trial:'included',pro:'included'},
  });
  const ALL_FEATURES=Object.freeze([...new Set([...FREE_FEATURES,...Object.keys(FEATURE_POLICY)])]);
  const SUBSCRIPTION_PLANS=Object.freeze(config.subscriptionPlans||{
    m1:{months:1,label:'1 месяц',price:'$4.99',productId:'loto_pro_m1',packageId:'m1'},
    m3:{months:3,label:'3 месяца',price:'$12.99',productId:'loto_pro_m3',packageId:'m3'},
    m6:{months:6,label:'6 месяцев',price:'$22.99',productId:'loto_pro_m6',packageId:'m6'},
    m12:{months:12,label:'12 месяцев',price:'$34.99',productId:'loto_pro_m12',packageId:'m12'},
  });
  const DEVELOPER_ACCESS_KEY='loto_developer_access_test_v1';
  const EXPIRED_PROMPT_KEY='loto_last_expired_subscription_prompt_v1';
  const COMMERCIAL_NOT_CONFIGURED_MESSAGE='Платёжная система ещё не подключена. Сейчас доступна бесплатная версия приложения.';
  const DEVELOPER_HOSTS=new Set(['localhost','127.0.0.1']);
  const developerHost=()=>DEVELOPER_HOSTS.has(location.hostname);
  const developerMode=()=>Boolean(config.developerMode&&developerHost());
  const configuredValue=value=>typeof value==='string'&&value.trim().length>0;
  const webBillingConfigured=()=>configuredValue(config.revenueCatWebPurchaseUrl);
  const nativeBillingConfigured=()=>configuredValue(config.revenueCatIosApiKey)||configuredValue(config.revenueCatAndroidApiKey);
  // Coarse entitlement buckets whose actions are eligible for previews. action.feature
  // stays one of these (subscription features[] + paywall copy are keyed by bucket).
  // Import/export/data_management/full_history/saved_combinations/notifications excluded.
  const PREVIEW_FEATURES=new Set(['advanced_models','wheel','world_analysis','judge','paradoxes']);
  // The 14 canonical per-feature preview ids: each has its OWN lifetime budget of 3.
  // Must match access.ts PREVIEW_FEATURES and public.preview_feature_ids() in the DB.
  const PREVIEW_FEATURE_IDS=new Set(['markov','gauss','delta','bayes','overdue','phys','chaos','quantum','consensus','qastro','paradoxes','wheel','judge','world_analysis']);
  const PREVIEW_LIMIT=3;
  // Fine-grained preview budget an action spends. Mirrors previewFeature() on the server.
  function previewFeatureFor(feature,operation,model){
    if(operation==='wheel'||model==='wheel')return'wheel';
    if(operation==='judge'||feature==='judge')return'judge';
    if(model==='paradox'||feature==='paradoxes')return'paradoxes';
    if(model==='physics')return'phys';
    if(String(model||'').startsWith('world')||feature==='world_analysis')return'world_analysis';
    return PREVIEW_FEATURE_IDS.has(model)?model:null;
  }
  // Server-authoritative remaining previews for one feature. Reads preview.byFeature;
  // falls back to the deprecated aggregate only if byFeature is missing.
  function previewRemainingFor(featureId){
    return previewBudgetFor(featureId).remaining;
  }
  const cleanNumber=value=>{
    const n=Number(value);
    return Number.isFinite(n)&&n>=0?n:null;
  };
  function previewBudgetFor(featureId,preview=state.access?.preview){
    preview=preview||{};
    const entry=(featureId&&preview.byFeature&&preview.byFeature[featureId])||{};
    const limit=cleanNumber(entry.limit??entry.total??entry.max??preview.perFeatureLimit??preview.limit)??PREVIEW_LIMIT;
    const remaining=cleanNumber(entry.remaining??preview.remaining)??0;
    const used=cleanNumber(entry.used??preview.used)??Math.max(0,limit-remaining);
    const resetAt=entry.resetAt||entry.renewsAt||entry.renewalAt||preview.resetAt||preview.renewsAt||preview.renewalAt||null;
    const renewable=Boolean(entry.renewable??preview.renewable??resetAt);
    return{limit,remaining,used,resetAt,renewable,authoritative:preview.authoritative===true};
  }
  function previewNoChargeMessage(featureId){
    const b=previewBudgetFor(featureId);
    return b.authoritative||b.remaining>0
      ?`Операция не выполнена, попытка не списана. Осталось ${b.remaining} из ${b.limit} бесплатных попыток.`
      :'Операция не выполнена, попытка не списана. Попробуйте ещё раз, когда соединение восстановится.';
  }
  function previewStateLabel(b){
    b=b&&typeof b==='object'?b:previewBudgetFor('');
    if(b.remaining<=0){
      if(b.renewable&&b.resetAt){
        let when=String(b.resetAt);
        try{when=new Date(b.resetAt).toLocaleString(document.documentElement.lang||'ru',{dateStyle:'medium',timeStyle:'short'});}catch(_e){}
        return`Бесплатные попытки закончились. Следующее обновление: ${when}.`;
      }
      return'Бесплатные попытки закончились. Для дальнейшего анализа требуется PRO.';
    }
    if(b.remaining===1)return`Осталась 1 из ${b.limit} бесплатных попыток. Для следующего анализа может потребоваться PRO.`;
    if(b.remaining===2)return`Осталось 2 из ${b.limit} бесплатных попыток. Скоро может потребоваться PRO.`;
    return`Осталось ${b.remaining} из ${b.limit} бесплатных попыток.`;
  }
  const PENDING_PRO_ACTION_KEY='loto_pending_pro_action_v1';
  const PRO_ACCESS=Object.freeze({
    ACTIVE_PRO:'ACTIVE_PRO',FREE_USE_AVAILABLE:'FREE_USE_AVAILABLE',
    PURCHASE_REQUIRED:'PURCHASE_REQUIRED',COMMERCIAL_UNAVAILABLE:'COMMERCIAL_UNAVAILABLE',
    AUTH_REQUIRED:'AUTH_REQUIRED',ACCOUNT_REQUIRED:'ACCOUNT_REQUIRED',ERROR:'ERROR',
  });
  // The 3 free PRO previews belong to a PERMANENT account, never an anonymous identity
  // (clearing storage / new browser / new device would otherwise mint a fresh trial).
  // Authoritative source is the server (access-state.requiresAccount / DB is_anonymous);
  // the session's own is_anonymous is a correct client-side fallback before that arrives.
  const isAnonymousIdentity=()=>state.access?.requiresAccount===true
    ||Boolean(state.session?.user?.is_anonymous)
    ||Boolean(state.user?.is_anonymous)||Boolean(state.user?.isAnonymous);
  const confirmedPermanentAccount=()=>Boolean(state.user?.id&&state.user?.email)
    &&!isAnonymousIdentity()
    &&state.user?.emailConfirmed===true;
  const freeAccess=()=>({
    accessLevel:'free',
    features:[...FREE_FEATURES],
    freeLimits:{recentDrawsPerGame:Number(config.freeRecentDraws||20),savedCombinations:3,groupAnalysisRows:FREE_GROUP_ANALYSIS_ROWS,simulations:'unlimited',recurringProCredits:0},
    // Display-only default until the server snapshot arrives; the server is authoritative.
    preview:{limit:PREVIEW_LIMIT,perFeatureLimit:PREVIEW_LIMIT,used:0,remaining:0,byFeature:{},features:[...PREVIEW_FEATURE_IDS],available:false,authoritative:false},
    trial:null,
    subscription:null,
  });
  const state={
    ready:false,
    backendReady:Boolean(config.supabaseUrl&&config.supabasePublishableKey),
    session:null,
    user:null,
    access:freeAccess(),
    metadata:null,
    experiment:{name:'monetization_v1',variant:'A'},
    archiveCache:new Map(),lastGeneration:null,developerScenario:null,selectedPlan:'m12',pendingProAction:null,
    authMessage:'',authMessageKind:'info',authSending:false,authCooldownUntil:0,authJustConfirmed:false,
  };
  const pendingJudgeTargets=new Map();
  const SUBJECT_KEY='loto_anonymous_subject_v1';
  const NATIVE_AUTH_REDIRECT_KEY='loto_native_auth_redirect_v1';
  let onboardingStep=0,onboardingNode=null,actionDepth=0,developerPanel=null,accessExpiryTimer=null,authCooldownTimer=null;
  // Dynamic UI always emits one canonical source language. The single i18n
  // observer translates it; pre-translating here would make later language
  // switches treat Norwegian/English output as a new source string.
  const T=value=>String(value??'');
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const endpoint=name=>`${String(config.supabaseUrl||'').replace(/\/$/,'')}/functions/v1/${name}`;
  const safeJson=async response=>response.json().catch(()=>({}));
  // Real scroll lock: on iOS/WKWebView `overflow:hidden` alone does NOT stop the page
  // behind a fixed overlay from touch-scrolling. We pin <body> with position:fixed at the
  // current offset (so nothing behind the modal moves) and restore the exact scroll
  // position on close. The overlay owns pointer/touch; the modal sheet scrolls internally.
  let __scrollLockY=0,__scrollLockDepth=0;
  function lockScroll(){
    if(__scrollLockDepth++>0)return;
    __scrollLockY=window.scrollY||window.pageYOffset||0;
    document.body.style.top=`-${__scrollLockY}px`;
    document.body.classList.add('scroll-locked');
  }
  function unlockScroll(){
    if(__scrollLockDepth>0)__scrollLockDepth--;
    if(__scrollLockDepth>0)return;
    document.body.classList.remove('scroll-locked');
    document.body.style.top='';
    window.scrollTo(0,__scrollLockY);
  }
  // Only a purchased/active PAID subscription is "premium". There is no Trial level:
  // Free users get exactly three lifetime PRO previews (server-authoritative ledger).
  const premium=()=>state.access?.accessLevel==='pro';
  const developerPro=()=>developerMode()&&['pro','cancelled'].includes(state.developerScenario)&&state.access?.accessLevel==='pro';
  const commercialNotConfigured=()=>!state.backendReady||(
    window.LotoNativeBilling?.isNative?!nativeBillingConfigured():!webBillingConfigured()
  );

  function formatAccessDate(value){
    const date=new Date(value||'');
    if(Number.isNaN(date.getTime()))return'';
    try{return new Intl.DateTimeFormat(document.documentElement.lang||'ru',{day:'numeric',month:'long',year:'numeric'}).format(date);}
    catch(_error){return date.toISOString().slice(0,10);}
  }
  function addCalendarMonths(value,months){
    const source=new Date(value);
    const date=new Date(source.getTime());
    const day=date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth()+Number(months||0));
    const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(day,lastDay));
    return date;
  }
  function applyDeveloperPlan(mode,restored=null){
    if(!developerMode())return false;
    const requestedPlan=SUBSCRIPTION_PLANS[mode]?mode:(mode==='pro'?(restored?.planId||state.selectedPlan):'');
    const selected=requestedPlan?'pro':mode==='cancelled'?'cancelled':mode==='expired'?'expired':'free';
    state.developerScenario=selected;
    state.archiveCache.clear();
    if(selected==='pro'||selected==='cancelled'){
      const now=Date.now();
      const planId=requestedPlan||restored?.planId||state.selectedPlan;
      const plan=SUBSCRIPTION_PLANS[planId]||SUBSCRIPTION_PLANS.m1;
      state.selectedPlan=planId;
      const restoredExpiry=Date.parse(restored?.expiresAt||'');
      const startedAt=restored?.startedAt||new Date(now).toISOString();
      const expiresAt=Number.isFinite(restoredExpiry)&&restoredExpiry>now
        ?new Date(restoredExpiry).toISOString()
        :addCalendarMonths(now,plan.months).toISOString();
      state.access={
        accessLevel:'pro',
        features:[...ALL_FEATURES],
        freeLimits:freeAccess().freeLimits,
        trial:null,
        subscription:{
          source:'developer-local',
          productId:plan.productId,
          startedAt,
          expiresAt,
          graceUntil:null,
          willRenew:selected!=='cancelled',
          billingIssue:false,
          environment:'local-test',
          planId,
        },
        serverTime:new Date(now).toISOString(),
      };
    }else if(selected==='expired'){
      const planId=restored?.planId||state.selectedPlan;
      const plan=SUBSCRIPTION_PLANS[planId]||SUBSCRIPTION_PLANS.m1;
      const restoredExpiry=Date.parse(restored?.expiresAt||'');
      state.access={
        ...freeAccess(),
        subscription:{
          source:'developer-local',
          productId:plan.productId,
          startedAt:restored?.startedAt||addCalendarMonths(Date.now(),-Number(plan.months||1)).toISOString(),
          expiresAt:Number.isFinite(restoredExpiry)?new Date(restoredExpiry).toISOString():new Date(Date.now()-1000).toISOString(),
          graceUntil:null,
          willRenew:false,
          billingIssue:false,
          environment:'local-test',
          planId,
        },
        serverTime:new Date().toISOString(),
      };
    }else state.access=freeAccess();
    try{
      localStorage.setItem(DEVELOPER_ACCESS_KEY,JSON.stringify({
        mode:selected,planId:state.selectedPlan,
        startedAt:state.access.subscription?.startedAt||null,
        expiresAt:state.access.subscription?.expiresAt||null,
        willRenew:state.access.subscription?.willRenew??false,
      }));
    }catch(_error){}
    if(state.ready){closePaywall();emit();}
    return true;
  }
  function restoreDeveloperPlan(){
    if(!developerMode())return;
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(DEVELOPER_ACCESS_KEY)||'null');}catch(_error){}
    if(['pro','cancelled'].includes(saved?.mode)&&Date.parse(saved.expiresAt||'')>Date.now())applyDeveloperPlan(saved.mode,saved);
    else if(saved?.mode==='expired'||Date.parse(saved?.expiresAt||'')<=Date.now()&&saved?.expiresAt)applyDeveloperPlan('expired',saved);
    else applyDeveloperPlan('free');
  }
  function renewDeveloperPlan(){
    if(!developerMode())return false;
    const plan=SUBSCRIPTION_PLANS[state.selectedPlan]||SUBSCRIPTION_PLANS.m1;
    const currentExpiry=Date.parse(state.access?.subscription?.expiresAt||'');
    const renewalBase=Number.isFinite(currentExpiry)&&currentExpiry>Date.now()?currentExpiry:Date.now();
    return applyDeveloperPlan(state.selectedPlan,{
      planId:state.selectedPlan,
      startedAt:state.access?.subscription?.startedAt||new Date().toISOString(),
      expiresAt:addCalendarMonths(renewalBase,plan.months).toISOString(),
      willRenew:true,
    });
  }
  function cancelDeveloperPlan(){
    const subscription=state.access?.subscription||{};
    return applyDeveloperPlan('cancelled',{
      planId:subscription.planId||state.selectedPlan,
      startedAt:subscription.startedAt,
      expiresAt:subscription.expiresAt,
      willRenew:false,
    });
  }
  function expireDeveloperPlan(){
    const subscription=state.access?.subscription||{};
    const applied=applyDeveloperPlan('expired',{planId:subscription.planId||state.selectedPlan});
    if(applied)showExpiredPaywall(true);
    return applied;
  }
  function updateDeveloperPanel(){
    if(!developerPanel)return;
    const isPro=developerPro();
    developerPanel.dataset.accessLevel=state.access?.accessLevel||'free';
    developerPanel.dataset.activePlan=state.selectedPlan||'';
    developerPanel.dataset.productId=state.access?.subscription?.productId||'';
    developerPanel.dataset.expiresAt=state.access?.subscription?.expiresAt||'';
    developerPanel.dataset.willRenew=String(Boolean(state.access?.subscription?.willRenew));
    for(const button of developerPanel.querySelectorAll('[data-plan]')){
      const active=isPro&&button.dataset.plan===state.selectedPlan;
      button.classList.toggle('on',active);
      button.setAttribute('aria-pressed',String(active));
    }
    for(const button of developerPanel.querySelectorAll('[data-scenario]')){
      const active=button.dataset.scenario===state.developerScenario;
      button.classList.toggle('on',active);
      button.setAttribute('aria-pressed',String(active));
    }
    const status=developerPanel.querySelector('[data-developer-status]');
    if(status)status.textContent=isPro
      ?`PRO ${SUBSCRIPTION_PLANS[state.selectedPlan]?.label||''} · до ${formatAccessDate(state.access.subscription?.expiresAt)}${state.access.subscription?.willRenew?' · автопродление':' · отменена, доступ до даты'}`
      :state.developerScenario==='expired'
        ?'Срок подписки истёк · доступ закрыт · показывается продление'
        :'FREE активен · PRO-функции должны открывать окно подписки';
  }

  function subjectId(){
    try{
      let value=localStorage.getItem(SUBJECT_KEY);
      if(!/^[0-9a-f-]{36}$/i.test(value||'')){value=uuid();localStorage.setItem(SUBJECT_KEY,value);}
      return value;
    }catch(_error){return uuid();}
  }

  async function readRedirectSession(){
    let pending='';
    try{pending=sessionStorage.getItem(NATIVE_AUTH_REDIRECT_KEY)||'';sessionStorage.removeItem(NATIVE_AUTH_REDIRECT_KEY);}catch(_error){}
    if(pending){
      const session=await window.LotoAuth?.acceptRedirect?.(pending);
      if(session){
        state.authJustConfirmed=true;
        state.authMessage='Аккаунт подтверждён. Вход выполнен.';
        state.authMessageKind='success';
      }
      return session||null;
    }
    let hasCode=false;
    try{hasCode=new URL(location.href).searchParams.has('code');}catch(_error){}
    const session=await window.LotoAuth?.initialize?.();
    if(hasCode&&session){
      state.authJustConfirmed=true;
      state.authMessage='Аккаунт подтверждён. Вход выполнен.';
      state.authMessageKind='success';
    }
    return session||null;
  }
  async function acceptAuthRedirect(url){
    if(!window.LotoAuth?.ready){
      try{sessionStorage.setItem(NATIVE_AUTH_REDIRECT_KEY,url);}catch(_error){}
      return false;
    }
    const session=await window.LotoAuth.acceptRedirect(url);
    state.session=session||null;
    if(state.ready)await refreshAccess();
    if(session){
      state.authJustConfirmed=true;
      setAuthMessage('Аккаунт подтверждён. Вход выполнен.','success');
      if(state.ready)openPaywall('trial_sign_in');
    }
    return Boolean(session);
  }
  async function refreshSession(){
    if(!window.LotoAuth?.ready)return false;
    try{
      state.session=await window.LotoAuth.getSession();
      return Boolean(state.session?.access_token);
    }catch(_error){
      state.session=null;
      return false;
    }
  }
  // Guarantee an identity for preview accounting. Prefer any real/anonymous session
  // that already exists; otherwise create an anonymous one so Free users are NOT
  // forced to register just to spend a preview. The server stays authoritative.
  async function ensureSession(){
    if(state.session?.access_token)return true;
    if(!window.LotoAuth?.ready)return false;
    try{
      state.session=await window.LotoAuth.ensureAnonymous();
      return Boolean(state.session?.access_token);
    }catch(_error){
      state.session=null;
      return false;
    }
  }
  async function api(name,{method='GET',body,query,requestId,timeoutMs=45_000}={}){
    if(!state.backendReady)throw new Error('backend_not_configured');
    await refreshSession();
    const url=new URL(endpoint(name));
    for(const [key,value] of Object.entries(query||{}))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    const headers={apikey:config.supabasePublishableKey};
    if(state.session?.access_token)headers.Authorization=`Bearer ${state.session.access_token}`;
    if(body!==undefined)headers['content-type']='application/json';
    if(requestId)headers['x-idempotency-key']=requestId;
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    let response;
    try{response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller?.signal});}
    catch(error){if(error?.name==='AbortError')throw new Error('request_timeout');throw error;}
    finally{if(timer)clearTimeout(timer);}
    const data=await safeJson(response);
    if(response.status===401){state.session=null;state.user=null;}
    if(!response.ok){const error=new Error(data.error||`HTTP ${response.status}`);error.status=response.status;error.payload=data;throw error;}
    return data;
  }
  async function track(eventName,properties={}){
    if(!state.backendReady)return;
    try{
      const result=await api('experiment',{method:'POST',body:{subjectId:subjectId(),eventName,properties}});
      if(result.variant)state.experiment={name:result.experiment,variant:result.variant};
    }catch(_error){}
  }
  function emit(){
    updateUi();
    scheduleAccessExpiry();
    window.dispatchEvent(new CustomEvent('loto:accesschange',{detail:{access:state.access,user:state.user}}));
  }
  function scheduleAccessExpiry(){
    if(accessExpiryTimer){clearTimeout(accessExpiryTimer);accessExpiryTimer=null;}
    const expiresAt=Date.parse(state.access?.subscription?.expiresAt||'');
    if(!premium()||!Number.isFinite(expiresAt))return;
    const remaining=expiresAt-Date.now();
    const wait=Math.max(250,Math.min(remaining+250,6*60*60*1000));
    accessExpiryTimer=setTimeout(async()=>{
      const currentExpiry=Date.parse(state.access?.subscription?.expiresAt||'');
      if(premium()&&Number.isFinite(currentExpiry)&&currentExpiry>Date.now()){scheduleAccessExpiry();return;}
      state.archiveCache.clear();
      if(developerMode()){
        const previous=state.access?.subscription||{};
        applyDeveloperPlan('expired',{planId:previous.planId||state.selectedPlan});
        return;
      }
      // Subscription expired: refresh entitlement + UI ONLY. This timer is scheduled by
      // emit() on startup, so for anyone whose access-state was already expired at load it
      // fired ~250ms after the preloader and popped the paywall with no user action — the
      // real auto-open bug (verified via console.trace: openPaywall ← showExpiredPaywall ←
      // this timer). A startup/backend callback must NEVER open the commercial modal; it
      // opens only on an explicit user action (openSubInfo / PRO buttons).
      await refreshAccess();
    },wait);
  }
  function showExpiredPaywall(force=false){
    const subscription=state.access?.subscription;
    const expiresAt=Date.parse(subscription?.expiresAt||'');
    if(!subscription?.productId||!Number.isFinite(expiresAt)||expiresAt>Date.now())return false;
    const signature=`${subscription.productId}:${subscription.expiresAt}`;
    if(!force){
      try{if(localStorage.getItem(EXPIRED_PROMPT_KEY)===signature)return false;}catch(_error){}
    }
    try{localStorage.setItem(EXPIRED_PROMPT_KEY,signature);}catch(_error){}
    openPaywall('subscription_expired');
    return true;
  }
  async function refreshAccess(){
    if(developerMode()&&state.developerScenario){emit();return state.access;}
    if(!state.backendReady||!state.session){emit();return state.access;}
    try{
      const result=await api('access-state');
      state.access=result.access||state.access;state.user=result.user||state.user;emit();
    }catch(_error){state.access=freeAccess();emit();}
    return state.access;
  }
  async function sendMagicLink(email){
    const value=String(email||'').trim();
    if(!state.backendReady)throw new Error('backend_not_configured');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('invalid_email');
    if(!window.LotoAuth?.ready)throw new Error('backend_not_configured');
    const redirectTo=window.LotoNativeBilling?.isNative
      ?config.nativeAuthRedirectUrl
      :config.webAuthRedirectUrl||`${location.origin}${location.pathname}`;
    await window.LotoAuth.sendMagicLink(value,redirectTo);
    return true;
  }
  async function signOut(){
    try{await window.LotoAuth?.signOut?.();}catch(_error){}
    state.session=null;state.user=null;state.archiveCache.clear();state.access=freeAccess();emit();
  }
  async function consume(feature){
    const result=await api('consume-feature',{method:'POST',body:{feature,requestId:`${feature}:${uuid()}`,units:1}});
    if(result.snapshot){state.access=result.snapshot;emit();}
    return result.allowed===true;
  }
  async function requireFeature(feature,{consumeAction=true}={}){
    if(FREE_FEATURES.includes(feature))return true;
    if(premium()&&state.access?.features?.includes(feature)){
      if(developerPro())return true;
      if(!consumeAction)return true;
      try{return await consume(feature);}catch(error){
        if(error.payload?.access)state.access=error.payload.access;
        emit();openPaywall(error.message||feature);return false;
      }
    }
    // Backend-computed preview actions go through runProAction(), which preserves
    // their complete payload and lets the confirmation button execute that action.
    if(PREVIEW_FEATURES.has(feature))return false;
    openPaywall(feature);return false;
  }
  async function resolveProAccess(action,{refresh=true}={}){
    try{
      if(!action||!PREVIEW_FEATURES.has(action.feature))return PRO_ACCESS.ERROR;
      // Canonical priority (only three access levels exist):
      //   1) paid PRO  ->  2) one of three lifetime free PRO previews  ->  3) purchase.
      // There is no Trial tier.
      if(premium()&&state.access?.features?.includes(action.feature))return PRO_ACCESS.ACTIVE_PRO;
      if(!state.backendReady)return PRO_ACCESS.COMMERCIAL_UNAVAILABLE;
      // Ensure an identity (anonymous if needed) rather than forcing registration.
      if(!state.session)await ensureSession();
      if(!state.session)return PRO_ACCESS.AUTH_REQUIRED;
      if(refresh)await refreshAccess();
      if(premium()&&state.access?.features?.includes(action.feature))return PRO_ACCESS.ACTIVE_PRO;
      // Account-required trial: an anonymous identity gets FREE features but must create/
      // sign in to a permanent account before spending a PRO preview. (Server enforces
      // the same via signup_required; this avoids even offering the preview here.)
      if(isAnonymousIdentity())return PRO_ACCESS.ACCOUNT_REQUIRED;
      const preview=state.access?.preview;
      if(preview?.authoritative!==true&&preview?.available!==true)return PRO_ACCESS.ERROR;
      // Per-feature budget: only THIS feature's remaining matters; other features stay usable.
      if(previewRemainingFor(action.previewFeature)>0&&preview.available===true)return PRO_ACCESS.FREE_USE_AVAILABLE;
      return PRO_ACCESS.PURCHASE_REQUIRED;
    }catch(_error){return PRO_ACCESS.ERROR;}
  }
  function serializableAction(action){
    const feature=String(action.feature||'');
    const operation=String(action.operation||'');
    const model=action.model==null?null:String(action.model);
    return{
      actionId:String(action.actionId||uuid()),actionType:String(action.actionType||action.operation||''),
      feature,operation,gameId:String(action.gameId||''),
      // Fine-grained lifetime budget this action spends (one of the 14). Recomputed on
      // deserialize so a persisted pending action always targets the right counter.
      previewFeature:previewFeatureFor(feature,operation,model)||'',
      model,input:action.input||null,options:action.options||{},
      payload:action.payload||{},locale:String(action.locale||document.documentElement.lang||'ru'),
      origin:String(action.origin||location.hash||location.pathname),resultTarget:action.resultTarget||null,
      idempotencyKey:String(action.idempotencyKey||`pro:${uuid()}`),createdAt:action.createdAt||new Date().toISOString(),
    };
  }
  function persistPendingAction(action){
    state.pendingProAction=action;
    try{sessionStorage.setItem(PENDING_PRO_ACTION_KEY,JSON.stringify(serializableAction(action)));}catch(_error){}
  }
  function clearPendingAction(action){
    if(action&&state.pendingProAction?.idempotencyKey!==action.idempotencyKey)return;
    state.pendingProAction=null;
    try{sessionStorage.removeItem(PENDING_PRO_ACTION_KEY);}catch(_error){}
  }
  function readPendingAction(){
    try{
      const value=JSON.parse(sessionStorage.getItem(PENDING_PRO_ACTION_KEY)||'null');
      if(!value||!PREVIEW_FEATURES.has(value.feature)||!/^[a-zA-Z0-9:_-]{16,160}$/.test(value.idempotencyKey||''))return null;
      return serializableAction(value);
    }catch(_error){return null;}
  }
  async function executeProAction(action){
    if(action.actionType==='analysis'){
      return api('pro-analysis',{query:{game:action.gameId,feature:action.feature},requestId:action.idempotencyKey});
    }
    return api('pro-compute',{method:'POST',body:{operation:action.operation,...action.payload},requestId:action.idempotencyKey});
  }
  function applyProActionResult(action,response){
    const target=action.resultTarget||{};
    // Model generators present their rows in the Result modal (Use rows / Judge),
    // instead of dropping them straight onto the main screen. Falls back to a direct
    // apply if the app hasn't defined the modal presenter.
    if(target.kind==='backend_rows'){
      const model=target.model||action.model;
      if(typeof window.showModelResult==='function')window.showModelResult(response.result,model);
      else window.applyBackendRows?.(response.result,model);
    }
    else if(target.kind==='judge'){
      const handlers=pendingJudgeTargets.get(action.idempotencyKey)||null;
      // Real data provenance: the drawn-history count shown in the verdict must be the
      // backend's actual dataset size (meta.historyCount), never a 0 fallback.
      const historyCount=Number(response.meta?.historyCount??response.meta?.datasetDraws);
      if(Number.isFinite(historyCount))target.drawsN=historyCount;
      window.renderBackendJudge?.(response.result,target.mountId||'jc-mount',target,handlers);
      pendingJudgeTargets.delete(action.idempotencyKey);
    }
    else if(target.kind==='world_analysis')window.renderBackendWorldAnalysis?.(response.analysis,target.targetId||'world-analysis-out');
  }
  async function completeProAction(action){
    const response=await executeProAction(action);
    if(response.access)state.access=response.access;
    emit();notePreview(response.preview,action);
    applyProActionResult(action,response);
    clearPendingAction(action);
    return response;
  }
  async function runProAction(rawAction){
    const action=serializableAction(rawAction);persistPendingAction(action);
    if(typeof navigator!=='undefined'&&navigator.onLine===false){
      window.showFeedback?.(T('Нет подключения к интернету'),T('Для использования бесплатной PRO-попытки требуется подключение к интернету.'),'📡',4600);
      return null;
    }
    const access=await resolveProAccess(action);
    if(access===PRO_ACCESS.ACTIVE_PRO){
      try{return await completeProAction(action);}catch(error){return handleBackendError(error,action.feature,{previewFeature:action.previewFeature});}
    }
    if(access===PRO_ACCESS.AUTH_REQUIRED){
      window.showFeedback?.(T('Требуется вход'),T('Войдите в аккаунт, чтобы бесплатные PRO-попытки сохранялись на всех устройствах.'),'👤',5200);
      return null;
    }
    if(access===PRO_ACCESS.ACCOUNT_REQUIRED){
      // Anonymous user: don't run the PRO op — open the existing sign-in/create-account
      // flow so the 3 free previews attach to a permanent account (one global counter).
      track('pro_preview_account_required',{feature:action.feature});
      openPaywall('preview_sign_in');
      return null;
    }
    if(access===PRO_ACCESS.COMMERCIAL_UNAVAILABLE){
      window.showFeedback?.(T('Сервис временно недоступен'),T(previewNoChargeMessage(action.previewFeature)),'⚠️',5200);
      return null;
    }
    if(access===PRO_ACCESS.ERROR){
      window.showFeedback?.(T('Не удалось проверить доступ'),T(previewNoChargeMessage(action.previewFeature)),'⚠️',5200);
      return null;
    }
    const budget=previewBudgetFor(action.previewFeature);
    if(access===PRO_ACCESS.PURCHASE_REQUIRED){track('pro_preview_exhausted',{feature:action.feature,previewFeature:action.previewFeature});return showPreviewOffer(action,{...budget,remaining:0});}
    track('pro_preview_offer_shown',{feature:action.feature,remaining:budget.remaining,limit:budget.limit});
    return showPreviewOffer(action,budget);
  }
  function showPreviewOffer(action,budget){
    return new Promise(resolve=>{
      const overlay=document.getElementById('prev-ov');
      if(!overlay){resolve(null);return;}
      const stateEl=overlay.querySelector('[data-prev-state]');
      const useButton=overlay.querySelector('[data-prev-use]');
      const buyButton=overlay.querySelector('[data-prev-buy]');
      const closeButton=overlay.querySelector('[data-prev-close]');
      budget=budget&&typeof budget==='object'?budget:previewBudgetFor(action.previewFeature);
      const exhausted=budget.remaining<=0;
      if(stateEl)stateEl.textContent=T(previewStateLabel(budget));
      if(useButton){useButton.hidden=exhausted;useButton.disabled=false;useButton.removeAttribute('aria-busy');useButton.textContent=T('Использовать бесплатную попытку');}
      if(buyButton)buyButton.textContent=T(commercialNotConfigured()?'Покупка PRO пока недоступна':'Оформить PRO');
      let done=false;
      let executing=false;
      const finish=value=>{if(done)return;done=true;overlay.classList.remove('show');document.body.classList.remove('pro-open');unlockScroll();resolve(value);};
      if(useButton)useButton.onclick=async()=>{
        if(executing)return;executing=true;useButton.disabled=true;useButton.setAttribute('aria-busy','true');
        useButton.textContent=T('Выполняем PRO-операцию…');if(stateEl)stateEl.textContent=T('Получаем полный результат…');
        track('pro_preview_started',{feature:action.feature,remaining:budget.remaining,limit:budget.limit});
        try{const response=await completeProAction(action);finish(response);}
        catch(error){
          executing=false;useButton.disabled=false;useButton.removeAttribute('aria-busy');useButton.textContent=T('Повторить бесплатную попытку');
          if(error?.payload?.access){state.access=error.payload.access;emit();}
          if(error?.message==='preview_exhausted'){
            useButton.hidden=true;if(stateEl)stateEl.textContent=T(previewStateLabel({...previewBudgetFor(action.previewFeature),remaining:0}));
          }else{
            if(stateEl)stateEl.textContent=T(previewNoChargeMessage(action.previewFeature));
            handleBackendError(error,action.feature,{openPurchase:false,previewFeature:action.previewFeature});
          }
        }
      };
      if(buyButton)buyButton.onclick=()=>{track('pro_preview_paywall_opened',{feature:action.feature});finish(null);openPaywall(action.feature);};
      if(closeButton)closeButton.onclick=()=>{if(!executing)finish(null);};
      overlay.onclick=event=>{if(event.target===overlay&&!executing)finish(null);};
      overlay.classList.add('show');document.body.classList.add('pro-open');lockScroll();
      overlay.querySelector('.pro-sheet')?.scrollTo(0,0);
    });
  }
  function notePreview(preview,action=null){
    if(!preview||preview.charged!==true)return;
    const b=previewBudgetFor(action?.previewFeature,preview);
    const message=b.remaining>0
      ?`Результат готов. Осталось ${b.remaining} из ${b.limit} бесплатных попыток.`
      :`Результат готов. ${previewStateLabel({...b,remaining:0})}`;
    track(b.remaining>0?'pro_preview_succeeded':'pro_preview_exhausted',{remaining:b.remaining,limit:b.limit,used:b.used});
    window.showFeedback?.(T('Результат готов'),T(message),'✨',4600);
  }
  async function fetchArchive(gameKey){
    if(!premium())return restrictedArchive(gameKey);
    if(developerPro())return fetchDeveloperArchive(gameKey);
    const backendGame=typeof window.resolveConfigKey==='function'?(window.resolveConfigKey(gameKey)||gameKey):gameKey;
    if(state.archiveCache.has(backendGame))return state.archiveCache.get(backendGame);
    const promise=(async()=>{
      let before='',draws=[],rules=[],total=0;
      const requestId=uuid();
      for(let page=0;page<60;page++){
        const result=await api('archive',{query:{game:backendGame,before,limit:100},requestId});
        draws.push(...(result.draws||[]));rules=result.ruleVersions||rules;total=result.total||total;
        if(result.access)state.access=result.access;
        if(!result.nextCursor)break;before=result.nextCursor;
      }
      emit();return{draws,eras:rules,updatedAt:state.metadata?.updatedAt||'',total,restricted:false};
    })().catch(error=>{state.archiveCache.delete(backendGame);if(error.status===402)openPaywall('full_history');throw error;});
    state.archiveCache.set(backendGame,promise);return promise;
  }
  async function fetchDeveloperArchive(gameKey){
    const backendGame=typeof window.resolveConfigKey==='function'?(window.resolveConfigKey(gameKey)||gameKey):gameKey;
    const cacheKey=`developer:${backendGame}`;
    if(state.archiveCache.has(cacheKey))return state.archiveCache.get(cacheKey);
    const promise=fetch('./results-archive.json',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error(`developer_archive_http_${response.status}`);
      const archive=await response.json();
      const draws=Array.isArray(archive.games?.[backendGame])?archive.games[backendGame]:[];
      const eras=Array.isArray(archive.ruleVersions?.[backendGame])?archive.ruleVersions[backendGame]:[];
      return{draws,eras,updatedAt:archive.updatedAt||'',total:draws.length,restricted:false,developer:true};
    }).catch(error=>{state.archiveCache.delete(cacheKey);throw error;});
    state.archiveCache.set(cacheKey,promise);
    return promise;
  }
  function metadataFor(gameKey){
    const id=typeof window.resolveConfigKey==='function'?(window.resolveConfigKey(gameKey)||gameKey):gameKey;
    return state.metadata?.games?.[id]||{availableDraws:0,freeDraws:Number(config.freeRecentDraws||20)};
  }
  function restrictedArchive(gameKey){
    const info=metadataFor(gameKey);
    return{draws:[],eras:[],updatedAt:state.metadata?.updatedAt||'',total:info.availableDraws||0,restricted:true};
  }
  async function analysis(gameKey){
    const id=typeof window.resolveConfigKey==='function'?(window.resolveConfigKey(gameKey)||gameKey):gameKey;
    if(premium()){
      if(!await requireFeature('advanced_models',{consumeAction:false}))return null;
      return(await api('pro-analysis',{query:{game:id},requestId:uuid()})).analysis;
    }
    if(state.backendReady)return(await api('free-analysis',{query:{game:id}})).analysis;
    return null;
  }
  async function compute(operation,payload={}){
    if(developerPro())throw new Error('developer_local_compute');
    const result=await api('pro-compute',{
      method:'POST',
      body:{operation,...payload},
      requestId:`${operation}:${uuid()}`,
    });
    if(result.access)state.access=result.access;
    emit();
    notePreview(result.preview);
    return result;
  }
  function showStatus(message){const element=document.getElementById('pro-pay-status');if(element)element.textContent=T(message||'');}
  function authCooldownRemaining(){
    return Math.max(0,state.authCooldownUntil-Date.now());
  }
  function setAuthMessage(message,kind='info'){
    state.authMessage=message||'';
    state.authMessageKind=kind;
    renderAuthUi();
  }
  function startAuthCooldown(seconds=60){
    state.authCooldownUntil=Date.now()+seconds*1000;
    if(authCooldownTimer)clearTimeout(authCooldownTimer);
    authCooldownTimer=setTimeout(()=>{state.authCooldownUntil=0;renderAuthUi();},seconds*1000);
    renderAuthUi();
  }
  function authRateLimited(error){
    const text=String(error?.message||error?.code||'').toLowerCase();
    return error?.status===429
      ||text.includes('rate')
      ||text.includes('security purposes')
      ||text.includes('too many')
      ||text.includes('over_email_send_rate_limit');
  }
  function renderAuthUi(){
    const message=document.getElementById('pro-auth-message');
    if(message){
      message.textContent=T(state.authMessage||'');
      message.dataset.kind=state.authMessageKind||'info';
      message.hidden=!state.authMessage;
    }
    const button=document.getElementById('pro-auth-submit');
    if(button){
      const cooling=authCooldownRemaining()>0;
      button.disabled=state.authSending||cooling;
      button.hidden=cooling&&!state.authSending;
      button.textContent=T(state.authSending?'Отправляем ссылку…':state.authMessageKind==='success'?'Отправить ссылку ещё раз':'Войти или создать аккаунт');
    }
  }
  function openPaywall(feature=''){
    const overlay=document.getElementById('pro-ov');if(!overlay)return;
    const context=document.getElementById('pro-context');
    if(context){
      const labels={
        full_history:'Полная история доступна в PRO. Бесплатные расчёты используют только 20 последних тиражей.',
        advanced_models:'Эта модель использует расширенную историческую базу и доступна в PRO.',
        basic_generation:'В бесплатной версии — до 5 рядов за один расчёт. Оформите PRO, чтобы создавать больше рядов сразу.',
        world_analysis:'Мировой анализ и полная статистическая база доступны в PRO.',
        judge:'Верховный судья доступен в PRO.',
        paradoxes:'Система парадоксов доступна в PRO.',
        wheel:'Колёсная матрица и Generate Wheel доступны в PRO.',
        exports:'Экспорт полной базы доступен в PRO.',
        data_management:'Ручное добавление и импорт данных доступны в PRO. Free всегда считает только по официальному Dataset Free.',
        saved_combinations:'В Free можно сохранить две комбинации. PRO снимает этот лимит.',
        trial_sign_in:'Войдите по ссылке из e-mail, чтобы PRO был привязан к вашему аккаунту и работал на всех устройствах.',
        preview_sign_in:'Бесплатные PRO-попытки доступны после входа. Создайте аккаунт или войдите по ссылке из e-mail, чтобы сохранить их на всех ваших устройствах.',
        preview_exhausted:'Вы использовали все бесплатные ознакомительные PRO-попытки. Оформите PRO, чтобы продолжить.',
        subscription_expired:'Срок оплаченной подписки закончился. Продлите PRO, чтобы снова открыть полную базу и профессиональные функции.',
      };
      context.textContent=T(labels[feature]||'Откройте PRO, чтобы использовать полную лабораторию.');
    }
    renderPreview(feature);
    showStatus('');
    overlay.classList.add('show');document.body.classList.add('pro-open');lockScroll();overlay.querySelector('.pro-sheet')?.scrollTo(0,0);track('paywall_view',{feature,variant:state.experiment.variant});updateUi();
  }
  function closePaywall(){document.getElementById('pro-ov')?.classList.remove('show');document.body.classList.remove('pro-open');unlockScroll();}
  function updateUi(){
    const level=state.access?.accessLevel||'free';
    const badge=document.getElementById('sub-badge');if(badge)badge.textContent=level==='pro'?'PRO':'FREE';
    const access=document.getElementById('pro-access-status');
    if(access){
      let label=T(level==='pro'?'PRO активен':'Постоянный Free');
      if(level==='pro'&&state.access.subscription?.expiresAt)label+=` · ${T('до')} ${formatAccessDate(state.access.subscription.expiresAt)}`;
      access.textContent=label;access.dataset.level=level;
    }
    const account=document.getElementById('pro-account-state');
    if(account)account.textContent=confirmedPermanentAccount()
      ?state.user.email
      :T('Для Trial и PRO войдите или создайте аккаунт по e-mail.');
    const unavailable=commercialNotConfigured();
    // Тарифы, форма и действия остаются видимыми всегда: при неподключённой оплате они
    // переходят в состояние disabled, а единственное объяснение показывает pro-commercial-notice.
    // Single intro model = 3 lifetime previews. The legacy 7-day trial button stays hidden.
    document.getElementById('pro-trial-btn')?.setAttribute('hidden','');
    document.getElementById('pro-signout-btn')?.toggleAttribute('hidden',!confirmedPermanentAccount());
    const form=document.getElementById('pro-auth-form');if(form)form.hidden=confirmedPermanentAccount();
    renderAuthUi();
    const nativeBilling=window.LotoNativeBilling;
    const paymentReady=nativeBilling?.isNative?nativeBilling.ready:Boolean(config.revenueCatWebPurchaseUrl);
    const purchase=document.getElementById('pro-purchase-btn');if(purchase)purchase.disabled=unavailable||!confirmedPermanentAccount()||!paymentReady;
    const restore=document.getElementById('pro-restore-btn');if(restore)restore.disabled=unavailable||!confirmedPermanentAccount();
    const portal=document.getElementById('pro-account-portal-btn');if(portal)portal.disabled=unavailable;
    document.getElementById('pro-commercial-notice')?.toggleAttribute('hidden',!unavailable);
    decorateHistory();updatePlanUi();updateDeveloperPanel();
  }
  function decorateHistory(){
    const host=document.getElementById('hist-pro-card');if(!host)return;
    if(premium()){host.hidden=true;return;}
    const game=typeof cur!=='undefined'?cur:'euro',info=metadataFor(game);
    const hidden=Math.max(0,(info.availableDraws||0)-(info.freeDraws||Number(config.freeRecentDraws||20)));
    host.hidden=false;
    const title=host.querySelector('[data-pro-history-title]');
    if(title)title.textContent=T(hidden?`Доступно ещё ${hidden} тиражей`:'Полная история доступна в PRO');
  }
  function renderPreview(feature){
    const box=document.getElementById('pro-preview');if(!box)return;
    const game=typeof cur!=='undefined'?cur:'euro',info=metadataFor(game);
    const full=info.availableDraws||0,free=info.freeDraws||Number(config.freeRecentDraws||20);
    const label=typeof lotteryName==='function'?lotteryName(game):game;
    const names={
      full_history:'архив и эпохи правил',advanced_models:'профессиональная модель',wheel:'колёсная матрица',world_analysis:'мировой анализ',judge:'Верховный судья',paradoxes:'система парадоксов',exports:'экспорт полной базы',data_management:'управление собственной базой',saved_combinations:'неограниченное сохранение',
    };
    box.innerHTML=`<b>${T('Демонстрационный пример PRO — не расчёт по вашим данным')}</b><span>${T(`${label}: Free анализирует ${free} последних тиражей, PRO получает ${full} доступных тиражей.`)}</span><span>${T(`Возможность: ${names[feature]||'полная лаборатория'}. Полный результат появляется только после серверной проверки PRO.`)}</span>`;
  }
  async function submitEmail(){
    const input=document.getElementById('pro-email');
    if(state.authSending)return;
    if(authCooldownRemaining()>0){
      setAuthMessage('Ссылка уже отправлена. Проверьте почту или повторите через 60 секунд','error');
      return;
    }
    state.authSending=true;renderAuthUi();
    try{
      await sendMagicLink(input?.value);
      setAuthMessage('Ссылка для входа отправлена. Откройте свою электронную почту и перейдите по ссылке на этом же устройстве и в этом же браузере.','success');
      startAuthCooldown(60);
    }catch(error){
      if(authRateLimited(error)){
        setAuthMessage('Ссылка уже отправлена. Проверьте почту или повторите через 60 секунд','error');
        startAuthCooldown(60);
      }else{
        setAuthMessage(error.message==='invalid_email'?'Укажите действующий e-mail.':error.message==='backend_not_configured'?COMMERCIAL_NOT_CONFIGURED_MESSAGE:'Не удалось отправить ссылку. Попробуйте позже.','error');
      }
    }finally{
      state.authSending=false;renderAuthUi();
    }
  }
  function selectPlan(planId){
    if(!SUBSCRIPTION_PLANS[planId])return false;
    state.selectedPlan=planId;
    updatePlanUi();
    track('plan_select',{planId,productId:SUBSCRIPTION_PLANS[planId].productId});
    return true;
  }
  function parsePrice(value){
    const number=parseFloat(String(value||'').replace(/[^\d.,]/g,'').replace(',','.'));
    return Number.isFinite(number)?number:0;
  }
  function formatPerMonth(value,currency){
    try{
      const money=new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:currency||'USD',maximumFractionDigits:2}).format(value);
      return `${money} / ${T('мес')}`;
    }catch(_error){return'';}
  }
  function updatePlanUi(){
    const plans=window.LotoNativeBilling?.plans||{};
    // Цена за месяц: из реальной цены магазина, а до загрузки Offering — из предварительной
    // (config) цены. Предварительная цена НИКОГДА не используется для проведения покупки.
    const perMonth={};let anyPreliminary=false;
    for(const [id,meta] of Object.entries(SUBSCRIPTION_PLANS)){
      const store=plans[id];const months=Number(meta.months)||1;
      const amount=store&&Number.isFinite(store.price)&&store.price>0?store.price:parsePrice(meta.price);
      if(amount>0)perMonth[id]={value:amount/months,currency:store?.currencyCode||'USD'};
    }
    const priced=Object.keys(perMonth);
    // «Выгодно» — только по фактическому сравнению месячной цены (реальной или предварительной).
    const bestPlan=priced.length>=2?priced.reduce((best,id)=>perMonth[id].value<perMonth[best].value?id:best):'';
    for(const button of document.querySelectorAll('#pro-subscription-plans [data-plan]')){
      const id=button.dataset.plan;const meta=SUBSCRIPTION_PLANS[id]||{};const store=plans[id];
      button.setAttribute('aria-pressed',String(id===state.selectedPlan));
      const amount=button.querySelector('[data-amt]');
      if(amount)amount.textContent=store?.priceString||meta.price||'';
      if(!store&&meta.price)anyPreliminary=true;
      const permonth=button.querySelector('[data-permonth]');
      if(permonth)permonth.textContent=(id!=='m1'&&perMonth[id])?formatPerMonth(perMonth[id].value,perMonth[id].currency):'';
      const badge=button.querySelector('[data-best]');
      const isBest=Boolean(bestPlan)&&id===bestPlan;
      button.classList.toggle('best',isBest);
      if(badge)badge.toggleAttribute('hidden',!isBest);
    }
    document.getElementById('pro-price-note')?.toggleAttribute('hidden',!anyPreliminary);
    const plan=SUBSCRIPTION_PLANS[state.selectedPlan]||SUBSCRIPTION_PLANS.m12;
    const store=plans[state.selectedPlan];
    const purchaseButton=document.getElementById('pro-purchase-btn');
    if(purchaseButton)purchaseButton.dataset.plan=state.selectedPlan;
    const selected=document.getElementById('pro-selected-plan');
    if(selected)selected.textContent=`${T(plan.label)} · ${store?.priceString||plan.price}`;
  }
  async function purchase(){
    if(commercialNotConfigured()){showStatus(COMMERCIAL_NOT_CONFIGURED_MESSAGE);return;}
    const plan=SUBSCRIPTION_PLANS[state.selectedPlan]||SUBSCRIPTION_PLANS.m12;
    if(state.session&&!state.user)await refreshAccess();
    if(!confirmedPermanentAccount()){showStatus('Сначала войдите или создайте аккаунт по e-mail, чтобы PRO сохранился на всех устройствах.');return;}
    if(window.LotoNativeBilling?.isNative){
      if(!window.LotoNativeBilling.ready){showStatus('Магазин подписок ещё не подключён к этой сборке.');return;}
      try{
        const result=await window.LotoNativeBilling.purchase(plan.productId,plan.packageId);
        if(result.active)showStatus('Покупка подтверждена магазином. PRO активируется после серверной проверки.');
        else showStatus('Покупка обрабатывается магазином. Доступ обновится автоматически.');
      }catch(error){
        showStatus(error?.message==='purchase_cancelled'?'Покупка отменена.':'Не удалось завершить покупку. Проверьте магазин и попробуйте снова.');
      }
      return;
    }
    if(!config.revenueCatWebPurchaseUrl){showStatus('Платёжный каталог ещё не активирован.');return;}
    const url=new URL(config.revenueCatWebPurchaseUrl);
    const appUserId=encodeURIComponent(state.user?.id||'');
    url.pathname=`${url.pathname.replace(/\/$/,'')}/${appUserId}`;
    url.searchParams.set('package_id',plan.packageId);
    if(state.user?.email)url.searchParams.set('email',state.user.email);
    track('checkout_open',{surface:'web',planId:state.selectedPlan,productId:plan.productId});
    window.location.assign(url);
  }
  async function restorePurchase(){
    if(commercialNotConfigured()){showStatus(COMMERCIAL_NOT_CONFIGURED_MESSAGE);return;}
    if(window.LotoNativeBilling?.isNative){
      if(!window.LotoNativeBilling.ready){showStatus('Магазин подписок ещё не подключён к этой сборке.');return;}
      try{await window.LotoNativeBilling.restore();}catch(_error){showStatus('Не удалось восстановить покупки. Попробуйте позже.');return;}
    }
    await refreshAccess();showStatus(state.access.accessLevel==='pro'?'Покупка восстановлена. PRO активен.':'Активная подписка пока не найдена.');
  }
  async function accountPortal(){
    if(commercialNotConfigured()){showStatus(COMMERCIAL_NOT_CONFIGURED_MESSAGE);return;}
    if(window.LotoNativeBilling?.isNative&&await window.LotoNativeBilling.manage())return;
    if(config.accountPortalUrl)window.open(config.accountPortalUrl,'_blank','noopener');
    else showStatus('Управление подпиской будет доступно после подключения платёжного кабинета.');
  }

  function wrapAction(name,feature){
    const original=window[name];if(typeof original!=='function')return;
    window[name]=async function(...args){
      if(actionDepth>0)return original.apply(this,args);
      if(!await requireFeature(feature))return;
      actionDepth++;
      try{return await original.apply(this,args);}
      finally{actionDepth=Math.max(0,actionDepth-1);}
    };
  }
  function featureForModel(algo){
    if(algo==='wheel')return'wheel';
    if(algo==='paradox')return'paradoxes';
    if(String(algo).startsWith('world'))return'world_analysis';
    return FREE_GENERATION_MODELS.has(algo)?'':'advanced_models';
  }
  function backendContext(){
    return typeof window.getBackendActionContext==='function'?window.getBackendActionContext():null;
  }
  async function backendRows(model,feature,operation='generate'){
    const context=backendContext();if(!context)return null;
    const payload=operation==='wheel'
      ?{gameId:context.gameId,pool:context.pool,count:context.count}
      :{gameId:context.gameId,model,count:context.count};
    const response=await runProAction({
      actionType:'compute',feature,operation,gameId:context.gameId,model,payload,
      input:operation==='wheel'?context.pool:null,options:{count:context.count},
      origin:location.hash||location.pathname,resultTarget:{kind:'backend_rows',model},
    });
    return response?.result||null;
  }
  function limitGroupAnalysisRows(rows,feature='judge'){
    if(!Array.isArray(rows))return rows;
    try{return typeof window.prepareRowsForGroupAnalysis==='function'?window.prepareRowsForGroupAnalysis(rows,feature):rows;}catch(_error){return rows;}
  }
  async function backendJudge(inputRows,mountId='jc-mount',options={}){
    const context=backendContext();if(!context)return null;
    const rows=(limitGroupAnalysisRows(inputRows||context.rows||[],options.feature||'judge')||[]).map(row=>({
      main:[...(row.main||row.m||[])],bonus:[...(row.bonus||row.b||[])],
    }));
    if(!rows.length){window.showFeedback?.('Нет рядов','Сначала создайте или введите комбинацию для проверки.','⚠️',3200);return null;}
    const idempotencyKey=`judge:${uuid()}`;
    pendingJudgeTargets.set(idempotencyKey,{
      namespace:options.namespace||'judge',mountId,
      onApply:options.onApply||null,intro:options.intro||'',applyLabel:options.applyLabel||'',
    });
    const response=await runProAction({
      actionType:'compute',feature:'judge',operation:'judge',gameId:context.gameId,payload:{gameId:context.gameId,rows},
      input:rows,origin:location.hash||location.pathname,idempotencyKey,
      resultTarget:{kind:'judge',mountId,namespace:options.namespace||'judge',inputRows:rows,intro:options.intro||'',applyLabel:options.applyLabel||''},
    });
    if(!response)pendingJudgeTargets.delete(idempotencyKey);
    return response?.result||null;
  }
  // A failed preview action never charged (server charges only on success). Show the
  // paywall only when the budget is genuinely exhausted; otherwise surface a soft error.
  function handleBackendError(error,feature,{openPurchase=true,previewFeature=null}={}){
    if(error?.payload?.access)state.access=error.payload.access;
    const message=error?.message||'';
    // Server-authoritative account gate (covers a direct API call / stale client state):
    // an anonymous identity must create/sign in to a permanent account for the trial.
    if(message==='signup_required'||error?.status===403){
      track('pro_preview_account_required',{feature});
      openPaywall('preview_sign_in');
      return null;
    }
    if(openPurchase&&(message==='preview_exhausted'||error?.status===402)&&!premium()){openPaywall('preview_exhausted');return null;}
    track('pro_preview_failed_no_charge',{feature});
    // Typed data-integrity failures (fail-closed): the server produced no verdict/rows
    // and charged nothing, so surface an honest reason instead of a generic retry.
    if(message==='insufficient_history'||message==='history_unavailable'){
      window.showFeedback?.(T('Исторические данные недоступны'),T('Анализ невозможен: история тиражей не загружена. Обновите официальные результаты. Попытка не списана.'),'⚠️',5200);
      return null;
    }
    if(message==='insufficient_rows'||message==='incomplete_result'){
      window.showFeedback?.(T('Не удалось сформировать ряды'),T('Сервис не смог собрать нужное число рядов. Попробуйте ещё раз — попытка не списана.'),'⚠️',4600);
      return null;
    }
    window.showFeedback?.(T('Не удалось получить результат'),T(previewNoChargeMessage(previewFeature)),'⚠️',4600);
    return null;
  }
  function installBackendOnlyActions(){
    const generatedRowsFromState=stateName=>{
      const state=window[stateName];
      return Array.isArray(state?.rows)?state.rows.map(row=>({
        main:[...(row.main||row.m||[])],bonus:[...(row.bonus||row.b||[])],
      })):null;
    };
    window.IF_run=()=>backendRows('consensus','advanced_models');
    window.CONS_run=()=>backendRows('consensus','advanced_models');
    window.QA_go=()=>backendRows('qastro','advanced_models');
    window.PDX_go=()=>backendRows('paradox','paradoxes');
    window.applyWheelBuilder=()=>backendRows('wheel','wheel','wheel');
    window.applyWheelMatrix=()=>backendRows('wheel','wheel','wheel');
    window.SUP_go=()=>backendJudge(null,'sup-result',{namespace:'sup'});
    window.ADV_judge=()=>{
      const rows=generatedRowsFromState('ADV_state');
      return backendJudge(rows,'adv-result',{
        namespace:'adv',applyLabel:'Использовать в билете',
        intro:'<b>Расследование судьи.</b> Проверяю ряды модели на защищённом Backend. Реши сам, какие замены применить.',
        onApply:(finalRows,meta)=>{
          window.ADV_close?.();window.closeSG?.();
          window.setGeneratedRows?.(finalRows,`${window.JUDGE_choiceText?.(meta)||'Решение судьи'}. Ряды перенесены в билет. ⚖️🍀`);
        },
      });
    };
    window.JC_open=async()=>{
      document.getElementById('jc-ov')?.classList.add('show');
      return backendJudge(null,'jc-mount',{
        namespace:'jc',applyLabel:'Применить в билете',
        onApply:(finalRows,meta)=>{
          window.JC_close?.();
          const choice=window.JUDGE_choiceText?.(meta)||'Решение судьи';
          const duration=window.setGeneratedRows?.(finalRows,`${choice}. Комбинация применена в билете. ⚖️`)||0;
          setTimeout(()=>window.showFeedback?.('Готово',`${choice}.`,'⚖️',2400),duration+150);
        },
      });
    };
    window.JUDGE_open=(namespace,rows,mountId,onApply,opts={})=>backendJudge(rows,mountId||`${namespace}-mount`,{namespace,onApply,intro:opts.intro||'',applyLabel:opts.applyLabel||''});
    // Send a specific set of generated rows to the existing Верховный судья (per-feature
    // 'judge' access). Used by the model Result modal. renderBackendJudge opens #jc-ov.
    window.judgeGeneratedRows=(rows)=>backendJudge(rows,'jc-mount');
    window.renderWorldAnalysis=async(targetId='world-analysis-out')=>{
      const context=backendContext();if(!context)return null;
      const response=await runProAction({
        actionType:'analysis',feature:'world_analysis',operation:'analysis',gameId:context.gameId,
        payload:{gameId:context.gameId},origin:location.hash||location.pathname,
        resultTarget:{kind:'world_analysis',targetId},
      });
      return response?.analysis||null;
    };
  }
  function renderOnboarding(){
    if(!onboardingNode)return;
    const variant=state.experiment.variant;
    const steps=[
      {title:'1 из 3 · Первый результат за минуту',copy:'Выберите лотерею и запустите честную симуляцию. Никакой регистрации не требуется.',action:'Запустить первую симуляцию'},
      {title:'2 из 3 · Увидьте реальные данные',copy:'Откройте базовую аналитику: Free честно считает только по 20 последним официальным тиражам.',action:'Показать частоты Free'},
      {title:'3 из 3 · Сравните с PRO',copy:variant==='B'?'Посмотрите демонстрационный Preview профессиональной модели без передачи полной базы.':'Посмотрите, насколько больше исторических данных и исследовательских инструментов использует PRO.',action:'Посмотреть пример PRO'},
    ];
    const step=steps[onboardingStep]||steps[2];
    onboardingNode.innerHTML=`<button class="commercial-onboarding-close" type="button" aria-label="Закрыть">✕</button><div class="commercial-onboarding-kicker">Loto Simulator</div><b>${T(step.title)}</b><span>${T(step.copy)}</span><button class="commercial-onboarding-action" type="button">${T(step.action)}</button>`;
    onboardingNode.querySelector('.commercial-onboarding-close').onclick=finishOnboarding;
    onboardingNode.querySelector('.commercial-onboarding-action').onclick=()=>{
      if(onboardingStep===0){window.doDraw?.();return;}
      if(onboardingStep===1){window.selPage?.('ana');window.selAT?.('freq');advanceOnboarding(2);return;}
      openPaywall('advanced_models');finishOnboarding();
    };
  }
  function advanceOnboarding(step){onboardingStep=Math.max(onboardingStep,step);renderOnboarding();}
  function finishOnboarding(){try{localStorage.setItem('loto_onboarding_complete_v1','1');}catch(_error){}onboardingNode?.remove();onboardingNode=null;}
  function installOnboarding(force=false){
    // Opens ONLY on an explicit user action (force=true). Without force it is a no-op, so
    // the panel never auto-appears after the splash. A user action always re-opens it from
    // step 1 (the first-visit completion flag no longer gates anything).
    if(!force)return;
    if(onboardingNode){onboardingNode.remove();onboardingNode=null;}
    onboardingStep=0;
    onboardingNode=document.createElement('section');onboardingNode.className=`commercial-onboarding variant-${state.experiment.variant}`;
    const anchor=document.getElementById('lot-nav-shell')||document.querySelector('.hdr');anchor?.insertAdjacentElement('afterend',onboardingNode);
    renderOnboarding();track('onboarding_view',{variant:state.experiment.variant});
  }
  function installGates(){
    const originalArchive=window.loadArchivePackage;
    if(typeof originalArchive==='function')window.loadArchivePackage=game=>config.enabled?fetchArchive(game):originalArchive(game);
    const originalLoad=window.loadD;
    if(typeof originalLoad==='function')window.loadD=async function(game){
      if(!config.enabled)return originalLoad(game);
      const recent=await window.loadHistoricalResults(game).catch(()=>[]);
      if(!premium())return recent.slice(0,Number(config.freeRecentDraws||20));
      try{const pack=await fetchArchive(game);return window.mergeDrawLists(recent,pack.draws).merged;}catch(_error){return recent.slice(0,Number(config.freeRecentDraws||20));}
    };
    const originalGenerator=window.generateRowsByAlgo;
    if(typeof originalGenerator==='function')window.generateRowsByAlgo=async function(algo,count,opts){
      const feature=featureForModel(algo);
      const requested=Math.max(1,Number(count)||1);
      const userFacing=!!(opts&&opts.user);
      const gameId=()=>{
        const currentGame=typeof window.getCurrentGameKey==='function'?window.getCurrentGameKey():'';
        return typeof window.resolveConfigKey==='function'?(window.resolveConfigKey(currentGame)||currentGame):currentGame;
      };
      // Internal callers (Consensus research rows, Advisor) keep the historical behaviour:
      // client-side generation, FREE limited per run, inside their own already-gated feature.
      // Not user-selected counts → no upgrade prompt here.
      if(!userFacing){
        const actual=premium()?requested:Math.min(requested,FREE_GENERATION_ROWS_PER_RUN);
        state.lastGeneration={algo,requested,actual,limited:actual<requested,internal:true};
        if(feature&&!developerPro()){
          const gid=gameId();
          const response=await runProAction({
            actionType:'compute',feature,operation:'generate',gameId:gid,model:algo,
            payload:{gameId:gid,model:algo,count:actual},options:{count:actual},
            origin:location.hash||location.pathname,resultTarget:null,
          });
          return(response?.result||[]).map(row=>({m:row.main,b:row.bonus}));
        }
        return originalGenerator.call(this,algo,actual);
      }
      // USER-facing generation: NEVER silently truncate. Honour the EXACT requested count, or
      // route to the existing Trial/PRO flow — never a partial result (bug: FREE picked 8 → got 5).
      state.lastGeneration={algo,requested,actual:requested,limited:false};
      if(feature){
        // A PRO model chosen by the user → always the Trial/PRO flow, at the exact requested count.
        if(!developerPro()){
          const gid=gameId();
          const response=await runProAction({
            actionType:'compute',feature,operation:'generate',gameId:gid,model:algo,
            payload:{gameId:gid,model:algo,count:requested},options:{count:requested},
            origin:location.hash||location.pathname,resultTarget:null,
          });
          if(!response?.result)return null;                 // paywall/not activated → no rows
          return response.result.map(row=>({m:row.main,b:row.bonus}));
        }
        return originalGenerator.call(this,algo,requested);
      }
      // Basic model (freq/bal/rnd/man): FREE gets up to the per-run limit exactly; asking for
      // more triggers the Trial/PRO flow instead of a silent 5.
      if(!premium()&&requested>FREE_GENERATION_ROWS_PER_RUN){
        track('generation_over_free_limit',{model:algo,requested});
        openPaywall('basic_generation');
        return null;
      }
      return originalGenerator.call(this,algo,requested);
    };
    const originalHistory=window.renderHistory;
    if(typeof originalHistory==='function')window.renderHistory=async function(...args){const result=await originalHistory.apply(this,args);decorateHistory();return result;};
    // Preview/backend-computed PRO features ALWAYS go through runProAction (never a
    // silent requireFeature gate). This guarantees a PRO card can NEVER do nothing:
    // it opens the free-use modal, a retryable service error, or the purchase screen.
    // Runs in every mode (including developer/localhost — which the native Capacitor
    // origin reports — so native behaviour matches production exactly and Wheel Matrix /
    // Paradox / Consensus / Judge / World analysis are never dead).
    installBackendOnlyActions();
    wrapAction('doExport','exports');wrapAction('addDraw','data_management');
    wrapAction('handleTextImport','data_management');wrapAction('handleImp','data_management');
    const originalSaveFav=window.saveFav;
    if(typeof originalSaveFav==='function')window.saveFav=async function(...args){
      if(!premium()){
        const saved=typeof window.loadFav==='function'?await window.loadFav():[];
        if(saved.length>=Number(state.access?.freeLimits?.savedCombinations||2)){openPaywall('saved_combinations');return;}
      }
      return originalSaveFav.apply(this,args);
    };
    const originalDraw=window.doDraw;if(typeof originalDraw==='function')window.doDraw=function(...args){const result=originalDraw.apply(this,args);track('simulation_complete',{game:typeof cur!=='undefined'?cur:'unknown'});advanceOnboarding(1);return result;};
    const originalPage=window.selPage;if(typeof originalPage==='function')window.selPage=function(page,...args){const result=originalPage.call(this,page,...args);if(page==='ana'){track('basic_analysis_view',{tab:typeof curAT!=='undefined'?curAT:'unknown'});advanceOnboarding(2);}return result;};
    window.openSubInfo=()=>openPaywall('');window.PRO_close=closePaywall;
    window.PRO_showPlans=()=>{};window.PRO_selectPlan=selectPlan;window.PRO_selectMethod=()=>{};window.PRO_continueCheckout=purchase;
  }
  function installDeveloperPanel(){
    if(!developerMode())return;
    developerPanel=document.createElement('aside');
    developerPanel.className='commercial-dev-panel';
    developerPanel.dataset.i18nIgnore='';
    developerPanel.setAttribute('aria-label','Локальный тест подписки');
    developerPanel.innerHTML='<b>ТЕСТ ПЛАТНЫХ СРОКОВ</b><span data-developer-status></span><div class="commercial-dev-actions"><button type="button" data-plan="m1">1 месяц</button><button type="button" data-plan="m3">3 месяца</button><button type="button" data-plan="m6">6 месяцев</button><button type="button" data-plan="m12">12 месяцев</button></div><div class="commercial-dev-scenarios"><button type="button" data-scenario="renewal">Продление</button><button type="button" data-scenario="cancelled">Отмена</button><button type="button" data-scenario="expired">Истёк</button></div><small>Только localhost: полный локальный архив. В публичной конфигурации тестовый доступ выключен.</small>';
    for(const button of developerPanel.querySelectorAll('[data-plan]'))button.onclick=()=>applyDeveloperPlan(button.dataset.plan);
    developerPanel.querySelector('[data-scenario="renewal"]').onclick=renewDeveloperPlan;
    developerPanel.querySelector('[data-scenario="cancelled"]').onclick=cancelDeveloperPlan;
    developerPanel.querySelector('[data-scenario="expired"]').onclick=expireDeveloperPlan;
    document.body.appendChild(developerPanel);
    updateDeveloperPanel();
  }
  async function init(){
    window.addEventListener('loto:nativebillingready',()=>updateUi());
    window.addEventListener('loto:nativepurchaseupdate',()=>{if(state.session)refreshAccess().catch(()=>{});});
    installGates();
    try{state.metadata=await fetch('./commercial-metadata.json',{cache:'no-store'}).then(response=>response.ok?response.json():null);}catch(_error){}
    if(state.backendReady){
      try{state.session=await readRedirectSession();}catch(_error){state.session=null;}
      // No forced registration: fall back to an anonymous identity for preview accounting.
      if(!state.session)await ensureSession();
      try{const assignment=await api('experiment',{query:{subjectId:subjectId()}});state.experiment={name:assignment.experiment,variant:assignment.variant};}catch(_error){}
      if(state.session)await refreshAccess();
    }
    restoreDeveloperPlan();
    // Onboarding is NOT auto-shown on first load (it popped up right after the splash and
    // annoyed users). The panel + its logic stay intact and are opened only on an explicit
    // user action via window.LotoCommercial.showOnboarding().
    // The PRO paywall must NEVER auto-open on page load/reload. showExpiredPaywall() used to
    // run here and popped the modal open right after the preloader for anyone whose backend
    // access-state still carries an expired subscription (productId set, expiresAt in the
    // past) — even though they are now on "Постоянный Free". The paywall opens only on an
    // explicit user action (openSubInfo / PRO buttons). The mid-session real-time expiry
    // notification (scheduleAccessExpiry timer) is unaffected.
    state.ready=true;emit();installDeveloperPanel();
    if(state.authJustConfirmed)setTimeout(()=>openPaywall('trial_sign_in'),0);
    // Resume a pending PRO action on load ONLY if it can complete silently for an already-PRO
    // user. Previously this re-ran runProAction unconditionally, which for a saved
    // (anonymous / exhausted) action opened the paywall on EVERY reload with no user action.
    // A startup resume must never OPEN the commercial modal; the pending action stays and is
    // picked up by the user's next explicit PRO action.
    const restored=readPendingAction();
    if(restored&&state.backendReady&&state.session)setTimeout(async()=>{
      try{if(await resolveProAccess(restored,{refresh:false})===PRO_ACCESS.ACTIVE_PRO)await runProAction(restored);}catch(_error){}
    },0);
  }

  const publicSnapshot=value=>{
    if(value===null||value===undefined)return value;
    try{return Object.freeze(structuredClone(value));}catch(_error){return Object.freeze({...value});}
  };
  window.LotoCommercial={
    get access(){return publicSnapshot(state.access);},get user(){return publicSnapshot(state.user);},
    get commercialNotConfigured(){return commercialNotConfigured();},
    policy:FEATURE_POLICY,freeGenerationModels:Object.freeze([...FREE_GENERATION_MODELS]),freeGenerationRowsPerRun:FREE_GENERATION_ROWS_PER_RUN,freeGroupAnalysisRows:FREE_GROUP_ANALYSIS_ROWS,
    datasetMode:()=>premium()?'pro':'free',requireFeature,resolveProAccess,runProAction,fetchArchive,analysis,compute,refreshAccess,
    proAccessStates:PRO_ACCESS,
    openPaywall,closePaywall,sendMagicLink,signOut,purchase,restorePurchase,accountPortal,acceptAuthRedirect,
    submitEmail,decorateHistory,selectPlan,
    // User-invoked entry point for the onboarding panel (no longer shown automatically).
    showOnboarding:()=>installOnboarding(true),
  };
  if(developerMode())window.LotoCommercialDeveloper=Object.freeze({
    applyPlan:applyDeveloperPlan,renew:renewDeveloperPlan,cancel:cancelDeveloperPlan,expire:expireDeveloperPlan,
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
