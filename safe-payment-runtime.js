(function(){
  'use strict';
  const config=window.LOTO_COMMERCIAL_CONFIG||{};
  const setLink=(id,value)=>{
    const node=document.getElementById(id);
    if(!node||!value)return;
    node.href=String(value);
    node.hidden=false;
  };
  // One support contact everywhere: supportUrl, else mailto: supportEmail — with the address shown.
  const supportEmail=String(config.supportEmail||'').trim();
  setLink('safe-support',String(config.supportUrl||'').trim()||(supportEmail?`mailto:${supportEmail}`:''));
  const safeSupport=document.getElementById('safe-support');
  if(safeSupport&&!safeSupport.hidden&&supportEmail&&!safeSupport.querySelector('.support-addr')){
    const addr=document.createElement('span');
    addr.className='support-addr';addr.setAttribute('data-i18n-ignore','');addr.textContent=` · ${supportEmail}`;
    safeSupport.append(addr);
  }
  setLink('safe-app-store',config.appStoreUrl);
  setLink('safe-play-store',config.googlePlayUrl);

  const canonical=String(config.canonicalSiteUrl||'').trim();
  try{
    if(canonical&&!new URL(canonical).hostname.endsWith('github.io')){
      document.getElementById('safe-domain').textContent=`Официальный адрес Lotto Simulator: ${canonical}`;
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
