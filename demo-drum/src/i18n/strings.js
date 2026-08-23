/**
 * CANONICAL DRUM I18N STRING TABLE — the single source of truth for every
 * user-visible string the 3D drum renders (HUD buttons, statuses, settings,
 * result-group labels, boot + error text, aria labels).
 *
 * Structure is KEY-FIRST so `scripts/audit-drum-i18n.mjs` can assert, at build
 * time, that EVERY key carries a non-empty value for ALL 16 canonical locales
 * (missing/empty = build failure). The drum profiles (registry.js/games.js)
 * store labelKeys — never localized user strings — and resolve them through
 * `t()` in i18n/index.js.
 *
 * Canonical locales (must match the main app's APP_LOCALES exactly):
 *   ru en no sv da fi de fr es it pt pl nl et lv lt
 *
 * Placeholders use {{0}}, {{1}}, … and MUST be preserved across every locale
 * (the audit checks placeholder parity per key).
 *
 * Proper-noun pool labels (Euro, Viking, Jolly, Bonus, Tilleggstall, Powerball,
 * Mega Ball) are intentionally the SAME brand string across locales; only true
 * descriptive labels (main numbers, additional number, stars) are translated.
 */
export const DRUM_LOCALES = ['ru', 'en', 'no', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'nl', 'et', 'lv', 'lt', 'uk'];

export const DRUM_STRINGS = {
  // ── Result-group / pool labels ───────────────────────────────────────────
  'pool.main': {
    ru: 'Основные', en: 'Main numbers', no: 'Hovedtall', sv: 'Huvudtal', da: 'Hovedtal',
    fi: 'Päänumerot', de: 'Hauptzahlen', fr: 'Numéros principaux', es: 'Números principales',
    it: 'Numeri principali', pt: 'Números principais', pl: 'Liczby główne', nl: 'Hoofdgetallen',
    et: 'Põhinumbrid', lv: 'Pamatskaitļi', lt: 'Pagrindiniai skaičiai',
    uk: 'Основні',
  },
  'pool.stars': {
    ru: 'Звёзды', en: 'Stars', no: 'Stjerner', sv: 'Stjärnor', da: 'Stjerner',
    fi: 'Tähdet', de: 'Sterne', fr: 'Étoiles', es: 'Estrellas', it: 'Stelle',
    pt: 'Estrelas', pl: 'Gwiazdy', nl: 'Sterren', et: 'Tähed', lv: 'Zvaigznes', lt: 'Žvaigždės',
    uk: 'Зірки',
  },
  'pool.tilleggstall': {
    ru: 'Tilleggstall', en: 'Tilleggstall', no: 'Tilleggstall', sv: 'Tilleggstall', da: 'Tilleggstall',
    fi: 'Tilleggstall', de: 'Tilleggstall', fr: 'Tilleggstall', es: 'Tilleggstall', it: 'Tilleggstall',
    pt: 'Tilleggstall', pl: 'Tilleggstall', nl: 'Tilleggstall', et: 'Tilleggstall', lv: 'Tilleggstall', lt: 'Tilleggstall',
    uk: 'Tilleggstall',
  },
  'pool.viking': {
    ru: 'Viking', en: 'Viking', no: 'Viking', sv: 'Viking', da: 'Viking',
    fi: 'Viking', de: 'Viking', fr: 'Viking', es: 'Viking', it: 'Viking',
    pt: 'Viking', pl: 'Viking', nl: 'Viking', et: 'Viking', lv: 'Viking', lt: 'Viking',
    uk: 'Viking',
  },
  'pool.euro': {
    ru: 'Euro', en: 'Euro', no: 'Euro', sv: 'Euro', da: 'Euro',
    fi: 'Euro', de: 'Euro', fr: 'Euro', es: 'Euro', it: 'Euro',
    pt: 'Euro', pl: 'Euro', nl: 'Euro', et: 'Euro', lv: 'Euro', lt: 'Euro',
    uk: 'Euro',
  },
  'pool.powerball': {
    ru: 'Powerball', en: 'Powerball', no: 'Powerball', sv: 'Powerball', da: 'Powerball',
    fi: 'Powerball', de: 'Powerball', fr: 'Powerball', es: 'Powerball', it: 'Powerball',
    pt: 'Powerball', pl: 'Powerball', nl: 'Powerball', et: 'Powerball', lv: 'Powerball', lt: 'Powerball',
    uk: 'Powerball',
  },
  'pool.mega': {
    ru: 'Mega Ball', en: 'Mega Ball', no: 'Mega Ball', sv: 'Mega Ball', da: 'Mega Ball',
    fi: 'Mega Ball', de: 'Mega Ball', fr: 'Mega Ball', es: 'Mega Ball', it: 'Mega Ball',
    pt: 'Mega Ball', pl: 'Mega Ball', nl: 'Mega Ball', et: 'Mega Ball', lv: 'Mega Ball', lt: 'Mega Ball',
    uk: 'Mega Ball',
  },
  'pool.jolly': {
    ru: 'Jolly', en: 'Jolly', no: 'Jolly', sv: 'Jolly', da: 'Jolly',
    fi: 'Jolly', de: 'Jolly', fr: 'Jolly', es: 'Jolly', it: 'Jolly',
    pt: 'Jolly', pl: 'Jolly', nl: 'Jolly', et: 'Jolly', lv: 'Jolly', lt: 'Jolly',
    uk: 'Jolly',
  },
  'pool.bonus': {
    ru: 'Бонус', en: 'Bonus', no: 'Bonus', sv: 'Bonus', da: 'Bonus',
    fi: 'Bonus', de: 'Bonus', fr: 'Bonus', es: 'Bonus', it: 'Bonus',
    pt: 'Bónus', pl: 'Bonus', nl: 'Bonus', et: 'Boonus', lv: 'Bonuss', lt: 'Bonusas',
    uk: 'Бонус',
  },

  // ── Primary action button ────────────────────────────────────────────────
  'action.start': {
    ru: 'Начать розыгрыш', en: 'Start draw', no: 'Start trekning', sv: 'Starta dragning', da: 'Start trækning',
    fi: 'Aloita arvonta', de: 'Ziehung starten', fr: 'Lancer le tirage', es: 'Iniciar sorteo',
    it: 'Avvia estrazione', pt: 'Iniciar sorteio', pl: 'Rozpocznij losowanie', nl: 'Trekking starten',
    et: 'Alusta loosimist', lv: 'Sākt izlozi', lt: 'Pradėti traukimą',
    uk: 'Почати розіграш',
  },
  'action.new': {
    ru: 'Новый розыгрыш', en: 'New draw', no: 'Ny trekning', sv: 'Ny dragning', da: 'Ny trækning',
    fi: 'Uusi arvonta', de: 'Neue Ziehung', fr: 'Nouveau tirage', es: 'Nuevo sorteo',
    it: 'Nuova estrazione', pt: 'Novo sorteio', pl: 'Nowe losowanie', nl: 'Nieuwe trekking',
    et: 'Uus loosimine', lv: 'Jauna izloze', lt: 'Naujas traukimas',
    uk: 'Новий розіграш',
  },

  // ── Live status ──────────────────────────────────────────────────────────
  'status.mixing': {
    ru: 'Перемешивание…', en: 'Mixing…', no: 'Blander…', sv: 'Blandar…', da: 'Blander…',
    fi: 'Sekoitetaan…', de: 'Mischen…', fr: 'Mélange…', es: 'Mezclando…', it: 'Mescolamento…',
    pt: 'A misturar…', pl: 'Mieszanie…', nl: 'Mengen…', et: 'Segamine…', lv: 'Jauc…', lt: 'Maišoma…',
    uk: 'Перемішування…',
  },
  'status.selecting': {
    ru: 'Выбор шара…', en: 'Selecting ball…', no: 'Velger kule…', sv: 'Väljer boll…', da: 'Vælger kugle…',
    fi: 'Valitaan palloa…', de: 'Kugel wird gewählt…', fr: 'Sélection de la boule…', es: 'Seleccionando bola…',
    it: 'Selezione pallina…', pt: 'A selecionar bola…', pl: 'Wybór kuli…', nl: 'Bal kiezen…',
    et: 'Kuuli valimine…', lv: 'Izvēlas bumbiņu…', lt: 'Renkamas kamuoliukas…',
    uk: 'Вибір кулі…',
  },
  'status.ball': {
    ru: 'Шар №{{0}}', en: 'Ball #{{0}}', no: 'Kule nr. {{0}}', sv: 'Boll nr {{0}}', da: 'Kugle nr. {{0}}',
    fi: 'Pallo nro {{0}}', de: 'Kugel Nr. {{0}}', fr: 'Boule n° {{0}}', es: 'Bola n.º {{0}}',
    it: 'Pallina n. {{0}}', pt: 'Bola n.º {{0}}', pl: 'Kula nr {{0}}', nl: 'Bal nr. {{0}}',
    et: 'Kuul nr {{0}}', lv: 'Bumbiņa Nr. {{0}}', lt: 'Kamuoliukas Nr. {{0}}',
    uk: 'Куля №{{0}}',
  },

  // ── Settings panel ───────────────────────────────────────────────────────
  'settings.title': {
    ru: 'Настройки', en: 'Settings', no: 'Innstillinger', sv: 'Inställningar', da: 'Indstillinger',
    fi: 'Asetukset', de: 'Einstellungen', fr: 'Paramètres', es: 'Ajustes', it: 'Impostazioni',
    pt: 'Definições', pl: 'Ustawienia', nl: 'Instellingen', et: 'Seaded', lv: 'Iestatījumi', lt: 'Nustatymai',
    uk: 'Налаштування',
  },
  'settings.close': {
    ru: 'Закрыть настройки', en: 'Close settings', no: 'Lukk innstillinger', sv: 'Stäng inställningar', da: 'Luk indstillinger',
    fi: 'Sulje asetukset', de: 'Einstellungen schließen', fr: 'Fermer les paramètres', es: 'Cerrar ajustes', it: 'Chiudi impostazioni',
    pt: 'Fechar definições', pl: 'Zamknij ustawienia', nl: 'Instellingen sluiten', et: 'Sulge seaded', lv: 'Aizvērt iestatījumus', lt: 'Uždaryti nustatymus',
    uk: 'Закрити налаштування',
  },
  'settings.game': {
    ru: 'Игра', en: 'Game', no: 'Spill', sv: 'Spel', da: 'Spil',
    fi: 'Peli', de: 'Spiel', fr: 'Jeu', es: 'Juego', it: 'Gioco',
    pt: 'Jogo', pl: 'Gra', nl: 'Spel', et: 'Mäng', lv: 'Spēle', lt: 'Žaidimas',
    uk: 'Гра',
  },
  'settings.quality': {
    ru: 'Качество', en: 'Quality', no: 'Kvalitet', sv: 'Kvalitet', da: 'Kvalitet',
    fi: 'Laatu', de: 'Qualität', fr: 'Qualité', es: 'Calidad', it: 'Qualità',
    pt: 'Qualidade', pl: 'Jakość', nl: 'Kwaliteit', et: 'Kvaliteet', lv: 'Kvalitāte', lt: 'Kokybė',
    uk: 'Якість',
  },
  'settings.reset': {
    ru: 'Сбросить', en: 'Reset', no: 'Nullstill', sv: 'Återställ', da: 'Nulstil',
    fi: 'Palauta', de: 'Zurücksetzen', fr: 'Réinitialiser', es: 'Restablecer', it: 'Reimposta',
    pt: 'Repor', pl: 'Resetuj', nl: 'Herstellen', et: 'Lähtesta', lv: 'Atiestatīt', lt: 'Atstatyti',
    uk: 'Скинути',
  },
  'settings.note': {
    ru: 'Победитель определяется только когда шар физически выпадает из барабана. Заранее заданной последовательности нет.',
    en: 'The winner is decided only when a ball physically leaves the drum. There is no pre-set sequence.',
    no: 'Vinneren avgjøres først når en kule fysisk faller ut av trommelen. Det finnes ingen forhåndsbestemt rekkefølge.',
    sv: 'Vinnaren avgörs först när en boll fysiskt lämnar trumman. Det finns ingen förutbestämd ordning.',
    da: 'Vinderen afgøres først, når en kugle fysisk forlader tromlen. Der er ingen forudbestemt rækkefølge.',
    fi: 'Voittaja ratkeaa vasta, kun pallo fyysisesti poistuu rummusta. Ennalta määrättyä järjestystä ei ole.',
    de: 'Der Gewinner steht erst fest, wenn eine Kugel die Trommel physisch verlässt. Es gibt keine vorgegebene Reihenfolge.',
    fr: 'Le gagnant n’est déterminé que lorsqu’une boule sort physiquement du tambour. Il n’y a aucune séquence prédéfinie.',
    es: 'El ganador se determina solo cuando una bola sale físicamente del bombo. No hay una secuencia predefinida.',
    it: 'Il vincitore è deciso solo quando una pallina esce fisicamente dal tamburo. Non esiste una sequenza prestabilita.',
    pt: 'O vencedor é decidido apenas quando uma bola sai fisicamente do tambor. Não existe uma sequência predefinida.',
    pl: 'Zwycięzca zostaje wyłoniony dopiero, gdy kula fizycznie opuści bęben. Nie ma z góry ustalonej kolejności.',
    nl: 'De winnaar wordt pas bepaald wanneer een bal fysiek uit de trommel valt. Er is geen vooraf bepaalde volgorde.',
    et: 'Võitja selgub alles siis, kui kuul füüsiliselt trumlist väljub. Eelnevalt määratud järjestust ei ole.',
    lv: 'Uzvarētājs tiek noteikts tikai tad, kad bumbiņa fiziski izkrīt no cilindra. Iepriekš noteiktas secības nav.',
    lt: 'Laimėtojas nustatomas tik tada, kai kamuoliukas fiziškai iškrenta iš būgno. Iš anksto nustatytos sekos nėra.',
    uk: 'Переможець визначається лише коли куля фізично випадає з барабана. Заздалегідь заданої послідовності немає.',
  },

  // ── Quality options ──────────────────────────────────────────────────────
  'q.auto': {
    ru: 'Авто', en: 'Auto', no: 'Auto', sv: 'Auto', da: 'Auto', fi: 'Automaattinen', de: 'Auto',
    fr: 'Auto', es: 'Automático', it: 'Auto', pt: 'Automático', pl: 'Auto', nl: 'Automatisch',
    et: 'Automaatne', lv: 'Automātiski', lt: 'Automatinis',
    uk: 'Авто',
  },
  'q.ultra': {
    ru: 'Ультра', en: 'Ultra', no: 'Ultra', sv: 'Ultra', da: 'Ultra', fi: 'Ultra', de: 'Ultra',
    fr: 'Ultra', es: 'Ultra', it: 'Ultra', pt: 'Ultra', pl: 'Ultra', nl: 'Ultra', et: 'Ultra', lv: 'Ultra', lt: 'Ultra',
    uk: 'Ультра',
  },
  'q.high': {
    ru: 'Высокое', en: 'High', no: 'Høy', sv: 'Hög', da: 'Høj', fi: 'Korkea', de: 'Hoch',
    fr: 'Élevée', es: 'Alta', it: 'Alta', pt: 'Alta', pl: 'Wysoka', nl: 'Hoog', et: 'Kõrge', lv: 'Augsta', lt: 'Aukšta',
    uk: 'Високе',
  },
  'q.medium': {
    ru: 'Среднее', en: 'Medium', no: 'Middels', sv: 'Medel', da: 'Mellem', fi: 'Keskitaso', de: 'Mittel',
    fr: 'Moyenne', es: 'Media', it: 'Media', pt: 'Média', pl: 'Średnia', nl: 'Gemiddeld', et: 'Keskmine', lv: 'Vidēja', lt: 'Vidutinė',
    uk: 'Середнє',
  },
  'q.low': {
    ru: 'Низкое', en: 'Low', no: 'Lav', sv: 'Låg', da: 'Lav', fi: 'Matala', de: 'Niedrig',
    fr: 'Basse', es: 'Baja', it: 'Bassa', pt: 'Baixa', pl: 'Niska', nl: 'Laag', et: 'Madal', lv: 'Zema', lt: 'Žema',
    uk: 'Низьке',
  },

  // ── Boot / error ─────────────────────────────────────────────────────────
  'boot.loading': {
    ru: 'Загрузка физики и графики…', en: 'Loading physics & graphics…', no: 'Laster fysikk og grafikk…',
    sv: 'Laddar fysik och grafik…', da: 'Indlæser fysik og grafik…', fi: 'Ladataan fysiikkaa ja grafiikkaa…',
    de: 'Physik & Grafik werden geladen…', fr: 'Chargement de la physique et des graphismes…',
    es: 'Cargando física y gráficos…', it: 'Caricamento di fisica e grafica…', pt: 'A carregar física e gráficos…',
    pl: 'Ładowanie fizyki i grafiki…', nl: 'Fysica en graphics laden…', et: 'Füüsika ja graafika laadimine…',
    lv: 'Ielādē fiziku un grafiku…', lt: 'Įkeliama fizika ir grafika…',
    uk: 'Завантаження фізики та графіки…',
  },
  'boot.error': {
    ru: 'Ошибка запуска: ', en: 'Startup error: ', no: 'Oppstartsfeil: ', sv: 'Startfel: ', da: 'Startfejl: ',
    fi: 'Käynnistysvirhe: ', de: 'Startfehler: ', fr: 'Erreur de démarrage : ', es: 'Error de inicio: ',
    it: 'Errore di avvio: ', pt: 'Erro de arranque: ', pl: 'Błąd uruchamiania: ', nl: 'Opstartfout: ',
    et: 'Käivitusviga: ', lv: 'Palaišanas kļūda: ', lt: 'Paleidimo klaida: ',
    uk: 'Помилка запуску: ',
  },
  'error.physics': {
    ru: 'Не удалось загрузить физический движок.', en: 'Failed to initialise the physics engine.',
    no: 'Kunne ikke starte fysikkmotoren.', sv: 'Kunde inte starta fysikmotorn.', da: 'Kunne ikke starte fysikmotoren.',
    fi: 'Fysiikkamoottorin käynnistys epäonnistui.', de: 'Physik-Engine konnte nicht gestartet werden.',
    fr: 'Impossible d’initialiser le moteur physique.', es: 'No se pudo iniciar el motor de física.',
    it: 'Impossibile inizializzare il motore fisico.', pt: 'Não foi possível iniciar o motor de física.',
    pl: 'Nie udało się uruchomić silnika fizyki.', nl: 'Kan de physics-engine niet initialiseren.',
    et: 'Füüsikamootori käivitamine ebaõnnestus.', lv: 'Neizdevās startēt fizikas dzinēju.', lt: 'Nepavyko paleisti fizikos variklio.',
    uk: 'Не вдалося завантажити фізичний рушій.',
  },
  'error.timeout': {
    ru: 'Превышено время загрузки 3D-машины. Нажмите, чтобы повторить.',
    en: 'Timed out starting the 3D machine. Tap to retry.',
    no: 'Tidsavbrudd ved oppstart av 3D-maskinen. Trykk for å prøve igjen.',
    sv: 'Tidsgränsen nåddes vid start av 3D-maskinen. Tryck för att försöka igen.',
    da: 'Tidsudløb ved start af 3D-maskinen. Tryk for at prøve igen.',
    fi: 'Aikakatkaisu 3D-koneen käynnistyksessä. Napauta yrittääksesi uudelleen.',
    de: 'Zeitüberschreitung beim Start der 3D-Maschine. Zum Wiederholen tippen.',
    fr: 'Délai dépassé au démarrage de la machine 3D. Touchez pour réessayer.',
    es: 'Se agotó el tiempo al iniciar la máquina 3D. Toca para reintentar.',
    it: 'Timeout all’avvio della macchina 3D. Tocca per riprovare.',
    pt: 'Tempo esgotado ao iniciar a máquina 3D. Toque para tentar de novo.',
    pl: 'Przekroczono czas uruchamiania maszyny 3D. Dotknij, aby spróbować ponownie.',
    nl: 'Time-out bij het starten van de 3D-machine. Tik om opnieuw te proberen.',
    et: 'Ajalõpp 3D-masina käivitamisel. Puuduta uuesti proovimiseks.',
    lv: 'Iestājās noildze, startējot 3D mašīnu. Pieskarieties, lai mēģinātu vēlreiz.',
    lt: 'Baigėsi 3D mašinos paleidimo laikas. Palieskite, kad bandytumėte dar kartą.',
    uk: 'Перевищено час завантаження 3D-машини. Натисніть, щоб повторити.',
  },
  'error.webgl': {
    ru: 'WebGL недоступен', en: 'WebGL is not available', no: 'WebGL er ikke tilgjengelig',
    sv: 'WebGL är inte tillgängligt', da: 'WebGL er ikke tilgængelig', fi: 'WebGL ei ole käytettävissä',
    de: 'WebGL ist nicht verfügbar', fr: 'WebGL n’est pas disponible', es: 'WebGL no está disponible',
    it: 'WebGL non è disponibile', pt: 'WebGL não está disponível', pl: 'WebGL jest niedostępny',
    nl: 'WebGL is niet beschikbaar', et: 'WebGL ei ole saadaval', lv: 'WebGL nav pieejams', lt: 'WebGL nepasiekiamas',
    uk: 'WebGL недоступний',
  },

  // ── Aria labels ──────────────────────────────────────────────────────────
  'aria.settings': {
    ru: 'Настройки', en: 'Settings', no: 'Innstillinger', sv: 'Inställningar', da: 'Indstillinger',
    fi: 'Asetukset', de: 'Einstellungen', fr: 'Paramètres', es: 'Ajustes', it: 'Impostazioni',
    pt: 'Definições', pl: 'Ustawienia', nl: 'Instellingen', et: 'Seaded', lv: 'Iestatījumi', lt: 'Nustatymai',
    uk: 'Налаштування',
  },
  'aria.back': {
    ru: 'Назад', en: 'Back', no: 'Tilbake', sv: 'Tillbaka', da: 'Tilbage', fi: 'Takaisin', de: 'Zurück',
    fr: 'Retour', es: 'Atrás', it: 'Indietro', pt: 'Voltar', pl: 'Wstecz', nl: 'Terug', et: 'Tagasi', lv: 'Atpakaļ', lt: 'Atgal',
    uk: 'Назад',
  },
  'aria.open3d': {
    ru: 'Открыть 3D-розыгрыш', en: 'Open 3D draw', no: 'Åpne 3D-trekning', sv: 'Öppna 3D-dragning',
    da: 'Åbn 3D-trækning', fi: 'Avaa 3D-arvonta', de: '3D-Ziehung öffnen', fr: 'Ouvrir le tirage 3D',
    es: 'Abrir sorteo 3D', it: 'Apri estrazione 3D', pt: 'Abrir sorteio 3D', pl: 'Otwórz losowanie 3D',
    nl: '3D-trekking openen', et: 'Ava 3D-loosimine', lv: 'Atvērt 3D izlozi', lt: 'Atverti 3D traukimą',
    uk: 'Відкрити 3D-розіграш',
  },

  // ── Sound button states ──────────────────────────────────────────────────
  'sound.enable': {
    ru: 'Включить звук', en: 'Enable sound', no: 'Slå på lyd', sv: 'Slå på ljud', da: 'Slå lyd til',
    fi: 'Ota ääni käyttöön', de: 'Ton einschalten', fr: 'Activer le son', es: 'Activar sonido', it: 'Attiva audio',
    pt: 'Ativar som', pl: 'Włącz dźwięk', nl: 'Geluid inschakelen', et: 'Lülita heli sisse', lv: 'Ieslēgt skaņu', lt: 'Įjungti garsą',
    uk: 'Увімкнути звук',
  },
  'sound.on': {
    ru: 'Звук включён', en: 'Sound on', no: 'Lyd på', sv: 'Ljud på', da: 'Lyd til',
    fi: 'Ääni päällä', de: 'Ton an', fr: 'Son activé', es: 'Sonido activado', it: 'Audio attivo',
    pt: 'Som ativado', pl: 'Dźwięk włączony', nl: 'Geluid aan', et: 'Heli sees', lv: 'Skaņa ieslēgta', lt: 'Garsas įjungtas',
    uk: 'Звук увімкнено',
  },
  'sound.allow': {
    ru: 'Нажмите, чтобы разрешить звук', en: 'Tap to allow sound', no: 'Trykk for å tillate lyd', sv: 'Tryck för att tillåta ljud', da: 'Tryk for at tillade lyd',
    fi: 'Napauta salliaksesi äänen', de: 'Tippen, um Ton zu erlauben', fr: 'Touchez pour autoriser le son', es: 'Toca para permitir el sonido', it: 'Tocca per consentire l’audio',
    pt: 'Toque para permitir o som', pl: 'Dotknij, aby zezwolić na dźwięk', nl: 'Tik om geluid toe te staan', et: 'Puuduta heli lubamiseks', lv: 'Pieskarieties, lai atļautu skaņu', lt: 'Palieskite, kad leistumėte garsą',
    uk: 'Натисніть, щоб дозволити звук',
  },
  'sound.offHint': {
    ru: 'Звук выключен. Чтобы смотреть розыгрыш со звуком, нажмите кнопку динамика.',
    en: 'Sound is off. To watch the draw with sound, tap the speaker button.',
    no: 'Lyden er av. Trykk på høyttalerknappen for å se trekningen med lyd.',
    sv: 'Ljudet är av. Tryck på högtalarknappen för att se dragningen med ljud.',
    da: 'Lyden er slået fra. Tryk på højttalerknappen for at se trækningen med lyd.',
    fi: 'Ääni on pois. Katso arvonta äänen kanssa napauttamalla kaiutinpainiketta.',
    de: 'Der Ton ist aus. Tippe auf die Lautsprechertaste, um die Ziehung mit Ton zu sehen.',
    fr: 'Le son est coupé. Touchez le bouton haut-parleur pour suivre le tirage avec le son.',
    es: 'El sonido está apagado. Toca el botón del altavoz para ver el sorteo con sonido.',
    it: 'L’audio è disattivato. Tocca il pulsante altoparlante per vedere l’estrazione con l’audio.',
    pt: 'O som está desligado. Toque no botão do altifalante para ver o sorteio com som.',
    pl: 'Dźwięk jest wyłączony. Dotknij przycisku głośnika, aby oglądać losowanie z dźwiękiem.',
    nl: 'Het geluid staat uit. Tik op de luidsprekerknop om de trekking met geluid te bekijken.',
    et: 'Heli on väljas. Loosimise vaatamiseks heliga puuduta kõlarinuppu.',
    lv: 'Skaņa ir izslēgta. Lai skatītos izlozi ar skaņu, pieskarieties skaļruņa pogai.',
    lt: 'Garsas išjungtas. Kad stebėtumėte traukimą su garsu, palieskite garsiakalbio mygtuką.',
    uk: 'Звук вимкнено. Щоб дивитися розіграш зі звуком, натисніть кнопку динаміка.',
  },

  // ── Save-combination prompt ──────────────────────────────────────────────
  'save.title': {
    ru: 'Сохранить эту комбинацию?', en: 'Save this combination?', no: 'Lagre denne kombinasjonen?', sv: 'Spara denna kombination?', da: 'Gem denne kombination?',
    fi: 'Tallennetaanko tämä yhdistelmä?', de: 'Diese Kombination speichern?', fr: 'Enregistrer cette combinaison ?', es: '¿Guardar esta combinación?', it: 'Salvare questa combinazione?',
    pt: 'Guardar esta combinação?', pl: 'Zapisać tę kombinację?', nl: 'Deze combinatie opslaan?', et: 'Kas salvestada see kombinatsioon?', lv: 'Saglabāt šo kombināciju?', lt: 'Išsaugoti šį derinį?',
    uk: 'Зберегти цю комбінацію?',
  },
  'save.save': {
    ru: 'Сохранить', en: 'Save', no: 'Lagre', sv: 'Spara', da: 'Gem',
    fi: 'Tallenna', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar', it: 'Salva',
    pt: 'Guardar', pl: 'Zapisz', nl: 'Opslaan', et: 'Salvesta', lv: 'Saglabāt', lt: 'Išsaugoti',
    uk: 'Зберегти',
  },
  'save.dismiss': {
    ru: 'Не сохранять', en: 'Don’t save', no: 'Ikke lagre', sv: 'Spara inte', da: 'Gem ikke',
    fi: 'Älä tallenna', de: 'Nicht speichern', fr: 'Ne pas enregistrer', es: 'No guardar', it: 'Non salvare',
    pt: 'Não guardar', pl: 'Nie zapisuj', nl: 'Niet opslaan', et: 'Ära salvesta', lv: 'Nesaglabāt', lt: 'Nesaugoti',
    uk: 'Не зберігати',
  },
  'save.toast.saved': {
    ru: 'Комбинация сохранена', en: 'Combination saved', no: 'Kombinasjon lagret', sv: 'Kombination sparad', da: 'Kombination gemt',
    fi: 'Yhdistelmä tallennettu', de: 'Kombination gespeichert', fr: 'Combinaison enregistrée', es: 'Combinación guardada', it: 'Combinazione salvata',
    pt: 'Combinação guardada', pl: 'Kombinacja zapisana', nl: 'Combinatie opgeslagen', et: 'Kombinatsioon salvestatud', lv: 'Kombinācija saglabāta', lt: 'Derinys išsaugotas',
    uk: 'Комбінацію збережено',
  },
  'save.toast.duplicate': {
    ru: 'Эта комбинация уже сохранена', en: 'This combination is already saved', no: 'Denne kombinasjonen er allerede lagret', sv: 'Den här kombinationen är redan sparad', da: 'Denne kombination er allerede gemt',
    fi: 'Tämä yhdistelmä on jo tallennettu', de: 'Diese Kombination ist bereits gespeichert', fr: 'Cette combinaison est déjà enregistrée', es: 'Esta combinación ya está guardada', it: 'Questa combinazione è già salvata',
    pt: 'Esta combinação já está guardada', pl: 'Ta kombinacja jest już zapisana', nl: 'Deze combinatie is al opgeslagen', et: 'See kombinatsioon on juba salvestatud', lv: 'Šī kombinācija jau ir saglabāta', lt: 'Šis derinys jau išsaugotas',
    uk: 'Ця комбінація вже збережена',
  },

  // ── Saved-combinations block ─────────────────────────────────────────────
  'saved.title': {
    ru: 'Сохранённые комбинации', en: 'Saved combinations', no: 'Lagrede kombinasjoner', sv: 'Sparade kombinationer', da: 'Gemte kombinationer',
    fi: 'Tallennetut yhdistelmät', de: 'Gespeicherte Kombinationen', fr: 'Combinaisons enregistrées', es: 'Combinaciones guardadas', it: 'Combinazioni salvate',
    pt: 'Combinações guardadas', pl: 'Zapisane kombinacje', nl: 'Opgeslagen combinaties', et: 'Salvestatud kombinatsioonid', lv: 'Saglabātās kombinācijas', lt: 'Išsaugoti deriniai',
    uk: 'Збережені комбінації',
  },
  'saved.empty': {
    ru: 'Пока нет сохранённых комбинаций', en: 'No saved combinations yet', no: 'Ingen lagrede kombinasjoner ennå', sv: 'Inga sparade kombinationer ännu', da: 'Ingen gemte kombinationer endnu',
    fi: 'Ei vielä tallennettuja yhdistelmiä', de: 'Noch keine gespeicherten Kombinationen', fr: 'Aucune combinaison enregistrée', es: 'Aún no hay combinaciones guardadas', it: 'Nessuna combinazione salvata',
    pt: 'Ainda não há combinações guardadas', pl: 'Brak zapisanych kombinacji', nl: 'Nog geen opgeslagen combinaties', et: 'Salvestatud kombinatsioone veel pole', lv: 'Vēl nav saglabātu kombināciju', lt: 'Kol kas nėra išsaugotų derinių',
    uk: 'Поки немає збережених комбінацій',
  },
  'saved.source': {
    ru: '3D-барабан', en: '3D drum', no: '3D-trommel', sv: '3D-trumma', da: '3D-tromle',
    fi: '3D-rumpu', de: '3D-Trommel', fr: 'Tambour 3D', es: 'Bombo 3D', it: 'Tamburo 3D',
    pt: 'Tambor 3D', pl: 'Bęben 3D', nl: '3D-trommel', et: '3D-trummel', lv: '3D cilindrs', lt: '3D būgnas',
    uk: '3D-барабан',
  },
  'saved.supreme': {
    ru: 'Верховный судья', en: 'Supreme Judge', no: 'Høyesterettsdommer', sv: 'Högsta domaren', da: 'Højesteretsdommer',
    fi: 'Ylin tuomari', de: 'Oberster Richter', fr: 'Juge suprême', es: 'Juez supremo', it: 'Giudice supremo',
    pt: 'Juiz supremo', pl: 'Najwyższy sędzia', nl: 'Opperrechter', et: 'Ülemkohtunik', lv: 'Augstākais tiesnesis', lt: 'Aukščiausiasis teisėjas',
    uk: 'Верховний суддя',
  },
  'saved.consensus': {
    ru: 'Консенсус моделей', en: 'Model consensus', no: 'Modellkonsensus', sv: 'Modellkonsensus', da: 'Modelkonsensus',
    fi: 'Mallien konsensus', de: 'Modell-Konsens', fr: 'Consensus des modèles', es: 'Consenso de modelos', it: 'Consenso dei modelli',
    pt: 'Consenso dos modelos', pl: 'Konsensus modeli', nl: 'Modelconsensus', et: 'Mudelite konsensus', lv: 'Modeļu konsenss', lt: 'Modelių konsensusas',
    uk: 'Консенсус моделей',
  },
  'saved.delete': {
    ru: 'Удалить', en: 'Delete', no: 'Slett', sv: 'Ta bort', da: 'Slet',
    fi: 'Poista', de: 'Löschen', fr: 'Supprimer', es: 'Eliminar', it: 'Elimina',
    pt: 'Eliminar', pl: 'Usuń', nl: 'Verwijderen', et: 'Kustuta', lv: 'Dzēst', lt: 'Ištrinti',
    uk: 'Видалити',
  },
  'saved.confirmDelete': {
    ru: 'Удалить?', en: 'Delete?', no: 'Slette?', sv: 'Ta bort?', da: 'Slet?',
    fi: 'Poista?', de: 'Löschen?', fr: 'Supprimer ?', es: '¿Eliminar?', it: 'Eliminare?',
    pt: 'Eliminar?', pl: 'Usunąć?', nl: 'Verwijderen?', et: 'Kustutada?', lv: 'Dzēst?', lt: 'Ištrinti?',
    uk: 'Видалити?',
  },

  // ── Bulk transfer of saved combinations to the main screen ────────────────
  'bulk.selectAll': {
    ru: 'Выбрать все', en: 'Select all', no: 'Velg alle', sv: 'Välj alla', da: 'Vælg alle',
    fi: 'Valitse kaikki', de: 'Alle auswählen', fr: 'Tout sélectionner', es: 'Seleccionar todo', it: 'Seleziona tutto',
    pt: 'Selecionar tudo', pl: 'Zaznacz wszystko', nl: 'Alles selecteren', et: 'Vali kõik', lv: 'Atlasīt visu', lt: 'Pasirinkti viską',
    uk: 'Вибрати все',
  },
  'bulk.clear': {
    ru: 'Снять выбор', en: 'Clear selection', no: 'Fjern valg', sv: 'Rensa val', da: 'Ryd valg',
    fi: 'Tyhjennä valinta', de: 'Auswahl aufheben', fr: 'Effacer la sélection', es: 'Borrar selección', it: 'Deseleziona',
    pt: 'Limpar seleção', pl: 'Wyczyść wybór', nl: 'Selectie wissen', et: 'Tühjenda valik', lv: 'Notīrīt atlasi', lt: 'Išvalyti pasirinkimą',
    uk: 'Зняти вибір',
  },
  'bulk.selected': {
    ru: 'Выбрано: {{0}}', en: 'Selected: {{0}}', no: 'Valgt: {{0}}', sv: 'Valda: {{0}}', da: 'Valgt: {{0}}',
    fi: 'Valittu: {{0}}', de: 'Ausgewählt: {{0}}', fr: 'Sélectionné : {{0}}', es: 'Seleccionado: {{0}}', it: 'Selezionati: {{0}}',
    pt: 'Selecionado: {{0}}', pl: 'Wybrano: {{0}}', nl: 'Geselecteerd: {{0}}', et: 'Valitud: {{0}}', lv: 'Atlasīts: {{0}}', lt: 'Pasirinkta: {{0}}',
    uk: 'Вибрано: {{0}}',
  },
  'bulk.selectedFor': {
    ru: 'Выбрано: {{0}} · {{1}}', en: 'Selected: {{0}} · {{1}}', no: 'Valgt: {{0}} · {{1}}', sv: 'Valda: {{0}} · {{1}}', da: 'Valgt: {{0}} · {{1}}',
    fi: 'Valittu: {{0}} · {{1}}', de: 'Ausgewählt: {{0}} · {{1}}', fr: 'Sélectionné : {{0}} · {{1}}', es: 'Seleccionado: {{0}} · {{1}}', it: 'Selezionati: {{0}} · {{1}}',
    pt: 'Selecionado: {{0}} · {{1}}', pl: 'Wybrano: {{0}} · {{1}}', nl: 'Geselecteerd: {{0}} · {{1}}', et: 'Valitud: {{0}} · {{1}}', lv: 'Atlasīts: {{0}} · {{1}}', lt: 'Pasirinkta: {{0}} · {{1}}',
    uk: 'Вибрано: {{0}} · {{1}}',
  },
  'bulk.addToHome': {
    ru: 'Добавить на главный экран ({{0}})', en: 'Add to home screen ({{0}})', no: 'Legg til på startskjermen ({{0}})', sv: 'Lägg till på startskärmen ({{0}})', da: 'Føj til startskærm ({{0}})',
    fi: 'Lisää aloitusnäyttöön ({{0}})', de: 'Zum Startbildschirm hinzufügen ({{0}})', fr: 'Ajouter à l’écran principal ({{0}})', es: 'Añadir a la pantalla principal ({{0}})', it: 'Aggiungi alla schermata principale ({{0}})',
    pt: 'Adicionar ao ecrã principal ({{0}})', pl: 'Dodaj do ekranu głównego ({{0}})', nl: 'Toevoegen aan startscherm ({{0}})', et: 'Lisa avakuvale ({{0}})', lv: 'Pievienot sākuma ekrānam ({{0}})', lt: 'Pridėti į pagrindinį ekraną ({{0}})',
    uk: 'Додати на головний екран ({{0}})',
  },
  'bulk.oneLottery': {
    ru: 'За один перенос можно добавить комбинации только одной лотереи.',
    en: 'You can add combinations from only one lottery per transfer.',
    no: 'Du kan legge til kombinasjoner fra bare ett lotteri per overføring.',
    sv: 'Du kan lägga till kombinationer från endast ett lotteri per överföring.',
    da: 'Du kan kun tilføje kombinationer fra ét lotteri pr. overførsel.',
    fi: 'Voit lisätä yhdistelmiä vain yhdestä arvonnasta kerrallaan.',
    de: 'Pro Übertragung lassen sich nur Kombinationen einer Lotterie hinzufügen.',
    fr: 'Vous ne pouvez ajouter que les combinaisons d’une seule loterie par transfert.',
    es: 'Solo puedes añadir combinaciones de una lotería por operación.',
    it: 'Puoi aggiungere combinazioni di una sola lotteria per volta.',
    pt: 'Só pode adicionar combinações de uma lotaria por transferência.',
    pl: 'W jednym przeniesieniu możesz dodać kombinacje tylko jednej loterii.',
    nl: 'Je kunt per overdracht alleen combinaties van één loterij toevoegen.',
    et: 'Ühe ülekandega saab lisada ainult ühe loterii kombinatsioone.',
    lv: 'Vienā pārsūtīšanā var pievienot tikai vienas loterijas kombinācijas.',
    lt: 'Vienu perkėlimu galima pridėti tik vienos loterijos derinius.',
    uk: 'За один перенос можна додати комбінації лише однієї лотереї.',
  },
  'bulk.incompatibleLottery': {
    ru: 'Это комбинация {{0}}. Для одного переноса можно выбрать только комбинации {{1}}.',
    en: 'This is a {{0}} combination. For one transfer, you can select only {{1}} combinations.',
    no: 'Dette er en {{0}}-kombinasjon. I én overføring kan du bare velge {{1}}-kombinasjoner.',
    sv: 'Det här är en {{0}}-kombination. För en överföring kan du bara välja {{1}}-kombinationer.',
    da: 'Dette er en {{0}}-kombination. I én overførsel kan du kun vælge {{1}}-kombinationer.',
    fi: 'Tämä on {{0}}-yhdistelmä. Yhdellä siirrolla voit valita vain {{1}}-yhdistelmiä.',
    de: 'Dies ist eine {{0}}-Kombination. Für eine Übertragung kannst du nur {{1}}-Kombinationen auswählen.',
    fr: 'C’est une combinaison {{0}}. Pour un transfert, vous ne pouvez choisir que des combinaisons {{1}}.',
    es: 'Esta es una combinación de {{0}}. En una transferencia solo puedes seleccionar combinaciones de {{1}}.',
    it: 'Questa è una combinazione {{0}}. Per un trasferimento puoi selezionare solo combinazioni {{1}}.',
    pt: 'Esta é uma combinação de {{0}}. Numa transferência só pode selecionar combinações de {{1}}.',
    pl: 'To jest kombinacja {{0}}. W jednym przeniesieniu możesz wybrać tylko kombinacje {{1}}.',
    nl: 'Dit is een {{0}}-combinatie. Voor één overdracht kun je alleen {{1}}-combinaties selecteren.',
    et: 'See on {{0}} kombinatsioon. Ühe ülekandega saab valida ainult {{1}} kombinatsioone.',
    lv: 'Šī ir {{0}} kombinācija. Vienā pārsūtīšanā var izvēlēties tikai {{1}} kombinācijas.',
    lt: 'Tai yra {{0}} derinys. Vienu perkėlimu galima pasirinkti tik {{1}} derinius.',
    uk: 'Це комбінація {{0}}. Для одного перенесення можна вибрати лише комбінації {{1}}.',
  },
  'bulk.added': {
    ru: 'Добавлено комбинаций: {{0}}', en: 'Combinations added: {{0}}', no: 'Kombinasjoner lagt til: {{0}}', sv: 'Kombinationer tillagda: {{0}}', da: 'Kombinationer tilføjet: {{0}}',
    fi: 'Yhdistelmiä lisätty: {{0}}', de: 'Kombinationen hinzugefügt: {{0}}', fr: 'Combinaisons ajoutées : {{0}}', es: 'Combinaciones añadidas: {{0}}', it: 'Combinazioni aggiunte: {{0}}',
    pt: 'Combinações adicionadas: {{0}}', pl: 'Dodano kombinacji: {{0}}', nl: 'Combinaties toegevoegd: {{0}}', et: 'Kombinatsioone lisatud: {{0}}', lv: 'Pievienotas kombinācijas: {{0}}', lt: 'Pridėta derinių: {{0}}',
    uk: 'Додано комбінацій: {{0}}',
  },
  'bulk.rowLimit': {
    ru: 'Достигнут лимит строк: {{0}}', en: 'Row limit reached: {{0}}', no: 'Radgrense nådd: {{0}}', sv: 'Radgräns nådd: {{0}}', da: 'Rækkegrænse nået: {{0}}',
    fi: 'Riviraja saavutettu: {{0}}', de: 'Zeilenlimit erreicht: {{0}}', fr: 'Limite de lignes atteinte : {{0}}', es: 'Límite de filas alcanzado: {{0}}', it: 'Limite di righe raggiunto: {{0}}',
    pt: 'Limite de linhas atingido: {{0}}', pl: 'Osiągnięto limit wierszy: {{0}}', nl: 'Rijlimiet bereikt: {{0}}', et: 'Ridade limiit täis: {{0}}', lv: 'Sasniegts rindu limits: {{0}}', lt: 'Pasiektas eilučių limitas: {{0}}',
    uk: 'Досягнуто ліміту рядків: {{0}}',
  },

  // ── Free-limit / PRO ─────────────────────────────────────────────────────
  'limit.title': {
    ru: 'Достигнут лимит сохранений', en: 'Save limit reached', no: 'Lagringsgrensen er nådd', sv: 'Spargränsen är nådd', da: 'Grænsen for gemte er nået',
    fi: 'Tallennusraja saavutettu', de: 'Speicherlimit erreicht', fr: 'Limite d’enregistrement atteinte', es: 'Límite de guardado alcanzado', it: 'Limite di salvataggio raggiunto',
    pt: 'Limite de guardados atingido', pl: 'Osiągnięto limit zapisów', nl: 'Opslaglimiet bereikt', et: 'Salvestuslimiit täis', lv: 'Sasniegts saglabāšanas limits', lt: 'Pasiektas išsaugojimų limitas',
    uk: 'Досягнуто ліміту збережень',
  },
  'limit.body': {
    ru: 'Бесплатно можно хранить до {{0}} комбинаций. Замените одну или перейдите на PRO.',
    en: 'Free plan keeps up to {{0}} combinations. Replace one or go PRO.',
    no: 'Gratis kan du lagre opptil {{0}} kombinasjoner. Bytt ut én eller oppgrader til PRO.',
    sv: 'Gratis kan du spara upp till {{0}} kombinationer. Ersätt en eller uppgradera till PRO.',
    da: 'Gratis kan du gemme op til {{0}} kombinationer. Erstat én eller skift til PRO.',
    fi: 'Ilmaiseksi voit tallentaa enintään {{0}} yhdistelmää. Korvaa yksi tai siirry PRO:hon.',
    de: 'Kostenlos sind bis zu {{0}} Kombinationen möglich. Ersetze eine oder wechsle zu PRO.',
    fr: 'L’offre gratuite garde jusqu’à {{0}} combinaisons. Remplacez-en une ou passez à PRO.',
    es: 'Gratis puedes guardar hasta {{0}} combinaciones. Sustituye una o pásate a PRO.',
    it: 'Con il piano gratuito puoi salvare fino a {{0}} combinazioni. Sostituiscine una o passa a PRO.',
    pt: 'No plano grátis pode guardar até {{0}} combinações. Substitua uma ou mude para PRO.',
    pl: 'W planie darmowym zapiszesz do {{0}} kombinacji. Zamień jedną lub przejdź na PRO.',
    nl: 'Gratis kun je tot {{0}} combinaties bewaren. Vervang er een of ga PRO.',
    et: 'Tasuta saad hoida kuni {{0}} kombinatsiooni. Asenda üks või vali PRO.',
    lv: 'Bez maksas var glabāt līdz {{0}} kombinācijām. Nomainiet vienu vai izvēlieties PRO.',
    lt: 'Nemokamai galima saugoti iki {{0}} derinių. Pakeiskite vieną arba pereikite prie PRO.',
    uk: 'Безкоштовно можна зберігати до {{0}} комбінацій. Замініть одну або перейдіть на PRO.',
  },
  'limit.replace': {
    ru: 'Заменить', en: 'Replace', no: 'Bytt ut', sv: 'Ersätt', da: 'Erstat',
    fi: 'Korvaa', de: 'Ersetzen', fr: 'Remplacer', es: 'Sustituir', it: 'Sostituisci',
    pt: 'Substituir', pl: 'Zamień', nl: 'Vervangen', et: 'Asenda', lv: 'Aizstāt', lt: 'Pakeisti',
    uk: 'Замінити',
  },
  'limit.pro': {
    ru: 'Перейти на PRO', en: 'Go PRO', no: 'Oppgrader til PRO', sv: 'Uppgradera till PRO', da: 'Skift til PRO',
    fi: 'Hanki PRO', de: 'Zu PRO wechseln', fr: 'Passer à PRO', es: 'Pasar a PRO', it: 'Passa a PRO',
    pt: 'Mudar para PRO', pl: 'Przejdź na PRO', nl: 'Ga PRO', et: 'Vali PRO', lv: 'Pāriet uz PRO', lt: 'Pereiti prie PRO',
    uk: 'Перейти на PRO',
  },
  'pro.demo': {
    ru: 'В демо PRO недоступен', en: 'PRO is off in this demo', no: 'PRO er av i denne demoen', sv: 'PRO är av i denna demo', da: 'PRO er slået fra i denne demo',
    fi: 'PRO on pois tässä demossa', de: 'PRO ist in dieser Demo aus', fr: 'PRO est désactivé dans cette démo', es: 'PRO está desactivado en esta demo', it: 'PRO è disattivato in questa demo',
    pt: 'PRO está desativado nesta demo', pl: 'PRO jest wyłączone w tym demie', nl: 'PRO staat uit in deze demo', et: 'PRO on selles demos väljas', lv: 'PRO šajā demo ir izslēgts', lt: 'PRO šioje demonstracijoje išjungtas',
    uk: 'PRO вимкнено в цьому демо',
  },

  // ── Shared ───────────────────────────────────────────────────────────────
  'action.cancel': {
    ru: 'Отмена', en: 'Cancel', no: 'Avbryt', sv: 'Avbryt', da: 'Annuller',
    fi: 'Peruuta', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar', it: 'Annulla',
    pt: 'Cancelar', pl: 'Anuluj', nl: 'Annuleren', et: 'Tühista', lv: 'Atcelt', lt: 'Atšaukti',
    uk: 'Скасувати',
  },
  'analysis.pending': {
    ru: 'Доступно в приложении', en: 'Available in the app', no: 'Tilgjengelig i appen', sv: 'Tillgängligt i appen', da: 'Tilgængelig i appen',
    fi: 'Saatavilla sovelluksessa', de: 'In der App verfügbar', fr: 'Disponible dans l’application', es: 'Disponible en la app', it: 'Disponibile nell’app',
    pt: 'Disponível na aplicação', pl: 'Dostępne w aplikacji', nl: 'Beschikbaar in de app', et: 'Saadaval rakenduses', lv: 'Pieejams lietotnē', lt: 'Pasiekiama programėlėje',
    uk: 'Доступно в застосунку',
  },
};
