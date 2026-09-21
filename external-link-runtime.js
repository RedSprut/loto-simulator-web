/* Открытие ссылок «наружу» — один общий путь для веба, iOS и Android.
 *
 * Корень проблемы. Юридические ссылки (политика, условия, условия подписки, безопасная оплата)
 * размечены как <a target="_blank">, а сами страницы лежат В БАНДЛЕ приложения, то есть их адрес —
 * внутренний (capacitor://localhost/... на iOS, http://localhost/... на Android). В браузере
 * target="_blank" открывает вкладку, а в нативной оболочке такой переход пропадает:
 *   • iOS: WebViewDelegationHandler.createWebViewWith(...) отдаёт адрес UIApplication.open(...)
 *     и возвращает nil. Системе схема capacitor:// неизвестна, открыть её некому — нового окна
 *     нет, переход не происходит, ошибки тоже нет;
 *   • Android: Capacitor не включает WebSettings.setSupportMultipleWindows() и не реализует
 *     WebChromeClient.onCreateWindow(...), поэтому WebView просто отказывает в новом окне —
 *     shouldOverrideUrlLoading() даже не вызывается.
 * Причина на обеих платформах одна: не сам URL, а режим «новое окно» для внутреннего адреса.
 *
 * Решение. Один делегированный обработчик превращает такую ссылку в обычную навигацию верхнего
 * уровня, которую обе платформы обрабатывают штатно:
 *   • внутренние страницы (они физически лежат в бандле приложения) открываются в самом WebView
 *     и работают офлайн;
 *   • внешние адреса Capacitor сам отдаёт системному браузеру — навигацию верхнего уровня на
 *     чужой хост он отменяет и открывает через UIApplication.open (iOS) либо Intent (Android).
 * Отдельный нативный плагин не нужен, и одно и то же правило работает на обеих платформах.
 *
 * В вебе ничего не меняется: обработчик там не вмешивается, ссылка по-прежнему открывает вкладку.
 */
(function(){
  'use strict';

  // Страницы из бандла приложения: build-public-bundle.mjs кладёт их в public-dist, а `cap sync` —
  // в ios/App/App/public и android/app/src/main/assets/public. Их всегда открываем локально, даже
  // если конфигурация задаёт абсолютный публичный адрес: так они доступны без сети и не уводят
  // пользователя из приложения.
  const BUNDLED=new Set(['privacy.html','terms.html','subscription-terms.html','safe-payment.html']);
  // Схемы, которыми управляем мы. mailto:/tel:/itms-apps: и прочее оставляем поведению по
  // умолчанию — Capacitor отдаёт их системе сам.
  const NAVIGABLE=new Set(['http:','https:','capacitor:','ionic:','file:']);

  function isNative(){
    try{
      return Boolean(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'
        &&window.Capacitor.isNativePlatform());
    }catch(_error){return false;}
  }

  function parseUrl(href){
    try{return new URL(String(href||''),document.baseURI);}catch(_error){return null;}
  }

  function nativeHref(url){
    const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1);
    if(!BUNDLED.has(file))return url.href;
    const local=parseUrl('./'+file);
    if(!local)return url.href;
    local.search=url.search;
    local.hash=url.hash;
    return local.href;
  }

  // Программная точка входа: то же правило для кода, который раньше звал window.open(...,'_blank').
  function open(href){
    const url=parseUrl(href);
    if(!url||!NAVIGABLE.has(url.protocol))return false;
    if(!isNative()){window.open(url.href,'_blank','noopener');return true;}
    window.location.assign(nativeHref(url));
    return true;
  }

  document.addEventListener('click',event=>{
    if(!isNative()||event.defaultPrevented)return;
    // Средняя кнопка и модификаторы — это «открыть в новом окне» самой платформы, не наш случай.
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const path=typeof event.composedPath==='function'?event.composedPath():[];
    let anchor=null;
    for(const item of path){if(item instanceof Element&&item.tagName==='A'){anchor=item;break;}}
    if(!anchor&&event.target instanceof Element)anchor=event.target.closest('a');
    if(!anchor||anchor.getAttribute('target')!=='_blank')return;
    const url=parseUrl(anchor.getAttribute('href'));
    if(!url||!NAVIGABLE.has(url.protocol))return;
    // preventDefault + одна навигация: двойного перехода быть не может.
    event.preventDefault();
    window.location.assign(nativeHref(url));
  },true);

  window.LotoLinks=Object.freeze({
    isNative,
    open,
    resolve(href){const url=parseUrl(href);return url?(isNative()?nativeHref(url):url.href):'';},
  });
})();
