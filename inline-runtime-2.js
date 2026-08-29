/* Личный кабинет — единый источник для Web/iOS/Android. Читает реальные данные из
   window.LotoCommercial (Supabase access-state / entitlements) и window.LotoAuth
   (Supabase Auth + Storage). Строки на русском переводятся рантайм-наблюдателем i18n. */
(function(){
  const $=id=>document.getElementById(id);
  const T=v=>String(v==null?'':v);
  let magicSending=false,avatarBusy=false;

  function fmtDate(iso){
    const t=Date.parse(iso||'');
    if(!Number.isFinite(t))return '';
    const loc=(document.documentElement.lang||'ru');
    try{return new Date(t).toLocaleDateString(loc,{day:'numeric',month:'long',year:'numeric'});}
    catch(_e){return new Date(t).toISOString().slice(0,10);}
  }
  function sourceLabel(src){
    switch(String(src||'')){
      case 'owner_lifetime':return 'Владелец · пожизненный доступ';
      case 'apple':return 'Apple App Store';
      case 'google':return 'Google Play';
      case 'stripe':return 'Stripe';
      case 'paddle':return 'Paddle';
      case 'revenuecat':return 'RevenueCat';
      case 'support':return 'Служба поддержки';
      case 'developer':return 'Режим разработчика';
      default:return 'Не определён';
    }
  }
  const isNative=()=>!!(window.LotoNativeBilling&&window.LotoNativeBilling.isNative);

  function setAvatar(url){
    const img=$('acc-avatar-img'),fb=$('acc-avatar-fallback');
    const himg=$('hdr-avatar-img'),hsil=$('hdr-avatar-silhouette');
    if(url){
      if(img){img.src=url;img.hidden=false;}
      if(fb)fb.style.display='none';
      if(himg){himg.src=url;himg.hidden=false;}
      if(hsil)hsil.style.display='none';
      const rm=$('acc-avatar-remove');if(rm)rm.hidden=false;
    }else{
      if(img){img.hidden=true;img.removeAttribute('src');}
      if(fb)fb.style.display='';
      if(himg){himg.hidden=true;himg.removeAttribute('src');}
      if(hsil)hsil.style.display='';
      const rm=$('acc-avatar-remove');if(rm)rm.hidden=true;
    }
  }
  let loadedUid=null,profileCache=null;
  function applyProfile(p){
    profileCache=p||null;
    setAvatar(p&&p.avatarUrl||null);
    const name=(p&&p.displayName||'').trim();
    const nameEl=$('acc-name');if(nameEl){nameEl.textContent=name;nameEl.hidden=!name;}
    const dn=$('acc-displayname');if(dn&&document.activeElement!==dn)dn.value=name;
    const bd=$('acc-birthday');if(bd&&document.activeElement!==bd)bd.value=(p&&p.birthday||'').slice(0,10);
    maybeGreetBirthday(p);
  }
  async function loadAvatar(force){
    const {user,confirmed}=accountState();
    const uid=confirmed?user.id:null;
    if(!uid){loadedUid=null;profileCache=null;setAvatar(null);const n=$('acc-name');if(n){n.hidden=true;n.textContent='';}return;}
    if(!force&&uid===loadedUid)return; // profile already loaded for this account
    loadedUid=uid;
    try{const p=await (window.LotoAuth&&window.LotoAuth.getProfile&&window.LotoAuth.getProfile());applyProfile(p);
      // Persist the current UI locale so a future birthday greeting can be in the right language.
      try{const loc=document.documentElement.lang||'ru';if(p&&p.locale!==loc)window.LotoAuth.updateProfile({locale:loc}).catch(()=>{});}catch(_e2){}
    }catch(_e){loadedUid=null;}
  }
  // In-app birthday greeting: when the signed-in user's birthday (month+day) is today, show a
  // localized congratulation once per day. Fully client-side — no push infrastructure touched.
  function maybeGreetBirthday(p){
    try{
      const b=p&&p.birthday;if(!b)return;
      const now=new Date(),mm=String(now.getMonth()+1).padStart(2,'0'),dd=String(now.getDate()).padStart(2,'0');
      if(b.slice(5,10)!==`${mm}-${dd}`)return;
      const key='loto_bday_greeted_'+now.getFullYear();
      if(localStorage.getItem(key))return;
      localStorage.setItem(key,'1');
      // Fixed, fully-localizable strings (no name interpolation, so the i18n observer
      // translates them to the user's language).
      if(typeof showFeedback==='function')showFeedback('С днём рождения! 🎂','Пусть сегодня удача будет на вашей стороне! 🎉','🎉',7000);
    }catch(_e){}
  }
  function msg(elId,text,kind){
    const n=$(elId);if(!n)return;
    n.textContent=T(text);n.dataset.kind=kind||'info';n.hidden=!text;
  }

  function accountState(){
    const C=window.LotoCommercial;
    const access=(C&&C.access)||{};
    const user=(C&&C.user)||null;
    const confirmed=!!(user&&user.id&&user.email&&!user.isAnonymous&&user.emailConfirmed===true);
    const hasEmailPending=!!(user&&user.email&&!user.isAnonymous&&!confirmed);
    return {access,user,confirmed,hasEmailPending};
  }

  function render(){
    const {access,user,confirmed,hasEmailPending}=accountState();
    const level=access.accessLevel||'free';
    const sub=access.subscription||null;
    const isPro=level==='pro';
    const lifetime=!!(isPro&&sub&&sub.source==='owner_lifetime'&&!sub.expiresAt);

    const dot=$('hdr-profile-dot');if(dot)dot.toggleAttribute('hidden',!confirmed);

    if($('acc-email'))$('acc-email').textContent=confirmed?user.email:'';
    if($('acc-status'))$('acc-status').textContent=confirmed?'Вход выполнен'
      :hasEmailPending?'Ожидается подтверждение e-mail':'Гостевой режим · вход не требуется для Free';

    if($('acc-signin'))$('acc-signin').hidden=confirmed;
    // Surface a pending Magic-Link callback result (expired / used / failed) in the sign-in card.
    try{const am=window.LotoCommercial&&window.LotoCommercial.authMessage;
      if(am&&am.text&&!confirmed)msg('acc-auth-msg',am.text,am.kind);
    }catch(_e){}

    if($('acc-plan'))$('acc-plan').hidden=false;
    const badge=$('acc-plan-badge');
    if(badge){badge.textContent=isPro?'PRO':'FREE';badge.classList.toggle('pro',isPro);}
    if($('acc-r-authstatus'))$('acc-r-authstatus').textContent=confirmed?'Вход выполнен'
      :hasEmailPending?'E-mail не подтверждён':'Гостевой режим';
    if($('acc-r-tier'))$('acc-r-tier').textContent=lifetime?'PRO пожизненный':isPro?'PRO активен':'Бесплатный (Free)';

    const start=sub&&sub.startedAt?fmtDate(sub.startedAt):'';
    if($('acc-row-start'))$('acc-row-start').hidden=!start;
    if(start&&$('acc-r-start'))$('acc-r-start').textContent=start;

    const endRow=$('acc-row-end');
    if(endRow){
      if(isPro){endRow.hidden=false;
        $('acc-r-end').textContent=(lifetime||!sub||!sub.expiresAt)?'Без срока':fmtDate(sub.expiresAt);
      }else endRow.hidden=true;
    }
    const renewRow=$('acc-row-renew');
    if(renewRow){
      if(lifetime){renewRow.hidden=false;const rd=$('acc-r-renew');rd.textContent='Не требуется — доступ навсегда';rd.className='ok';}
      else if(isPro&&sub){renewRow.hidden=false;const rd=$('acc-r-renew');
        if(sub.willRenew){rd.textContent='Автопродление включено';rd.className='ok';}
        else{rd.textContent='Продление отключено — доступ до даты окончания';rd.className='warn';}
      }else renewRow.hidden=true;
    }
    const srcRow=$('acc-row-source');
    if(srcRow){
      if(isPro){srcRow.hidden=false;$('acc-r-source').textContent=sourceLabel(sub&&sub.source);}
      else srcRow.hidden=true;
    }

    if($('acc-manage-btn'))$('acc-manage-btn').hidden=!(confirmed&&isPro&&!lifetime);
    if($('acc-restore-btn'))$('acc-restore-btn').hidden=!(confirmed&&isNative());
    if($('acc-signout-btn'))$('acc-signout-btn').hidden=!confirmed;
    if($('acc-avatar-actions'))$('acc-avatar-actions').hidden=!confirmed;
    if($('acc-mydata'))$('acc-mydata').hidden=!confirmed;
    if(!confirmed){setAvatar(null);const n=$('acc-name');if(n){n.hidden=true;n.textContent='';}}
  }

  function avatarError(err){
    const c=String((err&&err.message)||err||'');
    if(/account_required/.test(c))return 'Войдите в аккаунт, чтобы загрузить фото.';
    if(/invalid_format/.test(c))return 'Поддерживаются только JPG, PNG или WebP.';
    if(/file_too_large/.test(c))return 'Файл слишком большой. Максимум 5 МБ.';
    return 'Не удалось сохранить фото. Попробуйте ещё раз.';
  }

  const AccountUI={
    pickAvatar(){const f=$('acc-avatar-file');if(f)f.click();},
    async onFile(e){
      const file=e.target.files&&e.target.files[0];e.target.value='';
      if(!file)return;
      const lim=(window.LotoAuth&&window.LotoAuth.avatarLimits)||{maxBytes:5242880,mimeTypes:['image/jpeg','image/png','image/webp']};
      if(!lim.mimeTypes.includes(file.type)){msg('acc-avatar-msg','Поддерживаются только JPG, PNG или WebP.','error');return;}
      if(file.size>lim.maxBytes){msg('acc-avatar-msg','Файл слишком большой. Максимум 5 МБ.','error');return;}
      if(avatarBusy)return;avatarBusy=true;
      const b=$('acc-avatar-busy');if(b)b.hidden=false;msg('acc-avatar-msg','',null);
      try{const info=await window.LotoAuth.uploadAvatar(file);setAvatar(info&&info.avatarUrl||null);msg('acc-avatar-msg','Фото профиля обновлено.','success');}
      catch(err){msg('acc-avatar-msg',avatarError(err),'error');}
      finally{avatarBusy=false;if(b)b.hidden=true;}
    },
    async removeAvatar(){
      if(avatarBusy)return;avatarBusy=true;
      const b=$('acc-avatar-busy');if(b)b.hidden=false;msg('acc-avatar-msg','',null);
      try{await window.LotoAuth.removeAvatar();setAvatar(null);msg('acc-avatar-msg','Фото профиля удалено.','success');}
      catch(err){msg('acc-avatar-msg',avatarError(err),'error');}
      finally{avatarBusy=false;if(b)b.hidden=true;}
    },
    async sendMagic(){
      if(magicSending)return;
      const input=$('acc-email-input');const email=((input&&input.value)||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg('acc-auth-msg','Введите корректный e-mail.','error');return;}
      magicSending=true;const btn=$('acc-magic-btn');if(btn)btn.disabled=true;
      msg('acc-auth-msg','Отправляем ссылку…','info');
      try{await window.LotoCommercial.sendMagicLink(email);
        msg('acc-auth-msg','Ссылка для входа отправлена на указанный e-mail. Откройте её на этом устройстве.','success');}
      catch(_err){msg('acc-auth-msg','Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз.','error');}
      finally{magicSending=false;if(btn)btn.disabled=false;}
    },
    async manage(){try{await window.LotoCommercial.accountPortal();}catch(_e){}},
    async restore(){try{await window.LotoCommercial.restorePurchase();}catch(_e){}},
    async saveData(){
      const name=(($('acc-displayname')||{}).value||'').trim().slice(0,60);
      const birthday=(($('acc-birthday')||{}).value||'').trim();
      const btn=$('acc-savedata-btn');if(btn)btn.disabled=true;
      msg('acc-data-msg','Сохраняем…','info');
      try{
        const info=await window.LotoAuth.updateProfile({displayName:name||null,birthday:birthday||null,locale:document.documentElement.lang||'ru'});
        applyProfile(info);
        msg('acc-data-msg','Данные сохранены.','success');
      }catch(err){
        const c=String((err&&err.message)||err||'');
        msg('acc-data-msg',/invalid_birthday/.test(c)?'Проверьте дату рождения.':/account_required/.test(c)?'Войдите в аккаунт, чтобы сохранить данные.':'Не удалось сохранить. Попробуйте ещё раз.','error');
      }finally{if(btn)btn.disabled=false;}
    },
    async signOut(){try{await window.LotoCommercial.signOut();setAvatar(null);profileCache=null;const n=$('acc-name');if(n){n.hidden=true;n.textContent='';}msg('acc-auth-msg','',null);msg('acc-avatar-msg','',null);msg('acc-data-msg','',null);render();}catch(_e){}},
  };
  window.AccountUI=AccountUI;

  window.openAccount=function(){
    if(window.LotoModals)window.LotoModals.openModal('account-ov');else{const el=$('account-ov');if(el)el.classList.add('show');}
    const pb=$('profile-btn');if(pb)pb.setAttribute('aria-expanded','true');
    render();loadAvatar(true);
    try{window.LotoCommercial&&window.LotoCommercial.refreshAccess&&window.LotoCommercial.refreshAccess();}catch(_e){}
  };
  window.closeAccount=function(){
    if(window.LotoModals)window.LotoModals.closeModal('account-ov');else{const el=$('account-ov');if(el)el.classList.remove('show');}
    const pb=$('profile-btn');if(pb)pb.setAttribute('aria-expanded','false');
  };

  function wire(){
    const f=$('acc-avatar-file');if(f&&!f.__wired){f.__wired=1;f.addEventListener('change',e=>AccountUI.onFile(e));}
    // Requirement 6: immediately reflect a fresh Magic-Link login / entitlement change.
    window.addEventListener('loto:accesschange',()=>{render();loadAvatar();});
    // Re-render on language switch so the localized dates follow the new locale.
    window.addEventListener('loto:languagechange',()=>render());
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
