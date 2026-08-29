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
  let loadedUid=null;
  async function loadAvatar(force){
    const {user,confirmed}=accountState();
    const uid=confirmed?user.id:null;
    if(!uid){loadedUid=null;setAvatar(null);return;}
    if(!force&&uid===loadedUid)return; // avatar already loaded for this account
    loadedUid=uid;
    try{const p=await (window.LotoAuth&&window.LotoAuth.getProfile&&window.LotoAuth.getProfile());setAvatar(p&&p.avatarUrl||null);}
    catch(_e){loadedUid=null;}
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
    if(!confirmed)setAvatar(null);
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
    async signOut(){try{await window.LotoCommercial.signOut();setAvatar(null);msg('acc-auth-msg','',null);msg('acc-avatar-msg','',null);render();}catch(_e){}},
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
