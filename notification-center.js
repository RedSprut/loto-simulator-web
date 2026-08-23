/*
 * LotoNotifCenter — the in-app notification CENTER, bell + unread badge, settings UI and
 * system-icon badge sync. It is the read/UI layer on top of the existing LotoNotifications
 * runtime (subscriptions, preferences, OS permission, deep-link) and the existing backend
 * (notification_events + the new notification_user_state read/deleted state). No parallel
 * store: the inbox is offline-first (localStorage) AND syncs the same rows to Supabase when
 * a session + backend are available. Sender credentials never touch the client.
 */
(function () {
  'use strict';

  // ── self-contained i18n (all 17 app locales; no 1.4MB catalog rebuild needed) ──
  var LOCALES = ['ru','en','no','sv','da','fi','de','fr','es','it','pt','pl','nl','et','lv','lt','uk'];
  var S = {
    'nc.title': ['Уведомления','Notifications','Varsler','Aviseringar','Notifikationer','Ilmoitukset','Benachrichtigungen','Notifications','Notificaciones','Notifiche','Notificações','Powiadomienia','Meldingen','Teavitused','Paziņojumi','Pranešimai','Сповіщення'],
    'nc.empty': ['Нет уведомлений','No notifications','Ingen varsler','Inga aviseringar','Ingen notifikationer','Ei ilmoituksia','Keine Benachrichtigungen','Aucune notification','Sin notificaciones','Nessuna notifica','Sem notificações','Brak powiadomień','Geen meldingen','Teavitusi pole','Nav paziņojumu','Nėra pranešimų','Немає сповіщень'],
    'nc.select': ['Выбрать','Select','Velg','Välj','Vælg','Valitse','Auswählen','Sélectionner','Seleccionar','Seleziona','Selecionar','Zaznacz','Selecteren','Vali','Atlasīt','Pasirinkti','Вибрати'],
    'nc.cancel': ['Отмена','Cancel','Avbryt','Avbryt','Annuller','Peruuta','Abbrechen','Annuler','Cancelar','Annulla','Cancelar','Anuluj','Annuleren','Tühista','Atcelt','Atšaukti','Скасувати'],
    'nc.selectAll': ['Выбрать все','Select all','Velg alle','Välj alla','Vælg alle','Valitse kaikki','Alle auswählen','Tout sélectionner','Seleccionar todo','Seleziona tutto','Selecionar tudo','Zaznacz wszystko','Alles selecteren','Vali kõik','Atlasīt visu','Pasirinkti viską','Вибрати все'],
    'nc.markRead': ['Прочитано','Mark read','Merk lest','Markera läst','Markér læst','Merkitse luetuksi','Als gelesen','Marquer lu','Marcar leído','Segna letto','Marcar lido','Oznacz przeczytane','Markeer gelezen','Märgi loetuks','Atzīmēt lasītu','Žymėti skaitytu','Позначити прочитаним'],
    'nc.markUnread': ['Непрочитано','Mark unread','Merk ulest','Markera oläst','Markér ulæst','Merkitse lukemattomaksi','Als ungelesen','Marquer non lu','Marcar no leído','Segna non letto','Marcar não lido','Oznacz nieprzeczytane','Markeer ongelezen','Märgi lugemata','Atzīmēt nelasītu','Žymėti neskaitytu','Позначити непрочитаним'],
    'nc.delete': ['Удалить','Delete','Slett','Ta bort','Slet','Poista','Löschen','Supprimer','Eliminar','Elimina','Eliminar','Usuń','Verwijderen','Kustuta','Dzēst','Ištrinti','Видалити'],
    'nc.deleteAllRead': ['Удалить прочитанные','Delete read','Slett leste','Ta bort lästa','Slet læste','Poista luetut','Gelesene löschen','Supprimer les lus','Eliminar leídos','Elimina lette','Eliminar lidos','Usuń przeczytane','Verwijder gelezen','Kustuta loetud','Dzēst lasītos','Ištrinti skaitytus','Видалити прочитані'],
    'nc.confirmTitle': ['Подтверждение','Confirmation','Bekreftelse','Bekräftelse','Bekræftelse','Vahvistus','Bestätigung','Confirmation','Confirmación','Conferma','Confirmação','Potwierdzenie','Bevestiging','Kinnitus','Apstiprinājums','Patvirtinimas','Підтвердження'],
    'nc.confirmDelete': ['Удалить это уведомление?','Delete this notification?','Slette dette varselet?','Ta bort den här aviseringen?','Slet denne notifikation?','Poistetaanko tämä ilmoitus?','Diese Benachrichtigung löschen?','Supprimer cette notification ?','¿Eliminar esta notificación?','Eliminare questa notifica?','Eliminar esta notificação?','Usunąć to powiadomienie?','Deze melding verwijderen?','Kustutada see teavitus?','Dzēst šo paziņojumu?','Ištrinti šį pranešimą?','Видалити це сповіщення?'],
    'nc.confirmDeleteSelected': ['Удалить выбранные уведомления?','Delete selected notifications?','Slette valgte varsler?','Ta bort valda aviseringar?','Slet valgte notifikationer?','Poistetaanko valitut ilmoitukset?','Ausgewählte Benachrichtigungen löschen?','Supprimer les notifications sélectionnées ?','¿Eliminar las notificaciones seleccionadas?','Eliminare le notifiche selezionate?','Eliminar notificações selecionadas?','Usunąć wybrane powiadomienia?','Geselecteerde meldingen verwijderen?','Kustutada valitud teavitused?','Dzēst atlasītos paziņojumus?','Ištrinti pasirinktus pranešimus?','Видалити вибрані сповіщення?'],
    'nc.confirmDeleteRead': ['Удалить все прочитанные уведомления?','Delete all read notifications?','Slette alle leste varsler?','Ta bort alla lästa aviseringar?','Slet alle læste notifikationer?','Poistetaanko kaikki luetut ilmoitukset?','Alle gelesenen Benachrichtigungen löschen?','Supprimer toutes les notifications lues ?','¿Eliminar todas las notificaciones leídas?','Eliminare tutte le notifiche lette?','Eliminar todas as notificações lidas?','Usunąć wszystkie przeczytane powiadomienia?','Alle gelezen meldingen verwijderen?','Kustutada kõik loetud teavitused?','Dzēst visus izlasītos paziņojumus?','Ištrinti visus skaitytus pranešimus?','Видалити всі прочитані сповіщення?'],
    'nc.open': ['Открыть','Open','Åpne','Öppna','Åbn','Avaa','Öffnen','Ouvrir','Abrir','Apri','Abrir','Otwórz','Openen','Ava','Atvērt','Atverti','Відкрити'],
    'nc.selected': ['Выбрано: {0}','Selected: {0}','Valgt: {0}','Valda: {0}','Valgt: {0}','Valittu: {0}','Ausgewählt: {0}','Sélectionné : {0}','Seleccionado: {0}','Selezionati: {0}','Selecionado: {0}','Wybrano: {0}','Geselecteerd: {0}','Valitud: {0}','Atlasīts: {0}','Pasirinkta: {0}','Вибрано: {0}'],
    'nc.settings': ['Настройки уведомлений','Notification settings','Varslingsinnstillinger','Aviseringsinställningar','Notifikationsindstillinger','Ilmoitusasetukset','Benachrichtigungseinstellungen','Paramètres de notification','Ajustes de notificaciones','Impostazioni notifiche','Definições de notificações','Ustawienia powiadomień','Meldingsinstellingen','Teavituste seaded','Paziņojumu iestatījumi','Pranešimų nustatymai','Налаштування сповіщень'],
    'nc.master': ['Уведомления','Notifications','Varsler','Aviseringar','Notifikationer','Ilmoitukset','Benachrichtigungen','Notifications','Notificaciones','Notifiche','Notificações','Powiadomienia','Meldingen','Teavitused','Paziņojumi','Pranešimai','Сповіщення'],
    'nc.push': ['Системные push','System push','System-push','System-push','System-push','Järjestelmän push','System-Push','Push système','Push del sistema','Push di sistema','Push do sistema','Push systemowe','Systeem-push','Süsteemi push','Sistēmas push','Sistemos push','Системні push'],
    'nc.inapp': ['Внутри приложения','In-app','I appen','I appen','I appen','Sovelluksessa','In der App','Dans l’app','En la app','Nell’app','Na aplicação','W aplikacji','In de app','Rakenduses','Lietotnē','Programėlėje','У застосунку'],
    'nc.allLotteries': ['Все лотереи','All lotteries','Alle lotterier','Alla lotterier','Alle lotterier','Kaikki arvonnat','Alle Lotterien','Toutes les loteries','Todas las loterías','Tutte le lotterie','Todas as lotarias','Wszystkie loterie','Alle loterijen','Kõik loteriid','Visas loterijas','Visos loterijos','Усі лотереї'],
    'nc.catResults': ['Новые результаты','New results','Nye resultater','Nya resultat','Nye resultater','Uudet tulokset','Neue Ergebnisse','Nouveaux résultats','Nuevos resultados','Nuovi risultati','Novos resultados','Nowe wyniki','Nieuwe resultaten','Uued tulemused','Jauni rezultāti','Nauji rezultatai','Нові результати'],
    'nc.catJackpot': ['Изменение джекпота','Jackpot changes','Jackpot-endringer','Jackpotändringar','Jackpotændringer','Jackpot-muutokset','Jackpot-Änderungen','Changements de jackpot','Cambios de bote','Variazioni jackpot','Alterações de jackpot','Zmiany jackpota','Jackpotwijzigingen','Jackpoti muutused','Džekpota izmaiņas','Džekpoto pokyčiai','Зміни джекпоту'],
    'nc.catPrizes': ['Призы','Prizes','Premier','Priser','Præmier','Palkinnot','Preise','Prix','Premios','Premi','Prémios','Nagrody','Prijzen','Auhinnad','Balvas','Prizai','Призи'],
    'nc.catReminder': ['Напоминание о тираже','Draw reminder','Trekningspåminnelse','Dragningspåminnelse','Trækningspåmindelse','Arvontamuistutus','Ziehungserinnerung','Rappel de tirage','Recordatorio de sorteo','Promemoria estrazione','Lembrete de sorteio','Przypomnienie o losowaniu','Trekkingherinnering','Loosimise meeldetuletus','Izlozes atgādinājums','Traukimo priminimas','Нагадування про розіграш'],
    'nc.reminderTime': ['Время напоминания','Reminder time','Påminnelsestid','Påminnelsetid','Påmindelsestid','Muistutusaika','Erinnerungszeit','Heure du rappel','Hora del recordatorio','Orario promemoria','Hora do lembrete','Czas przypomnienia','Herinneringstijd','Meeldetuletuse aeg','Atgādinājuma laiks','Priminimo laikas','Час нагадування'],
    'nc.remOff': ['Выключено','Off','Av','Av','Fra','Pois','Aus','Désactivé','Desactivado','Off','Desligado','Wyłączone','Uit','Väljas','Izslēgts','Išjungta','Вимкнено'],
    'nc.rem15': ['За 15 минут','15 min before','15 min før','15 min innan','15 min før','15 min ennen','15 Min vorher','15 min avant','15 min antes','15 min prima','15 min antes','15 min przed','15 min ervoor','15 min enne','15 min pirms','15 min prieš','За 15 хвилин'],
    'nc.rem1h': ['За 1 час','1 hour before','1 time før','1 tim innan','1 time før','1 tunti ennen','1 Std vorher','1 h avant','1 h antes','1 ora prima','1 h antes','1 godz przed','1 uur ervoor','1 tund enne','1 h pirms','1 val prieš','За 1 годину'],
    'nc.rem24h': ['За 24 часа','24 hours before','24 timer før','24 tim innan','24 timer før','24 tuntia ennen','24 Std vorher','24 h avant','24 h antes','24 ore prima','24 h antes','24 godz przed','24 uur ervoor','24 tundi enne','24 h pirms','24 val prieš','За 24 години'],
    'nc.perm': ['Разрешение системы','System permission','Systemtillatelse','Systembehörighet','Systemtilladelse','Järjestelmän lupa','Systemberechtigung','Autorisation système','Permiso del sistema','Autorizzazione di sistema','Permissão do sistema','Uprawnienie systemu','Systeemtoestemming','Süsteemi luba','Sistēmas atļauja','Sistemos leidimas','Дозвіл системи'],
    'nc.permGranted': ['Разрешено','Granted','Tillatt','Tillåtet','Tilladt','Sallittu','Erlaubt','Autorisé','Permitido','Consentito','Permitido','Dozwolone','Toegestaan','Lubatud','Atļauts','Leista','Дозволено'],
    'nc.permDenied': ['Запрещено','Denied','Avvist','Nekad','Afvist','Estetty','Verweigert','Refusé','Denegado','Negato','Negado','Zabronione','Geweigerd','Keelatud','Liegts','Uždrausta','Заборонено'],
    'nc.permNot': ['Не запрошено','Not requested','Ikke forespurt','Inte begärt','Ikke anmodet','Ei pyydetty','Nicht angefragt','Non demandé','No solicitado','Non richiesto','Não solicitado','Nie zażądano','Niet aangevraagd','Pole küsitud','Nav pieprasīts','Neprašyta','Не запитано'],
    'nc.openSettings': ['Открыть настройки','Open settings','Åpne innstillinger','Öppna inställningar','Åbn indstillinger','Avaa asetukset','Einstellungen öffnen','Ouvrir les réglages','Abrir ajustes','Apri impostazioni','Abrir definições','Otwórz ustawienia','Instellingen openen','Ava seaded','Atvērt iestatījumus','Atverti nustatymus','Відкрити налаштування'],
    'nc.unread': ['{0} непрочитанных','{0} unread','{0} uleste','{0} olästa','{0} ulæste','{0} lukematonta','{0} ungelesen','{0} non lus','{0} sin leer','{0} non letti','{0} não lidas','{0} nieprzeczytane','{0} ongelezen','{0} lugemata','{0} nelasīti','{0} neskaityti','{0} непрочитаних'],
    'nc.type.upcoming_draw': ['Предстоящий розыгрыш','Upcoming draw','Kommende trekning','Kommande dragning','Kommende trækning','Tuleva arvonta','Bevorstehende Ziehung','Tirage à venir','Próximo sorteo','Estrazione imminente','Próximo sorteio','Nadchodzące losowanie','Komende trekking','Tulev loosimine','Gaidāmā izloze','Artėjantis traukimas','Майбутній розіграш'],
    'nc.type.draw_results': ['Опубликованы результаты','Results published','Resultater publisert','Resultat publicerade','Resultater offentliggjort','Tulokset julkaistu','Ergebnisse veröffentlicht','Résultats publiés','Resultados publicados','Risultati pubblicati','Resultados publicados','Wyniki opublikowane','Resultaten gepubliceerd','Tulemused avaldatud','Rezultāti publicēti','Rezultatai paskelbti','Опубліковано результати'],
    'nc.type.jackpot_update': ['Обновление джекпота','Jackpot update','Jackpot-oppdatering','Jackpotuppdatering','Jackpotopdatering','Jackpot-päivitys','Jackpot-Update','Mise à jour du jackpot','Actualización del bote','Aggiornamento jackpot','Atualização do jackpot','Aktualizacja jackpota','Jackpotupdate','Jackpoti uuendus','Džekpota atjauninājums','Džekpoto atnaujinimas','Оновлення джекпоту'],
    'nc.type.prize_breakdown': ['Распределение призов','Prize breakdown','Premiefordeling','Prisfördelning','Præmiefordeling','Palkintojakauma','Gewinnverteilung','Répartition des prix','Reparto de premios','Ripartizione premi','Distribuição de prémios','Podział nagród','Prijsverdeling','Auhindade jaotus','Balvu sadalījums','Prizų paskirstymas','Розподіл призів'],
    'nc.type.saved_ticket_results': ['Проверка моих рядов','My rows checked','Mine rekker sjekket','Mina rader kontrollerade','Mine rækker kontrolleret','Omat rivit tarkistettu','Meine Reihen geprüft','Mes lignes vérifiées','Mis filas comprobadas','Le mie righe controllate','As minhas linhas verificadas','Moje rzędy sprawdzone','Mijn rijen gecontroleerd','Minu read kontrollitud','Manas rindas pārbaudītas','Mano eilutės patikrintos','Мої рядки перевірено'],
    'nc.type.system_message': ['Системное сообщение','System message','Systemmelding','Systemmeddelande','Systemmeddelelse','Järjestelmäviesti','Systemmeldung','Message système','Mensaje del sistema','Messaggio di sistema','Mensagem do sistema','Komunikat systemowy','Systeembericht','Süsteemiteade','Sistēmas ziņojums','Sistemos pranešimas','Системне повідомлення'],
    'nc.noData': ['Данные ещё не получены.','Data has not been received yet.','Data er ikke mottatt ennå.','Data har inte tagits emot ännu.','Data er ikke modtaget endnu.','Tietoja ei ole vielä saatu.','Daten wurden noch nicht empfangen.','Les données ne sont pas encore reçues.','Los datos aún no se han recibido.','I dati non sono ancora stati ricevuti.','Os dados ainda não foram recebidos.','Dane nie zostały jeszcze odebrane.','Gegevens zijn nog niet ontvangen.','Andmeid pole veel saadud.','Dati vēl nav saņemti.','Duomenys dar negauti.','Дані ще не отримано.'],
    'nc.details': ['Подробности','Details','Detaljer','Detaljer','Detaljer','Tiedot','Details','Détails','Detalles','Dettagli','Detalhes','Szczegóły','Details','Üksikasjad','Detaļas','Išsami informacija','Подробиці'],
    'nc.view': ['Посмотреть','View','Vis','Visa','Vis','Näytä','Ansehen','Voir','Ver','Vedi','Ver','Zobacz','Bekijken','Vaata','Skatīt','Peržiūrėti','Переглянути'],
    'nc.drawDate': ['Дата тиража','Draw date','Trekningsdato','Dragningsdatum','Trækningsdato','Arvontapäivä','Ziehungsdatum','Date du tirage','Fecha del sorteo','Data estrazione','Data do sorteio','Data losowania','Trekkingsdatum','Loosimise kuupäev','Izlozes datums','Traukimo data','Дата тиражу'],
    'nc.localTime': ['Местное время','Local time','Lokal tid','Lokal tid','Lokal tid','Paikallinen aika','Ortszeit','Heure locale','Hora local','Ora locale','Hora local','Czas lokalny','Lokale tijd','Kohalik aeg','Vietējais laiks','Vietos laikas','Місцевий час'],
    'nc.currentJackpot': ['Текущий джекпот','Current jackpot','Gjeldende jackpot','Aktuell jackpot','Aktuel jackpot','Nykyinen jackpot','Aktueller Jackpot','Jackpot actuel','Bote actual','Jackpot attuale','Jackpot atual','Aktualny jackpot','Huidige jackpot','Praegune jackpot','Pašreizējais džekpots','Dabartinis džekpotas','Поточний джекпот'],
    'nc.nextJackpot': ['Следующий джекпот','Next jackpot','Neste jackpot','Nästa jackpot','Næste jackpot','Seuraava jackpot','Nächster Jackpot','Prochain jackpot','Próximo bote','Prossimo jackpot','Próximo jackpot','Następny jackpot','Volgende jackpot','Järgmine jackpot','Nākamais džekpots','Kitas džekpotas','Наступний джекпот'],
    'nc.numbers': ['Числа','Numbers','Tall','Nummer','Tal','Numerot','Zahlen','Numéros','Números','Numeri','Números','Liczby','Nummers','Numbrid','Skaitļi','Skaičiai','Числа'],
    'nc.summary': ['Итог','Summary','Oppsummering','Sammanfattning','Resumé','Yhteenveto','Zusammenfassung','Résumé','Resumen','Riepilogo','Resumo','Podsumowanie','Samenvatting','Kokkuvõte','Kopsavilkums','Santrauka','Підсумок'],
    'nc.prizeCat': ['Категория','Category','Kategori','Kategori','Kategori','Luokka','Kategorie','Catégorie','Categoría','Categoria','Categoria','Kategoria','Categorie','Kategooria','Kategorija','Kategorija','Категорія'],
    'nc.winners': ['Победителей','Winners','Vinnere','Vinnare','Vindere','Voittajia','Gewinner','Gagnants','Ganadores','Vincitori','Vencedores','Zwycięzcy','Winnaars','Võitjaid','Uzvarētāji','Laimėtojai','Переможців'],
    'nc.payout': ['Выплата одному','Payout per winner','Premie per vinner','Utbetalning per vinnare','Udbetaling pr. vinder','Voitto per voittaja','Auszahlung pro Gewinner','Gain par gagnant','Pago por ganador','Premio per vincitore','Prémio por vencedor','Wypłata na zwycięzcę','Uitbetaling per winnaar','Väljamakse võitja kohta','Izmaksa uzvarētājam','Išmoka laimėtojui','Виплата одному'],
    'nc.jackpotWon': ['Джекпот выигран','Jackpot won','Jackpot vunnet','Jackpot vunnen','Jackpot vundet','Jackpot voitettu','Jackpot gewonnen','Jackpot remporté','Bote ganado','Jackpot vinto','Jackpot ganho','Jackpot wygrany','Jackpot gewonnen','Jackpot võidetud','Džekpots laimēts','Džekpotas laimėtas','Джекпот виграно'],
    'nc.jackpotRolled': ['Джекпот перенесён','Jackpot rolled over','Jackpot overført','Jackpot överförd','Jackpot overført','Jackpot siirtyi','Jackpot übertragen','Jackpot reporté','Bote acumulado','Jackpot rinviato','Jackpot acumulado','Jackpot przechodzi dalej','Jackpot doorgeschoven','Jackpot kandus edasi','Džekpots pārcelts','Džekpotas perkeltas','Джекпот перенесено'],
    'nc.system': ['Важно','Important','Viktig','Viktigt','Vigtigt','Tärkeää','Wichtig','Important','Importante','Importante','Importante','Ważne','Belangrijk','Tähtis','Svarīgi','Svarbu','Важливо']
  };
  function locale() {
    try { return (localStorage.getItem('loto_lang') || document.documentElement.lang || 'ru').slice(0, 2).toLowerCase(); } catch (e) { return 'ru'; }
  }
  function t(key, a) {
    var row = S[key]; if (!row) return key;
    var i = LOCALES.indexOf(locale()); if (i < 0) i = 1;
    var s = row[i] || row[1] || row[0];
    return a == null ? s : s.replace('{0}', String(a));
  }

  // ── per-lottery presentation (order + gradient); names come from window.LOTS ──
  var GAMES = {
    lotto:        { grad: ['#CC2060', '#7A0E2B'] },
    viking:       { grad: ['#2A4BD8', '#0FBFA6'] },
    euro:         { grad: ['#0E7A50', '#123A44'] },
    powerball:    { grad: ['#B5162B', '#12327E'] },
    mega:         { grad: ['#C09018', '#124A7E'] },
    euromillions: { grad: ['#123C8E', '#6C1E8E'] },
    superenalotto:{ grad: ['#0E7A3C', '#B5162B'] },
    lottomax:     { grad: ['#C4182F', '#5E0C22'] },
    powerballau:  { grad: ['#5A2AC8', '#B5169E'] }
  };
  var GAME_ORDER = ['euro','lotto','viking','powerball','mega','euromillions','superenalotto','lottomax','powerballau'];
  var GAME_NAMES = {
    lotto:'Lotto', viking:'Vikinglotto', euro:'Eurojackpot', powerball:'Powerball',
    mega:'Mega Millions', euromillions:'EuroMillions', superenalotto:'SuperEnalotto',
    lottomax:'Lotto Max', powerballau:'Powerball Australia'
  };
  var TYPE_ALIAS = {
    draw_result:'draw_results', jackpot_updated:'jackpot_update', jackpot_updates:'jackpot_update',
    deadline_reminder:'upcoming_draw', deadline_reminders:'upcoming_draw',
    prize_breakdowns:'prize_breakdown', payout_breakdown:'prize_breakdown',
    saved_ticket_result:'saved_ticket_results', important_system:'system_message'
  };
  var DEST = {
    draw_results: 'ana', saved_ticket_results: 'chk', jackpot_update: 'sim',
    upcoming_draw: 'sim', prize_breakdown: 'ana', system_message: 'sim'
  };
  var SERVER_PREF = { jackpot_update: 'jackpot_updates', upcoming_draw: 'deadline_reminders' };
  function eventType(v) { v = String(v || 'draw_results'); return TYPE_ALIAS[v] || v; }
  function prefType(v) { return SERVER_PREF[eventType(v)] || eventType(v); }
  function gameName(id) { try { var L = window.LOTS && window.LOTS[id]; if (L && (L.short || L.name)) return L.short || L.name; } catch (e) {} return GAME_NAMES[id] || ''; }
  function grad(id) { var g = (GAMES[id] || {}).grad || ['#8a6b2e', '#4a3210']; return 'linear-gradient(135deg,' + g[0] + ',' + g[1] + ')'; }
  function fmtDate(iso, opts) {
    try { return new Date(iso).toLocaleString(locale(), opts || { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; }
  }
  function fmtMoney(value, currency) {
    if (value == null || value === '') return '';
    var n = Number(value);
    try {
      if (Number.isFinite(n) && currency) return new Intl.NumberFormat(locale(), { style: 'currency', currency: String(currency), maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
      if (Number.isFinite(n)) return new Intl.NumberFormat(locale()).format(n);
    } catch (e) {}
    return String(value) + (currency ? ' ' + currency : '');
  }
  function joinNums(a) { return Array.isArray(a) && a.length ? a.map(String).join(', ') : ''; }
  function firstArray() {
    for (var i = 0; i < arguments.length; i++) if (Array.isArray(arguments[i]) && arguments[i].length) return arguments[i];
    return [];
  }
  function payload(it) { return (it && it.payload && typeof it.payload === 'object') ? it.payload : {}; }
  function titleFor(it) {
    var p = payload(it), type = eventType(it.eventType), lot = gameName(it.lotteryId);
    if (p.title) return String(p.title);
    if (it.title && !looksLegacyTitle(it.title, it.lotteryId)) return it.title;
    return (lot ? lot + ': ' : '') + t('nc.type.' + type);
  }
  function bodyFor(it) {
    var p = payload(it), type = eventType(it.eventType);
    if (p.body) return String(p.body);
    if (it.body && !looksLegacyBody(it.body, it.lotteryId)) return it.body;
    if (type === 'upcoming_draw') return compactParts([dateValue(p.drawDate || p.date), p.localTime || p.time, moneyValue(p.currentJackpot || p.jackpot, p.currency)]).join(' · ') || t('nc.noData');
    if (type === 'draw_results' || type === 'saved_ticket_results') {
      var nums = numbersText(p);
      return compactParts([dateValue(p.drawDate || it.drawId), nums, p.summary]).join(' · ') || t('nc.noData');
    }
    if (type === 'jackpot_update') return compactParts([jackpotStatus(p), moneyValue(p.amount || p.jackpot, p.currency), p.nextJackpot ? t('nc.nextJackpot') + ': ' + moneyValue(p.nextJackpot, p.currency) : '']).join(' · ') || t('nc.noData');
    if (type === 'prize_breakdown') return compactParts([dateValue(p.drawDate || it.drawId), prizeRows(p).length ? t('nc.prizeCat') + ': ' + prizeRows(p).length : '']).join(' · ') || t('nc.noData');
    if (type === 'system_message') return p.summary || it.body || t('nc.system');
    return it.body || t('nc.noData');
  }
  function compactParts(a) { return a.filter(function (x) { return x != null && String(x).trim(); }).map(String); }
  function dateValue(v) { return v ? fmtDate(v, String(v).length <= 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function moneyValue(v, c) { return fmtMoney(v, c || ''); }
  function numbersText(p) {
    var main = firstArray(p.mainNumbers, p.main, p.numbers, p.result && p.result.mainNumbers);
    var bonus = firstArray(p.bonusNumbers, p.specialNumbers, p.bonus, p.result && p.result.bonusNumbers);
    var m = joinNums(main), b = joinNums(bonus);
    return m ? (b ? m + ' + ' + b : m) : '';
  }
  function jackpotStatus(p) {
    if (p.won === true || Number(p.winners) > 0) return t('nc.jackpotWon');
    if (p.won === false || p.rolledOver === true) return t('nc.jackpotRolled');
    return '';
  }
  function prizeRows(p) {
    var rows = firstArray(p.prizeTiers, p.payoutTiers, p.prizes, p.tiers);
    return rows.map(function (r) {
      return {
        category: r.category || r.match || r.label || r.tier || r.name || '',
        winners: r.winners ?? r.winnerCount ?? r.count ?? '',
        payout: r.payout ?? r.prize ?? r.amount ?? r.value ?? '',
        currency: r.currency || p.currency || ''
      };
    }).filter(function (r) { return r.category || r.winners !== '' || r.payout !== ''; });
  }
  function looksLegacyTitle(s, lot) { return String(s || '').trim().toLowerCase() === String(lot || '').trim().toLowerCase(); }
  function looksLegacyBody(s, lot) {
    var v = String(s || '').trim().toLowerCase();
    return !v || v === String(lot || '').toLowerCase() || /^[a-z0-9_-]+\s*[·-]\s*\d{4}-\d{2}-\d{2}$/i.test(v);
  }
  function meaningful(it) {
    if (!it || !it.id) return false;
    var p = payload(it), type = eventType(it.eventType);
    if (type === 'system_message') return !!(p.title || p.body || it.title || it.body);
    if (!it.lotteryId && type !== 'system_message') return false;
    if (p.title || p.body || p.drawDate || p.date || p.currentJackpot || p.jackpot || p.nextJackpot || numbersText(p) || prizeRows(p).length) return true;
    return !(looksLegacyTitle(it.title, it.lotteryId) && looksLegacyBody(it.body, it.lotteryId));
  }
  function eventKey(it) { return [eventType(it.eventType), it.lotteryId || '', it.drawId || payload(it).drawDate || payload(it).date || it.id].join(':'); }

  // ── offline-first inbox store (persists locally; syncs to Supabase when possible) ──
  var ITEMS_KEY = 'loto_notif_items_v1';    // cached messages {id,lotteryId,eventType,title,body,createdAt,deeplink}
  var STATE_KEY = 'loto_notif_state_v1';    // per-message {id: {read, deleted}}
  var items = [], stateMap = {}, listeners = [];
  function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function loadLocal() { items = readLS(ITEMS_KEY, []); stateMap = readLS(STATE_KEY, {}); }
  function persist() { writeLS(ITEMS_KEY, items); writeLS(STATE_KEY, stateMap); }

  // Client-only UI prefs not modelled server-side: the push-vs-in-app split and the
  // reminder lead time. Persist locally so they survive restarts; the shared master /
  // categories / lotteries stay authoritative in LotoNotifications + the backend.
  var UI_KEY = 'loto_notif_ui_v1';
  function uiPrefs() { return readLS(UI_KEY, { push: true, inapp: true, reminderLead: 'off' }); }
  function setUiPref(k, v) { var u = uiPrefs(); u[k] = v; writeLS(UI_KEY, u); emit(); }

  function prefs() { try { return (window.LotoNotifications && window.LotoNotifications.getState().prefs) || null; } catch (e) { return null; } }
  function matchesPrefs(it) {
    var p = prefs(); if (!p) return true;
    var pt = prefType(it.eventType);
    var catOk = pt === 'jackpot_updates' ? p.jackpot_updates
      : pt === 'deadline_reminders' ? p.deadline_reminders
      : pt === 'saved_ticket_results' ? p.saved_ticket_results
      : pt === 'prize_breakdown' ? (p.prize_breakdown !== false)
      : pt === 'system_message' ? true : p.draw_results;
    var sel = p.selected_lotteries || [];
    var lotOk = !sel.length || !it.lotteryId || sel.indexOf(it.lotteryId) >= 0;
    return catOk && lotOk;
  }
  function isDeleted(id) { return !!(stateMap[id] && stateMap[id].deleted); }
  function isRead(id) { return !!(stateMap[id] && stateMap[id].read); }
  /** Visible list: not deleted, matching the user's filters, newest first. */
  function list() {
    var seen = {};
    return items.filter(function (it) {
        if (!meaningful(it) || isDeleted(it.id) || !matchesPrefs(it)) return false;
        var k = eventKey(it); if (seen[k]) return false; seen[k] = true; return true;
      })
      .sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); })
      .map(function (it) { return Object.assign({}, it, { read: isRead(it.id) }); });
  }
  function unreadCount() { return list().filter(function (it) { return !it.read; }).length; }

  function setState(ids, patch) {
    ids.forEach(function (id) { stateMap[id] = Object.assign({}, stateMap[id], patch); });
    persist(); emit(); syncStateToBackend(ids, patch);
  }
  function markRead(ids, read) { setState(ids, { read: read }); }
  function del(ids) { setState(ids, { deleted: true }); }
  function askDelete(message) {
    if (typeof window.customConfirm === 'function') return window.customConfirm(message, t('nc.delete'), { title: t('nc.confirmTitle'), cancelLabel: t('nc.cancel') });
    return Promise.resolve(window.confirm ? window.confirm(message) : false);
  }
  async function deleteAllRead() {
    var ids = list().filter(function (it) { return it.read; }).map(function (it) { return it.id; });
    if (ids.length && await askDelete(t('nc.confirmDeleteRead'))) del(ids);
  }

  /** Add a message locally (from a push receipt or a fixture). Deduped by id. */
  function add(msg) {
    if (!msg || !msg.id) return;
    msg.eventType = eventType(msg.eventType);
    if (!meaningful(msg)) return;
    var key = eventKey(msg);
    var existing = items.find(function (x) { return x.id === msg.id || eventKey(x) === key; });
    var next = { id: String(existing ? existing.id : msg.id), lotteryId: msg.lotteryId || null, eventType: msg.eventType || 'draw_results',
      drawId: msg.drawId || payload(msg).drawDate || payload(msg).date || null,
      title: msg.title || '', body: msg.body || '', createdAt: msg.createdAt || new Date().toISOString(), deeplink: msg.deeplink || null,
      payload: msg.payload && typeof msg.payload === 'object' ? msg.payload : {} };
    if (existing) Object.assign(existing, next);
    else items.unshift(next);
    persist(); emit();
  }
  function seed(arr) { (arr || []).forEach(add); }

  function emit() { var u = uiPrefs().inapp ? unreadCount() : 0; updateBadges(u); listeners.forEach(function (fn) { try { fn(u); } catch (e) {} }); if (panel && !panel.classList.contains('hidden')) render(); }
  function onChange(fn) { if (typeof fn === 'function') { listeners.push(fn); fn(unreadCount()); } }

  // ── badges: header bell + system app icon (Badging API / native) ──
  function updateBadges(n) {
    var badge = document.getElementById('bell-badge');
    if (badge) { if (n > 0) { badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = false; } else { badge.hidden = true; } }
    var bell = document.getElementById('bell-btn'); if (bell) bell.setAttribute('aria-label', t('nc.title') + (n ? ' · ' + t('nc.unread', n) : ''));
    // System icon badge — only where the platform genuinely supports it; never a fake badge.
    try {
      if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge && navigator.clearAppBadge(); }
      var c = window.Capacitor, plug = c && c.Plugins && (c.Plugins.Badge || c.Plugins.PushNotifications);
      if (c && c.Plugins && c.Plugins.Badge) { if (n > 0) c.Plugins.Badge.set({ count: n }); else c.Plugins.Badge.clear && c.Plugins.Badge.clear(); }
    } catch (e) {}
  }

  // ── backend sync (best-effort; reuses LotoNotifications' Supabase session) ──
  function cfg() { return window.LOTO_COMMERCIAL_CONFIG || {}; }
  async function jwt() { try { var s = window.LotoAuth && window.LotoAuth.ready ? await window.LotoAuth.getSession() : null; return s && s.access_token || ''; } catch (e) { return ''; } }
  async function rpc(fn, body) {
    var c = cfg(); if (!c.supabaseUrl || !c.supabasePublishableKey) return null;
    var tok = await jwt(); if (!tok) return null;
    var res = await fetch(String(c.supabaseUrl).replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.supabasePublishableKey, Authorization: 'Bearer ' + tok },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('rpc ' + fn + ' ' + res.status);
    return res.json().catch(function () { return null; });
  }
  async function syncFromBackend() {
    try {
      var rows = await rpc('list_notifications', { p_limit: 200 });
      if (!Array.isArray(rows)) return;
      rows.forEach(function (r) {
        var p = r.payload || {};
        add({ id: r.id, lotteryId: r.lottery_id, eventType: r.notification_type, drawId: r.draw_id || p.drawId || p.drawDate || null,
          title: p.title || '', body: p.body || '', payload: p,
          createdAt: r.created_at, deeplink: p.deeplink || p.deepLink || null });
        stateMap[r.id] = Object.assign({}, stateMap[r.id], { read: !!r.read });
      });
      persist(); emit();
    } catch (e) {}
  }
  function syncStateToBackend(ids, patch) {
    (async function () {
      try {
        if ('read' in patch) await rpc('set_notifications_read', { p_ids: ids, p_read: !!patch.read });
        if (patch.deleted) await rpc('delete_notifications', { p_ids: ids });
      } catch (e) {}
    })();
  }

  // ── deep-link: open the right lottery + section, then mark read ──
  function openItem(it) {
    markRead([it.id], true);
    try { if (it.lotteryId && window.selLot) window.selLot(it.lotteryId); } catch (e) {}
    try {
      if (window.LotoNotifications && window.LotoNotifications._routeDeepLink && it.deeplink) { window.LotoNotifications._routeDeepLink(it.deeplink); }
      else if (window.selPage) window.selPage(DEST[it.eventType] || 'sim');
    } catch (e) {}
    close();
  }
  function showDetail(it) {
    markRead([it.id], true);
    try { if (it.lotteryId && window.selLot) window.selLot(it.lotteryId); } catch (e) {}
    ensurePanel();
    var old = panel.querySelector('.lnc-detail');
    if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'lnc-detail';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="lnc-detail-card">' +
      '<div class="lnc-detail-head"><div><div class="lnc-detail-kicker">' + escapeHtml(gameName(it.lotteryId) || t('nc.system')) + '</div><h4>' + escapeHtml(titleFor(it)) + '</h4></div>' +
      '<button type="button" class="lnc-close" data-dclose aria-label="' + t('nc.cancel') + '">✕</button></div>' +
      '<div class="lnc-detail-body">' + detailHtml(it) + '</div>' +
      '<div class="lnc-detail-actions"><button type="button" class="lnc-tbtn" data-dview>' + t('nc.view') + '</button><button type="button" class="lnc-tbtn" data-dclose2>' + t('nc.cancel') + '</button></div>' +
      '</div>';
    panel.appendChild(d);
    d.querySelector('[data-dclose]').onclick = function () { d.remove(); };
    d.querySelector('[data-dclose2]').onclick = function () { d.remove(); };
    d.querySelector('[data-dview]').onclick = function () { d.remove(); openItem(it); };
    d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
  }
  function detailRow(label, value) {
    if (value == null || String(value).trim() === '') return '';
    return '<div class="lnc-detail-row"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(value) + '</b></div>';
  }
  function detailHtml(it) {
    var p = payload(it), type = eventType(it.eventType), html = '';
    html += '<p class="lnc-detail-summary">' + escapeHtml(bodyFor(it)) + '</p>';
    if (type === 'upcoming_draw') {
      html += detailRow(t('nc.drawDate'), dateValue(p.drawDate || p.date || it.drawId));
      html += detailRow(t('nc.localTime'), p.localTime || p.time || '');
      html += detailRow(t('nc.currentJackpot'), moneyValue(p.currentJackpot || p.jackpot, p.currency));
    } else if (type === 'draw_results' || type === 'saved_ticket_results') {
      html += detailRow(t('nc.drawDate'), dateValue(p.drawDate || p.date || it.drawId));
      html += detailRow(t('nc.numbers'), numbersText(p));
      html += detailRow(t('nc.summary'), p.summary || '');
    } else if (type === 'jackpot_update') {
      html += detailRow(t('nc.summary'), jackpotStatus(p));
      html += detailRow(t('nc.winners'), p.winners);
      html += detailRow(t('nc.currentJackpot'), moneyValue(p.amount || p.jackpot, p.currency));
      html += detailRow(t('nc.nextJackpot'), moneyValue(p.nextJackpot, p.currency));
    } else if (type === 'prize_breakdown') {
      html += detailRow(t('nc.drawDate'), dateValue(p.drawDate || p.date || it.drawId));
      html += prizeTable(p);
    } else if (type === 'system_message') {
      html += detailRow(t('nc.summary'), p.summary || p.body || it.body || '');
    }
    if (!/<(div|table)\b/.test(html.replace(/<p[^>]*>[\s\S]*?<\/p>/g, ''))) html += '<p class="lnc-empty">' + escapeHtml(t('nc.noData')) + '</p>';
    return html;
  }
  function prizeTable(p) {
    var rows = prizeRows(p);
    if (!rows.length) return '<p class="lnc-empty">' + escapeHtml(t('nc.noData')) + '</p>';
    return '<div class="lnc-table-wrap"><table class="lnc-table"><thead><tr><th>' + t('nc.prizeCat') + '</th><th>' + t('nc.winners') + '</th><th>' + t('nc.payout') + '</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + escapeHtml(r.category || t('nc.noData')) + '</td><td>' + escapeHtml(r.winners === '' ? t('nc.noData') : r.winners) + '</td><td>' + escapeHtml(r.payout === '' ? t('nc.noData') : moneyValue(r.payout, r.currency)) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  // ── panel (bottom sheet): built lazily ──
  var panel = null, selMode = false, selected = {}, popH = null, escH = null, startY = 0;
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'lnc-ov hidden';
    panel.innerHTML =
      '<div class="lnc-sheet" role="dialog" aria-modal="true" aria-label="' + t('nc.title') + '">' +
      '  <div class="lnc-grip" data-grip></div>' +
      '  <div class="lnc-head">' +
      '    <h3 class="lnc-title"></h3>' +
      '    <div class="lnc-head-actions">' +
      '      <button type="button" class="lnc-tbtn" data-sel></button>' +
      '      <button type="button" class="lnc-tbtn" data-gear aria-label="' + t('nc.settings') + '">⚙️</button>' +
      '      <button type="button" class="lnc-close" data-close aria-label="' + t('nc.cancel') + '">✕</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="lnc-selbar" data-selbar hidden>' +
      '    <button type="button" class="lnc-tbtn" data-selall></button>' +
      '    <span class="lnc-selcount" data-selcount aria-live="polite"></span>' +
      '    <button type="button" class="lnc-tbtn" data-bulkread></button>' +
      '    <button type="button" class="lnc-tbtn" data-bulkunread></button>' +
      '    <button type="button" class="lnc-tbtn danger" data-bulkdel></button>' +
      '  </div>' +
      '  <div class="lnc-list" data-list></div>' +
      '  <div class="lnc-foot"><button type="button" class="lnc-tbtn" data-delread></button></div>' +
      '  <div class="lnc-settings hidden" data-settings></div>' +
      '</div>';
    document.body.appendChild(panel);
    panel.querySelector('[data-close]').onclick = close;
    panel.querySelector('[data-sel]').onclick = toggleSelMode;
    panel.querySelector('[data-gear]').onclick = toggleSettings;
    panel.querySelector('[data-selall]').onclick = selectAll;
    panel.querySelector('[data-bulkread]').onclick = function () { bulk(function (ids) { markRead(ids, true); }); };
    panel.querySelector('[data-bulkunread]').onclick = function () { bulk(function (ids) { markRead(ids, false); }); };
    panel.querySelector('[data-bulkdel]').onclick = function () { bulk(async function (ids) { if (!await askDelete(t('nc.confirmDeleteSelected'))) return false; del(ids); return true; }); };
    panel.querySelector('[data-delread]').onclick = deleteAllRead;
    panel.addEventListener('click', function (e) { if (e.target === panel) close(); });
    // swipe-down to close
    var grip = panel.querySelector('[data-grip]');
    grip.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
    grip.addEventListener('touchmove', function (e) { if (e.touches[0].clientY - startY > 70) close(); }, { passive: true });
  }

  function render() {
    ensurePanel();
    panel.querySelector('.lnc-title').textContent = selMode ? t('nc.selected', Object.keys(selected).length) : t('nc.title');
    panel.querySelector('[data-sel]').textContent = selMode ? t('nc.cancel') : t('nc.select');
    panel.querySelector('[data-selall]').textContent = t('nc.selectAll');
    panel.querySelector('[data-bulkread]').textContent = t('nc.markRead');
    panel.querySelector('[data-bulkunread]').textContent = t('nc.markUnread');
    panel.querySelector('[data-bulkdel]').textContent = t('nc.delete');
    panel.querySelector('[data-delread]').textContent = t('nc.deleteAllRead');
    panel.querySelector('[data-selbar]').hidden = !selMode;
    panel.querySelector('[data-selcount]').textContent = t('nc.selected', Object.keys(selected).length);

    var listEl = panel.querySelector('[data-list]');
    listEl.innerHTML = '';
    var data = list();
    if (!data.length) {
      var e = document.createElement('p'); e.className = 'lnc-empty'; e.textContent = t('nc.empty'); listEl.appendChild(e);
      return;
    }
    data.forEach(function (it) { listEl.appendChild(card(it)); });
  }

  function card(it) {
    var el = document.createElement('div');
    el.className = 'lnc-card' + (it.read ? ' read' : '');
    el.style.setProperty('--lnc-grad', grad(it.lotteryId));
    var displayTitle = titleFor(it);
    var displayBody = bodyFor(it);
    var head =
      '<div class="lnc-card-top">' +
      (selMode ? '<input type="checkbox" class="lnc-check" ' + (selected[it.id] ? 'checked' : '') + ' aria-label="' + escapeHtml(displayTitle) + '">' : '') +
      '<span class="lnc-lot">' + escapeHtml(gameName(it.lotteryId)) + '</span>' +
      '<span class="lnc-kind">' + escapeHtml(t('nc.type.' + eventType(it.eventType))) + '</span>' +
      '<span class="lnc-dot" ' + (it.read ? 'hidden' : '') + '></span>' +
      '<span class="lnc-time">' + escapeHtml(fmtDate(it.createdAt)) + '</span>' +
      '</div>';
    el.innerHTML = head +
      '<div class="lnc-card-title">' + escapeHtml(displayTitle) + '</div>' +
      '<div class="lnc-card-body">' + escapeHtml(displayBody) + '</div>' +
      '<div class="lnc-card-actions">' +
      '<button type="button" class="lnc-abtn" data-open>' + t('nc.details') + '</button>' +
      '<button type="button" class="lnc-abtn" data-view>' + t('nc.view') + '</button>' +
      '<button type="button" class="lnc-abtn" data-rd>' + (it.read ? t('nc.markUnread') : t('nc.markRead')) + '</button>' +
      '<button type="button" class="lnc-abtn danger" data-del>' + t('nc.delete') + '</button>' +
      '</div>';
    if (selMode) {
      var cb = el.querySelector('.lnc-check');
      el.querySelector('.lnc-card-top').onclick = function () { cb.checked = !cb.checked; toggleSel(it.id, cb.checked); };
      cb.onclick = function (e) { e.stopPropagation(); toggleSel(it.id, cb.checked); };
    }
    el.onclick = function () { if (!selMode) showDetail(it); };
    el.querySelector('[data-open]').onclick = function (e) { e.stopPropagation(); showDetail(it); };
    el.querySelector('[data-view]').onclick = function (e) { e.stopPropagation(); openItem(it); };
    el.querySelector('[data-rd]').onclick = function (e) { e.stopPropagation(); markRead([it.id], !it.read); };
    el.querySelector('[data-del]').onclick = async function (e) { e.stopPropagation(); if (await askDelete(t('nc.confirmDelete'))) del([it.id]); };
    return el;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function toggleSelMode() { selMode = !selMode; selected = {}; render(); }
  function toggleSel(id, on) { if (on) selected[id] = true; else delete selected[id]; render(); }
  function selectAll() { selected = {}; list().forEach(function (it) { selected[it.id] = true; }); render(); }
  async function bulk(fn) { var ids = Object.keys(selected); if (ids.length) { var ok = await fn(ids); if (ok === false) return; selected = {}; selMode = false; render(); } }

  // ── settings view (wired to LotoNotifications) ──
  function toggleSettings() {
    var s = panel.querySelector('[data-settings]');
    if (s.classList.contains('hidden')) { renderSettings(); s.classList.remove('hidden'); }
    else s.classList.add('hidden');
  }
  function renderSettings() {
    var N = window.LotoNotifications, st = N ? N.getState() : { prefs: prefs() || {}, phase: 'NOT_REQUESTED', permission: 'default' };
    var p = st.prefs || {};
    var u = uiPrefs();
    var permTxt = st.permission === 'granted' ? t('nc.permGranted') : st.permission === 'denied' ? t('nc.permDenied') : t('nc.permNot');
    var lots = GAME_ORDER.map(function (id) {
      var on = !(p.selected_lotteries || []).length || (p.selected_lotteries || []).indexOf(id) >= 0;
      return '<label class="lnc-row"><span>' + escapeHtml(gameName(id)) + '</span><input type="checkbox" data-lot="' + id + '" ' + (on ? 'checked' : '') + '></label>';
    }).join('');
    var rem = u.reminderLead || 'off';
    var s = panel.querySelector('[data-settings]');
    s.innerHTML =
      '<h4 class="lnc-sset">' + t('nc.settings') + '</h4>' +
      '<label class="lnc-row"><b>' + t('nc.master') + '</b><input type="checkbox" data-master ' + (p.enabled ? 'checked' : '') + '></label>' +
      '<label class="lnc-row"><span>' + t('nc.push') + '</span><input type="checkbox" data-push ' + (u.push && p.enabled ? 'checked' : '') + '></label>' +
      '<label class="lnc-row"><span>' + t('nc.inapp') + '</span><input type="checkbox" data-inapp ' + (u.inapp ? 'checked' : '') + '></label>' +
      '<div class="lnc-shdr">' + t('nc.allLotteries') + '</div>' +
      '<label class="lnc-row"><b>' + t('nc.allLotteries') + '</b><input type="checkbox" data-alllot ' + (!(p.selected_lotteries || []).length ? 'checked' : '') + '></label>' +
      lots +
      '<div class="lnc-shdr">' + t('nc.catResults') + '</div>' +
      '<label class="lnc-row"><span>' + t('nc.catResults') + '</span><input type="checkbox" data-cat="draw_results" ' + (p.draw_results ? 'checked' : '') + '></label>' +
      '<label class="lnc-row"><span>' + t('nc.catJackpot') + '</span><input type="checkbox" data-cat="jackpot_updates" ' + (p.jackpot_updates ? 'checked' : '') + '></label>' +
      '<label class="lnc-row"><span>' + t('nc.catPrizes') + '</span><input type="checkbox" data-cat="prize_breakdown" ' + (p.prize_breakdown !== false ? 'checked' : '') + '></label>' +
      '<label class="lnc-row"><span>' + t('nc.catReminder') + '</span><input type="checkbox" data-cat="deadline_reminders" ' + (p.deadline_reminders ? 'checked' : '') + '></label>' +
      '<div class="lnc-shdr">' + t('nc.reminderTime') + '</div>' +
      '<select class="lnc-select" data-remlead>' +
      ['off:nc.remOff', '15:nc.rem15', '60:nc.rem1h', '1440:nc.rem24h'].map(function (o) { var k = o.split(':'); return '<option value="' + k[0] + '"' + (rem === k[0] ? ' selected' : '') + '>' + t(k[1]) + '</option>'; }).join('') +
      '</select>' +
      '<div class="lnc-shdr">' + t('nc.perm') + '</div>' +
      '<div class="lnc-row"><span>' + t('nc.perm') + '</span><b>' + permTxt + '</b></div>' +
      (st.permission === 'denied' ? '<button type="button" class="lnc-tbtn" data-opensettings>' + t('nc.openSettings') + '</button>' : '');
    // wire
    var master = s.querySelector('[data-master]');
    if (master) master.onchange = function () { if (!N) return; if (master.checked) N.enableMaster(); else N.disableMaster(); };
    var push = s.querySelector('[data-push]'); if (push) push.onchange = function () { setUiPref('push', push.checked); if (N && push.checked) N.enableMaster(); };
    var inapp = s.querySelector('[data-inapp]'); if (inapp) inapp.onchange = function () { setUiPref('inapp', inapp.checked); };
    s.querySelectorAll('[data-cat]').forEach(function (cb) { cb.onchange = function () { if (N) N.setCategory(cb.dataset.cat, cb.checked); }; });
    var all = s.querySelector('[data-alllot]');
    if (all) all.onchange = function () { if (N) N.setSelectedLotteries(all.checked ? [] : GAME_ORDER.slice()); renderSettings(); emit(); };
    s.querySelectorAll('[data-lot]').forEach(function (cb) { cb.onchange = function () {
      var cur = (prefs() || {}).selected_lotteries || []; var id = cb.dataset.lot;
      if (!cur.length) cur = GAME_ORDER.slice(); // was "all" → become explicit
      cur = cb.checked ? cur.concat([id]).filter(function (x, i, a) { return a.indexOf(x) === i; }) : cur.filter(function (x) { return x !== id; });
      if (N) N.setSelectedLotteries(cur); renderSettings(); emit();
    }; });
    var rl = s.querySelector('[data-remlead]'); if (rl) rl.onchange = function () { setUiPref('reminderLead', rl.value); if (N && N.setReminderLead) N.setReminderLead(rl.value); };
    var os = s.querySelector('[data-opensettings]'); if (os) os.onclick = function () { if (N && N.openAppSettings) N.openAppSettings(); };
  }

  // ── open/close (scroll-lock, Back, Escape) ──
  function open() {
    ensurePanel(); render();
    panel.classList.remove('hidden');
    document.documentElement.classList.add('lnc-open');
    try { history.pushState({ lnc: 1 }, ''); } catch (e) {}
    popH = function () { if (!panel.classList.contains('hidden')) close(true); };
    window.addEventListener('popstate', popH);
    escH = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', escH);
    if (window.LotoNotifications && window.LotoNotifications.refreshPermission) { try { window.LotoNotifications.refreshPermission(); } catch (e) {} }
    syncFromBackend();
  }
  function close(fromPop) {
    if (!panel || panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    selMode = false; selected = {};
    var sv = panel.querySelector('[data-settings]'); if (sv) sv.classList.add('hidden');
    document.documentElement.classList.remove('lnc-open');
    if (escH) { document.removeEventListener('keydown', escH); escH = null; }
    if (popH) { window.removeEventListener('popstate', popH); popH = null; if (!fromPop) { try { if (history.state && history.state.lnc) history.back(); } catch (e) {} } }
  }

  // ── native + web push receipt wiring (adds messages + recomputes badges) ──
  function wirePush() {
    try {
      var c = window.Capacitor, push = c && c.Plugins && c.Plugins.PushNotifications;
      if (push && push.addListener) {
        push.addListener('pushNotificationReceived', function (n) { add(pushToItem(n)); });
        push.addListener('pushNotificationActionPerformed', function (a) { var it = pushToItem(a && a.notification); if (it) { add(it); open(); showDetail(Object.assign(it, { read: false })); } });
      }
    } catch (e) {}
    // Web push (service worker): receipt → add to the center; click → open + deep-link.
    try {
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) {
        var d = e.data || {};
        if (d.type === 'LOTO_PUSH_RECEIVED' && d.data) { add(pushToItem(d.data)); }
        else if (d.type === 'LOTO_PUSH_OPEN' && d.data) { var it = pushToItem(d.data); add(it); open(); showDetail(it); syncFromBackend(); }
      });
    } catch (e) {}
  }
  /** Cold-start deep link: the SW opens ./index.html?n_dest=…&n_lot=… — route it once. */
  function routeColdStart() {
    try {
      var q = new URLSearchParams(location.search);
      var dest = q.get('n_dest'); if (!dest) return;
      var lot = q.get('n_lot'), type = q.get('n_type');
      if (lot && window.selLot) window.selLot(lot);
      if (window.selPage) window.selPage(DEST[type] || (dest === 'analytics' ? 'ana' : dest === 'check' ? 'chk' : 'sim'));
      syncFromBackend();
    } catch (e) {}
  }
  function pushToItem(n) {
    if (!n) return null;
    var data = n.data || n || {};
    return { id: data.notificationId || data.id || ('p-' + Date.now()), lotteryId: data.lotteryId || null, eventType: data.eventType || data.notificationType || 'draw_results',
      drawId: data.drawId || data.date || null, title: n.title || data.title || '', body: n.body || data.body || '',
      payload: data.payload && typeof data.payload === 'object' ? data.payload : data,
      createdAt: data.createdAt || new Date().toISOString(), deeplink: data.deepLink || data.deeplink || data.destination || null };
  }

  function init() {
    loadLocal();
    // Test-only fixture (never shipped to production; gated on a global the build strips).
    try { if (window.__LOTO_NOTIF_FIXTURE) seed(window.__LOTO_NOTIF_FIXTURE); } catch (e) {}
    var bell = document.getElementById('bell-btn'); if (bell) bell.addEventListener('click', open);
    if (window.LotoNotifications && window.LotoNotifications.onChange) window.LotoNotifications.onChange(function () { emit(); });
    wirePush();
    routeColdStart();
    emit();
    syncFromBackend();
  }

  window.LotoNotifCenter = {
    open: open, close: close, onChange: onChange, unreadCount: unreadCount,
    add: add, seed: seed, list: list, markRead: markRead, delete: del, refresh: syncFromBackend, _t: t
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
