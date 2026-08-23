(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
  const setLink=(id,value)=>{
    const node=document.getElementById(id);
    if(!node||!value)return;
    node.href=String(value);
    node.hidden=false;
  };
  setLink('safe-support',config.supportUrl);
  setLink('safe-app-store',config.appStoreUrl);
  setLink('safe-play-store',config.googlePlayUrl);

  const canonical=String(config.canonicalSiteUrl||'').trim();
  try{
    if(canonical&&!new URL(canonical).hostname.endsWith('github.io')){
      document.getElementById('safe-domain').textContent=`Официальный адрес Loto Simulator: ${canonical}`;
    }
  }catch(_error){}

  const select=document.getElementById('safe-language');
  const i18n=window.LotoI18n;
  if(!select||!i18n)return;
  for(const code of i18n.localeCodes()){
    const info=i18n.localeInfo(code);
    const option=document.createElement('option');
    option.value=code;
    option.textContent=info.flag+' '+info.name;
    select.append(option);
  }
  select.value=i18n.language;
  select.addEventListener('change',()=>{void i18n.setLanguage(select.value);});
})();
