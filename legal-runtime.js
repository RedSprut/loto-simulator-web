(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
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
  const supportUrl=String(config.supportUrl||'').trim();
  if(support&&supportUrl){support.href=supportUrl;support.hidden=false;}
})();
