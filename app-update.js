/* Lotto Simulator — «Доступно обновление приложения» (lazy).
 * Loaded by pwa-runtime.js only once an update is CONFIRMED: on the web, the server serves a newer
 * deploy than the page runs (build.json); in the iOS / Android app, the store holds a newer build than
 * the one installed (build.json `stores`, set by the owner once a release is live). Never for a lost
 * connection or a server error: those answer «unknown» and nothing is shown.
 *
 * One small card above the bottom navigation, never a modal: «Обновить приложение» and «Позже».
 *  · web: the new service worker is asked to take over, unsaved rows are flushed, then ONE reload.
 *    Nothing is deleted — no localStorage, IndexedDB, cookies, Cache Storage or account tokens. If the
 *    page is still behind after that reload (a cache between the browser and the site), the card shows
 *    how to reopen the site in THIS browser instead of reloading again: no reload loop.
 *  · iOS / Android: the button opens the App Store / Google Play page; the app never replaces its own
 *    code. A build below the owner's minimum says why the update is needed.
 * The copy is this module's own (17 languages), in the app's current language, re-rendered on a change.
 * Contract with pwa-runtime.js (kept stable across deploys: an old page may load a newer copy of this
 * file): window.LotoAppUpdate.show({mode:'web'|'store'|'required', target, url, platform}).
 */
(function () {
  'use strict';
  if (window.LotoAppUpdate) return;

  const STRINGS = {
    ru: {
      title: 'Доступно обновление приложения',
      stale: 'Некоторые файлы приложения устарели. Для корректной работы необходимо обновление.',
      keep: 'Ваши сохранённые комбинации и настройки останутся без изменений.',
      update: 'Обновить приложение', later: 'Позже', updating: 'Обновляем…', ok: 'Понятно',
      store: 'Вышла новая версия Lotto Simulator. Установите её из {{store}}, чтобы приложение работало корректно.',
      required: 'Эта версия приложения устарела, и часть функций может работать неправильно. Для безопасной работы установите обновление из {{store}}.',
      manualTitle: 'Не удалось обновить автоматически',
      manualMobile: 'Закройте все вкладки Lotto Simulator (или само приложение) и откройте его снова.',
      manualSafari: 'Закройте все вкладки Lotto Simulator и откройте сайт снова. Если не помогло, нажмите ⌥⌘R.',
      manualOther: 'Закройте все вкладки Lotto Simulator и откройте сайт снова. Если не помогло, нажмите Ctrl+Shift+R (на Mac — ⌘⇧R).',
      manualKeep: 'Сохранённые комбинации, настройки и вход в аккаунт при этом не удаляются.',
    },
    en: {
      title: 'App update available',
      stale: 'Some app files are out of date. An update is needed for the app to work correctly.',
      keep: 'Your saved combinations and settings will stay unchanged.',
      update: 'Update app', later: 'Later', updating: 'Updating…', ok: 'Got it',
      store: 'A new version of Lotto Simulator is available. Install it from {{store}} so the app works correctly.',
      required: 'This version of the app is out of date, and some features may not work correctly. To keep using the app safely, install the update from {{store}}.',
      manualTitle: 'The app could not be updated automatically',
      manualMobile: 'Close all Lotto Simulator tabs (or the app itself) and open it again.',
      manualSafari: 'Close all Lotto Simulator tabs and open the site again. If that does not help, press ⌥⌘R.',
      manualOther: 'Close all Lotto Simulator tabs and open the site again. If that does not help, press Ctrl+Shift+R (on a Mac, ⌘⇧R).',
      manualKeep: 'Your saved combinations, settings and sign-in are not deleted.',
    },
    no: {
      title: 'Oppdatering av appen er tilgjengelig',
      stale: 'Noen av appens filer er utdatert. En oppdatering er nødvendig for at appen skal fungere riktig.',
      keep: 'Dine lagrede kombinasjoner og innstillinger forblir uendret.',
      update: 'Oppdater appen', later: 'Senere', updating: 'Oppdaterer…', ok: 'Forstått',
      store: 'En ny versjon av Lotto Simulator er tilgjengelig. Installer den fra {{store}} slik at appen fungerer riktig.',
      required: 'Denne versjonen av appen er utdatert, og noen funksjoner fungerer kanskje ikke riktig. Installer oppdateringen fra {{store}} for å bruke appen trygt.',
      manualTitle: 'Appen kunne ikke oppdateres automatisk',
      manualMobile: 'Lukk alle faner med Lotto Simulator (eller selve appen) og åpne den igjen.',
      manualSafari: 'Lukk alle faner med Lotto Simulator og åpne nettstedet igjen. Hjelper ikke det, trykk ⌥⌘R.',
      manualOther: 'Lukk alle faner med Lotto Simulator og åpne nettstedet igjen. Hjelper ikke det, trykk Ctrl+Shift+R (på Mac: ⌘⇧R).',
      manualKeep: 'Lagrede kombinasjoner, innstillinger og innlogging slettes ikke.',
    },
    sv: {
      title: 'En uppdatering av appen finns',
      stale: 'Vissa av appens filer är inaktuella. En uppdatering behövs för att appen ska fungera korrekt.',
      keep: 'Dina sparade kombinationer och inställningar förblir oförändrade.',
      update: 'Uppdatera appen', later: 'Senare', updating: 'Uppdaterar…', ok: 'Uppfattat',
      store: 'En ny version av Lotto Simulator finns. Installera den från {{store}} så att appen fungerar korrekt.',
      required: 'Den här versionen av appen är inaktuell och vissa funktioner kanske inte fungerar korrekt. Installera uppdateringen från {{store}} för att använda appen säkert.',
      manualTitle: 'Appen kunde inte uppdateras automatiskt',
      manualMobile: 'Stäng alla flikar med Lotto Simulator (eller själva appen) och öppna den igen.',
      manualSafari: 'Stäng alla flikar med Lotto Simulator och öppna webbplatsen igen. Om det inte hjälper, tryck ⌥⌘R.',
      manualOther: 'Stäng alla flikar med Lotto Simulator och öppna webbplatsen igen. Om det inte hjälper, tryck Ctrl+Shift+R (på Mac: ⌘⇧R).',
      manualKeep: 'Dina sparade kombinationer, inställningar och din inloggning raderas inte.',
    },
    da: {
      title: 'En opdatering af appen er tilgængelig',
      stale: 'Nogle af appens filer er forældede. En opdatering er nødvendig, for at appen fungerer korrekt.',
      keep: 'Dine gemte kombinationer og indstillinger forbliver uændrede.',
      update: 'Opdater appen', later: 'Senere', updating: 'Opdaterer…', ok: 'Forstået',
      store: 'En ny version af Lotto Simulator er tilgængelig. Installer den fra {{store}}, så appen fungerer korrekt.',
      required: 'Denne version af appen er forældet, og nogle funktioner virker muligvis ikke korrekt. Installer opdateringen fra {{store}} for at bruge appen sikkert.',
      manualTitle: 'Appen kunne ikke opdateres automatisk',
      manualMobile: 'Luk alle faner med Lotto Simulator (eller selve appen), og åbn den igen.',
      manualSafari: 'Luk alle faner med Lotto Simulator, og åbn webstedet igen. Hjælper det ikke, så tryk ⌥⌘R.',
      manualOther: 'Luk alle faner med Lotto Simulator, og åbn webstedet igen. Hjælper det ikke, så tryk Ctrl+Shift+R (på Mac: ⌘⇧R).',
      manualKeep: 'Dine gemte kombinationer, indstillinger og dit login slettes ikke.',
    },
    fi: {
      title: 'Sovelluksen päivitys on saatavilla',
      stale: 'Osa sovelluksen tiedostoista on vanhentunut. Sovellus tarvitsee päivityksen toimiakseen oikein.',
      keep: 'Tallennetut yhdistelmäsi ja asetuksesi säilyvät ennallaan.',
      update: 'Päivitä sovellus', later: 'Myöhemmin', updating: 'Päivitetään…', ok: 'Selvä',
      store: 'Lotto Simulatorista on saatavilla uusi versio. Asenna päivitys sovelluskaupasta ({{store}}), jotta sovellus toimii oikein.',
      required: 'Tämä sovellusversio on vanhentunut, ja jotkin toiminnot eivät ehkä toimi oikein. Asenna päivitys sovelluskaupasta ({{store}}), jotta voit käyttää sovellusta turvallisesti.',
      manualTitle: 'Sovellusta ei voitu päivittää automaattisesti',
      manualMobile: 'Sulje kaikki Lotto Simulatorin välilehdet (tai itse sovellus) ja avaa se uudelleen.',
      manualSafari: 'Sulje kaikki Lotto Simulatorin välilehdet ja avaa sivusto uudelleen. Jos se ei auta, paina ⌥⌘R.',
      manualOther: 'Sulje kaikki Lotto Simulatorin välilehdet ja avaa sivusto uudelleen. Jos se ei auta, paina Ctrl+Shift+R (Macissa ⌘⇧R).',
      manualKeep: 'Tallennettuja yhdistelmiä, asetuksia tai kirjautumista ei poisteta.',
    },
    de: {
      title: 'App-Update verfügbar',
      stale: 'Einige Dateien der App sind veraltet. Für einen korrekten Betrieb ist ein Update erforderlich.',
      keep: 'Ihre gespeicherten Kombinationen und Einstellungen bleiben unverändert.',
      update: 'App aktualisieren', later: 'Später', updating: 'Wird aktualisiert…', ok: 'Verstanden',
      store: 'Eine neue Version von Lotto Simulator ist verfügbar. Installieren Sie sie über {{store}}, damit die App korrekt funktioniert.',
      required: 'Diese App-Version ist veraltet, und einige Funktionen arbeiten möglicherweise nicht korrekt. Installieren Sie das Update über {{store}}, um die App sicher weiter zu nutzen.',
      manualTitle: 'Die App konnte nicht automatisch aktualisiert werden',
      manualMobile: 'Schließen Sie alle Tabs von Lotto Simulator (oder die App selbst) und öffnen Sie sie erneut.',
      manualSafari: 'Schließen Sie alle Tabs von Lotto Simulator und öffnen Sie die Website erneut. Falls das nicht hilft, drücken Sie ⌥⌘R.',
      manualOther: 'Schließen Sie alle Tabs von Lotto Simulator und öffnen Sie die Website erneut. Falls das nicht hilft, drücken Sie Strg+Umschalt+R (auf dem Mac ⌘⇧R).',
      manualKeep: 'Ihre gespeicherten Kombinationen, Einstellungen und Ihre Anmeldung werden dabei nicht gelöscht.',
    },
    fr: {
      title: 'Mise à jour de l’application disponible',
      stale: 'Certains fichiers de l’application sont obsolètes. Une mise à jour est nécessaire pour qu’elle fonctionne correctement.',
      keep: 'Vos combinaisons enregistrées et vos réglages resteront inchangés.',
      update: 'Mettre à jour l’application', later: 'Plus tard', updating: 'Mise à jour…', ok: 'J’ai compris',
      store: 'Une nouvelle version de Lotto Simulator est disponible. Installez-la depuis {{store}} pour que l’application fonctionne correctement.',
      required: 'Cette version de l’application est obsolète et certaines fonctions peuvent ne pas fonctionner correctement. Pour l’utiliser en toute sécurité, installez la mise à jour depuis {{store}}.',
      manualTitle: 'La mise à jour automatique a échoué',
      manualMobile: 'Fermez tous les onglets de Lotto Simulator (ou l’application elle-même), puis rouvrez-la.',
      manualSafari: 'Fermez tous les onglets de Lotto Simulator, puis rouvrez le site. Si cela ne suffit pas, appuyez sur ⌥⌘R.',
      manualOther: 'Fermez tous les onglets de Lotto Simulator, puis rouvrez le site. Si cela ne suffit pas, appuyez sur Ctrl+Maj+R (sur Mac : ⌘⇧R).',
      manualKeep: 'Vos combinaisons enregistrées, vos réglages et votre connexion ne sont pas supprimés.',
    },
    es: {
      title: 'Actualización de la aplicación disponible',
      stale: 'Algunos archivos de la aplicación están desactualizados. Es necesario actualizarla para que funcione correctamente.',
      keep: 'Tus combinaciones guardadas y tus ajustes no cambiarán.',
      update: 'Actualizar la aplicación', later: 'Más tarde', updating: 'Actualizando…', ok: 'Entendido',
      store: 'Hay una nueva versión de Lotto Simulator. Instálala desde {{store}} para que la aplicación funcione correctamente.',
      required: 'Esta versión de la aplicación está desactualizada y algunas funciones pueden no funcionar bien. Para usarla con seguridad, instala la actualización desde {{store}}.',
      manualTitle: 'No se pudo actualizar automáticamente',
      manualMobile: 'Cierra todas las pestañas de Lotto Simulator (o la propia aplicación) y vuelve a abrirla.',
      manualSafari: 'Cierra todas las pestañas de Lotto Simulator y vuelve a abrir el sitio. Si no funciona, pulsa ⌥⌘R.',
      manualOther: 'Cierra todas las pestañas de Lotto Simulator y vuelve a abrir el sitio. Si no funciona, pulsa Ctrl+Mayús+R (en Mac, ⌘⇧R).',
      manualKeep: 'Tus combinaciones guardadas, tus ajustes y tu sesión no se borran.',
    },
    it: {
      title: 'Aggiornamento dell’app disponibile',
      stale: 'Alcuni file dell’app non sono aggiornati. Per funzionare correttamente l’app deve essere aggiornata.',
      keep: 'Le tue combinazioni salvate e le tue impostazioni resteranno invariate.',
      update: 'Aggiorna l’app', later: 'Più tardi', updating: 'Aggiornamento…', ok: 'Ho capito',
      store: 'È disponibile una nuova versione di Lotto Simulator. Installala da {{store}} perché l’app funzioni correttamente.',
      required: 'Questa versione dell’app non è più aggiornata e alcune funzioni potrebbero non funzionare correttamente. Per usarla in sicurezza, installa l’aggiornamento da {{store}}.',
      manualTitle: 'Non è stato possibile aggiornare automaticamente',
      manualMobile: 'Chiudi tutte le schede di Lotto Simulator (o l’app stessa) e riaprila.',
      manualSafari: 'Chiudi tutte le schede di Lotto Simulator e riapri il sito. Se non basta, premi ⌥⌘R.',
      manualOther: 'Chiudi tutte le schede di Lotto Simulator e riapri il sito. Se non basta, premi Ctrl+Maiusc+R (su Mac ⌘⇧R).',
      manualKeep: 'Le combinazioni salvate, le impostazioni e l’accesso non vengono eliminati.',
    },
    pt: {
      title: 'Atualização da aplicação disponível',
      stale: 'Alguns ficheiros da aplicação estão desatualizados. É necessária uma atualização para que funcione corretamente.',
      keep: 'As suas combinações guardadas e definições permanecerão inalteradas.',
      update: 'Atualizar aplicação', later: 'Mais tarde', updating: 'A atualizar…', ok: 'Entendi',
      store: 'Está disponível uma nova versão do Lotto Simulator. Instale-a na {{store}} para que a aplicação funcione corretamente.',
      required: 'Esta versão da aplicação está desatualizada e algumas funções podem não funcionar corretamente. Para a utilizar em segurança, instale a atualização na {{store}}.',
      manualTitle: 'Não foi possível atualizar automaticamente',
      manualMobile: 'Feche todos os separadores do Lotto Simulator (ou a própria aplicação) e abra-a novamente.',
      manualSafari: 'Feche todos os separadores do Lotto Simulator e abra o site novamente. Se não resultar, prima ⌥⌘R.',
      manualOther: 'Feche todos os separadores do Lotto Simulator e abra o site novamente. Se não resultar, prima Ctrl+Shift+R (no Mac, ⌘⇧R).',
      manualKeep: 'As suas combinações guardadas, definições e sessão iniciada não são eliminadas.',
    },
    pl: {
      title: 'Dostępna aktualizacja aplikacji',
      stale: 'Niektóre pliki aplikacji są nieaktualne. Aby aplikacja działała poprawnie, potrzebna jest aktualizacja.',
      keep: 'Twoje zapisane kombinacje i ustawienia pozostaną bez zmian.',
      update: 'Zaktualizuj aplikację', later: 'Później', updating: 'Aktualizowanie…', ok: 'Rozumiem',
      store: 'Dostępna jest nowa wersja Lotto Simulator. Zainstaluj ją z {{store}}, aby aplikacja działała poprawnie.',
      required: 'Ta wersja aplikacji jest nieaktualna i niektóre funkcje mogą działać niepoprawnie. Aby bezpiecznie korzystać z aplikacji, zainstaluj aktualizację z {{store}}.',
      manualTitle: 'Nie udało się zaktualizować automatycznie',
      manualMobile: 'Zamknij wszystkie karty Lotto Simulator (lub samą aplikację) i otwórz ją ponownie.',
      manualSafari: 'Zamknij wszystkie karty Lotto Simulator i otwórz stronę ponownie. Jeśli to nie pomoże, naciśnij ⌥⌘R.',
      manualOther: 'Zamknij wszystkie karty Lotto Simulator i otwórz stronę ponownie. Jeśli to nie pomoże, naciśnij Ctrl+Shift+R (na Macu ⌘⇧R).',
      manualKeep: 'Zapisane kombinacje, ustawienia i logowanie nie zostaną usunięte.',
    },
    nl: {
      title: 'App-update beschikbaar',
      stale: 'Sommige bestanden van de app zijn verouderd. Een update is nodig om de app correct te laten werken.',
      keep: 'Opgeslagen combinaties en instellingen blijven ongewijzigd.',
      update: 'App bijwerken', later: 'Later', updating: 'Bijwerken…', ok: 'Begrepen',
      store: 'Er is een nieuwe versie van Lotto Simulator beschikbaar. Installeer die via {{store}} zodat de app correct werkt.',
      required: 'Deze versie van de app is verouderd en sommige functies werken mogelijk niet correct. Installeer de update via {{store}} om de app veilig te blijven gebruiken.',
      manualTitle: 'Automatisch bijwerken is niet gelukt',
      manualMobile: 'Sluit alle tabbladen van Lotto Simulator (of de app zelf) en open hem opnieuw.',
      manualSafari: 'Sluit alle tabbladen van Lotto Simulator en open de site opnieuw. Helpt dat niet, druk dan op ⌥⌘R.',
      manualOther: 'Sluit alle tabbladen van Lotto Simulator en open de site opnieuw. Helpt dat niet, druk dan op Ctrl+Shift+R (op een Mac ⌘⇧R).',
      manualKeep: 'Opgeslagen combinaties, instellingen en de aanmelding worden niet verwijderd.',
    },
    et: {
      title: 'Rakenduse uuendus on saadaval',
      stale: 'Mõned rakenduse failid on aegunud. Rakenduse õigeks toimimiseks on vaja uuendust.',
      keep: 'Teie salvestatud kombinatsioonid ja seaded jäävad muutmata.',
      update: 'Uuendage rakendust', later: 'Hiljem', updating: 'Uuendamine…', ok: 'Selge',
      store: 'Saadaval on Lotto Simulatori uus versioon. Paigaldage see poest {{store}}, et rakendus toimiks õigesti.',
      required: 'See rakenduse versioon on aegunud ja mõned funktsioonid ei pruugi õigesti töötada. Rakenduse turvaliseks kasutamiseks paigaldage uuendus poest {{store}}.',
      manualTitle: 'Automaatne uuendamine ebaõnnestus',
      manualMobile: 'Sulgege kõik Lotto Simulatori vahelehed (või rakendus ise) ja avage see uuesti.',
      manualSafari: 'Sulgege kõik Lotto Simulatori vahelehed ja avage sait uuesti. Kui see ei aita, vajutage ⌥⌘R.',
      manualOther: 'Sulgege kõik Lotto Simulatori vahelehed ja avage sait uuesti. Kui see ei aita, vajutage Ctrl+Shift+R (Macis ⌘⇧R).',
      manualKeep: 'Salvestatud kombinatsioone, seadeid ja sisselogimist ei kustutata.',
    },
    lv: {
      title: 'Pieejams lietotnes atjauninājums',
      stale: 'Daži lietotnes faili ir novecojuši. Lai lietotne darbotos pareizi, nepieciešams atjauninājums.',
      keep: 'Jūsu saglabātās kombinācijas un iestatījumi paliks nemainīgi.',
      update: 'Atjaunināt lietotni', later: 'Vēlāk', updating: 'Atjaunina…', ok: 'Skaidrs',
      store: 'Ir pieejama jauna Lotto Simulator versija. Instalējiet to no {{store}}, lai lietotne darbotos pareizi.',
      required: 'Šī lietotnes versija ir novecojusi, un dažas funkcijas var nedarboties pareizi. Lai droši lietotu lietotni, instalējiet atjauninājumu no {{store}}.',
      manualTitle: 'Neizdevās atjaunināt automātiski',
      manualMobile: 'Aizveriet visas Lotto Simulator cilnes (vai pašu lietotni) un atveriet to vēlreiz.',
      manualSafari: 'Aizveriet visas Lotto Simulator cilnes un atveriet vietni vēlreiz. Ja tas nepalīdz, nospiediet ⌥⌘R.',
      manualOther: 'Aizveriet visas Lotto Simulator cilnes un atveriet vietni vēlreiz. Ja tas nepalīdz, nospiediet Ctrl+Shift+R (Mac datorā ⌘⇧R).',
      manualKeep: 'Saglabātās kombinācijas, iestatījumi un pieteikšanās netiek dzēsti.',
    },
    lt: {
      title: 'Galimas programėlės naujinys',
      stale: 'Kai kurie programėlės failai pasenę. Kad programėlė veiktų tinkamai, reikia ją atnaujinti.',
      keep: 'Jūsų išsaugoti deriniai ir nustatymai liks nepakeisti.',
      update: 'Atnaujinti programėlę', later: 'Vėliau', updating: 'Atnaujinama…', ok: 'Supratau',
      store: 'Išleista nauja Lotto Simulator versija. Įdiekite ją iš {{store}}, kad programėlė veiktų tinkamai.',
      required: 'Ši programėlės versija pasenusi, todėl kai kurios funkcijos gali veikti netinkamai. Kad galėtumėte saugiai naudotis programėle, įdiekite naujinį iš {{store}}.',
      manualTitle: 'Nepavyko atnaujinti automatiškai',
      manualMobile: 'Uždarykite visus Lotto Simulator skirtukus (arba pačią programėlę) ir atidarykite ją iš naujo.',
      manualSafari: 'Uždarykite visus Lotto Simulator skirtukus ir atidarykite svetainę iš naujo. Jei nepadeda, paspauskite ⌥⌘R.',
      manualOther: 'Uždarykite visus Lotto Simulator skirtukus ir atidarykite svetainę iš naujo. Jei nepadeda, paspauskite Ctrl+Shift+R (Mac kompiuteryje ⌘⇧R).',
      manualKeep: 'Išsaugoti deriniai, nustatymai ir prisijungimas nėra ištrinami.',
    },
    uk: {
      title: 'Доступне оновлення застосунку',
      stale: 'Деякі файли застосунку застаріли. Для коректної роботи потрібне оновлення.',
      keep: 'Ваші збережені комбінації та налаштування залишаться без змін.',
      update: 'Оновити застосунок', later: 'Пізніше', updating: 'Оновлюємо…', ok: 'Зрозуміло',
      store: 'Вийшла нова версія Lotto Simulator. Встановіть її з {{store}}, щоб застосунок працював коректно.',
      required: 'Ця версія застосунку застаріла, і частина функцій може працювати неправильно. Для безпечної роботи встановіть оновлення з {{store}}.',
      manualTitle: 'Не вдалося оновити автоматично',
      manualMobile: 'Закрийте всі вкладки Lotto Simulator (або сам застосунок) і відкрийте його знову.',
      manualSafari: 'Закрийте всі вкладки Lotto Simulator і відкрийте сайт знову. Якщо не допомогло, натисніть ⌥⌘R.',
      manualOther: 'Закрийте всі вкладки Lotto Simulator і відкрийте сайт знову. Якщо не допомогло, натисніть Ctrl+Shift+R (на Mac — ⌘⇧R).',
      manualKeep: 'Збережені комбінації, налаштування та вхід в обліковий запис при цьому не видаляються.',
    },
  };
  const STORE_NAME = { ios: 'App Store', android: 'Google Play' };
  // A reload that did not bring the page up to date is not repeated within this window.
  const ATTEMPT_KEY = 'loto_update_attempt', ATTEMPT_MS = 10 * 60 * 1000, LATER_KEY = 'loto_update_later';

  const lang = () => {
    let code = '';
    try { code = (window.LotoI18n && window.LotoI18n.language) || document.documentElement.lang || ''; } catch (_e) { code = ''; }
    code = String(code).toLowerCase().slice(0, 2);
    return code === 'nb' || code === 'nn' ? 'no' : STRINGS[code] ? code : 'en';
  };
  const t = (key, store) => String((STRINGS[lang()] || STRINGS.en)[key] || STRINGS.en[key] || '').replace('{{store}}', store || '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const readAttempt = () => { try { return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || 'null'); } catch (_e) { return null; } };
  const writeAttempt = (to) => { try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ to, at: Date.now() })); } catch (_e) {} };
  // The page has already been reloaded for THIS deploy and is still behind it.
  const triedFor = (target) => { const a = readAttempt(); return !!(a && target && a.to === target && Date.now() - a.at < ATTEMPT_MS); };
  // Which «reopen» advice fits the browser in hand.
  function manualKey() {
    const ua = navigator.userAgent || '';
    const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    let standalone = false;
    try { standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_e) {}
    if (standalone || touchMac || /iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return 'manualMobile';
    if (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)) return 'manualSafari';
    return 'manualOther';
  }

  function ensureStyles() {
    if (document.getElementById('lu-style')) return;
    const style = document.createElement('style');
    style.id = 'lu-style';
    style.textContent = '.lu-card{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 88px);z-index:9000;box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 120px);overflow:auto;'
      + 'padding:14px 16px 16px;border-radius:16px;border:1px solid color-mix(in srgb,var(--gold,#E9B44C) 60%,transparent);background:var(--bg2,#241220);color:var(--fg,#F6EEE4);box-shadow:0 14px 36px rgba(0,0,0,.38);'
      + 'font-family:inherit;text-align:left;animation:luIn .22s ease-out}'
      + '.lu-h{margin:0 0 6px;font-size:15px;font-weight:800;line-height:1.35;color:var(--fg,#F6EEE4)}'
      + '.lu-card p{margin:0 0 6px;font-size:13.5px;line-height:1.5;overflow-wrap:anywhere}.lu-card .lu-keep{color:var(--sub,#A58E9B)}'
      + '.lu-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'
      + '.lu-act button{flex:1 1 150px;min-height:44px;box-sizing:border-box;padding:8px 14px;border-radius:999px;font:inherit;font-size:14px;font-weight:700;line-height:1.25;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}'
      + '.lu-go{border:1px solid var(--gold,#E9B44C);background:var(--gold,#E9B44C);color:#1B0D16;box-shadow:0 0 14px color-mix(in srgb,var(--gold,#E9B44C) 40%,transparent)}'
      + '.lu-later{border:1px solid var(--border,#3D2434);background:transparent;color:var(--fg,#F6EEE4)}'
      + '.lu-act button:focus-visible{outline:2px solid var(--gold,#E9B44C);outline-offset:2px}.lu-act button:disabled{opacity:.7;cursor:progress}'
      + '@keyframes luIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}'
      + '@media (prefers-reduced-motion:reduce){.lu-card{animation:none}}';
    document.head.appendChild(style);
  }

  let card = null, state = null;
  function close() {
    if (card) card.remove();
    card = null; state = null;
  }
  function render() {
    if (!card || !state) return;
    const store = STORE_NAME[state.platform] || '';
    const manual = state.mode === 'web' && (state.manual || triedFor(state.target));
    let body;
    if (manual) body = `<p>${esc(t(manualKey()))}</p><p class="lu-keep">${esc(t('manualKeep'))}</p>`;
    else if (state.mode === 'web') body = `<p>${esc(t('stale'))}</p><p class="lu-keep">${esc(t('keep'))}</p>`;
    else body = `<p>${esc(t(state.mode === 'required' ? 'required' : 'store', store))}</p><p class="lu-keep">${esc(t('keep'))}</p>`;
    const buttons = manual
      ? `<button type="button" class="lu-later" data-lu-later>${esc(t('ok'))}</button>`
      : `<button type="button" class="lu-go" data-lu-go${state.busy ? ' disabled' : ''}>${esc(t(state.busy ? 'updating' : 'update'))}</button><button type="button" class="lu-later" data-lu-later>${esc(t('later'))}</button>`;
    card.innerHTML = `<h2 class="lu-h" id="lu-title">${esc(t(manual ? 'manualTitle' : 'title'))}</h2>${body}<div class="lu-act">${buttons}</div>`;
    card.setAttribute('lang', lang());
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // Web: let the newest service worker take over, keep the rows on screen, reload once.
  async function reloadFresh() {
    const target = state.target;
    if (triedFor(target)) { state.manual = true; render(); return; }
    state.busy = true; render();
    writeAttempt(target);
    try { if (typeof window.flushTicketNow === 'function') window.flushTicketNow(); } catch (_e) {}
    try {
      const sw = navigator.serviceWorker, registration = sw && await sw.getRegistration();
      if (registration) {
        await Promise.race([registration.update().catch(() => {}), sleep(4000)]);
        const next = registration.waiting || registration.installing;
        if (next) {
          next.postMessage({ type: 'SKIP_WAITING' });
          await Promise.race([new Promise((resolve) => sw.addEventListener('controllerchange', resolve, { once: true })), sleep(3000)]);
        }
      }
    } catch (_e) { /* the reload below still asks the network for the page first */ }
    location.reload();
  }
  // iOS / Android: the store page; the installed app is updated by the store alone.
  function openStore() {
    const url = state && state.url;
    if (!url) return;
    try { if (window.LotoLinks && window.LotoLinks.open(url)) return; } catch (_e) {}
    try { window.location.assign(url); } catch (_e) {}
  }

  function show(options) {
    const o = options || {};
    const mode = o.mode === 'store' || o.mode === 'required' ? o.mode : 'web';
    if (mode !== 'web' && !/^https:\/\/(?:apps\.apple\.com|play\.google\.com)\//.test(String(o.url || ''))) return false;
    ensureStyles();
    state = { mode, target: String(o.target || ''), url: String(o.url || ''), platform: o.platform === 'ios' || o.platform === 'android' ? o.platform : '', busy: false, manual: false };
    if (!card) {
      card = document.createElement('section');
      card.className = 'lu-card';
      card.id = 'loto-app-update';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-labelledby', 'lu-title');
      card.setAttribute('aria-live', 'polite');
      card.setAttribute('data-i18n-ignore', '');
      card.addEventListener('click', (event) => {
        // «Позже»: this update is not offered again in this session unless something actually fails.
        if (event.target.closest('[data-lu-later]')) { try { if (state && state.target) sessionStorage.setItem(LATER_KEY, state.target); } catch (_e) {} close(); return; }
        if (!event.target.closest('[data-lu-go]') || !state || state.busy) return;
        if (state.mode === 'web') reloadFresh(); else openStore();
      });
      card.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
      document.body.appendChild(card);
    }
    render();
    return true;
  }
  window.addEventListener('loto:languagechange', render);
  window.LotoAppUpdate = Object.freeze({ show, close, isOpen: () => !!card });
})();
