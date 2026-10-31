(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
  // 404.html: тема приложения (светлая / тёмная / системная) — до первой отрисовки.
  if(document.documentElement.classList.contains('nf-page')){
    let mode='';
    try{mode=String(localStorage.getItem('loto_theme')||'');}catch(_error){}
    if(mode==='light'||mode==='dark')document.documentElement.dataset.theme=mode;
  }
  // Opened from the iOS app (?app=ios, commercial-runtime appLegalUrl): Apple sells PRO there, so the
  // web checkout (Paddle, «Безопасная оплата») is left out and the page's own links keep the mark
  // (Guideline 3.1.1). The web pages are unchanged without it.
  let iosApp=false;
  try{iosApp=new URLSearchParams(location.search).get('app')==='ios';}catch(_error){}
  if(iosApp){
    document.querySelectorAll('[data-web-checkout]').forEach(node=>{node.hidden=true;});
    document.querySelectorAll('[data-ios-app]').forEach(node=>{node.hidden=false;});
    document.querySelectorAll('.legal-nav a[href^="./"]').forEach(link=>{link.href=`${link.getAttribute('href')}?app=ios`;});
  }
  const select=document.getElementById('legal-language');
  const i18n=window.LotoI18n;
  if(select&&i18n){
    for(const code of i18n.localeCodes()){
      const info=i18n.localeInfo(code);
      const option=document.createElement('option');
      option.value=code;
      option.textContent=`${info.flag} ${info.name}`;
      select.append(option);
    }
    select.value=i18n.language;
    select.addEventListener('change',()=>{void i18n.setLanguage(select.value);});
    window.addEventListener('loto:languagechange',event=>{
      select.value=event.detail?.language||i18n.language;
    });
  }
  const support=document.getElementById('legal-support');
  const email=String(config.supportEmail||'').trim();
  const href=email?`mailto:${email}`:String(config.supportUrl||'').trim();
  if(support&&href){
    support.href=href;support.hidden=false;support.dataset.i18nIgnore='';
    const updateLabel=()=>{support.textContent=i18n?.translate('Служба поддержки')||'Служба поддержки';};
    updateLabel();window.addEventListener('loto:languagechange',updateLabel);
  }
})();
