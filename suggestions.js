/* Public form + owner inbox. Database permissions remain the authority for every owner action. */
(function () {
  'use strict';
  var W=window,D=document,overlay=null,busy=false,ownerHost=null,ownerButton=null,timer=null;
  var requestId=null,offset=0,ownerData=null,ownerBusy=false,pendingReply={},ownerEpoch=0;
  function lang(owner){
    var app=D.documentElement.lang||'en';
    // The existing panel has only ru/en/no. Its default Russian fallback is not an explicit
    // owner choice: this feature supports the other fourteen app languages as well.
    if(owner&&W.LotoOwnerI18n){
      var chosen='';try{chosen=W.localStorage.getItem('loto_owner_lang')||'';}catch(e){}
      if(chosen&&!W.LotoOwnerI18n.followsApp())return W.LotoOwnerI18n.lang;
    }
    return app;
  }
  function t(key,owner){if(!key)return '';var strings=W.LotoSuggestionStrings;return (strings[lang(owner)]||strings.en)[key];}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  // randomUUID / AbortSignal.timeout are newer than the app's floor (iOS 15.0, Android WebView 90).
  function id(){
    if(W.crypto.randomUUID)return W.crypto.randomUUID();
    var b=W.crypto.getRandomValues(new Uint8Array(16)),h=[];b[6]=b[6]&15|64;b[8]=b[8]&63|128;
    for(var i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));
    return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');
  }
  function timeoutSignal(ms){
    if(AbortSignal.timeout)return AbortSignal.timeout(ms);
    var controller=new AbortController();setTimeout(function(){controller.abort();},ms);return controller.signal;
  }
  async function session(){return W.LotoAuth&&W.LotoAuth.getSession?await W.LotoAuth.getSession():null;}
  async function api(name,body){
    var config=W.LOTO_COMMERCIAL_CONFIG||{};
    if(!config.supabaseUrl||!config.supabasePublishableKey)throw new Error('unavailable');
    var s=await session(),headers={'Content-Type':'application/json',apikey:config.supabasePublishableKey};
    if(s&&s.access_token)headers.Authorization='Bearer '+s.access_token;
    var response=await fetch(config.supabaseUrl.replace(/\/+$/,'')+'/functions/v1/'+name,{
      method:'POST',headers:headers,body:JSON.stringify(body),cache:'no-store',signal:timeoutSignal(20000)
    });
    var result=await response.json().catch(function(){return {};});
    if(!response.ok||result.error)throw new Error(result.error||'unavailable');
    return result;
  }
  function field(label,control){return '<label class="sg-field"><span>'+esc(label)+'</span>'+control+'</label>';}
  function relabelPublic(){
    D.querySelectorAll('[data-suggestion-open]').forEach(function(b){b.setAttribute('aria-label',t('action'));b.title=t('action');var label=b.querySelector('.suggestion-label');if(label)label.textContent=t('action');});
    if(!overlay)return;
    overlay.querySelectorAll('[data-sgt]').forEach(function(el){el.textContent=t(el.dataset.sgt);});
    overlay.querySelector('.sg-close').setAttribute('aria-label',t('close'));
    overlay.querySelector('#sg-email-note').textContent=t(overlay.dataset.signed==='1'?'verified':'optional');
    if(busy)overlay.querySelector('[type=submit]').textContent=t('sending');
    var notice=overlay.querySelector('#sg-notice');if(notice.dataset.key)notice.textContent=t(notice.dataset.key);
  }
  function build(){
    if(overlay)return;
    overlay=D.createElement('div');overlay.id='suggestions-ov';overlay.setAttribute('data-i18n-ignore','');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','sg-title');overlay.setAttribute('aria-describedby','sg-intro');
    overlay.innerHTML='<section class="sg-box"><div class="sg-head"><h2 id="sg-title" data-sgt="title"></h2><button class="sg-close" type="button">×</button></div>'+
      '<p id="sg-intro" data-sgt="intro"></p><form id="suggestion-form">'+
      field(t('email'),'<input id="sg-email" name="email" type="email" autocomplete="email" maxlength="254" aria-describedby="sg-email-note">')+
      '<p class="sg-note" id="sg-email-note"></p>'+field(t('message'),' <textarea id="sg-message" name="message" required maxlength="5000" rows="5"></textarea>')+
      '<label class="sg-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>'+
      '<div id="sg-captcha"></div><button class="sg-primary" type="submit" data-sgt="send"></button></form>'+
      '<div id="sg-notice" class="sg-notice" role="status" aria-live="polite" tabindex="-1"></div></section>';
    // These labels repaint in place without replacing a typed draft.
    var labels=overlay.querySelectorAll('.sg-field>span');labels[0].dataset.sgt='email';labels[1].dataset.sgt='message';
    D.body.appendChild(overlay);
    overlay.__lotoClose=function(){overlay.classList.remove('show');D.getElementById('suggestion-btn').setAttribute('aria-expanded','false');};
    overlay.querySelector('.sg-close').onclick=close;
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    overlay.querySelector('form').addEventListener('submit',submit);
    overlay.querySelector('form').addEventListener('input',function(){if(!busy)requestId=null;});
    if(W.LotoModals)W.LotoModals.register(overlay);
    relabelPublic();
  }
  function close(){if(W.LotoModals)W.LotoModals.closeModal(overlay.id);else overlay.__lotoClose();}
  async function open(){
    build();
    var email=overlay.querySelector('#sg-email');email.disabled=true;
    try {
      var s=await session(),u=s&&s.user,signed=!!(u&&!u.is_anonymous&&u.email);
      overlay.dataset.signed=signed?'1':'0';
      if(signed){email.value=u.email;email.readOnly=true;}
      else {if(email.readOnly)email.value='';email.readOnly=false;}
    } catch {overlay.dataset.signed='0';email.readOnly=true;}
    email.disabled=false;relabelPublic();
    D.getElementById('suggestion-btn').setAttribute('aria-expanded','true');
    if(W.LotoModals)W.LotoModals.openModal(overlay.id);else overlay.classList.add('show');
  }
  function notice(key){var n=overlay.querySelector('#sg-notice');n.dataset.key=key;n.textContent=t(key);return n;}
  async function captchaToken(){
    var config=W.LOTO_COMMERCIAL_CONFIG||{};
    if(!config.turnstileSiteKey)return '';
    if(!W.LotoTurnstile)await W.LotoLoadRuntimeScript('turnstile-runtime.js');
    return W.LotoTurnstile.getToken(overlay.querySelector('#sg-captcha'),{action:'user_suggestion',size:W.innerWidth<390?'compact':'normal'});
  }
  async function submit(e){
    e.preventDefault();if(busy)return;
    var form=e.target;if(!form.reportValidity())return;
    var message=form.elements.message.value.trim();if(!message){form.elements.message.focus();return;}
    busy=true;form.querySelector('[type=submit]').disabled=true;notice('');relabelPublic();
    // Keep the same id after an uncertain network result; the database deduplicates retries.
    requestId=requestId||id();
    try {
      var platform=W.Capacitor&&W.Capacitor.getPlatform?W.Capacitor.getPlatform():'web';
      var result=await api('suggestions',{request_id:requestId,email:form.elements.email.value,message:message,
        platform:['ios','android'].indexOf(platform)>=0?platform:'web',locale:lang(false),website:form.elements.website.value,captcha_token:await captchaToken()});
      if(!result.ok)throw new Error('save_failed');
      form.reset();form.hidden=true;notice('success').focus();requestId=null;
    } catch(error){notice(error.message==='rate_limited'?'rate':error.message==='captcha_required'?'captcha':'error');}
    finally {busy=false;form.querySelector('[type=submit]').disabled=false;relabelPublic();}
  }
  function ownerApi(params){return api('owner-analytics',{suggestions:params});}
  function ownerText(key){return esc(t(key,true));}
  function ownerDate(value){return new Date(value).toLocaleString(lang(true)==='no'?'nb':lang(true));}
  function ownerNotice(key){var el=ownerHost&&ownerHost.querySelector('[data-owner-notice]');if(el)el.textContent=t(key,true);}
  function repaintOwner(){
    if(!ownerHost||!ownerData)return;
    var drafts={};ownerHost.querySelectorAll('[data-reply]').forEach(function(el){drafts[el.dataset.reply]=el.value;});
    ownerButton.textContent=t('owner',true)+' · '+ownerData.unread;
    ownerHost.innerHTML='<section class="sg-box" data-i18n-ignore><div class="sg-head"><h2>'+ownerText('owner')+' · '+ownerData.unread+'</h2><button class="sg-close" type="button" data-owner-close aria-label="'+ownerText('close')+'">×</button></div>'+
      '<div role="status" aria-live="polite" class="sg-notice" data-owner-notice></div>'+
      (ownerData.items.length?ownerData.items.map(function(row){return '<article class="sg-card '+(row.read_at?'':'is-unread')+'" data-id="'+esc(row.id)+'">'+
        '<div class="sg-meta">'+ownerText('date')+': '+esc(ownerDate(row.created_at))+'<br>'+ownerText('email')+': '+esc(row.email||'—')+'<br>'+ownerText('platform')+': '+esc(row.platform)+' · '+esc(row.locale)+'</div>'+
        '<div class="sg-message" data-i18n-ignore>'+esc(row.message)+'</div>'+field(t('status',true),'<select data-status="'+row.id+'" aria-label="'+ownerText('status')+'">'+['new','reviewing','planned','implemented','declined'].map(function(status){return '<option value="'+status+'"'+(status===row.status?' selected':'')+'>'+ownerText(status)+'</option>';}).join('')+'</select>')+
        (!row.read_at?'<div class="sg-actions"><button data-read="'+row.id+'" type="button">'+ownerText('read')+'</button></div>':'')+
        (row.replies||[]).map(function(r){return '<div class="sg-reply">'+esc(r.body)+'<div class="sg-meta">'+ownerText(r.sent_at?'sent':'queued')+' · '+esc(ownerDate(r.sent_at||r.created_at))+'</div></div>';}).join('')+
        (row.email?'<form data-reply-form="'+row.id+'">'+field(t('reply',true),'<textarea data-reply="'+row.id+'" required maxlength="5000" rows="3"></textarea>')+'<button class="sg-primary" type="submit">'+ownerText('queue')+'</button></form>':'<p class="sg-note">'+ownerText('noEmail')+'</p>')+'</article>';}).join(''):'<p>'+ownerText('empty')+'</p>')+
      '<div class="sg-actions"><button data-page="-1" type="button"'+(offset===0?' disabled':'')+'>'+ownerText('previous')+'</button><button data-page="1" type="button"'+(offset+30>=ownerData.total?' disabled':'')+'>'+ownerText('next')+'</button></div></section>';
    Object.keys(drafts).forEach(function(key){var el=ownerHost.querySelector('[data-reply="'+key+'"]');if(el)el.value=drafts[key];});
  }
  async function ownerLoad(){
    var epoch=ownerEpoch,data=await ownerApi({op:'list',offset:offset});if(epoch!==ownerEpoch)return;ownerData=data;repaintOwner();
  }
  async function ownerAction(params){
    if(ownerBusy)return;var epoch=ownerEpoch;ownerBusy=true;
    ownerHost.querySelectorAll('button,select,textarea').forEach(function(el){el.disabled=true;});
    try {await ownerApi(params);if(epoch===ownerEpoch)await ownerLoad();}
    catch {if(epoch===ownerEpoch)ownerNotice('error');}
    finally {ownerBusy=false;ownerHost.querySelectorAll('button,select,textarea').forEach(function(el){el.disabled=false;});
      var pages=ownerHost.querySelectorAll('[data-page]');if(pages.length){pages[0].disabled=offset===0;pages[1].disabled=!ownerData||offset+30>=ownerData.total;}}
  }
  async function openOwner(){
    var epoch=ownerEpoch;
    ownerHost.hidden=false;ownerButton.setAttribute('aria-expanded','true');ownerHost.innerHTML='<section class="sg-box"><div role="status">'+ownerText('loading')+'</div></section>';
    try {await ownerLoad();if(epoch!==ownerEpoch||ownerHost.hidden)return;ownerHost.querySelector('[data-owner-close]').focus();}
    catch {ownerHost.innerHTML='<section class="sg-box"><p>'+ownerText('error')+'</p><button class="sg-close" data-owner-close type="button" aria-label="'+ownerText('close')+'">×</button></section>';}
  }
  function closeOwner(){if(!ownerHost||ownerHost.hidden)return false;ownerHost.hidden=true;ownerButton.setAttribute('aria-expanded','false');ownerButton.focus();return true;}
  async function updateUnread(){
    var epoch=ownerEpoch;
    try {var data=await ownerApi({op:'unread'});if(ownerButton&&epoch===ownerEpoch)ownerButton.textContent=t('owner',true)+' · '+data.unread;} catch { /* the inbox exposes retryable error on open */ }
  }
  function startOwner(){
    var panel=D.getElementById('ow-ov');if(!panel)return;
    if(!ownerButton){
      ownerButton=D.createElement('button');ownerButton.id='owner-suggestions-btn';ownerButton.className='ow-btn';ownerButton.type='button';ownerButton.setAttribute('aria-expanded','false');ownerButton.onclick=openOwner;
      panel.querySelector('.ow-top').appendChild(ownerButton);
      ownerHost=D.createElement('div');ownerHost.id='owner-suggestions-view';ownerHost.hidden=true;ownerHost.setAttribute('data-i18n-ignore','');panel.appendChild(ownerHost);
      ownerHost.addEventListener('click',function(e){var close=e.target.closest('[data-owner-close]');if(close){closeOwner();return;}
        var read=e.target.closest('[data-read]');if(read){ownerAction({op:'mark',id:read.dataset.read,offset:offset});return;}
        var page=e.target.closest('[data-page]');if(page&&!ownerBusy){offset+=Number(page.dataset.page)*30;openOwner();}});
      ownerHost.addEventListener('change',function(e){if(e.target.dataset.status)ownerAction({op:'status',id:e.target.dataset.status,status:e.target.value,offset:offset});});
      ownerHost.addEventListener('submit',async function(e){e.preventDefault();var form=e.target,key=form.dataset.replyForm,area=form.querySelector('textarea');if(!area.value.trim()||ownerBusy)return;
        var draft=pendingReply[key];if(!draft||draft.message!==area.value.trim())pendingReply[key]={id:id(),message:area.value.trim()};
        var sentDraft=pendingReply[key];
        await ownerAction({op:'reply',id:key,message:sentDraft.message,request_id:sentDraft.id,offset:offset});
        // Clear only when the returned list confirms persistence, including after a lost response.
        var row=ownerData&&ownerData.items.find(function(r){return r.id===key;});
        if(row&&(row.replies||[]).some(function(r){return r.request_id===sentDraft.id;})){delete pendingReply[key];var current=ownerHost.querySelector('[data-reply="'+key+'"]');if(current)current.value='';ownerNotice('queued');}
      });
    }
    ownerButton.hidden=false;ownerButton.textContent=t('owner',true);updateUnread();if(!timer)timer=setInterval(updateUnread,60000);
  }
  function stopOwner(){ownerEpoch++;if(timer){clearInterval(timer);timer=null;}if(ownerHost){ownerHost.hidden=true;ownerHost.innerHTML='';}if(ownerButton)ownerButton.hidden=true;ownerData=null;pendingReply={};}
  D.addEventListener('click',function(e){if(e.target.closest('[data-suggestion-open]')){e.preventDefault();if(overlay&&overlay.querySelector('form').hidden){overlay.querySelector('form').hidden=false;notice('');}open();}});
  W.addEventListener('loto:languagechange',function(){relabelPublic();if(ownerData)repaintOwner();else if(ownerButton)ownerButton.textContent=t('owner',true);});
  W.addEventListener('loto:ownerlanguagechange',function(){if(ownerData)repaintOwner();else if(ownerButton)ownerButton.textContent=t('owner',true);});
  W.LotoSuggestions={open:open,startOwner:startOwner,stopOwner:stopOwner,closeOwner:closeOwner,openOwner:openOwner};
  relabelPublic();
})();
