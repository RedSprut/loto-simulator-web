(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
  // 404.html: тема приложения (светлая / тёмная / системная) — до первой отрисовки.
  if(document.documentElement.classList.contains('nf-page')){
    let mode='';
    try{mode=String(localStorage.getItem('loto_theme')||'');}catch(_error){}
    if(mode==='light'||mode==='dark')document.documentElement.dataset.theme=mode;
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
