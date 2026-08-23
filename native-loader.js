(function(){
  try{
    if(!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()))return;
    var current=document.currentScript;
    var revision=current?new URL(current.src,window.location.href).search:'';
    var script=document.createElement('script');
    script.src='./native-bridge.js'+revision;
    script.async=false;
    document.head.appendChild(script);
  }catch(_error){}
})();
