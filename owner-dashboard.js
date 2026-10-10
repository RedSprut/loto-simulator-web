/* Lotto Simulator — Owner Analytics 2.0 («Панель владельца»).
 *
 * Entry: the «Панель владельца» button in Личный кабинет, revealed ONLY after a server-side owner
 * probe (am_i_owner). Every read goes through the owner-analytics Edge Function, which re-verifies
 * the JWT and calls SECURITY DEFINER RPCs that check public.is_owner(auth.uid()) again → a non-owner
 * gets 403 and no data. Russian only, owner only, real data only.
 *
 * What it shows is the DERIVED identity model, not raw event guesswork:
 *   verified people (accounts) · probable people (anonymous human device groups, lower bound) ·
 *   unknown visitors · an estimated audience RANGE · households · devices · browser profiles ·
 *   sessions, with owner/test and bots excluded by default and counted separately.
 * Each card carries a «Как считается» note, and every probabilistic number carries its confidence.
 *
 * 2026-09-19: the restored calm BLUE theme (tokens from the original «Голубая» palette), a KPI block
 * that names the precision of every number (точно · фильтр · с согласием · оценка), identifier-free
 * visit counters (people / suspicious / bots per country), exact account and purchase metrics from the
 * auth + entitlement tables, and a country choropleth with hover, whole-territory selection, continent
 * view and a scrollable country card. Still Russian only, owner only, real data only.
 *
 * 2026-09-24: the «AI-агенты» section. AI agents acting for a person are shown APART from people:
 * whether the agent's identity was cryptographically proven (Web Bot Auth) or merely claimed, which
 * operator, which account, what it did (visit / login / purchase with plan and amount / simulation)
 * and — the number to watch — what refused it and why. It reads its own ledger
 * (public.agent_activity via owner_agent_activity); no other section's numbers change.
 *
 * 2026-09-26: Русский · English · Norsk. The panel is still AUTHORED in Russian: every literal here is
 * a Russian source passed through t() (owner-i18n.js, the app's own i18n engine over an owner-only
 * catalog), texts the server composes in Russian (notes, notification titles) go through tx(), and
 * numbers, money and dates follow the panel language. The switcher in the header applies at once —
 * the open section, sheet, popup, map and notification centre re-render from the data they already
 * hold — and the choice is remembered. The public app, its language and every number are untouched.
 *
 * 2026-09-27: the panel language FOLLOWS the app language (Русский / Norsk / English → the same panel
 * language, one persisted source of truth: the app's `loto_lang`). The header switcher only appears
 * when the app runs in one of the other 14 locales, as the fallback chooser. And a distinct
 * «Google Analytics 4 — независимая аналитика» block sits UNDER the internal overview: GA4 read
 * server-side as an independent control source, never replacing the internal numbers.
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.LotoOwnerDashboard) return;

  var CFG = (W.LOTO_COMMERCIAL_CONFIG || {});
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var APIKEY = String(CFG.supabasePublishableKey || '');
  var LIB = W.LotoOwnerLib || {};
  var THEME_KEY = 'ow_theme_v2';

  // ── language ───────────────────────────────────────────────────────────────────────────────
  // Tables below keep their Russian sources and are translated where they are printed, so a switch
  // of the panel language only has to re-render. Without owner-i18n.js the panel stays Russian.
  function i18n() { return W.LotoOwnerI18n || null; }
  function t(source) {
    var api = i18n();
    if (api) return api.t.apply(null, arguments);
    var args = Array.prototype.slice.call(arguments, 1);
    return String(source).replace(/{{(\d+)}}/g, function (_, n) { return args[+n] == null ? '' : String(args[+n]); });
  }
  function tx(text) { var api = i18n(); return api ? api.tx(text) : String(text == null ? '' : text); }
  function intl() { var api = i18n(); return api ? api.intl() : 'ru-RU'; }
  function lang() { var api = i18n(); return api ? api.lang : 'ru'; }

  var SECTIONS = [
    // 2026-10-02: the connected trail of every visitor and every server operation (owner_activity).
    { id: 'activity', label: 'Активность' },
    { id: 'day', label: 'День' },
    { id: 'journey', label: 'Путь гостя' },
    { id: 'usage', label: 'Лотереи и функции' },
    { id: 'overview', label: 'Обзор' },
    { id: 'live', label: 'Live' },
    { id: 'people', label: 'Люди' },
    { id: 'households', label: 'Домохозяйства' },
    { id: 'devices', label: 'Устройства' },
    { id: 'sessions', label: 'Сессии' },
    { id: 'acquisition', label: 'Источники' },
    { id: 'geography', label: 'География' },
    { id: 'map', label: 'Карта' },
    { id: 'games', label: 'Игры' },
    { id: 'features', label: 'Функции' },
    { id: 'funnels', label: 'Воронки' },
    { id: 'retention', label: 'Удержание' },
    { id: 'bots', label: 'Боты и QA' },
    { id: 'agents', label: 'AI-агенты' },
    { id: 'consent', label: 'Согласия' },
    { id: 'quality', label: 'Качество данных' }
  ];
  var PRESETS = [
    ['day', 'День по календарю'], ['live', 'Live · 30 минут'], ['today', 'Сегодня'], ['yesterday', 'Вчера'], ['7d', '7 дней'],
    ['30d', '30 дней'], ['90d', '90 дней'], ['month', 'Текущий месяц'], ['lastMonth', 'Прошлый месяц'],
    ['all', 'Всё время'], ['custom', 'Период…']
  ];
  // Choropleth metrics: every one is a column of the `countries` report rows.
  var MAP_METRICS = [
    // 2026-10-14: human geography first — visits whose browser shows a person (a consent decision or a
    // sign-in) and consented people by class; «не определено» and automation stay separate metrics.
    ['visits_people', 'Визиты людей'], ['people_confirmed', 'Люди ✓'], ['people_likely', 'Вероятно люди'],
    ['visits_unknown', 'Визиты: не определено'],
    ['visits_human', 'Обычные визиты'], ['visitors', 'Посетители с согласием'], ['registered', 'Зарегистрированные'],
    ['buyers', 'Покупатели'], ['households', 'Домохозяйства (оценка)'], ['consent_accepted', 'Согласились на аналитику'],
    ['visits_suspicious', 'Подозрительный трафик'], ['visits_bot', 'Боты']
  ];
  var AUDIENCES = [['all', 'Все'], ['guest', 'Гостевые визиты'], ['registered', 'Авторизованные визиты']];
  var PLATFORMS = [['all', 'Все'], ['web', 'Веб'], ['ios', 'iOS'], ['android', 'Android']];
  var HOW = {
    ga4: 'Данные Google Analytics 4 читаются напрямую из GA4 Data API сервисным аккаунтом после проверки владельца. Считает Google по своим правилам (cookie GA4, сессии по 30 минут, без моделирования); учитываются только посетители, согласившиеся на аналитику, — тег GA4 загружается только после согласия. Внутренняя аналитика выше остаётся основной; отсутствующие показатели не заменяются нулями.',
    verified: 'Люди с подтверждённой личностью: вошли в аккаунт. Один аккаунт = один человек, сколько бы устройств он ни использовал. Владелец исключён.',
    probable: 'Анонимные устройства с признаками живого человека, сгруппированные внутри одного домохозяйства по нижней границе: в группу попадают только устройства разных типов, которые никогда не работали одновременно. Это оценка, а не доказанная личность.',
    unknown: 'Анонимные устройства без признаков взаимодействия: один заход без действий. Они не называются людьми и считаются отдельно.',
    estimated: 'Диапазон. Нижняя граница — подтверждённые люди плюс вероятные, которых нельзя объяснить вторым устройством уже известного человека. Верхняя — подтверждённые плюс каждое анонимное устройство отдельно плюс неизвестные посетители.',
    households: 'Домохозяйство — это устройства, которые регулярно выходят из одной домашней сети. Мобильные операторы, CGNAT, VPN и дата-центры домохозяйством не считаются, поэтому сотни людей за одним адресом не склеиваются.',
    devices: 'Физические устройства. Профили браузера объединяются в одно устройство только при сильном доказательстве: совпал технический признак (с отдельного согласия) или тот же аккаунт на идентичном профиле устройства, и сессии не перекрывались.',
    profiles: 'Профиль браузера или установка приложения. Это самый нижний уровень: очистка данных браузера создаёт новый профиль.',
    sessions: 'Сессия обрывается после 30 минут без активности. Перезагрузка страницы сессию не начинает; брошенная вкладка не превращается в многодневную сессию.',
    active: 'Активное время: сумма отчётов о вовлечённости (страница видима и человек взаимодействовал). Для старых данных без таких отчётов время оценивается по интервалам между действиями и помечается как оценка.',
    excluded: 'Владелец и тестовые заходы определяются по аккаунту владельца и по профилям, когда-либо связанным с ним. Боты — по объявленным краулерам, браузерам без интерфейса, сериям мгновенных действий, сетям дата-центров и одиночным заходам сразу после публикации сборки.',
    channels: 'Источник берётся из перехода: домен-источник и метки кампании. Если источника нет (старые данные или возврат в уже открытой вкладке) — «Источник неизвестен». Ничего не домысливается.',
    geo: 'Местоположение определяется по IP на сервере и хранится грубо: страна, регион, город и координаты центра города. Сам IP не сохраняется. Точный адрес не показывается никогда.',
    live: 'Активны сейчас: профили с событиями за последние 5 минут.',
    newPeople: 'Новые: первый визит за всё время попал внутрь выбранного периода.',
    returningPeople: 'Вернувшиеся: человек был известен ДО начала периода и снова заходил внутри него.',
    returnedAnotherDay: 'Приходили в разные дни: человек был активен минимум в два разных календарных дня внутри периода (по выбранному часовому поясу). Новый человек тоже может сюда попасть.',
    repeatSessions: 'Повторные сессии: сколько сессий сверх первой пришлось на людей в этом периоде.',
    consent: 'Долю согласившихся от ВСЕХ посетителей измерить нельзя: до решения не сохраняется ничего, поэтому закрывшие баннер следов не оставляют. Показаны решения, доля согласий среди них и доля данных, собранных с согласием.',
    funnels: 'Воронка по людям: на каждом шаге считается число людей, которые его достигли в выбранном периоде.',
    retention: 'Когорты по дню первого визита. D1/D7/D30 — вернулся ли человек ровно на 1-й, 7-й и 30-й день.',
    quality: 'Качество приёма: сколько событий принято, сколько отклонено и почему. Здесь же свежесть данных и распределение уверенности идентификации.',
    visitsHuman: 'Обычные визиты — визиты без обнаруженных признаков автоматизации (не доказательство живого человека): по одному на загрузку страницы или запуск приложения, независимо от согласия. Сервер считает их как обезличенные счётчики по стране и платформе — без идентификаторов, поэтому «уникальных посетителей» из них вывести нельзя. Автоматизация, headless-браузеры, сети дата-центров, VPN и Tor считаются отдельно.',
    guests: 'Гостевые визиты — визиты без входа в аккаунт (по счётчикам). Кто именно заходил, сервер не знает и не записывает.',
    authorizedVisits: 'Авторизованные визиты — загрузки страницы и запуски приложения, в которых был проверенный вход в аккаунт (по обезличенным счётчикам; какой именно аккаунт, не записывается). Это ВИЗИТЫ, а не люди: один человек за день даёт столько визитов, сколько раз открыл приложение. Число людей за ними — «Точные активные аккаунты» в блоке «Кто это был».',
    registered: 'Точное число: аккаунты в базе авторизации без анонимных сессий. Не зависит от согласия на аналитику и от фильтров трафика. Владелец учтён и показан отдельно.',
    levels: 'FREE / PRO / Lifetime — из серверной таблицы прав доступа (entitlements). PRO — активная платная подписка; Lifetime — бессрочный доступ владельца; истёкшие показаны отдельно. Клиентский флаг isPro не используется никогда.',
    buyers: 'Покупатели — аккаунты с оплаченным правом доступа от магазина (Apple, Google, Paddle, Stripe, RevenueCat) в production. Клиентское событие «оплатил» доказательством не считается. Покупки, продления, возвраты и суммы — из журнала событий магазина (вебхук RevenueCat), который ведётся с момента подключения; промо-доступ, пробные периоды и sandbox покупками не считаются.',
    revenue: 'Сумма покупок (gross) — ровно то, что заплатил покупатель, в его валюте (например 4,99 €); суммы разных валют не складываются. «≈ USD по курсу RevenueCat» — пересчёт самого RevenueCat на момент события (поле price вебхука): ориентир, а не бухгалтерская выручка. Возвраты показаны отдельно и из суммы покупок не вычитаются молча.',
    netRevenue: 'Чистыми (net) = сумма покупки минус удержания магазина по данным RevenueCat (поля tax_percentage и commission_percentage вебхука: налог и комиссия магазина). Показывается только для событий, где RevenueCat сообщил эти доли; иначе — «нет данных», ничего не домысливается. Комиссия RevenueCat за Web Billing и сборы Stripe выставляются отдельными счетами и в событиях отсутствуют.',
    notSales: 'Не продажи: промо-доступ (магазин promotional — владелец выдал доступ бесплатно), пробные периоды (цена 0), события без оплаты и sandbox / Test Store (репетиции оплаты). Они показаны, чтобы было видно, что произошло, но в покупки, продления, отмены, возвраты и суммы не входят.',
    conversion: 'Оценка: новые регистрации за период ÷ обычные визиты за период; покупатели ÷ все аккаунты. Показывается только при достаточной выборке (≥ 20 визитов, ≥ 10 аккаунтов), иначе — «Недостаточно данных».',
    traffic: 'Боты — объявленные краулеры. Подозрительный трафик — headless-браузеры, сети дата-центров, VPN, Tor и всплески запросов с одной сети. Ни одна страна не удаляется вручную: видно, какой это трафик.',
    consented: 'Посетители с согласием — люди из данных, собранных после «Принять»: подтверждённые аккаунты и вероятные анонимные люди. Это часть всех посетителей, а не все посетители.',
    countryMap: 'Страна определяется сервером по сети запроса — это страна посещения, а не гражданство или место жительства; VPN и Tor показаны отдельно. Хранится только счётчик. Аккаунты и покупатели привязаны к стране только если их устройства согласились на аналитику; остальные — «не определено».',
    // 2026-09-20: the calendar day report
    dayBounds: 'Границы дня — календарные сутки в часовом поясе отчёта (по умолчанию Europe/Oslo): от полуночи до полуночи, в день перевода часов — 23 или 25 часов. Исходные метки времени хранятся в UTC и не меняются; день только выбирает окно.',
    dayCompare: 'Сравнение: предыдущий день, тот же день недели неделей раньше и среднее дневных значений за 7 предыдущих дней. Процент показан только когда база больше нуля; для уникальных счётчиков среднее за 7 дней — это среднее по дням, а не уникальные за неделю.',
    dayPeople: 'Люди — посетители с согласием на аналитику: подтверждённые аккаунты, вероятные и неизвестные анонимные устройства (каждое анонимное устройство считается отдельно). Новые — первый визит в истории попал в этот день; вернувшиеся — были известны раньше. Это не все посетители: без согласия остаются только счётчики визитов.',
    dayEntities: 'Аккаунты, устройства, сессии и домохозяйства — четыре разные величины: один человек может иметь несколько устройств, несколько сессий за день и делить домашнюю сеть с другими. IP-адрес никогда не считается человеком.',
    dayStatuses: 'Статусы активных за день аккаунтов — из серверной таблицы прав доступа: FREE, PRO (активная платная подписка), PRO Lifetime, PRO истёк/отменён. Гости — устройства без входа в аккаунт. Владелец и тестовые аккаунты считаются отдельно и в эти цифры не входят даже при включённом переключателе.',
    dayRegistrations: 'Регистрации — аккаунты, созданные в этот день (точно, из базы авторизации, без анонимных сессий и без владельца). Анонимная сессия, ставшая аккаунтом, считается по дате создания её записи.',
    dayLanguages: 'Язык интерфейса — из событий с согласием (locale приложения). Страна — из счётчиков визитов (сервер, по сети) и сессий с согласием. Это две независимые величины: язык не выводится из страны и наоборот.',
    dayCommerce: 'Покупки, продления, отмены, возвраты, сбои оплаты, тариф (1/3/6/12 мес.) и магазин — из журнала событий магазина (вебхук RevenueCat), только оплаченные события production. Промо-доступ, пробные периоды, sandbox и Test Store считаются отдельно и покупками не являются. У событий без цены сумма не выдумывается: они показаны как «без суммы». Checkout начат / не удался — клиентские события экрана оплаты.',
    dayFeatures: 'Функции — все события приложения за день: сколько раз произошло и сколько уникальных пользователей (аккаунт, человек или устройство) их совершили. Периодические отчёты об активности не показываются.',
    daySystem: 'Сбои за день: отклонённые и невалидные события приёма, ошибки разбора аналитики, недоставленные push, ошибки в приложении у пользователей и системные уведомления владельца.',
    identity: 'Шесть разных величин, которые не складываются друг в друга. Точные аккаунты — один auth-аккаунт = один пользователь, сколько бы визитов, сессий и устройств у него ни было (владелец отдельно). Оценка уникальных гостей — гостевые профили с согласием (одна стабильная анонимная идентичность) плюс дневные ключи гостей без согласия: HMAC суток, сети, браузера, ОС, устройства, платформы и языка; 50 загрузок одного такого гостя за день — 1 гость и 50 визитов, на следующий день — новый ключ. IP не хранится, ключ не считается доказанным человеком и не является аккаунтом; ключи, за которыми в тот же день был вход в аккаунт, исключены. Визиты, сессии, устройства и домохозяйства — отдельные метрики.',
    liveFeed: 'Лента — реальные события сегодня (по часовому поясу отчёта): действия пользователей с согласием, платежи магазина, новые аккаунты и обезличенные счётчики визитов по часам. Показаны только страна, платформа, язык, лотерея/функция, статус и 8-значный псевдоним; e-mail, IP и идентификаторы устройств не существуют в этих данных. Владелец и боты скрыты, пока не включены переключатели.',
    journey: 'Путь одного человека по продукту: новый гость (первый визит без аккаунта) → активный гость (сделал что-то значимое) → новый пользователь (реальная первая регистрация) → PRO (действующий PRO-доступ). Гость — это установка (браузер или приложение) с согласием на аналитику: без согласия действий не видно, такой гость есть только в визитах. Обновление страницы, повторное открытие, новая сессия, смена языка или темы и навигация никого не делают новым и не считаются действием.',
    journeyGuests: 'Новый гость — установка, чья самая первая сессия с согласием началась в периоде без входа в аккаунт. Вернувшийся гость — установка, известная до периода, снова пришедшая без аккаунта. Один браузер = один гость; разные браузеры одного человека без входа в аккаунт — разные гости, потому что связать их надёжно нельзя.',
    journeyActive: 'Активный гость — гость с хотя бы одним значимым действием: генерация рядов, симуляция тиража, 3D-тираж до конца, проверка билета, анализ периода, календарный анализ, суд (присяжные, защита, судья), сохранение или отправка комбинаций, приглашение через «Поделиться», запуск PRO-модели. Интерес к PRO (попытка PRO-функции, экран PRO, начало оплаты) — отдельный сигнал. Просмотр разделов, открытие экранов, язык, тема, прокрутка — не действия. Карточка «Активный гость» одна на гостя в день и обновляется, а не дублируется.',
    journeyUsers: 'Новый пользователь — только реальная первая регистрация аккаунта (не анонимный, не владелец). Гостевая история привязывается к аккаунту, только если вход в этот аккаунт произошёл на той же установке; адрес, сеть и похожие устройства людей не объединяют. После регистрации действия этой установки без входа считаются действиями аккаунта. FREE — аккаунт без действующего PRO; PRO — действующий платный или бессрочный доступ; новые PRO — первая оплата в периоде.',
    journeyCohort: 'Берутся новые гости выбранного периода, и для каждого смотрится, что с ним стало до сегодняшнего дня: стал ли активным, зарегистрировался ли (через вход на той же установке), стал ли PRO. Проценты — от числа новых гостей периода.',
    usage: 'Какие лотереи и функции реально используют. Источник — события с согласием на аналитику (без согласия действий не видно). Человек — аккаунт, если на установке был вход в аккаунт, иначе установка (браузер или приложение). Люди, установки, сессии и действия — четыре разных числа: один активный человек с сотней генераций остаётся одним человеком, поэтому популярность сортируется по людям. Обновление страницы, открытие приложения, навигация, язык и тема — не использование функции; одинаковое событие, повторённое в пределах секунды, считается одним.',
    usageUnits: 'Действие — значимое использование: генерация рядов, симуляция, 3D-тираж до конца, проверка билета, анализ, календарь, суд (присяжные, защитник, судья), сохранение или отправка комбинаций, приглашение через «Поделиться», PRO-модель, интерес к PRO. Открытие — только посмотрел (открыл генератор, 3D-барабан, суд, статистику, результаты, выбрал лотерею). Лотерея записывается только у действий, которые относятся к лотерее; язык, тема, вход, оплата — глобальные и без лотереи.',
    usageStatus: 'Статус в момент действия: гость — до входа в аккаунт на этой установке; PRO — приложение в этот момент имело PRO-доступ; иначе FREE. Один человек может за период побывать гостем, FREE и PRO — тогда он есть в каждой строке, а в итогах один раз.',
    usageMatrix: 'Клетка — сколько людей (или сессий, или действий — переключатель) сделали это в этой лотерее или стране. Нажатие на клетку, строку или столбец включает фильтр.',
    usageTransitions: 'Люди, которые в выбранном срезе были гостями, и что с ними стало к сегодняшнему дню: зарегистрировали аккаунт (вход на той же установке), делали что-то уже в аккаунте, получили PRO (действующий доступ или оплата). Адрес, сеть и похожие устройства людей не объединяют.',
    human: 'Кто за трафиком — по доказательствам, которые видит сервер, без новых данных о людях. «Человек ✓» — вошёл в аккаунт или сделал в приложении то, что делается только нажатием (выбрал лотерею, сгенерировал, открыл функцию, сохранил…). «Вероятно человек» — согласился на аналитику (это нажатие), но больше ничего не сделал; для визитов — браузер, где уже принято решение по согласию. «Не определено» — загрузка страницы без решения по согласию и без входа: так же выглядит и человек, закрывший вкладку, и сервис, открывший ссылку; такие визиты считаются, но не входят ни в людей, ни в страны, ни в уведомления. «Автоматический трафик» — боты, мониторинг, headless-браузеры, агенты, дата-центры, VPN, Tor; хранится для диагностики («Включить ботов»). Люди и визиты не складываются: загрузка страницы человеком с согласием — тоже визит.',
    usageShare: 'Одно нажатие человека на «Поделиться» (блок на главной или «О приложении») — одно действие; оно записывается, когда известен итог: сервис открыт, текст или ссылка скопированы, системное меню отправило. Показ блока не считается, повтор одного нажатия тоже. Канал — только код (системное меню, копировать ссылку, Facebook, X, Reddit, Telegram, WhatsApp, LinkedIn, e-mail, Instagram, TikTok): текст, ссылка и получатель не сохраняются. Только события с согласием на аналитику; владелец, тестовые установки и боты исключены.',
    usagePeople: 'Люди выбираются фильтрами, а путь показывает всё, что человек делал за период: страна → лотерея → функции в ней (по первому использованию) → другие лотереи, интерес к PRO, регистрация, PRO. Функция, которую только открыли, помечена «открыл». Показано до 100 последних активных людей.'
  };

  var state = {
    section: 'overview',
    preset: 'day',
    day: LIB.todayYMD ? LIB.todayYMD('Europe/Oslo') : '',
    block: null,
    tz: 'Europe/Oslo',
    custom: { from: '', to: '' },
    filters: { platform: 'all', country: 'all', lottery: 'all', audience: 'all', feature: 'all', status: 'all' },
    usageMetric: 'people',
    toggles: { owner: false, bots: false, unknown: true },
    ga4Loading: false, ga4Error: null,
    compare: true,
    page: 0,
    peopleKind: 'all',
    mapMetric: 'visits_people',
    continent: 'all',
    selectedCountry: null,
    kpiError: null,
    busy: false,
    refreshing: false,
    lastRefresh: null,
    data: {},
    error: null
  };
  var mapRemount = false;
  var ovEl = null, mapApi = null, livePoll = null, hourglassTimer = null, mapLoading = false;

  // ── api ────────────────────────────────────────────────────────────────────────────────────
  async function api(payload) {
    var session = null;
    try { if (W.LotoAuth && W.LotoAuth.getSession) session = await W.LotoAuth.getSession(); } catch (e) {}
    var headers = { 'Content-Type': 'application/json', 'apikey': APIKEY };
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    var response = await fetch(BASE + '/functions/v1/owner-analytics', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    var body = null;
    try { body = await response.json(); } catch (e) {}
    if (!response.ok) {
      var error = new Error((body && (body.error || body.detail)) || ('HTTP ' + response.status));
      error.status = response.status;
      error.code = body && body.code ? String(body.code) : '';
      error.detail = body && body.detail ? String(body.detail).slice(0, 300) : '';
      throw error;
    }
    return body;
  }
  async function isOwner() {
    try { var r = await api({ probe: true }); return r && r.owner === true; } catch (e) { return false; }
  }
  function currentRange() {
    if (state.preset === 'day' && LIB.dayRange) return LIB.dayRange(state.day, state.tz);
    var r = LIB.range ? LIB.range(state.preset, Date.now(), state.tz, state.custom.from, state.custom.to) : null;
    return r || { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: new Date().toISOString(), bucket: 'day', tz: state.tz };
  }
  function params(extra) {
    var range = currentRange();
    var payload = {
      from: range.from, to: range.to, tz: range.tz, bucket: range.bucket,
      platform: state.filters.platform, country: state.filters.country, lottery: state.filters.lottery,
      audience: state.filters.audience, feature: state.filters.feature, status: state.filters.status,
      include_owner: state.toggles.owner, include_bots: state.toggles.bots, include_unknown: state.toggles.unknown
    };
    if (state.compare && range.prev_from) { payload.prev_from = range.prev_from; payload.prev_to = range.prev_to; }
    return Object.assign(payload, extra || {});
  }

  // ── formatting ─────────────────────────────────────────────────────────────────────────────
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(value) { var n = +value || 0; return n.toLocaleString(intl()); }
  function money(value, currency) { return LIB.formatMoney ? LIB.formatMoney(value, currency) : (+value).toLocaleString(intl()) + ' ' + (currency || ''); }
  function moneyList(rows, key) { return LIB.moneyList ? LIB.moneyList(rows, key) : ''; }
  // Server money text «4.99 EUR + 99 NOK» → «4,99 € · 99,00 kr» (each currency on its own, never summed).
  function moneyTextRu(text) {
    if (!text) return '';
    return String(text).split(' + ').map(function (part) {
      var m = /^(-?[\d.]+)\s+([A-Z]{3})$/.exec(part.trim());
      return m ? money(m[1], m[2]) : part;
    }).join(' · ');
  }
  function usdEstimate(value) { return LIB.usdEstimate ? LIB.usdEstimate(value) : ''; }
  function none() { return '<span class="ow-kpi-none">' + esc(t('нет данных')) + '</span>'; }
  function dur(ms) { return LIB.formatDuration ? LIB.formatDuration(ms) : t('{{0}} с', Math.round((+ms || 0) / 1000)); }
  function pctText(part, total) { return total ? Math.round((part / total) * 100) + '%' : '—'; }
  function timeText(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(intl(), { timeZone: state.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(value); }
  }
  function clockText(value) {
    try { return new Date(value).toLocaleTimeString(intl(), { timeZone: state.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; }
  }
  function label(map, key) { return (map && map[key]) ? t(map[key]) : (key || '—'); }
  function place(row) {
    var parts = [];
    if (row.city) parts.push(row.city);
    if (row.region && row.region !== row.city) parts.push(row.region);
    if (row.country) parts.push(countryName(row.country));
    return parts.length ? parts.join(' · ') : t('Место не определено');
  }
  function confidenceChip(value, evidence) {
    var c = LIB.confidence ? LIB.confidence(value) : { value: value, label: '', tone: 'mid' };
    var tip = (evidence || []).map(function (e) { return LIB.evidenceRu ? LIB.evidenceRu(e) : e; }).join(' · ');
    return '<span class="ow-conf ow-conf-' + c.tone + '" title="' + esc(c.label + (tip ? ': ' + tip : '')) + '">' + c.value + '</span>';
  }
  function how(key) {
    return '<button class="ow-how" type="button" data-how="' + esc(key) + '" aria-label="' + esc(t('Как считается')) + '">i</button>';
  }
  function card(title, value, sub, howKey, delta) {
    return '<div class="ow-card">' +
      '<div class="ow-card-h"><span>' + esc(t(title)) + '</span>' + (howKey ? how(howKey) : '') + '</div>' +
      '<div class="ow-card-v">' + value + '</div>' +
      (delta ? '<div class="ow-card-d ' + delta.dir + '">' + delta.text + '</div>' : '') +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') + '</div>';
  }
  function deltaOf(current, previous) {
    if (previous == null || previous === 0) return null;
    var change = LIB.pctChange ? LIB.pctChange(current, previous) : null;
    if (!change) return null;
    var arrow = change.dir === 'up' ? '▲' : change.dir === 'down' ? '▼' : '■';
    return { dir: change.dir, text: arrow + ' ' + esc(t('{{0}}% к прошлому периоду ({{1}})', Math.abs(Math.round(change.pct)), num(previous))) };
  }
  function table(columns, rows, empty) {
    if (!rows || !rows.length) return '<div class="ow-empty">' + esc(t(empty || 'Нет данных за период')) + '</div>';
    return '<div class="ow-tw"><table class="ow-t"><thead><tr>' +
      columns.map(function (c) { return '<th' + (c.numeric ? ' class="num"' : '') + '>' + esc(t(c.title)) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (row, index) {
        var cls = (row.__click ? 'ow-click ' : '') + (row.__class || '');
        return '<tr' + (cls.trim() ? ' class="' + esc(cls.trim()) + '"' : '') + (row.__click ? ' data-row="' + index + '"' : '') + '>' +
          columns.map(function (c) { return '<td' + (c.numeric ? ' class="num"' : '') + '>' + (c.html ? c.html(row) : esc(row[c.key])) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function barList(entries, labels, howKey, title) {
    var rows = Object.keys(entries || {}).map(function (key) { return { key: key, value: +entries[key] || 0 }; })
      .sort(function (a, b) { return b.value - a.value; });
    var max = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    if (!rows.length) return '<div class="ow-empty">' + esc(t('Нет данных за период')) + '</div>';
    return '<div class="ow-block"><div class="ow-block-h">' + esc(t(title || '')) + (howKey ? how(howKey) : '') + '</div>' +
      rows.map(function (row) {
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(label(labels, row.key)) + '</span>' +
          '<span class="ow-bar-t"><i style="width:' + (max ? Math.max(2, Math.round((row.value / max) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(row.value) + '</span></div>';
      }).join('') + '</div>';
  }
  function chartColors() {
    return (ovEl && ovEl.getAttribute('data-ow-theme') === 'dark')
      ? ['#6fb7ff', '#5eead4', '#c4b5fd']
      : ['#1d4ed8', '#0891b2', '#7c3aed'];
  }
  function lineChart(series, keys, titles) {
    if (!series || series.length < 2) return '<div class="ow-empty">' + esc(t('Для графика нужно минимум две точки')) + '</div>';
    var width = 720, height = 190, padLeft = 42, padBottom = 26, padTop = 12;
    var max = 0;
    series.forEach(function (point) { keys.forEach(function (key) { max = Math.max(max, +point[key] || 0); }); });
    max = max || 1;
    var stepX = (width - padLeft - 10) / Math.max(1, series.length - 1);
    var colors = chartColors();
    var paths = keys.map(function (key, index) {
      var d = series.map(function (point, i) {
        var x = padLeft + i * stepX;
        var y = padTop + (height - padTop - padBottom) * (1 - (+point[key] || 0) / max);
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      return '<path d="' + d + '" fill="none" stroke="' + colors[index % colors.length] + '" stroke-width="2.2" stroke-linejoin="round"/>';
    }).join('');
    var ticks = [0, 0.5, 1].map(function (fraction) {
      var y = padTop + (height - padTop - padBottom) * (1 - fraction);
      return '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - 10) + '" y2="' + y + '" class="ow-grid"/>' +
        '<text x="6" y="' + (y + 4) + '" class="ow-axis">' + num(Math.round(max * fraction)) + '</text>';
    }).join('');
    var labels = series.map(function (point, i) {
      if (series.length > 8 && i % Math.ceil(series.length / 8) !== 0) return '';
      var x = padLeft + i * stepX;
      return '<text x="' + x + '" y="' + (height - 8) + '" class="ow-axis" text-anchor="middle">' + esc(String(point.bucket).slice(5)) + '</text>';
    }).join('');
    var legend = keys.map(function (key, index) {
      return '<span><i style="background:' + colors[index % colors.length] + '"></i>' + esc(t(titles[index])) + '</span>';
    }).join('');
    return '<div class="ow-chart"><svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="' + esc(t('График')) + '">' +
      ticks + paths + labels + '</svg><div class="ow-legend">' + legend + '</div></div>';
  }

  // ── styles ─────────────────────────────────────────────────────────────────────────────────
  function resolveTheme() {
    var stored = null;
    try { stored = W.localStorage.getItem(THEME_KEY); } catch (e) {}
    if (stored === 'light' || stored === 'dark') return stored;
    try { if (D.body && D.body.classList.contains('dark')) return 'dark'; } catch (e) {}
    try { return W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function ensureStyles() {
    if (D.getElementById('ow-style')) return;
    var css = [
      '#ow-ov{position:fixed;inset:0;z-index:1300;display:none;background:var(--ow-bg);color:var(--ow-tx);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '#ow-ov.show{display:flex;flex-direction:column}',
      // «Голубая» — the original soft light-blue palette of the owner analytics (commit 6235a66), restored.
      '#ow-ov[data-ow-theme="light"]{--ow-bg:#e8f2fc;--ow-card:#ffffff;--ow-card2:#d7e9fb;--ow-tx:#0d2540;--ow-sub:#3f6690;--ow-bd:#bcd7f2;--ow-accent:#1d4ed8;--ow-up:#0f7a4d;--ow-down:#c62a5a;--ow-chip:#e3effc}',
      // Night variant of the same character: deep blue surfaces, luminous blue accent.
      '#ow-ov[data-ow-theme="dark"]{--ow-bg:#0b1624;--ow-card:#12223a;--ow-card2:#0f1c30;--ow-tx:#e6f0fb;--ow-sub:#8fb0d6;--ow-bd:#22405f;--ow-accent:#4f8ff7;--ow-up:#5ad19a;--ow-down:#f2789a;--ow-chip:#183050}',
      '#ow-ov .ow-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card);min-width:0}',
      '#ow-ov .ow-title{font-weight:800;font-size:16px;margin-right:auto;min-width:0;flex:1 1 140px}',
      '#ow-ov .ow-btn{min-height:34px;padding:6px 12px;border-radius:10px;border:1px solid var(--ow-bd);background:var(--ow-card2);color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov .ow-btn[disabled]{opacity:.6;cursor:progress}',
      '#ow-ov .ow-btn-primary{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      // The panel language switcher: three always-visible flag buttons (a segmented control) in the
      // header; native language names, never translated. It is never hidden by any panel state.
      '#ow-ov .ow-lang{display:inline-flex !important;flex:0 0 auto;gap:2px;padding:2px;border-radius:11px;border:1px solid var(--ow-bd);background:var(--ow-card2)}',
      '#ow-ov .ow-lang button{min-height:30px;padding:4px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}',
      '#ow-ov .ow-lang button[aria-pressed="true"]{background:var(--ow-accent);color:#fff}',
      '#ow-ov .ow-lang button:focus-visible{outline:2px solid var(--ow-accent);outline-offset:1px}',
      '#ow-ov .ow-lang .ow-lang-f{font-size:15px;line-height:1}',
      '@media (max-width:719px){#ow-ov .ow-lang{flex:1 1 100%}#ow-ov .ow-lang button{flex:1 1 0}}',
      // The owner bell inside the panel header (the public header has no owner bell at all).
      '#ow-ov .ow-bell{position:relative;padding:6px 10px;line-height:1}',
      '#ow-ov .ow-bell .ow-bell-ico{font-size:16px}',
      '#ow-ov .ow-bell.has-unread{border-color:var(--ow-accent);box-shadow:0 0 0 1px var(--ow-accent) inset}',
      '#ow-ov .ow-bell-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:var(--ow-accent);color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center}',
      '#ow-ov .ow-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card2)}',
      '#ow-ov select,#ow-ov input[type="date"]{min-height:32px;padding:4px 8px;border-radius:9px;border:1px solid var(--ow-bd);background:var(--ow-card);color:inherit;font:inherit}',
      '#ow-ov .ow-toggle{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9px;border:1px solid var(--ow-bd);background:var(--ow-card);cursor:pointer}',
      '#ow-ov .ow-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card)}',
      '#ow-ov .ow-tab{white-space:nowrap;padding:6px 12px;border-radius:999px;border:1px solid var(--ow-bd);background:var(--ow-card2);cursor:pointer;font-weight:700;color:inherit;font:inherit}',
      '#ow-ov .ow-tab[aria-selected="true"]{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      '#ow-ov .ow-body{flex:1;overflow:auto;padding:14px;position:relative;min-width:0}',
      '#ow-ov .ow-controls{min-width:0}#ow-ov .ow-controls label{max-width:100%;min-width:0}',
      '#ow-ov select,#ow-ov input[type="date"]{max-width:100%}',
      '#ow-ov .ow-tabs{min-width:0;max-width:100%}',
      '#ow-ov .ow-cards,#ow-ov .ow-block,#ow-ov .ow-chart{min-width:0}',
      '@media (max-width:719px){#ow-ov .ow-status{flex:1 1 100%;margin-left:0;text-align:left}#ow-ov .ow-top .ow-btn{flex:1 1 auto}}',
      // Phones: the filter bar folds away behind «Фильтры», so a section (and the map) starts on the first screen.
      '#ow-ov .ow-filters-btn{display:none}',
      '@media (max-width:719px){#ow-ov .ow-filters-btn{display:inline-block}#ow-ov .ow-controls{display:none}#ow-ov .ow-controls.open{display:flex}}',
      '#ow-ov .ow-money .ow-card-v{font-size:22px}',
      '#ow-ov .ow-tag-kind{background:rgba(242,193,78,.25);color:#a8730b}',
      '#ow-ov .ow-cmp-l{font-weight:800;color:var(--ow-sub)}',
      '#ow-ov .ow-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}',
      '#ow-ov .ow-card{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px}',
      '#ow-ov .ow-card-h{display:flex;align-items:center;gap:6px;color:var(--ow-sub);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;flex-wrap:wrap}',
      // Long uppercase titles («Зарегистрированные») must wrap inside a narrow card, never push the info button out of it.
      '#ow-ov .ow-card-h > span:first-child{min-width:0;flex:1 1 auto;overflow-wrap:anywhere}',
      '#ow-ov .ow-card-v{font-size:26px;font-weight:800;margin-top:6px;overflow-wrap:anywhere}',
      '#ow-ov .ow-card-s{color:var(--ow-sub);font-size:12px;margin-top:4px}',
      '#ow-ov .ow-card-d{font-size:12px;font-weight:700;margin-top:4px}',
      '#ow-ov .ow-card-d.up{color:var(--ow-up)}#ow-ov .ow-card-d.down{color:var(--ow-down)}#ow-ov .ow-card-d.stable{color:var(--ow-sub)}',
      '#ow-ov .ow-how{width:18px;height:18px;border-radius:50%;border:1px solid var(--ow-bd);background:var(--ow-chip);color:var(--ow-sub);font:700 11px/1 system-ui;cursor:pointer;flex:0 0 auto}',
      '#ow-ov .ow-block{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px;margin-top:12px}',
      '#ow-ov .ow-block-h{display:flex;align-items:center;gap:6px;font-weight:800;margin-bottom:8px}',
      '#ow-ov .ow-bar{display:grid;grid-template-columns:minmax(120px,1fr) 2fr auto;gap:8px;align-items:center;margin:4px 0}',
      '#ow-ov .ow-bar-t{height:10px;border-radius:6px;background:var(--ow-chip);overflow:hidden}',
      '#ow-ov .ow-bar-t i{display:block;height:100%;background:var(--ow-accent)}',
      '#ow-ov .ow-bar-v{font-weight:700;min-width:54px;text-align:right}',
      '#ow-ov .ow-tw{overflow:auto;max-width:100%}',
      '#ow-ov table.ow-t{width:100%;border-collapse:collapse;font-size:13px}',
      '#ow-ov table.ow-t th,#ow-ov table.ow-t td{padding:7px 8px;border-bottom:1px solid var(--ow-bd);text-align:left;white-space:nowrap}',
      '#ow-ov table.ow-t th{color:var(--ow-sub);font-size:11px;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0;background:var(--ow-card)}',
      '#ow-ov table.ow-t td.num,#ow-ov table.ow-t th.num{text-align:right;font-variant-numeric:tabular-nums}',
      '#ow-ov tr.ow-click{cursor:pointer}#ow-ov tr.ow-click:hover{background:var(--ow-card2)}',
      '#ow-ov .ow-empty{color:var(--ow-sub);padding:14px;text-align:center}',
      '#ow-ov .ow-conf{display:inline-block;min-width:30px;padding:1px 6px;border-radius:7px;font-weight:800;font-size:12px;text-align:center}',
      '#ow-ov .ow-conf-high{background:rgba(90,209,154,.22);color:var(--ow-up)}',
      '#ow-ov .ow-conf-good{background:rgba(90,209,154,.14);color:var(--ow-up)}',
      '#ow-ov .ow-conf-mid{background:rgba(242,193,78,.22);color:#a8730b}',
      '#ow-ov .ow-conf-low{background:rgba(242,120,154,.2);color:var(--ow-down)}',
      '#ow-ov .ow-chart{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:10px;margin-top:12px}',
      '#ow-ov .ow-chart svg{width:100%;height:190px}',
      '#ow-ov .ow-grid{stroke:var(--ow-bd);stroke-width:1}',
      '#ow-ov text.ow-axis{fill:var(--ow-sub);font-size:10px}',
      '#ow-ov .ow-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--ow-sub);font-size:12px;margin-top:6px}',
      '#ow-ov .ow-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}',
      '#ow-ov .ow-load{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--ow-bg) 78%,transparent);z-index:5}',
      '#ow-ov .ow-load.show{display:flex}',
      '#ow-ov .ow-hg{font-size:34px;line-height:1}',
      '#ow-ov .ow-stages{color:var(--ow-sub);font-size:12px;text-align:center;max-width:280px}',
      '#ow-ov .ow-status{color:var(--ow-sub);font-size:12px;margin-left:auto;text-align:right}',
      '#ow-ov .ow-err{background:rgba(242,120,154,.14);border:1px solid var(--ow-down);border-radius:12px;padding:10px;margin-top:10px;display:flex;gap:10px;align-items:center}',
      // The map is the section: as tall as the viewport allows on a desktop, wide and short on a phone.
      // The box follows the world's own proportions (≈1.9:1 between 56°S and 78°N): sizeMapBox() sets the
      // height from the box's real width, so a phone gets a wide, short world with no empty ocean below it
      // and a desktop the tallest box that still fits. These are only the fallback heights before that.
      '#ow-ov .ow-map{height:clamp(300px,60vh,720px);border-radius:16px;overflow:hidden;border:1px solid var(--ow-bd);margin-top:10px;background:var(--ow-card2)}',
      '@media (max-width:719px){#ow-ov .ow-map{height:220px;border-radius:12px}}',
      '#ow-ov .ow-map-note{color:var(--ow-sub);font-size:12px;margin-top:6px}',
      // The ⓘ «Как считается» note (and every other openPopup message) is ONE component: a fixed
      // backdrop that flex-centres the card in the viewport — horizontally and vertically, whatever
      // the section's scroll position — above the country / person sheets (z 30), with the safe-area
      // insets kept free and a long note scrolling inside the card instead of leaving the screen.
      '#ow-ov .ow-pop-back{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:12px;padding:max(12px,var(--loto-safe-top,env(safe-area-inset-top,0px))) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:rgba(8,14,26,.35)}',
      '#ow-ov .ow-pop{position:relative;box-sizing:border-box;width:100%;max-width:560px;max-height:100%;overflow:auto;overscroll-behavior:contain;margin:0;background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.35)}',
      '#ow-ov .ow-pop h3{margin:0 0 6px;font-size:14px}',
      '#ow-ov .ow-pop p{margin:0;color:var(--ow-sub);font-size:13px}',
      // Sheets (person / country / visitor cards) and the notification centre open BELOW the header
      // (--ow-top-h is its measured height), so the header — the language buttons above all — stays
      // visible and usable whatever is open (2026-10-02).
      '#ow-ov .ow-sheet{position:fixed;inset:var(--ow-top-h,0px) 0 0 0;background:rgba(8,4,8,.55);display:flex;align-items:flex-end;justify-content:center;z-index:30}',
      '#ow-ov .ow-sheet-in{background:var(--ow-card);border-radius:16px 16px 0 0;width:min(760px,100%);max-height:min(88vh,calc(100vh - var(--ow-top-h,0px) - 8px));overflow:auto;padding:14px}',
      '#ow-ov #own-center{top:var(--ow-top-h,0px)}',
      '@media (min-width:720px){#ow-ov .ow-sheet{align-items:center}#ow-ov .ow-sheet-in{border-radius:16px}}',
      '#ow-ov .ow-jr{display:grid;grid-template-columns:64px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid var(--ow-bd);font-size:13px}',
      '#ow-ov .ow-jr b{font-variant-numeric:tabular-nums;color:var(--ow-sub);font-weight:700}',
      '#ow-ov .ow-deny{padding:30px;text-align:center}',
      // KPI precision tags, empty states, map legend / tooltip / country card
      '#ow-ov .ow-tag{display:inline-block;margin-left:auto;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;text-transform:none;letter-spacing:0;background:var(--ow-chip);color:var(--ow-sub);white-space:nowrap}',
      '#ow-ov .ow-tag-exact{color:var(--ow-up)}#ow-ov .ow-tag-estimate{color:#a8730b}',
      // The GA4 block is visibly a different source: a dashed frame and its own tag on every card.
      '#ow-ov .ow-ga4{border:2px dashed var(--ow-bd);margin-top:20px}#ow-ov .ow-ga4>.ow-block-h{font-size:15px}#ow-ov .ow-tag-ga4{background:#fbbc04;color:#3c2a00;margin-left:6px}#ow-ov .ow-ga4 .ow-block{margin-top:10px}',
      '#ow-ov .ow-kpi-none{font-size:15px;font-weight:700;color:var(--ow-sub);margin-top:10px}',
      '#ow-ov .ow-kpi-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px}',
      '#ow-ov .ow-kpi-h h2{font-size:15px;margin:0 8px 0 0}',
      '#ow-ov .ow-legend-scale{display:flex;align-items:center;gap:4px;margin-top:8px;color:var(--ow-sub);font-size:12px;flex-wrap:wrap}',
      '#ow-ov .ow-legend-scale i{display:inline-block;width:22px;height:12px;border-radius:3px;border:1px solid var(--ow-bd)}',
      '#ow-ov .ow-map{position:relative}',
      '#ow-ov .ow-map-tip{position:absolute;left:0;top:0;pointer-events:none;background:var(--ow-card);color:var(--ow-tx);border:1px solid var(--ow-bd);border-radius:10px;padding:6px 9px;font-size:12px;line-height:1.4;box-shadow:0 8px 24px rgba(13,37,64,.18);z-index:4;max-width:240px}',
      '#ow-ov .ow-map-tip[hidden]{display:none}',
      // Label pills of the active countries (HTML markers: no glyph server, themed with the panel).
      '#ow-ov .ow-map-pill{pointer-events:auto;cursor:pointer;border:1px solid rgba(29,78,216,.35);border-radius:999px;padding:2px 8px;font:700 11px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:rgba(255,255,255,.92);color:#0d2540;box-shadow:0 4px 14px rgba(13,37,64,.18);white-space:nowrap;transform:translateZ(0)}',
      '#ow-ov .ow-map-pill:hover,#ow-ov .ow-map-pill.is-selected{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
      '#ow-ov .ow-map-pill.is-hidden{display:none}',
      '#ow-ov [data-ow-map-theme="dark"] .ow-map-pill{background:rgba(18,34,58,.94);border-color:rgba(195,221,250,.45);color:#e6f0fb;box-shadow:0 4px 14px rgba(0,0,0,.45)}',
      '#ow-ov [data-ow-map-theme="dark"] .ow-map-pill:hover,#ow-ov [data-ow-map-theme="dark"] .ow-map-pill.is-selected{background:#c3ddfa;border-color:#c3ddfa;color:#0b1624}',
      '@media (max-width:719px){#ow-ov .ow-map-pill{font-size:10px;padding:1px 6px}}',
      '#ow-ov .maplibregl-ctrl-attrib{font-size:10px}',
      '#ow-ov .ow-block-h{flex-wrap:wrap}#ow-ov .ow-block-h select{max-width:46vw}',
      '#ow-ov .ow-country-h{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;margin-bottom:8px;flex-wrap:wrap}',
      '#ow-ov .ow-country-h .ow-flag{font-size:28px;line-height:1}',
      '#ow-ov .ow-country-h code{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--ow-chip);padding:3px 6px;border-radius:6px}',
      '#ow-ov .ow-sheet-in .ow-cards{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}',
      // 2026-09-20: calendar bar, chips, comparison deltas, day header, LIVE feed
      '#ow-ov .ow-daybar{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '#ow-ov .ow-daybar[hidden]{display:none}',
      '#ow-ov .ow-chip{min-height:32px;padding:4px 11px;border-radius:999px;border:1px solid var(--ow-bd);background:var(--ow-card);color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov .ow-chip[aria-pressed="true"]{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      '#ow-ov .ow-daynav{min-width:34px;padding:4px 8px}',
      '#ow-ov .ow-dayhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 10px}',
      '#ow-ov .ow-dayhead h2{margin:0;font-size:20px}',
      '#ow-ov .ow-dayhead .ow-card-s{font-size:13px}',
      '#ow-ov .ow-cmp{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:11.5px;color:var(--ow-sub);line-height:1.35}',
      '#ow-ov .ow-cmp b{font-weight:800}',
      '#ow-ov .ow-cmp .up{color:var(--ow-up)}#ow-ov .ow-cmp .down{color:var(--ow-down)}',
      '#ow-ov .ow-block[id^="ow-b-"]{scroll-margin-top:12px}',
      '#ow-ov .ow-block.ow-focus{outline:2px solid var(--ow-accent);outline-offset:2px}',
      // «Активность» (2026-10-02): event rows with progressive disclosure, actor / status chips, the
      // «новое» highlight (a calm outline + tag, no flashing), the chart switchers, donut and heatmap.
      '#ow-ov .ow-act-views{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '#ow-ov .ow-act-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 10px;align-items:end;margin-bottom:12px}',
      '#ow-ov .ow-act-filters>label:not(.ow-toggle){display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--ow-sub);min-width:0}',
      '#ow-ov .ow-act-filters>label select{width:100%;color:var(--ow-tx);font-size:14px}',
      '#ow-ov .ow-act-search{display:flex;gap:6px;min-width:0;grid-column:span 2}',
      '@media (max-width:719px){#ow-ov .ow-act-search{grid-column:1/-1}}',
      '#ow-ov .ow-act-small{font-size:15px;line-height:1.3;display:block}#ow-ov .ow-sheet-in.ow-act .ow-card-v{font-size:20px;line-height:1.2}',
      '#ow-ov .ow-act-search input{flex:1;min-width:0;min-height:32px;padding:4px 10px;border-radius:9px;border:1px solid var(--ow-bd);background:var(--ow-card);color:inherit;font:inherit}',
      '#ow-ov .ow-act-note{padding:10px 12px;margin-bottom:12px;border:1px solid var(--ow-bd);border-left:4px solid var(--ow-accent);border-radius:10px;background:var(--ow-card)}',
      '#ow-ov .ow-act-chain{display:inline-block;margin-top:6px;color:var(--ow-sub);font-size:13px;line-height:1.7}#ow-ov .ow-act-chain b{color:var(--ow-accent)}',
      '#ow-ov .ow-act-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}',
      '#ow-ov .ow-act-cs{display:inline-flex;gap:4px;margin-left:auto;flex-wrap:wrap}#ow-ov .ow-act-cs .ow-chip{padding:2px 9px;font-size:12px}',
      '#ow-ov .ow-act-ev{border:1px solid var(--ow-bd);border-radius:10px;background:var(--ow-card);margin:6px 0;transition:border-color .6s ease,box-shadow .6s ease}',
      '#ow-ov .ow-act-ev>summary{display:grid;grid-template-columns:70px 22px 1fr auto;gap:8px;align-items:start;padding:8px 10px;cursor:pointer;list-style:none}',
      '#ow-ov .ow-act-ev>summary::-webkit-details-marker{display:none}',
      '#ow-ov .ow-act-ev[open]>summary{border-bottom:1px solid var(--ow-bd)}',
      '#ow-ov .ow-act-t{font-variant-numeric:tabular-nums;color:var(--ow-sub);font-weight:700;font-size:12px;padding-top:2px}',
      '#ow-ov .ow-act-i{text-align:center}#ow-ov .ow-act-m{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '#ow-ov .ow-act-h{font-weight:700}#ow-ov .ow-act-s{font-size:12px;color:var(--ow-sub);overflow-wrap:anywhere}',
      '#ow-ov .ow-act-src{font-size:11px;color:var(--ow-sub);border:1px solid var(--ow-bd);border-radius:999px;padding:1px 8px;white-space:nowrap}',
      '#ow-ov .ow-act-operation{border-left:3px solid #7c3aed}#ow-ov .ow-act-action{border-left:3px solid var(--ow-accent)}',
      '#ow-ov .ow-act-error,#ow-ov .ow-act-fail{border-left:3px solid var(--ow-down)}#ow-ov .ow-act-session .ow-act-ev,#ow-ov .ow-act-view{border-left-width:3px}',
      '#ow-ov .ow-act-d{padding:8px 12px 10px;font-size:13px}#ow-ov .ow-act-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 14px}',
      '#ow-ov .ow-act-fact{display:flex;gap:8px;min-width:0}#ow-ov .ow-act-fact span{color:var(--ow-sub);min-width:110px}#ow-ov .ow-act-fact b{font-weight:600;overflow-wrap:anywhere}',
      '#ow-ov .ow-act-tech,#ow-ov .ow-act-raw{margin-top:8px}#ow-ov .ow-act-tech>summary,#ow-ov .ow-act-raw>summary{cursor:pointer;color:var(--ow-accent);font-weight:700;font-size:12px}',
      '#ow-ov .ow-act-raw pre{max-height:240px;overflow:auto;background:var(--ow-card2);border-radius:8px;padding:8px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '#ow-ov .ow-act-ids div{font-size:12px;overflow-wrap:anywhere}#ow-ov .ow-act-ids span{color:var(--ow-sub);display:inline-block;min-width:64px}',
      '#ow-ov .ow-act-lin{color:var(--ow-sub);font-size:12px;margin-bottom:6px}#ow-ov .ow-act-link{white-space:nowrap}',
      '#ow-ov .ow-act-actor{display:inline-block;padding:0 8px;border-radius:999px;font-size:11px;font-weight:800;background:var(--ow-chip)}',
      '#ow-ov .ow-act-actor-admin{background:rgba(242,193,78,.28);color:#8a5d00}#ow-ov .ow-act-actor-agent{background:rgba(124,58,237,.16);color:#6d28d9}',
      '#ow-ov[data-ow-theme="dark"] .ow-act-actor-admin{color:#fcd34d}#ow-ov[data-ow-theme="dark"] .ow-act-actor-agent{color:#c4b5fd}',
      '#ow-ov .ow-act-st{display:inline-block;padding:0 7px;border-radius:999px;font-size:11px;font-weight:800}',
      '#ow-ov .ow-act-st-ok{background:rgba(15,122,77,.14);color:var(--ow-up)}#ow-ov .ow-act-st-err{background:rgba(198,42,90,.14);color:var(--ow-down)}#ow-ov .ow-act-st-warn{background:rgba(217,119,6,.16);color:#b45309}',
      '#ow-ov .ow-act-errn{color:var(--ow-down)}',
      '#ow-ov .ow-new{border-color:var(--ow-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--ow-accent) 22%,transparent)}',
      '#ow-ov tr.ow-new td{background:color-mix(in srgb,var(--ow-accent) 8%,transparent)}',
      '#ow-ov .ow-new-tag{display:inline-block;margin-left:4px;padding:0 6px;border-radius:999px;background:var(--ow-accent);color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}',
      '#ow-ov .ow-act-session{margin:10px 0}#ow-ov .ow-act-sh{font-size:12px;font-weight:800;color:var(--ow-sub);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 2px}',
      '#ow-ov .ow-act-donut{display:flex;flex-wrap:wrap;gap:12px;align-items:center}#ow-ov .ow-act-donut svg{width:140px;height:140px;flex:0 0 auto}',
      '#ow-ov .ow-act-donut-n{font-size:20px;font-weight:800;fill:var(--ow-tx)}#ow-ov .ow-act-legend{display:flex;flex-direction:column;gap:3px;font-size:13px;min-width:0}',
      '#ow-ov .ow-act-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}#ow-ov .ow-act-legend span{color:var(--ow-sub)}',
      '#ow-ov .ow-act-heat{display:grid;grid-template-columns:28px repeat(24,minmax(0,1fr));gap:2px;overflow-x:auto}',
      '#ow-ov .ow-act-hh,#ow-ov .ow-act-hd{font-size:10px;color:var(--ow-sub);text-align:center}#ow-ov .ow-act-hd{text-align:left;line-height:16px}',
      '#ow-ov .ow-act-hc{height:16px;border-radius:3px;background:var(--ow-accent);opacity:var(--a);min-width:6px}',
      '@media (max-width:719px){#ow-ov .ow-act-ev>summary{grid-template-columns:58px 18px 1fr}#ow-ov .ow-act-src{display:none}#ow-ov .ow-act-fact{flex-direction:column;gap:0}}',
      '@media(prefers-reduced-motion:reduce){#ow-ov .ow-act-ev{transition:none}}',
      '#ow-ov .ow-anchors{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '#ow-ov .ow-anchors a{color:var(--ow-accent);text-decoration:none;font-size:12px;font-weight:700;padding:3px 9px;border:1px solid var(--ow-bd);border-radius:999px;background:var(--ow-card)}',
      '#ow-ov .ow-status-chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:800;background:var(--ow-chip);color:var(--ow-sub);white-space:nowrap}',
      '#ow-ov .ow-status-pro,#ow-ov .ow-status-lifetime{background:rgba(90,209,154,.2);color:var(--ow-up)}',
      '#ow-ov .ow-status-owner{background:rgba(242,193,78,.25);color:#a8730b}',
      '#ow-ov .ow-status-expired{background:rgba(242,120,154,.18);color:var(--ow-down)}',
      '#ow-ov .ow-human{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;background:var(--ow-chip);color:var(--ow-sub)}',
      '#ow-ov .ow-human-confirmed{background:rgba(90,209,154,.22);color:var(--ow-up)}',
      '#ow-ov .ow-human-likely{background:rgba(79,143,247,.16);color:var(--ow-accent)}',
      '#ow-ov .ow-human-automated{background:rgba(242,120,154,.16);color:var(--ow-down)}',
      '#ow-ov .ow-feed-commerce td{background:rgba(90,209,154,.08)}',
      '#ow-ov .ow-feed-account td{background:rgba(79,143,247,.09)}',
      '#ow-ov .ow-feed-visits td{color:var(--ow-sub)}',
      '#ow-ov .ow-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ow-up);margin-right:6px;animation:ow-pulse 1.6s ease-in-out infinite}',
      '@keyframes ow-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '@media(prefers-reduced-motion:reduce){#ow-ov .ow-live-dot{animation:none}}',
      // «Лотереи и функции»: section filters, heat matrices, journey chips (wrap on phones)
      '#ow-ov .ow-u-bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:10px 12px}',
      '#ow-ov .ow-u-f{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ow-sub);min-width:0}',
      '#ow-ov .ow-u-f select{max-width:190px;min-height:32px}',
      '#ow-ov .ow-u-metric{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}',
      '#ow-ov .ow-u-metric .ow-chip{min-height:28px;padding:2px 9px;font-size:12px}',
      '#ow-ov .ow-u-link{border:0;background:none;padding:0;color:inherit;font:inherit;font-weight:700;cursor:pointer;text-align:left;text-decoration:underline dotted var(--ow-bd);text-underline-offset:3px}',
      '#ow-ov table.ow-u-m th:first-child{position:sticky;left:0;z-index:1;background:var(--ow-card);text-transform:none;letter-spacing:0;font-size:12px;color:var(--ow-tx)}',
      '#ow-ov .ow-u-cell{min-width:38px;border:0;border-radius:7px;padding:4px 7px;font:inherit;font-weight:800;color:var(--ow-tx);cursor:pointer;background:rgba(79,143,247,var(--a,.1))}',
      '#ow-ov .ow-u-zero{color:var(--ow-bd)}',
      '#ow-ov .ow-path{display:flex;flex-wrap:wrap;gap:4px;align-items:center;white-space:normal;min-width:240px;max-width:560px}',
      '#ow-ov .ow-path-s{padding:1px 7px;border-radius:999px;background:var(--ow-chip);font-size:12px;font-weight:600;white-space:nowrap}',
      '#ow-ov .ow-path-lottery{background:var(--ow-accent);color:#fff;font-weight:800}',
      '#ow-ov .ow-path-country{background:none;padding-left:0;font-weight:800}',
      '#ow-ov .ow-path-status{background:rgba(90,209,154,.2);color:var(--ow-up);font-weight:800}',
      '#ow-ov .ow-path-seen{opacity:.6;font-weight:500}',
      '#ow-ov .ow-path-a{color:var(--ow-sub);font-size:11px}',
      '@media(max-width:640px){#ow-ov .ow-u-f{flex:1 1 100%;justify-content:space-between}#ow-ov .ow-u-f select{flex:1;max-width:none}#ow-ov .ow-path{min-width:200px}}'
    ].join('\n');
    var style = D.createElement('style');
    style.id = 'ow-style';
    style.textContent = css;
    (D.head || D.documentElement).appendChild(style);
  }

  // ── shell ──────────────────────────────────────────────────────────────────────────────────
  function build() {
    if (ovEl) return ovEl;
    ensureStyles();
    ovEl = D.createElement('div');
    ovEl.id = 'ow-ov';
    // The owner panel keeps the platform date inputs: it has its own language (ru/en/no), so the app's
    // date overlay + in-app picker (index.html localizeDateInput) must not take these over.
    ovEl.setAttribute('data-native-date', '');
    ovEl.setAttribute('data-i18n-ignore', '');
    ovEl.setAttribute('data-ow-theme', resolveTheme());
    ovEl.innerHTML =
      '<div class="ow-top">' +
        '<button class="ow-btn" id="ow-back" type="button" data-owt="‹ Назад"></button>' +
        '<span class="ow-title" data-owt="Аналитика — реальная аудитория"></span>' +
        // The owner analytics bell lives HERE, inside the owner panel — never in the public header.
        // owner-notifications.js reveals it after the server owner probe and owns its badge.
        '<button class="ow-btn ow-bell" id="owner-bell-btn" type="button" hidden aria-label="' + esc(t('Уведомления владельца')) + '">' +
          '<span class="ow-bell-ico" aria-hidden="true">🔔</span>' +
          '<span class="ow-bell-badge" id="owner-bell-badge" hidden aria-hidden="true">0</span></button>' +
        '<button class="ow-btn ow-filters-btn" id="ow-filters" type="button" aria-expanded="false" data-owt="Фильтры"></button>' +
        '<span class="ow-lang" id="ow-lang" role="group" data-owt-aria="Язык панели"></span>' +
        '<button class="ow-btn" id="ow-theme" type="button" data-owt="Тема"></button>' +
        '<button class="ow-btn" id="ow-export" type="button" data-owt="Экспорт"></button>' +
        '<button class="ow-btn ow-btn-primary" id="ow-refresh" type="button" data-owt="Обновить"></button>' +
      '</div>' +
      '<div class="ow-controls" id="ow-controls">' +
        '<label><span data-owt="Период"></span> <select id="ow-preset"></select></label>' +
        '<span id="ow-daybar" class="ow-daybar" role="group" data-owt-aria="Календарь">' +
          '<button class="ow-chip" type="button" data-day="0" data-owt="Сегодня"></button>' +
          '<button class="ow-chip" type="button" data-day="-1" data-owt="Вчера"></button>' +
          '<button class="ow-chip" type="button" data-day="-2" data-owt="Позавчера"></button>' +
          '<button class="ow-btn ow-daynav" type="button" id="ow-day-prev" data-owt-aria="Предыдущий день">‹</button>' +
          '<input type="date" id="ow-day" data-owt-aria="Дата" max="2099-12-31" min="2026-01-01">' +
          '<button class="ow-btn ow-daynav" type="button" id="ow-day-next" data-owt-aria="Следующий день">›</button>' +
        '</span>' +
        '<span id="ow-custom" hidden><input type="date" id="ow-from" data-owt-aria="С"> — <input type="date" id="ow-to" data-owt-aria="По"></span>' +
        '<label><span data-owt="Часовой пояс"></span> <select id="ow-tz"></select></label>' +
        '<label><span data-owt="Платформа"></span> <select id="ow-platform"></select></label>' +
        '<label><span data-owt="Лотерея"></span> <select id="ow-lottery"><option value="all"></option></select></label>' +
        '<label><span data-owt="Аудитория"></span> <select id="ow-audience"></select></label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-compare" checked> <span data-owt="Сравнить с прошлым периодом"></span></label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-owner"> <span data-owt="Включить владельца / тесты"></span></label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-bots"> <span data-owt="Включить ботов"></span></label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-unknown" checked> <span data-owt="Включить неизвестных"></span></label>' +
        '<span class="ow-status" id="ow-status"></span>' +
      '</div>' +
      '<div class="ow-tabs" id="ow-tabs" role="tablist"></div>' +
      '<div class="ow-body" id="ow-content">' +
        '<div class="ow-load" id="ow-load"><div class="ow-hg" id="ow-hg">⏳</div><div class="ow-stages" id="ow-stages"></div></div>' +
        '<div id="ow-section"></div>' +
      '</div>';
    D.body.appendChild(ovEl);
    // Keep --ow-top-h equal to the header's height (it wraps differently per language and width).
    var topBar = ovEl.querySelector('.ow-top');
    var syncTop = function () { try { ovEl.style.setProperty('--ow-top-h', Math.round(topBar.getBoundingClientRect().bottom) + 'px'); } catch (e) {} };
    try { if (W.ResizeObserver) new W.ResizeObserver(syncTop).observe(topBar); } catch (e) {}
    W.addEventListener('resize', syncTop);
    ovEl.__syncTop = syncTop;
    // The panel is a body-level "-ov" overlay built lazily, so the shell's modal manager has to be
    // told about it: __lotoClose routes an external close (another modal opening, Escape, native
    // back) through the REAL close(), which releases the scroll lock and stops the live poll, the
    // map and the owner notification centre. Without this the manager stripped .show behind our
    // back and the page stayed locked with the panel's timers running.
    ovEl.__lotoClose = function (reason) {
      // Escape closes the innermost layer first (notification centre, ⓘ note, sheet), the panel last.
      if (reason === 'escape' && closeInnermost()) return;
      close();
    };
    try { if (W.LotoModals && W.LotoModals.register) W.LotoModals.register(ovEl); } catch (e) {}

    relabel();
    syncControls();
    var zones = (LIB.ZONES || ['Europe/Oslo', 'UTC']).slice();
    try {
      var local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local && zones.indexOf(local) < 0) zones.push(local);
    } catch (e) {}
    ovEl.querySelector('#ow-tz').innerHTML = zones.map(function (z) { return '<option value="' + esc(z) + '"' + (z === state.tz ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('');
    wire();
    return ovEl;
  }

  // Every static text of the shell in the panel language: [data-owt] / [data-owt-aria] carry the
  // Russian source, the selects and tabs are rebuilt with their current value kept.
  function options(list, current) {
    return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>'; }).join('');
  }
  function relabel() {
    if (!ovEl) return;
    var code = lang();
    ovEl.setAttribute('lang', code === 'no' ? 'nb' : code);
    ovEl.querySelectorAll('[data-owt]').forEach(function (el) { el.textContent = t(el.getAttribute('data-owt')); });
    ovEl.querySelectorAll('[data-owt-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-owt-aria'))); });
    // The three panel languages are always offered (the catalog is the panel's own, so even before
    // owner-i18n.js loads the buttons exist); the pressed one is the language the panel speaks.
    var langs = (i18n() && i18n().LANGS) || ['ru', 'en', 'no'];
    var flags = { ru: ['Русский', '🇷🇺'], en: ['English', '🇬🇧'], no: ['Norsk', '🇳🇴'] };
    ovEl.querySelector('#ow-lang').innerHTML = langs.map(function (c) {
      var n = i18n() ? i18n().languageName(c) : { name: flags[c][0], flag: flags[c][1] };
      return '<button type="button" data-lang="' + c + '" lang="' + (c === 'no' ? 'nb' : c) + '" aria-pressed="' + (c === code) + '" title="' + esc(n.name) + '">' +
        '<span class="ow-lang-f" aria-hidden="true">' + esc(n.flag) + '</span> <span class="ow-lang-n">' + esc(n.name) + '</span></button>';
    }).join('');
    ovEl.querySelector('#ow-preset').innerHTML = options(PRESETS, state.preset);
    ovEl.querySelector('#ow-platform').innerHTML = options(PLATFORMS, state.filters.platform);
    ovEl.querySelector('#ow-audience').innerHTML = options(AUDIENCES, state.filters.audience);
    var lottery = ovEl.querySelector('#ow-lottery');
    if (lottery && lottery.options[0]) lottery.options[0].textContent = t('Все');
    ovEl.querySelector('#ow-tabs').innerHTML = SECTIONS.map(function (s) {
      return '<button class="ow-tab" role="tab" data-section="' + s.id + '" aria-selected="' + (s.id === state.section) + '">' + esc(t(s.label)) + '</button>';
    }).join('');
  }

  var stageView = null;
  function setHourglass(on, message) {
    var load = ovEl.querySelector('#ow-load');
    var stages = ovEl.querySelector('#ow-stages');
    if (message) { stageView = typeof message === 'function' ? message : null; stages.textContent = stageView ? stageView() : message; }
    load.classList.toggle('show', !!on);
    if (on && !hourglassTimer) {
      var flip = false;
      hourglassTimer = setInterval(function () {
        flip = !flip;
        var hg = ovEl.querySelector('#ow-hg');
        if (hg) hg.textContent = flip ? '⌛' : '⏳';
      }, 520);
    }
    if (!on && hourglassTimer) { clearInterval(hourglassTimer); hourglassTimer = null; }
  }
  // The status line is kept as the function that builds it, so a language switch can rebuild it.
  var statusView = null;
  function setStatus(view) {
    statusView = typeof view === 'function' ? view : null;
    var el = ovEl.querySelector('#ow-status');
    if (el) el.innerHTML = typeof view === 'function' ? view() : String(view || '');
  }

  // ── data loading ───────────────────────────────────────────────────────────────────────────
  async function load(section, extra) {
    if (state.busy) return null;                        // never two requests for the same view
    state.busy = true;
    state.error = null;
    setHourglass(true, function () { return t('Загрузка раздела…'); });
    try {
      var response = await api({ section: section, params: params(extra) });
      state.data[section] = response;
      return response;
    } catch (error) {
      state.error = error;
      return null;
    } finally {
      state.busy = false;
      setHourglass(false);
    }
  }
  // Overview = its own section + the KPI block; the map = the batch of country rows. Each request
  // fails on its own: a KPI failure never hides the overview, and vice versa.
  async function loadMany(sections, extra) {
    if (state.busy) return null;
    state.busy = true;
    state.error = null;
    state.kpiError = null;
    setHourglass(true, function () { return t('Загрузка раздела…'); });
    try {
      var section0 = sections[0];
      state.journeyError = null;
      var settled = await Promise.allSettled(sections.map(function (name) { return api({ section: name, params: params(extra) }); }));
      settled.forEach(function (outcome, index) {
        var name = sections[index];
        if (outcome.status === 'fulfilled') { state.data[name] = outcome.value; return; }
        state.data[name] = null;
        if (name === 'kpi') state.kpiError = outcome.reason;
        else if (name === 'journey' && section0 !== 'journey') state.journeyError = outcome.reason;   // the day report stands on its own
        else state.error = outcome.reason;
      });
      return settled;
    } finally {
      state.busy = false;
      setHourglass(false);
    }
  }
  async function show(section, extra) {
    state.section = section;
    ovEl.querySelectorAll('.ow-tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.getAttribute('data-section') === section));
    });
    stopLive();
    // Leaving the map tab frees its WebGL context, markers and listeners at once; the next visit builds
    // a fresh map into the freshly rendered box (an orphaned instance kept answering for a detached box).
    if (section !== 'map' && mapApi) { mapApi.destroy(); mapApi = null; }
    if (section === 'overview') { await loadMany(['overview', 'kpi'], extra); state.ga4Loading = true; state.ga4Error = null; }
    else if (section === 'map') { await loadMany(['countries'], extra); state.data.map = state.data.countries; }
    // The day report shows the guest journey of the same day as its own block, from its own request.
    else if (section === 'day') await loadMany(['day', 'journey'], extra);
    else if (section === 'activity') await load('activity', actExtra(extra));
    else await load(section, extra);
    render();
    if (section === 'overview') loadGa4();   // its own request, its own states — never on the overview's path
    if (section === 'live') startLive();
    if (section === 'activity') startActivityPoll();
    if (section === 'map') {
      mountMap();
      // On a phone the folded filter bar still leaves the tabs above the map: bring the map up.
      try { if (W.innerWidth < 720) { var box = ovEl.querySelector('#ow-mapbox'); if (box) box.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } catch (e) {}
    }
    focusBlock();
  }
  // Deep links (#owner?d=…&s=day&b=commerce) land on a block of the day report.
  function focusBlock() {
    if (!state.block) return;
    var block = state.block;
    state.block = null;
    var el = ovEl.querySelector('#ow-b-' + block.replace(/[^a-z_]/g, ''));
    if (!el) return;
    try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    el.classList.add('ow-focus');
    setTimeout(function () { el.classList.remove('ow-focus'); }, 2600);
  }
  // Keep the calendar bar, the preset select and the date input in step with the state.
  function syncControls() {
    if (!ovEl) return;
    var preset = ovEl.querySelector('#ow-preset'); if (preset) preset.value = state.preset;
    var bar = ovEl.querySelector('#ow-daybar'); if (bar) bar.hidden = state.preset !== 'day';
    var custom = ovEl.querySelector('#ow-custom'); if (custom) custom.hidden = state.preset !== 'custom';
    var input = ovEl.querySelector('#ow-day'); if (input && state.day) input.value = state.day;
    var today = LIB.todayYMD ? LIB.todayYMD(state.tz) : '';
    var next = ovEl.querySelector('#ow-day-next'); if (next) next.disabled = !!today && state.day >= today;
    ovEl.querySelectorAll('.ow-chip[data-day]').forEach(function (chip) {
      var target = LIB.shiftDay ? LIB.shiftDay(today, +chip.getAttribute('data-day')) : null;
      chip.setAttribute('aria-pressed', String(state.preset === 'day' && !!target && target === state.day));
    });
    var tz = ovEl.querySelector('#ow-tz'); if (tz) tz.value = state.tz;
  }
  function setDay(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    state.preset = 'day';
    state.day = ymd;
    state.data = {};
    state.page = 0;
    syncControls();
    reload();
  }
  function reload() { return show(state.section); }

  // ── refresh with real stages ───────────────────────────────────────────────────────────────
  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;
    var button = ovEl.querySelector('#ow-refresh');
    button.disabled = true;
    button.setAttribute('data-owt', 'Обновление…');
    button.textContent = t('Обновление…');
    setHourglass(true, function () { return t('Получение свежих событий…'); });
    try {
      var result = await api({ refresh: true });
      var run = (result && result.refresh && result.refresh.run) || {};
      var stages = run.stage_ms || {};
      var order = [['sessions', 'Сессии'], ['profiles', 'Профили'], ['devices', 'Устройства'], ['households', 'Домохозяйства'], ['people', 'Люди'], ['summaries', 'Сводки']];
      setHourglass(true, order.filter(function (s) { return stages[s[0]] != null; })
        .map(function (s) { return t('{{0}} ✓ {{1}} мс', t(s[1]), stages[s[0]]); }).join(' · ') || t('Идентификация…'));
      state.data = {};
      state.busy = false;
      if (mapApi) { mapApi.destroy(); mapApi = null; }
      await show(state.section);
      var events = result.refresh.new_events, sessions = result.refresh.new_sessions, scanned = run.events_scanned;
      var at = new Date();
      state.lastRefresh = at;
      setStatus(function () {
        var added = [];
        if (events) added.push(t('+{{0}} событий', num(events)));
        if (sessions) added.push(t('+{{0}} сессий', num(sessions)));
        return esc(t('Обновлено {{0}}', clockText(at)) + (added.length ? ' · ' + added.join(' · ') : '') +
          (scanned != null ? ' · ' + t('обработано {{0}}', num(scanned)) : ''));
      });
    } catch (error) {
      setStatus(function () { return '<span style="color:var(--ow-down)">' + esc(t('Не удалось обновить: {{0}}', error.message || t('ошибка'))) + '</span>'; });
      renderError(error, refresh);
    } finally {
      setHourglass(false);
      button.disabled = false;
      button.setAttribute('data-owt', 'Обновить');
      button.textContent = t('Обновить');
      state.refreshing = false;
    }
  }

  // The owner gets a sentence and a code that says which part failed; the details stay in the logs.
  var ERROR_TEXT = {
    REPORT_COMPARE_FAILED: 'Не удалось посчитать сравнение с прошлым периодом.',
    REPORT_SECTION_FAILED: 'Не удалось загрузить этот раздел.',
    REPORT_QUERY_FAILED: 'Не удалось загрузить отчёт.',
    REPORT_TIMEOUT: 'Отчёт считался слишком долго. Попробуйте более короткий период.'
  };
  function errorText(error) {
    var code = error && error.code;
    if (code && ERROR_TEXT[code]) return t(ERROR_TEXT[code]) + ' ' + t('Код: {{0}}', code);
    if (error && error.status === 403) return t('Нет доступа к панели владельца.');
    if (error && /Failed to fetch|NetworkError|load failed/i.test(error.message || '')) return t('Нет связи с сервером. Проверьте соединение.');
    return t('Ошибка: {{0}}', (error && error.message) ? tx(error.message) : t('неизвестно'));
  }

  function renderError(error, retry) {
    var host = ovEl.querySelector('#ow-section');
    var box = D.createElement('div');
    box.className = 'ow-err';
    box.innerHTML = '<span>' + esc(errorText(error)) + '</span>';
    var button = D.createElement('button');
    button.className = 'ow-btn';
    button.type = 'button';
    button.setAttribute('data-owt', 'Повторить');
    button.textContent = t('Повторить');
    button.addEventListener('click', function () { box.remove(); (retry || reload)(); });
    box.appendChild(button);
    host.prepend(box);
  }

  // ── live ───────────────────────────────────────────────────────────────────────────────────
  function startLive() {
    stopLive();
    livePoll = setInterval(async function () {
      if (state.section !== 'live' || D.hidden || state.busy || state.refreshing) return;
      await load('live');
      if (state.section === 'live') render();
    }, 15000);
  }
  function stopLive() { if (livePoll) { clearInterval(livePoll); livePoll = null; } }

  // ── map ────────────────────────────────────────────────────────────────────────────────────
  function countryRows() {
    var response = state.data.countries;
    return (response && response.data && Array.isArray(response.data.rows)) ? response.data.rows : [];
  }
  function worldMeta(iso) {
    try { return (mapApi && mapApi.world && mapApi.world.meta[iso]) || null; } catch (e) { return null; }
  }
  // A country in the panel language: the Russian table / the map's Russian name for Russian, Intl
  // region names (then the map's English name) for English and Norwegian.
  function countryName(iso) {
    if (!iso || iso === 'ZZ') return t('Не определено');
    var ru = lang() === 'ru';
    var fromCatalog = ru ? (LIB.countryNameRu ? LIB.countryNameRu(iso) : iso) : (LIB.countryName ? LIB.countryName(iso) : iso);
    if (fromCatalog !== iso) return fromCatalog;
    var meta = worldMeta(iso);
    return (meta && ((ru && meta.ru) || meta.n)) || iso;
  }
  // «территория Норвегии» for a dependency drawn as its own feature (SJ → NO, GF → FR, TK → NZ).
  function parentNote(iso) {
    var meta = worldMeta(iso);
    return meta && meta.parent ? t('территория: {{0}}', countryName(meta.parent)) : '';
  }
  function continentOf(iso) {
    try { return (mapApi && mapApi.world && mapApi.world.meta[iso] && mapApi.world.meta[iso].c) || null; } catch (e) { return null; }
  }
  function metricLabel(metric) {
    for (var i = 0; i < MAP_METRICS.length; i++) if (MAP_METRICS[i][0] === metric) return t(MAP_METRICS[i][1]);
    return metric;
  }
  // Compact tooltip: the selected metric first, then the three anchors — each figure exactly once.
  function hoverHtml(iso, metric) {
    var row = countryRows().filter(function (r) { return r.country === iso; })[0] || {};
    var lines = [[metric, metricLabel(metric)], ['visits_people', 'Визиты людей'], ['visits_unknown', 'Визиты: не определено'], ['registered', 'Аккаунты'], ['buyers', 'Покупатели']];
    var seen = {};
    var parent = parentNote(iso);
    return '<b>' + esc((LIB.flagEmoji ? LIB.flagEmoji(iso) + ' ' : '') + countryName(iso)) + '</b>' + (parent ? '<br><i>' + esc(parent) + '</i>' : '') +
      lines.filter(function (l) { if (seen[l[0]]) return false; seen[l[0]] = true; return true; })
        .map(function (l, i) { return '<br>' + esc(t(l[1])) + ': ' + (i === 0 ? '<b>' + num(row[l[0]]) + '</b>' : num(row[l[0]])); }).join('');
  }
  // Height from the real width (world aspect ≈ 1.9:1), capped by the viewport; re-applied on resize.
  function sizeMapBox(host) {
    try {
      var width = host.clientWidth || host.getBoundingClientRect().width;
      if (!width) return;
      var phone = W.innerWidth < 720;
      var max = phone ? Math.min(460, Math.round(W.innerHeight * 0.6)) : Math.min(720, Math.round(W.innerHeight * 0.72));
      var height = Math.round(Math.max(phone ? 200 : 300, Math.min(width / 1.9, max)));
      host.style.height = height + 'px';
    } catch (e) {}
  }
  var mapResizeTimer = null;
  W.addEventListener('resize', function () {
    if (!ovEl || !ovEl.classList.contains('show') || state.section !== 'map') return;
    clearTimeout(mapResizeTimer);
    mapResizeTimer = setTimeout(function () { var host = ovEl.querySelector('#ow-mapbox'); if (host) { sizeMapBox(host); if (mapApi) mapApi.resize(); } }, 120);
  });
  async function mountMap(force) {
    var host = ovEl.querySelector('#ow-mapbox');
    if (mapLoading) { if (force) mapRemount = true; return; }
    if (!host) return;
    sizeMapBox(host);
    var rows = countryRows();
    if (mapApi && !force && mapApi.map && mapApi.map.getContainer() === host) {
      mapApi.setData(rows, state.mapMetric); mapApi.setContinent(state.continent); mapApi.select(state.selectedCountry); mapApi.resize(); return;
    }
    mapLoading = true;
    setHourglass(true, function () { return t('Загрузка карты…'); });
    try {
      if (mapApi) { mapApi.destroy(); mapApi = null; }
      // Versioned like every other runtime script: an unversioned dynamic import could be served from
      // the HTTP cache (max-age 600) or the service worker's stale-while-revalidate for a while after a deploy.
      var rev = '';
      try { rev = D.documentElement.getAttribute('data-build') || ''; } catch (e) {}
      var module = await import('./owner-map.js' + (rev ? '?v=' + encodeURIComponent(rev) : ''));
      mapApi = await module.createMap({
        container: host,
        theme: ovEl.getAttribute('data-ow-theme'),
        colorFor: function (value, max, theme) { return LIB.choroplethColor ? LIB.choroplethColor(value, max, theme) : (value > 0 ? '#5591db' : '#dde6ee'); },
        onHover: hoverHtml,
        nameOf: countryName,
        label: t('Карта мира: страны, окрашенные по выбранному показателю'),
        numberLocale: intl(),
        locale: {
          'NavigationControl.ZoomIn': t('Приблизить'), 'NavigationControl.ZoomOut': t('Отдалить'),
          'AttributionControl.ToggleAttribution': t('Показать источники карты'), 'Map.Title': t('Карта'), 'Marker.Title': t('Метка на карте')
        },
        onSelect: function (iso) { state.selectedCountry = iso; openCountry(iso); }
      });
      mapApi.setData(rows, state.mapMetric);
      if (state.continent !== 'all') mapApi.setContinent(state.continent); else mapApi.fit();
      if (state.selectedCountry) mapApi.select(state.selectedCountry);
    } catch (error) {
      var box = ovEl.querySelector('#ow-mapbox');
      if (box) box.innerHTML = '<div class="ow-empty">' + esc(t('Карта не загрузилась: {{0}}', error.message || t('ошибка'))) + '</div>';
    } finally {
      mapLoading = false;
      setHourglass(false);
      if (mapRemount) { mapRemount = false; if (state.section === 'map') mountMap(true); }
    }
  }

  // The country card: everything the owner may know about one country, nothing about one person.
  // Raw IP addresses and e-mails do not exist in this data and are never shown.
  var countryLoading = false;
  var NET_LABELS = { isp: 'Домашний провайдер', mobile: 'Мобильный оператор', hosting: 'Дата-центр', vpn: 'VPN', tor: 'Tor', education: 'Учебная сеть', business: 'Корпоративная', unknown: 'Не определено' };
  async function openCountry(iso) {
    if (!iso || countryLoading) return;
    countryLoading = true;
    state.selectedCountry = iso;
    if (mapApi) mapApi.select(iso);
    setHourglass(true, function () { return t('Загрузка страны…'); });
    var response = null;
    try { response = await api({ section: 'country', params: params({ country: iso }) }); }
    catch (error) { countryLoading = false; setHourglass(false); openPopup('Ошибка', function () { return esc(errorText(error)); }); return; }
    countryLoading = false;
    setHourglass(false);
    var sheet = openSheet(function () { return countrySheetHtml(iso, response.data || {}); }, function () { return countryName(iso); });
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet || event.target.id === 'ow-sheet-close') { sheet.remove(); state.selectedCountry = null; if (mapApi) mapApi.select(null); }
    });
    try { sheet.querySelector('#ow-sheet-close').focus({ preventScroll: true }); } catch (e) {}
  }
  // The class of a country from the choropleth batch (062): a country seen only through undetermined
  // visits is «Не определено», never human geography.
  function countryHuman(iso) {
    var row = countryRows().filter(function (r) { return r.country === iso; })[0];
    return row && row.human ? row.human : null;
  }
  function countrySheetHtml(iso, data) {
    var sum = data.summary || {};
    var visits = data.visits_available !== false;
    var kv = function (value, opts) { var k = LIB.kpiText ? LIB.kpiText(value, opts) : { text: num(value), state: 'ok' }; return k.state === 'ok' ? k.text : '<span class="ow-kpi-none">' + esc(k.text) + '</span>'; };
    var v = function (key) { return visits ? kv(sum[key] == null ? 0 : sum[key]) : kv(null, { unavailable: true }); };
    var human = +sum.visits_human || 0, regNew = +sum.registered_new || 0;
    var conversion = visits && human >= 20 ? (Math.round((regNew / human) * 10000) / 100) + '%' : kv(null, { insufficient: true });
    return '<div class="ow-sheet-in">' +
      '<div class="ow-country-h"><span class="ow-flag">' + esc(LIB.flagEmoji ? LIB.flagEmoji(iso) : '') + '</span><span>' + esc(countryName(iso)) + '</span>' + ' ' + humanChip(countryHuman(iso)) +
        '<code>' + esc(iso) + '</code>' + (continentOf(iso) ? '<span class="ow-tag">' + esc(label(LIB.CONTINENT_RU, continentOf(iso))) + '</span>' : '') +
        (parentNote(iso) ? '<span class="ow-tag">' + esc(parentNote(iso)) + '</span>' : '') +
        how('countryMap') + '</div>' +
      '<div class="ow-cards">' +
        card('Обычные визиты', v('visits_human'), esc(t('без обнаруженных признаков автоматизации')), 'visitsHuman') +
        card('Гостевые визиты', v('visits_guest'), esc(t('визиты без входа в аккаунт')), 'guests') +
        card('Авторизованные визиты', v('visits_signed_in'), esc(t('визиты с входом в аккаунт · это визиты, не люди')), 'authorizedVisits') +
        card('Зарегистрированные', kv(sum.registered), esc(t('точно · новых за период: {{0}}', num(sum.registered_new))), 'registered') +
        card('FREE', kv(sum.free), esc(t('точно')), 'levels') +
        card('PRO', kv(sum.pro), esc(t('активная подписка')), 'levels') +
        card('Lifetime', kv(sum.lifetime), esc(t('бессрочный доступ')), 'levels') +
        card('Покупатели', kv(sum.buyers), esc(t('покупок за период: {{0}}', num(sum.purchases))), 'buyers') +
        card('Домохозяйства', kv(sum.households), esc(t('оценка · с согласием')), 'households') +
        card('Посетители с согласием', kv(sum.visitors), esc(t('{{0}} гостевых профилей', num(sum.guests))), 'consented') +
        card('Web', v('web'), esc(t('обычные визиты'))) + card('iOS', v('ios'), esc(t('обычные визиты'))) + card('Android', v('android'), esc(t('обычные визиты'))) +
        card('Согласились', kv(sum.consent_accepted), esc(t('решений за период')), 'consent') +
        card('Отклонили', kv(sum.consent_declined), esc(t('решений за период')), 'consent') +
        card('Боты', v('visits_bot'), esc(t('объявленные краулеры')), 'traffic') +
        card('Подозрительный трафик', v('visits_suspicious'), esc(t('VPN / Tor / дата-центры: {{0}}', visits ? num(sum.visits_proxy) : '—')), 'traffic') +
        card('Конверсия в регистрацию', conversion, esc(t('оценка · регистрации ÷ обычные визиты')), 'conversion') +
      '</div>' +
      (visits ? lineChart(data.timeseries || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '<div class="ow-empty">' + esc(t('Счётчики визитов ещё не накоплены')) + '</div>') +
      lineChart(data.visitors_timeseries || [], ['visitors', 'sessions'], ['Посетители с согласием', 'Сессии']) +
      barList(data.platforms, { web: 'Веб', ios: 'iOS', android: 'Android' }, null, 'Платформы (все визиты)') +
      barList(data.network_types, NET_LABELS, 'traffic', 'Тип сети') +
      '<div class="ow-block"><div class="ow-block-h">' + esc(t('Лотереи')) + '</div>' +
        table([{ title: 'Лотерея', key: 'lottery' }, { title: 'Сессий', key: 'sessions', numeric: true }], data.top_lotteries, 'Нет данных с согласием') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + esc(t('Функции')) + '</div>' +
        table([{ title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } }, { title: 'Сессий', key: 'sessions', numeric: true }], data.top_features, 'Нет данных с согласием') + '</div>' +
      lineChart(data.consent_timeseries || [], ['accepted', 'declined'], ['Согласились', 'Отклонили']) +
      '<button class="ow-btn ow-btn-primary" id="ow-sheet-close" type="button" style="margin-top:10px">' + esc(t('Закрыть')) + '</button></div>';
  }

  // Sheets and popups keep the function that renders them (`__render`), so a language switch
  // re-renders what is on screen from the data it was opened with — no second request.
  function openSheet(render, name) {
    var old = ovEl.querySelector('#ow-sheet'); if (old) old.remove();
    var sheet = D.createElement('div');
    sheet.className = 'ow-sheet';
    sheet.id = 'ow-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.__render = function () {
      sheet.innerHTML = render();
      if (name) sheet.setAttribute('aria-label', name());
    };
    sheet.__render();
    ovEl.appendChild(sheet);
    return sheet;
  }

  // The one popup of the panel (ⓘ notes, errors): centred in the viewport by .ow-pop-back.
  function openPopup(title, body) {
    closePopup();
    var back = D.createElement('div');
    back.className = 'ow-pop-back';
    back.id = 'ow-pop-back';
    var pop = D.createElement('div');
    pop.className = 'ow-pop';
    pop.id = 'ow-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-labelledby', 'ow-pop-title');
    back.__render = function () {
      pop.innerHTML = '<h3 id="ow-pop-title">' + esc(t(title)) + '</h3><p>' + (typeof body === 'function' ? body() : String(body || '')) + '</p>';
      var close = D.createElement('button');
      close.className = 'ow-btn';
      close.type = 'button';
      close.textContent = t('Закрыть');
      close.style.marginTop = '8px';
      close.addEventListener('click', closePopup);
      pop.appendChild(close);
    };
    back.__render();
    back.appendChild(pop);
    // A tap on the dimmed backdrop (not on the card) closes the note, like Escape and «Закрыть».
    back.addEventListener('click', function (event) { if (event.target === back) closePopup(); });
    ovEl.appendChild(back);
    try { pop.querySelector('.ow-btn').focus({ preventScroll: true }); } catch (e) {}
  }
  function closePopup() { var back = ovEl && ovEl.querySelector('#ow-pop-back'); if (back) back.remove(); }
  // Innermost layer first: the owner notification centre, then an ⓘ note (above a sheet), then a
  // sheet. Returns false when only the panel itself is left.
  function closeInnermost() {
    try {
      if (W.LotoOwnerNotifications && W.LotoOwnerNotifications._state().open) { W.LotoOwnerNotifications.close(); return true; }
    } catch (e) {}
    if (ovEl.querySelector('#ow-pop-back')) { closePopup(); return true; }
    var sheet = ovEl.querySelector('#ow-sheet');
    if (sheet) { sheet.remove(); state.selectedCountry = null; if (mapApi) mapApi.select(null); return true; }
    return false;
  }

  // ── person sheet ───────────────────────────────────────────────────────────────────────────
  async function openPerson(personId) {
    setHourglass(true, function () { return t('Загрузка карточки…'); });
    var response = null;
    try { response = await api({ section: 'person', params: params({ person: personId }) }); }
    catch (error) { setHourglass(false); openPopup('Ошибка', function () { return esc(error.message ? tx(error.message) : t('не удалось загрузить')); }); return; }
    setHourglass(false);
    var sheet = openSheet(function () { return personSheetHtml(response.data || {}); }, function () { return t('Карточка человека'); });
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet || event.target.id === 'ow-sheet-close') sheet.remove();
    });
  }
  function personSheetHtml(data) {
    var person = data.person || {};
    return '<div class="ow-sheet-in">' +
      '<div class="ow-block-h">' + esc(label(LIB.KIND_RU, person.kind)) + ' · ' + esc(String(person.person_id || '').slice(0, 8)) +
        ' ' + confidenceChip(person.confidence, person.evidence) + '</div>' +
      '<div class="ow-cards">' +
        card('Первый визит', esc(timeText(person.first_seen))) +
        card('Последний визит', esc(timeText(person.last_seen))) +
        card('Сессии', num(person.sessions)) +
        card('Активное время', esc(dur(person.active_ms))) +
        card('Устройства', num(person.devices)) +
        card('Место', esc(place(person))) +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + esc(t('Устройства')) + '</div>' +
        table([
          { title: 'ID', key: 'short' },
          { title: 'Тип', key: 'kind', html: function (r) { return esc(r.kind || '—'); } },
          { title: 'ОС', key: 'os' },
          { title: 'Браузеры', key: 'browsers', html: function (r) { return esc((r.browsers || []).join(', ')); } },
          { title: 'Профилей', key: 'profiles', numeric: true },
          { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } }
        ], data.devices || [], 'Нет устройств') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + esc(t('Сессии')) + '</div>' +
        table([
          { title: 'Начало', key: 'started_at', html: function (r) { return esc(timeText(r.started_at)); } },
          { title: 'Длит.', key: 'duration_ms', html: function (r) { return esc(dur(r.duration_ms)); }, numeric: true },
          { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)) + (r.active_source === 'estimated' ? ' <span class="ow-conf ow-conf-mid" title="' + esc(t('Оценка по интервалам между действиями')) + '">' + esc(t('оц.')) + '</span>' : ''); }, numeric: true },
          { title: 'События', key: 'events', numeric: true },
          { title: 'Вход', key: 'entry' },
          { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
          { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
          { title: 'Устройство', key: 'device', html: function (r) { return esc([r.device, r.os, r.browser].filter(Boolean).join(' · ')); } }
        ], data.sessions || [], 'Нет сессий') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + esc(t('Путь')) + '</div>' +
        ((data.journey || []).length
          ? (data.journey || []).map(function (step) {
            return '<div class="ow-jr"><b>' + esc(clockText(step.at).slice(0, 5)) + '</b><span>' +
              esc(label(LIB.EVENT_RU, step.event)) +
              (step.lottery ? ' · ' + esc(step.lottery) : '') +
              (step.model ? ' · ' + esc(t('модель {{0}}', step.model)) : '') +
              (step.props && step.props.rows ? ' · ' + esc(t('{{0}} ряд.', num(step.props.rows))) : '') +
              '</span></div>';
          }).join('')
          : '<div class="ow-empty">' + esc(t('Нет событий')) + '</div>') +
      '</div>' +
      '<button class="ow-btn ow-btn-primary" id="ow-sheet-close" type="button" style="margin-top:10px">' + esc(t('Закрыть')) + '</button></div>';
  }

  // ── sections ───────────────────────────────────────────────────────────────────────────────
  // Titles passed to card / kcard / dayCard / block / table / barList / lineChart are Russian
  // sources (the helpers translate them; data-kpi keeps the source as a stable hook). Sub-lines are
  // HTML the caller builds, so the caller translates them: et() = esc(t()).
  function et() { return esc(t.apply(null, arguments)); }
  var PLATFORM_RU = { web: 'Веб', ios: 'iOS', android: 'Android' };
  var CONSENT_STATE_RU = { accepted: 'Согласились', declined: 'Отклонили', undecided: 'Ещё не решили' };
  // KPI card: value text or an honest empty state, a precision tag and a «how» note.
  function kcard(title, value, sub, howKey, precision, opts) {
    var k = opts && opts.text ? (value ? { text: String(value), state: 'ok' } : { text: t('нет данных'), state: 'none' }) : (LIB.kpiText ? LIB.kpiText(value, opts) : { text: num(value), state: 'ok' });
    var text = k.state === 'ok' ? esc(k.text) + (opts && opts.suffix ? opts.suffix : '') : '<span class="ow-kpi-none">' + esc(k.text) + '</span>';
    var tag = precision ? '<span class="ow-tag ow-tag-' + esc(precision) + '">' + esc(label(LIB.PRECISION_RU, precision)) + '</span>' : '';
    return '<div class="ow-card ow-kpi" data-kpi="' + esc(title) + '">' +
      '<div class="ow-card-h"><span>' + et(title) + '</span>' + (howKey ? how(howKey) : '') + tag + '</div>' +
      '<div class="ow-card-v">' + text + '</div>' +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') + '</div>';
  }
  function renderKpi() {
    var response = state.data.kpi;
    var head = '<div class="ow-kpi-h"><h2>' + et('Ключевые показатели') + '</h2>' +
      ['exact', 'filtered', 'consented', 'estimate'].map(function (p) { return '<span class="ow-tag ow-tag-' + p + '">' + esc(label(LIB.PRECISION_RU, p)) + '</span>'; }).join('') + '</div>';
    if (!response) {
      return '<div class="ow-block" id="ow-kpi">' + head +
        '<div class="ow-err"><span>' + esc(state.kpiError ? errorText(state.kpiError) : t('Нет данных')) + '</span>' +
        '<button class="ow-btn" type="button" data-kpi-retry>' + et('Повторить') + '</button></div></div>';
    }
    var d = response.data || {};
    var a = d.accounts || {}, tr = d.traffic || {}, c = d.consented || {}, cs = d.consent || {}, cv = d.conversion || {};
    var levels = a.levels || {}, rv = a.revenue || {};
    var grossKpi = moneyList(rv.gross_by_currency || []), netKpi = moneyList(rv.net_by_currency || [], 'amount'), refundKpi = moneyList(rv.refunds_by_currency || []);
    var tv = function (key) { return tr.available ? (tr[key] == null ? 0 : tr[key]) : null; };
    var un = { unavailable: !tr.available };
    var pct = function (value) { return value == null ? null : value; };
    var notSales = rv.promo_grants || rv.trial_starts || rv.sandbox_events
      ? '<br>' + et('не продажи: промо {{0}} · пробных {{1}} · sandbox {{2}}', num(rv.promo_grants), num(rv.trial_starts), num(rv.sandbox_events)) : '';
    return '<div class="ow-block" id="ow-kpi">' + head + (d.human ? '<div class="ow-cards">' + humanCards(d.human.scalars || d.human) + '</div>' : '') + '<div class="ow-cards">' +
      kcard('Обычные визиты', tv('human'), tr.available ? et('{{0}} всего · {{1}} без обнаруженных признаков автоматизации', num(tr.visits), pctText(tr.human, tr.visits)) : et('счётчики ещё не накоплены'), 'visitsHuman', 'filtered', un) +
      kcard('Гостевые визиты', tv('guest'), et('визиты без входа в аккаунт'), 'guests', 'filtered', un) +
      kcard('Авторизованные визиты', tv('signed_in'), et('визиты с входом в аккаунт · это визиты, не люди'), 'authorizedVisits', 'filtered', un) +
      kcard('Зарегистрированные аккаунты', a.registered_total, et('+{{0}} за период · владелец: {{1}} · анонимных сессий: {{2}}', num(a.registered_new), num(a.owners), num(a.anonymous_accounts)), 'registered', 'exact') +
      kcard('Новые регистрации', a.registered_new, et('за выбранный период'), 'registered', 'exact') +
      kcard('FREE', levels.free, et('без активной подписки'), 'levels', 'exact') +
      kcard('PRO', levels.pro, et('истёкших: {{0}} · пробных: {{1}}', num(levels.expired), num(a.trials_active)), 'levels', 'exact') +
      kcard('Lifetime', levels.lifetime, et('бессрочный доступ'), 'levels', 'exact') +
      kcard('Покупатели', a.paying_customers, et('подписок активно: {{0}} · тестовых аккаунтов: {{1}}', num(a.active_subscriptions), num(a.test_accounts)), 'buyers', 'exact') +
      kcard('Покупки за период', a.purchase_events != null ? a.purchase_events : a.purchases, et('оплачено · продления: {{0}} · возвраты: {{1}}', a.renewals == null ? t('нет данных') : num(a.renewals), num(rv.refund_events)) + notSales, 'buyers', 'exact') +
      kcard('Сумма покупок (gross)', grossKpi || null, (rv.gross_usd != null ? esc(usdEstimate(rv.gross_usd)) + ' · ' : '') + et('в валюте покупателя, до удержаний') + (refundKpi ? ' · ' + et('возвраты: {{0}}', refundKpi) : ''), 'revenue', 'exact', { text: true }) +
      kcard('Чистыми (net)', netKpi || null, +rv.net_unknown ? et('RevenueCat не сообщил удержания для {{0}} из {{1}}', num(rv.net_unknown), num((+rv.net_known || 0) + (+rv.net_unknown || 0))) : (rv.net_usd != null ? esc(usdEstimate(rv.net_usd)) : et('после удержаний магазина по данным RevenueCat')), 'netRevenue', 'exact', { text: true }) +
      kcard('Конверсия в регистрацию', pct(cv.signup_rate_pct), et('регистрации ÷ обычные визиты · нужно ≥ {{0}} визитов', num(cv.min_visits)), 'conversion', 'estimate', { insufficient: true, suffix: '%' }) +
      kcard('Конверсия в покупку', pct(cv.purchase_rate_pct), et('покупатели ÷ аккаунты · нужно ≥ {{0}} аккаунтов', num(cv.min_registered)), 'conversion', 'estimate', { insufficient: true, suffix: '%' }) +
      kcard('Посетители с согласием', c.visitors, et('{{0}} гостевых профилей · {{1}} с аккаунтом · {{2}} без признаков', num(c.guest_profiles), num(c.registered_profiles), num(c.unknown_visitors)), 'consented', 'consented') +
      kcard('Домохозяйства', c.households, et('по домашним сетям согласившихся'), 'households', 'estimate') +
      kcard('Боты', tv('bot'), et('объявленные краулеры'), 'traffic', 'filtered', un) +
      kcard('Подозрительный трафик', tv('suspicious'), et('headless, дата-центры, VPN, Tor, всплески'), 'traffic', 'filtered', un) +
      kcard('Согласия', cs.accepted, et('отклонили: {{0}} · стран известно: {{1}}', num(cs.declined), num(cs.countries_known)), 'consent', 'exact') +
    '</div>' +
    (tr.available ? lineChart(tr.timeseries || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '') +
    (tr.available ? barList(tr.by_platform, PLATFORM_RU, 'visitsHuman', 'Обычные визиты по платформам') : '') +
    (tr.available ? barList(tr.by_consent, CONSENT_STATE_RU, 'consent', 'Обычные визиты по состоянию согласия') : '') +
    '</div>';
  }

  function renderOverview(data) {
    var people = data.people || {}, structure = data.structure || {}, excluded = data.excluded || {};
    var engagement = data.engagement || {}, geography = data.geography || {}, live = data.live || {};
    var previous = data.previous || null;
    return renderKpi() + '<div class="ow-cards" style="margin-top:12px">' +
      card('Оценка живой аудитории', num(people.estimated_min) + '–' + num(people.estimated_max), et('подтверждённые + вероятные … + каждое устройство отдельно'), 'estimated') +
      card('Подтверждённые люди', num(people.verified), et('вошли в аккаунт'), 'verified', previous ? null : null) +
      card('Вероятные люди', num(people.probable), et('анонимные, сгруппированы по нижней границе'), 'probable') +
      card('Неизвестные посетители', num(people.unknown_visitors), et('нет признаков взаимодействия'), 'unknown') +
      card('Новые', num(people.new), et('первый визит внутри периода'), 'newPeople') +
      card('Вернувшиеся', num(people.returning), et('были известны до периода'), 'returningPeople') +
      card('Приходили в разные дни', num(people.returned_another_day), et('активны в 2+ календарных дня'), 'returnedAnotherDay') +
      card('Дней активности в среднем', people.active_days_avg == null ? '—' : esc((+people.active_days_avg).toLocaleString(intl())), et('на человека за период')) +
      card('Активны сейчас', num(live.active_now), et('события за 5 минут'), 'live') +
      card('Домохозяйства', num(structure.households), et('одна домашняя сеть'), 'households') +
      card('Устройства', num(structure.devices), et('{{0}} общих (несколько аккаунтов)', num(structure.shared_devices)), 'devices') +
      card('Профили браузера', num(structure.browser_profiles), et('установки и профили'), 'profiles') +
      card('Сессии', num(structure.sessions), et('таймаут 30 минут'), 'sessions', previous ? deltaOf(structure.sessions, previous.sessions) : null) +
      card('Повторные сессии', num(structure.repeat_sessions), et('сверх первой на человека'), 'repeatSessions') +
      card('События', num(structure.events), '', null, previous ? deltaOf(structure.events, previous.events) : null) +
      card('Активное время в среднем', esc(dur(engagement.avg_active_ms)), et('{{0}} измерено / {{1}} оценка', num(engagement.measured_sessions), num(engagement.estimated_sessions)), 'active') +
      card('Вовлечённые сессии', num(engagement.engaged_sessions), et('{{0}} от всех', pctText(engagement.engaged_sessions, structure.sessions))) +
      card('Исключено: владелец и тесты', et('{{0}} проф. / {{1}} сес.', num(excluded.owner_test_profiles), num(excluded.owner_test_sessions)), et('не входят в аудиторию'), 'excluded') +
      card('Исключено: боты', et('{{0}} проф. / {{1}} сес.', num(excluded.bot_profiles), num(excluded.bot_sessions)), et('краулеры и автоматизация'), 'excluded') +
      card('Страны · регионы · города', num(geography.countries) + ' · ' + num(geography.regions) + ' · ' + num(geography.cities), et('{{0}} сессий без гео', num(geography.unknown_sessions)), 'geo') +
    '</div>' +
    lineChart(data.timeseries || [], ['people', 'sessions'], ['Люди', 'Сессии']) +
    barList(data.people_by_channel, LIB.CHANNEL_RU, 'channels', 'Люди по первому источнику') +
    barList(data.channels, LIB.CHANNEL_RU, 'channels', 'Сессии по последнему источнику') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Свежесть данных') + '</div>' +
      '<div class="ow-bar"><span class="ow-bar-l">' + et('Последнее событие') + '</span><span>' + esc(timeText((data.freshness || {}).latest_event)) + '</span><span></span></div>' +
      '<div class="ow-bar"><span class="ow-bar-l">' + et('Последний разбор') + '</span><span>' + esc(timeText((data.freshness || {}).latest_resolution)) + '</span><span></span></div>' +
    '</div>' +
    renderGa4();
  }

  // ── Google Analytics 4 — the INDEPENDENT control source (2026-09-27) ──────────────────────
  // Rendered UNDER the internal analytics of the overview and never mixed with it: the internal
  // numbers above stay the primary record; this block shows what GA4 itself reports for the same
  // period (read server-side through the GA4 Data API after the owner gate). Nothing is invented:
  // a metric GA4 did not return prints «нет данных», an event without rows prints a dash, an
  // unconfigured property explains what is missing, a failed request shows its error.
  var GA4_EVENT_RU = {
    session_start: 'Сессии (session_start)', generate_combination: 'Сгенерировали комбинацию', pro_feature: 'Открыли PRO-функцию',
    paywall_view: 'Увидели экран PRO', begin_checkout: 'Начали оплату', purchase: 'Покупка подтверждена'
  };
  var GA4_FUNNEL = ['session_start', 'generate_combination', 'pro_feature', 'paywall_view', 'begin_checkout', 'purchase'];
  var GA4_DEVICE_RU = { desktop: 'Компьютер', mobile: 'Телефон', tablet: 'Планшет', smarttv: 'Телевизор' };
  var GA4_ERROR_RU = {
    ga4_forbidden: 'у сервисного аккаунта нет доступа к свойству GA4', ga4_quota: 'исчерпана квота GA4 Data API',
    ga4_auth_failed: 'не удалось получить токен сервисного аккаунта', ga4_bad_range: 'неверный период'
  };
  function ga4Metric(totals, name) { return totals && Object.prototype.hasOwnProperty.call(totals, name) ? num(totals[name]) : none(); }
  function ga4Card(title, value, sub) {
    return '<div class="ow-card"><div class="ow-card-h"><span>' + et(title) + '</span><span class="ow-tag ow-tag-ga4">GA4</span></div>' +
      '<div class="ow-card-v">' + value + '</div>' + (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') + '</div>';
  }
  function renderGa4() {
    var g = state.data.ga4, err = state.ga4Error, tag = W.LotoGA4;
    var tagLine = tag && tag.configured ? t('Тег GA4 на сайте настроен ({{0}}); загружается только после согласия на аналитику.', tag.measurementId)
      : t('Тег GA4 на сайте не настроен (переменная деплоя LOTO_GA4_MEASUREMENT_ID пуста): сайт ничего не отправляет в Google.');
    var body;
    if (state.ga4Loading) body = '<div class="ow-empty">' + et('Загрузка GA4…') + '</div>';
    else if (err) {
      var reason = err.code && GA4_ERROR_RU[err.code] ? t(GA4_ERROR_RU[err.code]) : (err.status ? t('HTTP {{0}}', err.status) : t('неизвестно'));
      body = '<div class="ow-error" role="alert">' + et('Ошибка запроса GA4: {{0}}', reason) + (err.detail ? ' <small>' + esc(err.detail) + '</small>' : '') + '</div>';
    } else if (!g) body = '<div class="ow-empty">' + et('GA4 ещё не запрашивался') + '</div>';
    else if (g.configured === false) {
      body = '<div class="ow-empty"><b>' + et('GA4 не подключён.') + '</b> ' +
        et('Чтобы включить: создайте свойство GA4, задайте переменную деплоя LOTO_GA4_MEASUREMENT_ID (идентификатор G-…), добавьте сервисный аккаунт как Viewer свойства и сохраните секреты GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, GA4_SERVICE_ACCOUNT_PRIVATE_KEY.') +
        (g.missing && g.missing.length ? '<div class="ow-card-s">' + et('Не заданы: {{0}}', g.missing.join(', ')) + '</div>' : '') + '</div>';
    } else {
      var tt = g.totals || {};
      var engaged = tt.sessions ? pctText(tt.engagedSessions, tt.sessions) : '—';
      var avgEngage = tt.sessions && tt.userEngagementDuration != null ? esc(dur((tt.userEngagementDuration / tt.sessions) * 1000)) : none();
      var rt = g.realtime && g.realtime.activeUsers != null ? num(g.realtime.activeUsers) : none();
      var cards = '<div class="ow-cards">' +
        ga4Card('Активные пользователи', ga4Metric(tt, 'activeUsers'), et('за период, по данным GA4')) +
        ga4Card('Новые пользователи', ga4Metric(tt, 'newUsers'), et('первый визит по cookie GA4')) +
        ga4Card('Сессии', ga4Metric(tt, 'sessions'), et('таймаут 30 минут')) +
        ga4Card('Вовлечённые сессии', ga4Metric(tt, 'engagedSessions'), et('{{0}} от всех', engaged)) +
        ga4Card('Просмотры страниц', ga4Metric(tt, 'screenPageViews'), '') +
        ga4Card('События', ga4Metric(tt, 'eventCount'), '') +
        ga4Card('Покупки (GA4)', ga4Metric(tt, 'ecommercePurchases'), et('событие purchase; деньги считает журнал магазина')) +
        ga4Card('Среднее время вовлечения', avgEngage, et('на сессию')) +
        ga4Card('Сейчас на сайте (30 мин)', rt, g.realtime_error ? et('realtime недоступен: {{0}}', g.realtime_error) : et('отчёт реального времени GA4')) +
      '</div>';
      var byEvent = {};
      (g.funnel || []).forEach(function (row) { byEvent[row.event] = row; });
      var base = byEvent.session_start ? byEvent.session_start.users : 0;
      var funnel = '<div class="ow-block"><div class="ow-block-h">' + et('Воронка GA4 (пользователи по событиям)') + '</div>' +
        GA4_FUNNEL.map(function (name) {
          var row = byEvent[name];
          var users = row ? row.users : null;
          return '<div class="ow-bar"><span class="ow-bar-l">' + et(GA4_EVENT_RU[name]) + '</span>' +
            '<span class="ow-bar-t"><i style="width:' + (row && base ? Math.max(1, Math.round((users / base) * 100)) : 0) + '%"></i></span>' +
            '<span class="ow-bar-v">' + (row ? num(users) + ' · ' + pctText(users, base) + ' · ' + et('{{0}} соб.', num(row.count)) : '<span class="ow-kpi-none">' + et('нет событий в GA4 за период') + '</span>') + '</span></div>';
        }).join('') + '</div>';
      var chart = lineChart((g.daily || []).map(function (d) { return { bucket: d.date, users: d.activeUsers, sessions: d.sessions }; }), ['users', 'sessions'], ['Активные пользователи', 'Сессии']);
      var countries = (g.countries || []).length
        ? '<div class="ow-block"><div class="ow-block-h">' + et('Страны по GA4') + '</div>' + (function () {
            var max = g.countries.reduce(function (m, r) { return Math.max(m, r.activeUsers); }, 0);
            return g.countries.map(function (r) {
              return '<div class="ow-bar"><span class="ow-bar-l">' + esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + (countryName(r.country) || r.country)) + '</span>' +
                '<span class="ow-bar-t"><i style="width:' + (max ? Math.max(2, Math.round((r.activeUsers / max) * 100)) : 0) + '%"></i></span>' +
                '<span class="ow-bar-v">' + num(r.activeUsers) + '</span></div>';
            }).join('');
          })() + '</div>'
        : '<div class="ow-empty">' + et('GA4 не вернул страны за период') + '</div>';
      var devices = {};
      (g.devices || []).forEach(function (r) { devices[r.device] = r.activeUsers; });
      var deviceList = (g.devices || []).length ? barList(devices, GA4_DEVICE_RU, null, 'Устройства по GA4') : '<div class="ow-empty">' + et('GA4 не вернул устройства за период') + '</div>';
      body = cards + funnel + chart + countries + deviceList +
        '<div class="ow-card-s">' + et('Период GA4: {{0}} — {{1}} (дни по часовому поясу панели, {{2}}); стандартные отчёты GA4 отстают до 24–48 часов. Выручка в GA4 не измеряется: деньги считает журнал магазина (RevenueCat) в разделе «День».', g.range.from, g.range.to, g.range.tz) + '</div>';
    }
    return '<div class="ow-block ow-ga4" id="ow-b-ga4"><div class="ow-block-h">' + et('Google Analytics 4 — независимая аналитика') + how('ga4') + '<span class="ow-tag ow-tag-ga4">GA4</span></div>' +
      '<div class="ow-card-s">' + et('Независимый контрольный источник. Внутренняя аналитика Lotto Simulator выше остаётся основной; GA4 не заменяет её и считает по своим правилам.') + ' ' + esc(tagLine) + '</div>' +
      body + '</div>';
  }
  function paintGa4() {
    if (!ovEl || state.section !== 'overview') return;
    var el = ovEl.querySelector('#ow-b-ga4');
    if (el) el.outerHTML = renderGa4();
  }
  var ga4Request = 0;
  async function loadGa4() {
    var range = currentRange(), id = ++ga4Request;
    state.ga4Loading = true; state.ga4Error = null;
    paintGa4();
    try {
      var report = await api({ ga4: { op: 'report', from: range.from, to: range.to, tz: range.tz } });
      if (id !== ga4Request) return;
      state.data.ga4 = report;
    } catch (error) {
      if (id !== ga4Request) return;
      state.ga4Error = { code: (error && error.code) || '', status: error && error.status, detail: (error && error.detail) || '' };
      if (!state.ga4Error.code && !state.ga4Error.detail && error && /Failed to fetch|NetworkError|load failed/i.test(error.message || '')) state.ga4Error.detail = t('Нет связи с сервером. Проверьте соединение.');
      state.data.ga4 = null;
    } finally {
      if (id === ga4Request) { state.ga4Loading = false; paintGa4(); }
    }
  }

  // ── LIVE: today's aggregates + the chronological feed (v4). The older `stream` shape is still
  // rendered when a backend answers with it, so nothing breaks during a rollout.
  // Человек ✓ / Вероятно человек / Не определено / Автоматический трафик — the server's class (062).
  function humanChip(cls) {
    if (!cls) return '<span class="ow-card-s">—</span>';
    return '<span class="ow-human ow-human-' + esc(cls) + '">' + esc(label(LIB.HUMAN_RU, cls)) + '</span>';
  }
  // The four classes as cards (day, LIVE, KPI). People and visits are never added together: a consented
  // person's page load is also a counter visit.
  function humanCards(h) {
    h = h || {};
    return card('Человек ✓', num(h.human_confirmed), et('вошёл в аккаунт или действовал в приложении · новых: {{0}}', num(h.new_human_confirmed)), 'human') +
      card('Вероятно человек', num(h.human_likely), et('согласие на аналитику без действий · новых: {{0}}', num(h.new_human_likely)), 'human') +
      card('Визиты людей', num(h.visits_people), et('решение по согласию или вход в аккаунт · это визиты, не люди'), 'human') +
      card('Не определено', num(h.visits_unknown), et('визиты без решения по согласию и без входа — ни в людей, ни в страны не входят'), 'human') +
      card('Автоматический трафик', num(h.visits_automated), et('боты, мониторинг, headless, дата-центры, VPN, Tor'), 'human');
  }
  function statusChip(status) {
    var key = String(status || 'guest');
    return '<span class="ow-status-chip ow-status-' + esc(key) + '">' + esc(label(LIB.STATUS_RU, key)) + '</span>';
  }
  function feedRows(data) {
    if (Array.isArray(data.feed)) return data.feed;
    return (data.stream || []).map(function (row) {
      return { at: row.at, kind: 'event', name: row.event, lottery: row.lottery, page: row.page, platform: row.platform, country: row.country,
        device: row.device, status: row.owner_test ? 'owner' : (row.kind === 'verified' ? 'free' : 'guest'), who: row.person, class: row.class };
    });
  }
  function feedWhat(row) {
    if (row.kind === 'commerce') {
      var amount = row.price != null && row.currency ? ' · ' + esc(money(row.price, row.currency)) : '';
      var net = row.net != null && row.currency ? ' · ' + et('чистыми {{0}}', money(row.net, row.currency)) : '';
      var kind = row.row_kind && row.row_kind !== 'paid' ? ' <span class="ow-tag ow-tag-kind">' + esc(label(LIB.COMMERCE_KIND_RU, row.row_kind)) + '</span>' : '';
      return esc(label(LIB.COMMERCE_RU, row.name)) + kind + (row.plan ? ' · ' + et('{{0}} мес.', row.plan) : '') + amount + net + (row.reason ? ' · ' + esc(tx(row.reason)) : '');
    }
    if (row.kind === 'account') return et('Новый аккаунт') + (row.platform ? ' · ' + esc(label(PLATFORM_RU, row.platform)) : '');
    if (row.kind === 'visits') {
      return et('Визиты за час: {{0}}', num(row.count)) + ' · ' + esc(label(LIB.TRAFFIC_RU, row.name)) +
        (row.consent ? ' · ' + esc(label({ accepted: 'с согласием', declined: 'отклонили', undecided: 'без решения' }, row.consent)) : '');
    }
    var what = esc(label(LIB.EVENT_RU, row.name));
    if (row.lottery) what += ' · ' + esc(row.lottery);
    if (row.model) what += ' · ' + et('модель {{0}}', row.model);
    if (row.rows) what += ' · ' + et('{{0}} ряд.', num(row.rows));
    if (row.context && row.name === 'client_error') what += ' · ' + esc(tx(row.context));
    return what;
  }
  function renderLive(data) {
    var s = data.today_scalars || {};
    var rows = feedRows(data).map(function (row) { return Object.assign({}, row, { __click: false, __class: 'ow-feed-' + (row.kind || 'event') }); });
    var gross = moneyTextRu(s.revenue_text), net = moneyTextRu(s.net_text);
    var notSales = [s.promo_grants ? t('промо {{0}}', num(s.promo_grants)) : '', s.trial_starts ? t('пробных {{0}}', num(s.trial_starts)) : '', s.sandbox_events ? t('sandbox {{0}}', num(s.sandbox_events)) : ''].filter(Boolean).join(' · ');
    var cards = '<div class="ow-cards">' +
      card('Активны сейчас', '<span class="ow-live-dot" aria-hidden="true"></span>' + num(data.active_now), et('события за 5 минут · за 15 минут: {{0}}', num(data.active_15m)), 'live') +
      card('Точные аккаунты сегодня', num(s.exact_accounts), et('один аккаунт = один пользователь'), 'identity') +
      card('Оценка уникальных гостей', num(s.estimated_unique_guests), et('с согласием: {{0}} · дневных ключей: {{1}}', num(s.guest_profiles_consented), num(s.guest_keys_daily)), 'identity') +
      card('Люди с согласием сегодня', num(s.people), et('новых: {{0}} · вернувшихся: {{1}}', num(s.new_people), num(s.returning_people)), 'dayPeople') +
      card('Визиты сегодня', data.visits_available === false ? '—' : num(s.visits_human), et('обычные · за последний час: {{0}}', num(data.visits_last_hour)), 'visitsHuman') +
      card('Регистрации сегодня', num(s.registrations), et('точно'), 'dayRegistrations') +
      card('Страны сегодня', num(s.countries), et('по визитам и сессиям'), 'dayLanguages') +
      card('Покупки PRO сегодня', num(s.purchases), et('оплачено · продлений: {{0}} · возвратов: {{1}} · сбоев оплаты: {{2}}', num(s.renewals), num(s.refunds), num(s.payment_failures)) + (notSales ? '<br>' + et('не продажи: {{0}}', notSales) : ''), 'dayCommerce') +
      card('Сумма покупок сегодня', gross ? esc(gross) : none(), (s.gross_usd != null ? esc(usdEstimate(s.gross_usd)) + ' · ' : '') + et('в валюте покупателя, до удержаний'), 'revenue') +
      card('Чистыми сегодня', net ? esc(net) : none(), s.net_unknown ? et('RevenueCat не сообщил удержания для {{0}} из {{1}}', num(s.net_unknown), num((+s.net_known || 0) + (+s.net_unknown || 0))) : (s.net_usd != null ? esc(usdEstimate(s.net_usd)) : et('после удержаний магазина по данным RevenueCat')), 'netRevenue') +
      card('Owner-уведомления', num(data.unread_owner_notifications), et('непрочитанных'), 'liveFeed') +
      humanCards(s) +
      card('Обновление', et('каждые 15 с'), et('пока открыт раздел') + ' · ' + esc(data.today || '')) +
    '</div>';
    var host = ovEl && ovEl.querySelector('#ow-section');
    var scroll = host ? host.scrollTop : 0;
    var html = cards +
      '<div class="ow-block" id="ow-b-feed"><div class="ow-block-h">' + et('Живая активность сегодня') + how('liveFeed') + '<span class="ow-tag" style="margin-left:auto">' + et('{{0}} записей', num(rows.length)) + '</span></div>' +
      table([
        { title: 'Время', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Что', key: 'kind', html: function (r) { return '<span class="ow-tag">' + esc(label(LIB.FEED_KIND_RU, r.kind)) + '</span>'; } },
        { title: 'Событие', key: 'name', html: feedWhat },
        { title: 'Статус', key: 'status', html: function (r) { return statusChip(r.status); } },
        { title: 'Платформа', key: 'platform', html: function (r) { return esc(label(PLATFORM_RU, r.platform)); } },
        { title: 'Язык', key: 'locale', html: function (r) { return esc(r.locale || '—'); } },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? (LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country) : '—'); } },
        { title: 'Кто это', key: 'human', html: function (r) { return r.kind === 'commerce' ? '<span class="ow-card-s">—</span>' : humanChip(r.human); } },
        // An hourly counter row has NO device: it says «агрегировано». Its network kind (isp = провайдер)
        // is a network, shown in its own column — never as a device type.
        { title: 'Устройство', key: 'device', html: function (r) { return r.aggregate || r.kind === 'visits' ? '<span class="ow-card-s">' + et('агрегировано') + '</span>' : esc(r.device || '—'); } },
        // The panel's one network vocabulary (NET_LABELS, translated) — a raw code such as «unknown» never
        // reaches the owner (LIVE showed it for a counter row whose network was not determined).
        { title: 'Сеть', key: 'network', html: function (r) { return esc(r.network ? label(NET_LABELS, r.network) : '—'); } },
        { title: 'Кто', key: 'who', html: function (r) { return '<code>' + esc(r.who || '—') + '</code>'; } }
      ], rows, 'Сегодня событий ещё не было') + '</div>';
    if (host) setTimeout(function () { try { host.scrollTop = scroll; } catch (e) {} }, 0);
    return html;
  }

  // ── День: the calendar day report ──────────────────────────────────────────────────────────
  var WEEKDAYS_RU = ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  function dayTitle(ymd) {
    try {
      var p = ymd.split('-');
      return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString(intl(), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ymd; }
  }
  function cmpLine(key, compare, opts) {
    opts = opts || {};
    var cur = compare && compare.__current ? compare.__current[key] : null;
    if (cur == null || !LIB.delta) return '';
    var parts = [];
    var one = function (title, block) {
      if (!block || !block.scalars || block.scalars[key] == null) return;
      var d = LIB.delta(cur, block.scalars[key]);
      if (!d) return;
      var value = opts.money ? money(block.scalars[key], 'USD') : num(block.scalars[key]);
      var sign = d.abs > 0 ? '+' : '';
      var change = d.pct == null ? (d.abs === 0 ? '±0' : sign + num(d.abs)) : sign + num(d.abs) + ' · ' + sign + num(d.pct) + '%';
      parts.push('<span>' + et(title) + ' <b>' + esc(String(value)) + '</b> <span class="' + d.dir + '">' + esc(change) + '</span></span>');
    };
    one('вчера', compare.prev_day);
    one('нед. назад', compare.same_weekday);
    one('ср. 7 дн.', compare.avg7);
    return parts.length ? '<div class="ow-cmp">' + (opts.label ? '<span class="ow-cmp-l">' + et(opts.label) + ':</span>' : '') + parts.join('') + '</div>' : '';
  }
  // A day card: the value, its precision tag, the «how» note and the three comparisons.
  function dayCard(title, key, sub, howKey, precision, compare, opts) {
    opts = opts || {};
    var scalars = (compare && compare.__current) || {};
    var value = scalars[key];
    var text;
    if (opts.money) { var k = LIB.kpiText ? LIB.kpiText(value) : { text: num(value), state: 'ok' }; text = k.state === 'ok' ? esc(money(value, 'USD')) : '<span class="ow-kpi-none">' + esc(k.text) + '</span>'; }
    else if (opts.unavailable) text = '<span class="ow-kpi-none">' + et('Нет данных') + '</span>';
    else text = num(value);
    var tag = precision ? '<span class="ow-tag ow-tag-' + esc(precision) + '">' + esc(label(LIB.PRECISION_RU, precision)) + '</span>' : '';
    return '<div class="ow-card ow-kpi" data-kpi="' + esc(title) + '">' +
      '<div class="ow-card-h"><span>' + et(title) + '</span>' + (howKey ? how(howKey) : '') + tag + '</div>' +
      '<div class="ow-card-v">' + text + '</div>' +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') +
      (opts.unavailable ? '' : cmpLine(key, compare, opts)) + '</div>';
  }
  function block(id, title, howKey, inner, extraHead) {
    return '<div class="ow-block" id="ow-b-' + id + '"><div class="ow-block-h">' + et(title) + (howKey ? how(howKey) : '') + (extraHead || '') + '</div>' + inner + '</div>';
  }
  function moneyCard(kpi, title, howKey, tagClass, tagText, value, sub, cmp) {
    return '<div class="ow-card ow-kpi" data-kpi="' + esc(kpi) + '"><div class="ow-card-h"><span>' + et(title) + '</span>' + how(howKey) + '<span class="ow-tag ' + tagClass + '">' + et(tagText) + '</span></div>' +
      '<div class="ow-card-v">' + value + '</div><div class="ow-card-s">' + sub + '</div>' + (cmp || '') + '</div>';
  }
  function renderDay(data) {
    var s = data.scalars || {};
    var compare = Object.assign({ __current: s }, data.compare || {});
    var visits = data.visits_available !== false;
    var un = { unavailable: !visits };
    var v = data.visits || {}, platforms = data.platforms || {}, accounts = data.accounts || {}, commerce = data.commerce || {}, system = data.system || {}, excluded = data.excluded || {};
    var anchors = [['identity', 'Кто это был'], ['journey', 'Путь гостя'], ['visits', 'Визиты'], ['people', 'Аудитория'], ['accounts', 'Аккаунты'], ['platforms', 'Платформы'], ['countries', 'Страны и языки'], ['lotteries', 'Лотереи'], ['features', 'Функции'], ['funnel', 'Воронка'], ['commerce', 'Платежи'], ['system', 'Сбои']];
    var head = '<div class="ow-dayhead"><h2>' + esc(dayTitle(data.day || state.day)) + '</h2>' +
      '<span class="ow-card-s">' + esc(WEEKDAYS_RU[data.weekday] ? t(WEEKDAYS_RU[data.weekday]) : '') + (data.is_today ? ' · ' + et('сегодня (день ещё идёт)') : '') + ' · ' + et('{{0}} ч', String(data.hours_in_day || 24)) + ' · ' + esc(state.tz) + '</span>' + how('dayBounds') + how('dayCompare') + '</div>' +
      '<div class="ow-anchors">' + anchors.map(function (a) { return '<a href="#ow-b-' + a[0] + '" data-block="' + a[0] + '">' + et(a[1]) + '</a>'; }).join('') + '</div>';

    var visitsBlock = block('visits', 'Визиты (счётчики без идентификаторов)', 'visitsHuman',
      '<div class="ow-cards">' +
        dayCard('Обычные визиты', 'visits_human', visits ? et('{{0}} всего · {{1}} без признаков автоматизации', num(s.visits_total), pctText(s.visits_human, s.visits_total)) : et('счётчики ещё не накоплены'), 'visitsHuman', 'filtered', compare, un) +
        dayCard('Гостевые визиты', 'visits_guest', et('визиты без входа в аккаунт'), 'guests', 'filtered', compare, un) +
        dayCard('Авторизованные визиты', 'visits_signed_in', et('визиты с входом · это визиты, не люди'), 'authorizedVisits', 'filtered', compare, un) +
        dayCard('Подозрительный трафик', 'visits_suspicious', et('headless, дата-центры, VPN, Tor, всплески'), 'traffic', 'filtered', compare, un) +
        dayCard('Боты', 'visits_bot', et('объявленные краулеры'), 'traffic', 'filtered', compare, un) +
      '</div>' +
      (visits ? lineChart(v.hourly || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '') +
      (visits ? barList(v.by_platform, PLATFORM_RU, null, 'Обычные визиты по платформам') : '') +
      (visits ? barList(v.by_consent, CONSENT_STATE_RU, 'consent', 'Обычные визиты по состоянию согласия') : '') +
      (visits ? barList(v.by_network, NET_LABELS, 'traffic', 'Все визиты по типу сети') : ''));

    var identityBlock = block('identity', 'Кто это был: аккаунты · гости · визиты · сессии · устройства · домохозяйства', 'identity',
      '<div class="ow-cards">' + humanCards(s) + '</div><div class="ow-cards">' +
        dayCard('Точные активные аккаунты', 'exact_accounts', et('один аккаунт = один пользователь · владелец отдельно · авторизованных визитов: {{0}}', num(s.visits_signed_in)), 'identity', 'exact', compare) +
        dayCard('Оценка уникальных гостей', 'estimated_unique_guests', et('профилей с согласием: {{0}} · дневных ключей: {{1}}', num(s.guest_profiles_consented), num(s.guest_keys_daily)) + (s.guest_keys_linked ? ' · ' + et('связано с аккаунтом и исключено: {{0}}', num(s.guest_keys_linked)) : ''), 'identity', 'estimate', compare) +
        dayCard('Визиты', 'visits_human', et('обычные · загрузки страницы, не люди'), 'visitsHuman', 'filtered', compare, un) +
        dayCard('Сессии', 'sessions', et('с согласием · таймаут 30 минут'), 'sessions', 'consented', compare) +
        dayCard('Устройства', 'devices', et('с согласием · {{0}} профилей/установок', num(s.profiles)), 'devices', 'consented', compare) +
        dayCard('Домохозяйства (оценка)', 'households', et('по домашним сетям согласившихся'), 'households', 'estimate', compare) +
      '</div>' +
      (data.identity && data.identity.guest_keys_by_platform ? barList(data.identity.guest_keys_by_platform, PLATFORM_RU, 'identity', 'Дневные ключи гостей по платформам') : '') +
      '<div class="ow-card-s" style="margin-top:6px">' + esc(tx((data.identity && data.identity.note) || '')) + '</div>');

    var peopleBlock = block('people', 'Аудитория с согласием', 'dayPeople',
      '<div class="ow-cards">' +
        dayCard('Уникальные пользователи', 'people', et('с признаками человека: {{0}}', num(s.people_human)), 'dayPeople', 'consented', compare) +
        dayCard('Новые', 'new_people', et('первый визит в истории — в этот день'), 'newPeople', 'consented', compare) +
        dayCard('Вернувшиеся', 'returning_people', et('были известны до этого дня'), 'returningPeople', 'consented', compare) +
        dayCard('Аккаунты активны', 'accounts_active', et('вошли в аккаунт в этот день (без владельца)'), 'dayEntities', 'exact', compare) +
        dayCard('Устройства', 'devices', et('{{0}} профилей/установок', num(s.profiles)), 'dayEntities', 'consented', compare) +
        dayCard('Сессии', 'sessions', et('{{0}} вовлечённых · {{1}} событий', num(s.engaged_sessions), num(s.events)), 'sessions', 'consented', compare) +
        dayCard('Домохозяйства (оценка)', 'households', et('по домашним сетям'), 'households', 'estimate', compare) +
        dayCard('Гости', 'guests', et('устройства без входа в аккаунт'), 'dayStatuses', 'consented', compare) +
      '</div>' +
      lineChart(data.sessions_hourly || [], ['sessions', 'people'], ['Сессии', 'Люди']));

    var levels = accounts.levels_active || {};
    var accountsBlock = block('accounts', 'Аккаунты и статусы', 'dayStatuses',
      '<div class="ow-cards">' +
        dayCard('Регистрации', 'registrations', et('аккаунтов всего сейчас: {{0}}', num(accounts.registered_total_now)), 'dayRegistrations', 'exact', compare) +
        dayCard('FREE активны', 'free_active', et('вошли в этот день'), 'dayStatuses', 'exact', compare) +
        dayCard('PRO активны', 'pro_active', et('активная платная подписка'), 'dayStatuses', 'exact', compare) +
        dayCard('PRO Lifetime активны', 'lifetime_active', et('бессрочный доступ (не владелец)'), 'dayStatuses', 'exact', compare) +
        dayCard('PRO истёк / отменён', 'expired_active', et('заходили с истёкшей подпиской'), 'dayStatuses', 'exact', compare) +
        card('Владелец / тест (отдельно)', et('{{0}} сес. · {{1}} проф.', num(excluded.owner_sessions), num(excluded.owner_profiles)), et('аккаунтов владельца активно: {{0}} · регистраций владельца: {{1}} · не входят в цифры выше', num(excluded.owner_accounts_active), num(s.registrations_owner)), 'excluded') +
        card('Исключено: боты', et('{{0}} сес.', num(excluded.bot_sessions)), et('краулеры и автоматизация'), 'excluded') +
      '</div>' +
      (Object.keys(levels).length ? barList(levels, LIB.STATUS_RU, 'dayStatuses', 'Активные аккаунты по статусу') : ''));

    var platformsBlock = block('platforms', 'Платформы и устройства', 'devices',
      '<div class="ow-cards">' +
        dayCard('Web', 'web', et('сессий'), 'devices', 'consented', compare) +
        dayCard('iOS', 'ios', et('сессий'), 'devices', 'consented', compare) +
        dayCard('Android', 'android', et('сессий'), 'devices', 'consented', compare) +
        dayCard('Телефоны', 'mobile', et('устройств'), 'devices', 'consented', compare) +
        dayCard('Компьютеры', 'desktop', et('устройств'), 'devices', 'consented', compare) +
        dayCard('Планшеты', 'tablet', et('устройств'), 'devices', 'consented', compare) +
      '</div>' +
      barList(platforms.os, null, null, 'Операционные системы (устройства)'));

    var countriesBlock = block('countries', 'Страны и языки интерфейса', 'dayLanguages',
      '<div class="ow-cards">' +
        dayCard('Страны', 'countries', et('по визитам и сессиям, без ботов'), 'countryMap', 'filtered', compare) +
        card('Языки интерфейса', num((data.languages || []).length), et('разных locale за день'), 'dayLanguages') +
      '</div>' +
      '<div class="ow-block-h" style="margin-top:8px">' + et('Страны') + '</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country)) + (r.is_new ? ' <span class="ow-tag ow-tag-exact">' + et('новая') + '</span>' : ''); } },
        { title: 'Обычные визиты', key: 'visits_human', html: function (r) { return visits ? num(r.visits_human) : '—'; }, numeric: true },
        { title: 'Подозр.', key: 'visits_suspicious', html: function (r) { return visits ? num(r.visits_suspicious) : '—'; }, numeric: true },
        { title: 'Боты', key: 'visits_bot', html: function (r) { return visits ? num(r.visits_bot) : '—'; }, numeric: true },
        { title: 'Люди (с согласием)', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Аккаунтов', key: 'accounts', numeric: true }
      ], data.countries, 'В этот день визитов не было') +
      '<div class="ow-block-h" style="margin-top:12px">' + et('Языки интерфейса') + '</div>' +
      table([
        { title: 'Язык', key: 'locale' }, { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.languages, 'Нет данных с согласием'));

    var lotteriesBlock = block('lotteries', 'Лотереи', 'funnels',
      table([
        { title: 'Лотерея', key: 'lottery' }, { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Генераций', key: 'generator_runs', numeric: true }, { title: '3D', key: 'draw3d', numeric: true }
      ], data.lotteries, 'В этот день лотереи не открывали'));

    var featuresBlock = block('features', 'Функции: события и уникальные пользователи', 'dayFeatures',
      table([
        { title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Уникальных пользователей', key: 'users', numeric: true }
      ], data.features, 'Событий с согласием не было') +
      barList(data.pages, PAGE_RU, null, 'Разделы (просмотры)'));

    var steps = data.funnel || [];
    var first = steps.length ? (+steps[0].value || 0) : 0;
    var stepTitles = { visits: 'Обычные визиты', people: 'Люди с согласием', signup: 'Регистрации', paywall: 'Увидели PRO', checkout: 'Начали оплату', purchase: 'Купили PRO' };
    var funnelBlock = block('funnel', 'Регистрации и конверсия в PRO', 'conversion',
      steps.map(function (step) {
        var value = +step.value || 0;
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(label(stepTitles, step.step)) + ' <span class="ow-tag ow-tag-' + esc(step.precision) + '">' + esc(label(LIB.PRECISION_RU, step.precision)) + '</span></span>' +
          '<span class="ow-bar-t"><i style="width:' + (first ? Math.max(1, Math.round((value / first) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(value) + ' · ' + pctText(value, first) + '</span></div>';
      }).join('') +
      '<div class="ow-card-s" style="margin-top:6px">' + et('Ступени с разной точностью не складываются в одну воронку буквально: визиты — счётчики, люди — только с согласием, регистрации и покупки — точные записи.') + '</div>');

    // Money: gross by currency (what was paid), RevenueCat's USD estimate apart, net only where the
    // store's deductions are known. Nothing is summed across currencies, nothing is invented.
    var grossRows = commerce.gross_by_currency || commerce.revenue_by_currency || [];
    var netRows = commerce.net_by_currency || [];
    var grossText = moneyList(grossRows), netText = moneyList(netRows, 'amount'), dedText = moneyList(netRows, 'deductions'), refundText = moneyList(commerce.refunds_by_currency || []);
    var netTotal = (+s.net_known || 0) + (+s.net_unknown || 0);
    var notSalesRows = [['Промо-доступ', s.promo_grants], ['Пробные периоды', s.trial_starts], ['Без оплаты', s.zero_price_events], ['Sandbox / Test Store', s.sandbox_events]].filter(function (r) { return +r[1] > 0; });
    var commerceBlock = block('commerce', 'Платежи и подписки', 'dayCommerce',
      '<div class="ow-cards">' +
        dayCard('Покупки PRO', 'purchases', et('оплачено · подтверждено магазином'), 'dayCommerce', 'exact', compare) +
        dayCard('Продления', 'renewals', et('оплачено · подтверждено магазином'), 'dayCommerce', 'exact', compare) +
        dayCard('Отмены', 'cancellations', et('истекло: {{0}}', num(s.expirations)), 'dayCommerce', 'exact', compare) +
        dayCard('Возвраты', 'refunds', refundText ? et('на сумму {{0}}', refundText) + (commerce.refund_usd != null ? ' · ' + esc(usdEstimate(commerce.refund_usd)) : '') : (+s.refunds ? et('сумма неизвестна') : et('возвратов не было')), 'revenue', 'exact', compare) +
        dayCard('Сбои оплаты', 'payment_failures', et('магазин + клиент'), 'dayCommerce', 'exact', compare) +
        dayCard('Checkout начат', 'checkout_started', et('клиент открыл оплату · по телеметрии: {{0}}', num((commerce.telemetry || {}).purchase_start)), 'dayCommerce', 'exact', compare) +
        dayCard('Checkout не удался', 'checkout_failed', et('отменено пользователем: {{0}}', num(s.checkout_cancelled)), 'dayCommerce', 'exact', compare) +
        card('Не продажи (отдельно)', notSalesRows.length ? notSalesRows.map(function (r) { return et(r[0]) + ': ' + num(r[1]); }).join('<br>') : '0', et('промо, пробные, без оплаты, sandbox — в покупки и суммы не входят'), 'notSales') +
      '</div>' +
      '<div class="ow-cards ow-money" style="margin-top:10px">' +
        moneyCard('Сумма покупок (gross)', 'Сумма покупок (gross)', 'revenue', 'ow-tag-exact', 'точно', grossText ? esc(grossText) : none(),
          et('в валюте покупателя, до удержаний · {{0}} с суммой · {{1}} без суммы', num(s.revenue_known), num(s.revenue_unknown)) + (s.gross_usd != null ? '<br>' + esc(usdEstimate(s.gross_usd)) : ''),
          cmpLine('revenue_usd', compare, { money: true, label: '≈ USD' })) +
        moneyCard('Удержания магазина', 'Удержания магазина', 'netRevenue', 'ow-tag-estimate', 'оценка RevenueCat', dedText ? esc(dedText) : none(),
          (netTotal ? et('налог + комиссия магазина · известно для {{0}} из {{1}}', num(s.net_known), num(netTotal)) : et('налог + комиссия магазина по данным RevenueCat')) + (s.deductions_usd != null ? '<br>' + esc(usdEstimate(s.deductions_usd)) : '')) +
        moneyCard('Чистыми (net)', 'Чистыми (net)', 'netRevenue', 'ow-tag-exact', 'по данным RevenueCat', netText ? esc(netText) : none(),
          (+s.net_unknown ? et('RevenueCat не сообщил удержания для {{0}} из {{1}} — чистая сумма по ним неизвестна', num(s.net_unknown), num(netTotal)) : et('сумма покупки минус удержания магазина')) + (s.net_usd != null ? '<br>' + esc(usdEstimate(s.net_usd)) : ''),
          cmpLine('net_usd', compare, { money: true, label: '≈ USD' })) +
      '</div>' +
      barList(commerce.by_plan, { 1: '1 месяц', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев', unknown: 'Тариф не определён' }, 'dayCommerce', 'Тариф (оплаченные покупки и продления)') +
      barList(commerce.by_store, { apple: 'App Store', google: 'Google Play', paddle: 'Paddle (веб)', stripe: 'Stripe (RevenueCat Web Billing)', revenuecat: 'RevenueCat', promotional: 'Промо-доступ', test_store: 'Test Store', web: 'Веб', ios: 'iOS', android: 'Android', unknown: 'Не определено' }, 'dayCommerce', 'Магазин (оплаченные покупки и продления)') +
      '<div class="ow-block-h" style="margin-top:12px">' + et('События магазина') + '</div>' +
      table([
        { title: 'Время', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Событие', key: 'name', html: function (r) { return esc(label(LIB.COMMERCE_RU, r.name)) + (r.error ? '<br><span class="ow-card-s">' + esc(tx(r.error)) + '</span>' : ''); } },
        { title: 'Вид', key: 'kind', html: function (r) { var k = r.kind || 'paid'; return '<span class="ow-tag' + (k === 'paid' ? ' ow-tag-exact' : ' ow-tag-kind') + '">' + esc(label(LIB.COMMERCE_KIND_RU, k)) + '</span>'; } },
        { title: 'Тариф', key: 'plan', html: function (r) { return r.plan ? et('{{0}} мес.', r.plan) : '—'; } },
        { title: 'Магазин', key: 'store', html: function (r) { return esc(r.store || '—'); } },
        { title: 'Сумма (gross)', key: 'price', html: function (r) { return r.price != null && r.currency ? esc(money(r.price, r.currency)) : '<span class="ow-card-s">' + et('без суммы') + '</span>'; }, numeric: true },
        { title: 'Удержания', key: 'net', html: function (r) { var d = LIB.deductionText ? LIB.deductionText(r) : ''; return d ? esc(d) : '<span class="ow-card-s">' + et('нет данных') + '</span>'; }, numeric: true },
        { title: 'Чистыми (net)', key: 'net', html: function (r) { return r.net != null && r.currency ? esc(money(r.net, r.currency)) : '<span class="ow-card-s">' + et('нет данных') + '</span>'; }, numeric: true },
        { title: '≈ USD (RC)', key: 'price_usd', html: function (r) { return r.price_usd != null ? esc(money(r.price_usd, 'USD')) : '—'; }, numeric: true },
        { title: 'Статус', key: 'status', html: function (r) { return statusChip(r.status); } },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? countryName(r.country) : '—'); } },
        { title: 'Причина', key: 'reason', html: function (r) { return esc(r.reason ? tx(r.reason) : '—'); } }
      ], commerce.events, 'Событий магазина в этот день не было') +
      '<div class="ow-card-s" style="margin-top:6px">' + esc(tx(commerce.note || '')) + (commerce.net_source ? '<br>' + esc(tx(commerce.net_source)) : '') + (commerce.usd_source ? '<br>USD: ' + esc(tx(commerce.usd_source)) : '') + '</div>');

    var ingest = {};
    (system.ingest || []).forEach(function (row) { ingest[row.outcome + ': ' + (row.reason || '—')] = row.events; });
    var systemBlock = block('system', 'Сбои и системные события', 'daySystem',
      '<div class="ow-cards">' +
        dayCard('Отклонено приёмом', 'ingest_rejected', et('событий rejected + invalid'), 'quality', 'exact', compare) +
        dayCard('Ошибки разбора', 'resolve_errors', et('запусков analytics_resolve со статусом error'), 'quality', 'exact', compare) +
        dayCard('Push не доставлен', 'push_failed', et('отправлено: {{0}}', num((system.push || {}).sent)), 'daySystem', 'exact', compare) +
        card('Ошибки в приложении', num(system.client_errors), et('client_error у пользователей'), 'daySystem') +
      '</div>' +
      barList(ingest, null, 'quality', 'Приём событий') +
      '<div class="ow-block-h" style="margin-top:12px">' + et('Ошибки разбора') + '</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(clockText(r.at)); } }, { title: 'Причина', key: 'trigger' }, { title: 'Ошибка', key: 'error' }
      ], system.resolution_errors, 'Ошибок разбора не было') +
      '<div class="ow-block-h" style="margin-top:12px">' + et('Системные уведомления владельца') + '</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Заголовок', key: 'title', html: function (r) { return esc(tx(r.title)); } },
        { title: 'Детали', key: 'body', html: function (r) { return esc(tx(r.body)); } }
      ], system.notifications, 'Системных уведомлений не было'));

    var journeyResponse = state.data.journey;
    var journeyBlock = block('journey', 'Путь гостя: новый гость → активный гость → новый пользователь → PRO', 'journey',
      journeyResponse && journeyResponse.data ? journeyBody(journeyResponse.data, true)
        : '<div class="ow-empty">' + et(state.journeyError ? 'Путь гостя не загрузился: {{0}}' : 'Нет данных', (state.journeyError && state.journeyError.message) || '') + '</div>');
    return head + identityBlock + journeyBlock + visitsBlock + peopleBlock + accountsBlock + platformsBlock + countriesBlock + lotteriesBlock + featuresBlock + funnelBlock + commerceBlock + systemBlock;
  }

  var PAGE_RU = { sim: 'Симулятор', ana: 'Статистика', privacy: 'Политика', terms: 'Условия' };
  function kvLines(map, limit, labels) {
    var keys = Object.keys(map || {});
    if (limit) keys = keys.slice(0, limit);
    return keys.map(function (k) { return esc(labels ? label(labels, k) : k) + ': ' + num(map[k]); }).join('<br>') || '—';
  }

  function renderPeople(data) {
    var rows = (data.rows || []).map(function (row) { return Object.assign({}, row, { __click: true }); });
    return '<div class="ow-block"><div class="ow-block-h">' + et('Люди: {{0}}', num(data.total)) + how('estimated') +
      '<select id="ow-kind" style="margin-left:auto" aria-label="' + et('Категория') + '">' +
        ['all', 'verified', 'probable', 'unknown'].map(function (kind) {
          return '<option value="' + kind + '"' + (kind === state.peopleKind ? ' selected' : '') + '>' +
            esc(kind === 'all' ? t('Все категории') : label(LIB.KIND_RU, kind)) + '</option>';
        }).join('') + '</select></div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Категория', key: 'kind', html: function (r) { return esc(label(LIB.KIND_RU, r.kind)); } },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Устройств', key: 'devices', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)); }, numeric: true },
        { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Первый визит', key: 'first_seen', html: function (r) { return esc(timeText(r.first_seen)) + (r.is_new ? ' · ' + et('новый') : ''); } },
        { title: 'Последний', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } },
        { title: 'Дом', key: 'household' }
      ], rows, 'Нет людей за период') +
      pager(data.total) + '</div>';
  }

  function pager(total) {
    var size = 50;
    if (!total || total <= size) return '';
    var pages = Math.ceil(total / size);
    return '<div class="ow-bar" style="margin-top:8px"><span class="ow-bar-l">' + et('Страница {{0}} из {{1}}', state.page + 1, pages) + '</span>' +
      '<span><button class="ow-btn" type="button" data-page="prev"' + (state.page ? '' : ' disabled') + '>' + et('Назад') + '</button> ' +
      '<button class="ow-btn" type="button" data-page="next"' + (state.page + 1 < pages ? '' : ' disabled') + '>' + et('Вперёд') + '</button></span><span></span></div>';
  }

  function renderHouseholds(data) {
    return '<div class="ow-block"><div class="ow-block-h">' + et('Домохозяйства: {{0}}', num(data.total)) + how('households') + '</div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Людей (оценка)', key: 'people_min', html: function (r) { return num(r.people_min) + '–' + num(r.people_max); }, numeric: true },
        { title: 'Подтверждённых', key: 'verified_people', numeric: true },
        { title: 'Вероятных', key: 'probable_people', numeric: true },
        { title: 'Устройств', key: 'devices', numeric: true },
        { title: 'Профилей', key: 'profiles', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Владелец', key: 'owner_household', html: function (r) { return r.owner_household ? et('да') : '—'; } },
        { title: 'Последний визит', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } }
      ], data.rows, 'Домохозяйства не определены: нужны повторные визиты из домашней сети') + '</div>';
  }

  function renderDevices(data) {
    return '<div class="ow-cards">' +
      card('Типы', kvLines(data.by_kind), '', 'devices') +
      card('ОС', kvLines(data.by_os, 6)) +
      card('Браузеры', kvLines(data.by_browser, 6)) +
      card('Платформы', kvLines(data.by_platform)) +
      card('Экраны', kvLines(data.by_screen)) +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Устройства') + how('devices') + '</div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Тип', key: 'kind' },
        { title: 'ОС', key: 'os' },
        { title: 'Браузеры', key: 'browsers', html: function (r) { return esc((r.browsers || []).join(', ')); } },
        { title: 'Профилей', key: 'profiles', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)); }, numeric: true },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Общее', key: 'shared', html: function (r) { return r.shared ? et('да (несколько аккаунтов)') : '—'; } },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Дом', key: 'household' }
      ], data.rows, 'Нет устройств за период') + '</div>';
  }

  function renderSessions(data) {
    return '<div class="ow-cards">' +
      card('Сессии', num(data.total), et('таймаут 30 минут'), 'sessions') +
      card('События на сессию', esc(String(data.distribution && data.distribution.events_per_session || 0))) +
    '</div>' +
    barList((data.distribution || {}).duration_buckets, null, 'sessions', 'Длительность сессий') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Сессии') + '</div>' +
      table([
        { title: 'Начало', key: 'started_at', html: function (r) { return esc(timeText(r.started_at)); } },
        { title: 'Длит.', key: 'duration_ms', html: function (r) { return esc(dur(r.duration_ms)); }, numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)) + (r.active_source === 'estimated' ? ' ' + et('оц.') : ''); }, numeric: true },
        { title: 'События', key: 'events', numeric: true },
        { title: 'Действия', key: 'interactions', numeric: true },
        { title: 'Вход', key: 'entry' },
        { title: 'Выход', key: 'exit' },
        { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Устройство', key: 'device', html: function (r) { return esc([r.browser, r.os, r.device].filter(Boolean).join(' / ')); } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Человек', key: 'person' }
      ], data.rows, 'Нет сессий за период') +
      pager(data.total) + '</div>';
  }

  function renderAcquisition(data) {
    var coverage = data.coverage || {};
    return '<div class="ow-cards">' +
      card('Сессии с источником', num(coverage.sessions_with_source), '', 'channels') +
      card('Источник неизвестен', num(coverage.sessions_unknown_source), esc(tx(coverage.note || ''))) +
    '</div>' +
    barList(data.first_touch, LIB.CHANNEL_RU, 'channels', 'Первый источник (люди)') +
    barList(data.last_touch, LIB.CHANNEL_RU, 'channels', 'Последний источник (сессии)') +
    barList(data.search_engines, null, null, 'Поисковые системы') +
    barList(data.social, null, null, 'Соцсети') +
    barList(data.ai_assistants, null, null, 'ИИ-ассистенты') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Сайты-источники') + '</div>' +
      table([{ title: 'Домен', key: 'domain' }, { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Людей', key: 'people', numeric: true }],
        data.referrers, 'Переходов по ссылкам не было') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Кампании (UTM)') + '</div>' +
      table([
        { title: 'Источник', key: 'source' }, { title: 'Канал', key: 'medium' }, { title: 'Кампания', key: 'campaign' },
        { title: 'Содержание', key: 'content' }, { title: 'Ключ', key: 'term' },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Людей', key: 'people', numeric: true }
      ], data.campaigns, 'Меток кампаний не было') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Страницы входа') + '</div>' +
      table([{ title: 'Страница', key: 'page' }, { title: 'Сессий', key: 'sessions', numeric: true }], data.landing_pages, 'Нет данных') + '</div>';
  }

  function renderGeography(data) {
    var country = function (r) { return esc(countryName(r.country)); };
    return '<div class="ow-block"><div class="ow-block-h">' + et('Страны') + how('geo') + '</div>' +
      table([
        { title: 'Страна', key: 'country', html: country },
        { title: 'Людей', key: 'people', numeric: true }, { title: 'Домохозяйств', key: 'households', numeric: true },
        { title: 'Устройств', key: 'devices', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Новых', key: 'new_people', numeric: true }
      ], data.countries, 'Нет данных') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Регионы') + '</div>' +
      table([
        { title: 'Страна', key: 'country', html: country },
        { title: 'Регион', key: 'region' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Домохозяйств', key: 'households', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.regions, 'Регион не определён: нужен city-уровень GeoIP') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Города') + '</div>' +
      table([
        { title: 'Город', key: 'city' }, { title: 'Регион', key: 'region' },
        { title: 'Страна', key: 'country', html: country },
        { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.cities, 'Город не определён') + '</div>' +
    barList(data.resolution, { city: 'До города', region: 'До региона', country: 'До страны', none: 'Не определено' }, 'geo', 'Точность определения') +
    barList(data.network_types, NET_LABELS, null, 'Тип сети');
  }

  function renderMap(data) {
    var rows = (data.rows || []).map(function (row) { return Object.assign({}, row, { __click: true }); });
    var totals = data.totals || {};
    var visits = data.visits_available !== false;
    var theme = ovEl.getAttribute('data-ow-theme');
    var scale = (theme === 'dark' ? LIB.BLUE_DARK : LIB.BLUE_LIGHT) || [];
    var legend = '<div class="ow-legend-scale"><span>' + et('Нет данных') + '</span><i style="background:' + esc(scale[0] || '#dde6ee') + '"></i><span>' + et('меньше') + '</span>' +
      scale.slice(1).map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join('') + '<span>' + et('больше · {{0}}', metricLabel(state.mapMetric)) + '</span></div>';
    var cell = function (key) { return function (r) { return visits ? num(r[key]) : '—'; }; };
    return '<div class="ow-block"><div class="ow-block-h">' + et('Карта') + how('countryMap') +
      '<select id="ow-mapmetric" aria-label="' + et('Показатель карты') + '" style="margin-left:auto">' + MAP_METRICS.map(function (m) {
        return '<option value="' + m[0] + '"' + (m[0] === state.mapMetric ? ' selected' : '') + '>' + et(m[1]) + '</option>';
      }).join('') + '</select>' +
      '<select id="ow-continent" aria-label="' + et('Континент') + '">' + [['all', 'Весь мир']].concat((LIB.CONTINENT_ORDER || []).map(function (c) { return [c, LIB.CONTINENT_RU[c]]; })).map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === state.continent ? ' selected' : '') + '>' + et(c[1]) + '</option>';
      }).join('') + '</select>' +
      '<button class="ow-btn" id="ow-fit" type="button">' + et('Показать всё') + '</button></div>' +
      '<div class="ow-map" id="ow-mapbox"></div>' + legend +
      '<div class="ow-map-note">' + et('Наведите на страну — подсветится вся её территория; нажмите — откроется карточка.') + ' ' +
        (visits ? et('Обычные визиты: {{0}} · подозрительных: {{1}} · ботов: {{2}} · стран: {{3}}', num(totals.visits_human), num(totals.visits_suspicious), num(totals.visits_bot), num(totals.countries))
          : et('Счётчики визитов ещё не накоплены — карта показывает данные, собранные с согласием')) +
        ' · ' + et('аккаунтов со страной: {{0}} · покупателей: {{1}}', num(totals.registered), num(totals.buyers)) + '<br>' + esc(tx(data.note || '')) + '</div></div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Страны') + '</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country)) + ' <span class="ow-card-s" style="display:inline">' + esc(r.country) + '</span>'; } },
        { title: 'Обычные визиты', key: 'visits_human', html: cell('visits_human'), numeric: true },
        { title: 'Гости', key: 'visits_guest', html: cell('visits_guest'), numeric: true },
        { title: 'Подозр.', key: 'visits_suspicious', html: cell('visits_suspicious'), numeric: true },
        { title: 'Боты', key: 'visits_bot', html: cell('visits_bot'), numeric: true },
        { title: 'С согласием', key: 'visitors', numeric: true },
        { title: 'Аккаунты', key: 'registered', numeric: true },
        { title: 'FREE / PRO / Lifetime', key: 'free', html: function (r) { return num(r.free) + ' / ' + num(r.pro) + ' / ' + num(r.lifetime); }, numeric: true },
        { title: 'Покупатели', key: 'buyers', numeric: true },
        { title: 'Дом. (оценка)', key: 'households', numeric: true },
        { title: 'Web / iOS / Android', key: 'web', html: function (r) { return visits ? num(r.web) + ' / ' + num(r.ios) + ' / ' + num(r.android) : '—'; }, numeric: true },
        { title: 'Согласия да / нет', key: 'consent_accepted', html: function (r) { return num(r.consent_accepted) + ' / ' + num(r.consent_declined); }, numeric: true }
      ], rows, 'Нет данных за период') + '</div>';
  }

  function renderGames(data) {
    return '<div class="ow-block"><div class="ow-block-h">' + et('Лотереи') + '</div>' +
      table([
        { title: 'Лотерея', key: 'lottery' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Открытий', key: 'opens', numeric: true },
        { title: 'Генераций', key: 'generator_runs', numeric: true }, { title: 'Сохранений', key: 'saved', numeric: true },
        { title: 'Статистика', key: 'statistics_opens', numeric: true }, { title: '3D', key: 'draw3d', numeric: true },
        { title: 'Проверок билета', key: 'ticket_checks', numeric: true },
        { title: 'Вернувшихся', key: 'returning_people', numeric: true },
        { title: 'Ср. активность', key: 'avg_active_ms', html: function (r) { return esc(dur(r.avg_active_ms)); }, numeric: true }
      ], data.rows, 'Нет активности по лотереям') + '</div>' +
      barList(data.models, null, null, 'Использованные модели');
  }

  function renderFeatures(data) {
    return '<div class="ow-block"><div class="ow-block-h">' + et('Функции') + '</div>' +
      table([
        { title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.rows, 'Нет событий') + '</div>' +
      barList(data.pages, PAGE_RU, null, 'Разделы');
  }

  function renderFunnels(data) {
    var steps = data.steps || [];
    var first = steps.length ? (steps[0].people || 0) : 0;
    var titles = { landing: 'Зашли', game: 'Открыли лотерею', generator_open: 'Открыли генератор', generate: 'Сгенерировали', save: 'Сохранили', signup: 'Зарегистрировались', paywall: 'Увидели PRO', checkout: 'Начали оплату', purchase: 'Оплатили' };
    // The funnel counts PEOPLE with analytics consent; the store's own sales live in «День» → Платежи.
    var notes = { checkout: 'Люди с согласием, открывшие экран оплаты (клиент). Оплаченные покупки — точные записи магазина: «День» → Платежи.',
      purchase: 'Люди с согласием, у которых клиент сообщил об оплате. Число оплаченных покупок — из журнала магазина: «День» → Платежи и «Обзор» → Покупки за период.' };
    return '<div class="ow-block"><div class="ow-block-h">' + et('Воронка по людям') + how('funnels') + '</div>' +
      steps.map(function (step) {
        var value = step.people || 0;
        var note = notes[step.step] ? t(notes[step.step]) : (step.note ? tx(step.note) : '');
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(label(titles, step.step)) + '</span>' +
          '<span class="ow-bar-t"><i style="width:' + (first ? Math.max(1, Math.round((value / first) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(value) + ' · ' + pctText(value, first) + '</span></div>' +
          (note ? '<div class="ow-card-s">' + esc(note) + '</div>' : '');
      }).join('') + '</div>';
  }

  function renderRetention(data) {
    var summary = data.summary || {};
    return '<div class="ow-cards">' +
      card('Новые люди', num(summary.new), '', 'retention') +
      card('Вернувшиеся', num(summary.returning)) +
      card('Были в 2+ дня', num(summary.multi_day)) +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Когорты') + how('retention') + '</div>' +
      table([
        { title: 'Когорта', key: 'cohort' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'D1', key: 'd1', html: function (r) { return num(r.d1) + ' · ' + pctText(r.d1, r.people); }, numeric: true },
        { title: 'D7', key: 'd7', html: function (r) { return num(r.d7) + ' · ' + pctText(r.d7, r.people); }, numeric: true },
        { title: 'D30', key: 'd30', html: function (r) { return num(r.d30) + ' · ' + pctText(r.d30, r.people); }, numeric: true }
      ], data.cohorts, 'Пока нет когорт') + '</div>';
  }

  function renderBots(data) {
    var evidence = {};
    Object.keys(data.evidence || {}).forEach(function (key) {
      evidence[LIB.evidenceRu ? LIB.evidenceRu(key) : key] = data.evidence[key];
    });
    return '<div class="ow-cards">' +
      card('Владелец и тесты', et('{{0}} проф.', num((data.owner_test || {}).profiles)), et('{{0}} сессий', num((data.owner_test || {}).sessions)), 'excluded') +
      card('Классы трафика', kvLines(data.classes, 0, LIB.CLASS_RU), '', 'excluded') +
    '</div>' +
    barList(evidence, null, 'excluded', 'Признаки, по которым принято решение') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Профили с признаками автоматизации') + '</div>' +
      table([
        { title: 'ID', key: 'short' }, { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Оценка', key: 'bot_score', numeric: true },
        { title: 'Признаки', key: 'evidence', html: function (r) { return esc((r.evidence || []).map(function (e) { return LIB.evidenceRu ? LIB.evidenceRu(e) : e; }).join(' · ')); } },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'События', key: 'events', numeric: true },
        { title: 'Действия', key: 'interactions', numeric: true },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? countryName(r.country) : '—'); } },
        { title: 'Браузер', key: 'browser' }, { title: 'Первый', key: 'first_seen', html: function (r) { return esc(timeText(r.first_seen)); } }
      ], data.rows, 'Ботов и тестов за период не найдено') + '</div>';
  }

  function renderQuality(data) {
    var events = data.events || {}, freshness = data.freshness || {}, consent = data.consent || {};
    var ingest = {};
    (data.ingest || []).forEach(function (row) { ingest[row.outcome + ': ' + (row.reason || '—')] = row.events; });
    return '<div class="ow-cards">' +
      card('События за период', num(events.total), et('{{0}} новый формат / {{1}} старый', num(events.v2), num(events.v1_legacy)), 'quality') +
      card('Без гео', num(events.missing_geo), et('{{0}} от всех', pctText(events.missing_geo, events.total)), 'geo') +
      card('С городом', num(events.city_level), et('{{0}} от всех', pctText(events.city_level, events.total))) +
      card('Начало сессии без источника', num(events.missing_acquisition), et('остаётся «неизвестно»'), 'channels') +
      card('С признаком устройства', num(events.with_device_signal), et('только с отдельным согласием')) +
      card('Согласия', et('{{0}} да / {{1}} нет', num(consent.accepted), num(consent.declined)), et('{{0}} с распознаванием устройства', num(consent.device_recognition))) +
      card('Задержка разбора', et('{{0}} мин', num(Math.round((freshness.watermark_lag_seconds || 0) / 60))), et('разбор идёт каждые 5 минут')) +
      card('Последнее событие', esc(timeText(freshness.latest_event))) +
    '</div>' +
    barList(ingest, null, 'quality', 'Приём событий') +
    barList(data.identity_confidence, null, null, 'Распределение уверенности идентификации') +
    barList(freshness.geo_source_mix, null, null, 'Источник геоданных') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Запуски разбора') + '</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(timeText(r.at)); } },
        { title: 'Статус', key: 'status' }, { title: 'Причина', key: 'trigger' },
        { title: 'События', key: 'events', numeric: true }, { title: 'Сессии', key: 'sessions', numeric: true },
        { title: 'Этапы (мс)', key: 'stage_ms', html: function (r) { return esc(Object.keys(r.stage_ms || {}).map(function (k) { return k + ':' + r.stage_ms[k]; }).join(' ')); } },
        { title: 'Ошибка', key: 'error', html: function (r) { return esc(r.error || '—'); } }
      ], data.resolution_runs, 'Разбор ещё не запускался') + '</div>';
  }

  function renderConsent(data) {
    var decisions = data.decisions || {}, coverage = data.analytics_coverage || {}, device = data.device_recognition || {};
    var acceptRate = data.accept_rate == null ? '—' : data.accept_rate + '%';
    return '<div class="ow-cards">' +
      card('Решений о согласии', num(decisions.total), et('за выбранный период'), 'consent') +
      card('Согласились на аналитику', num(decisions.accepted), et('доля среди решений: {{0}}', acceptRate)) +
      card('Только необходимое', num(decisions.only_necessary), et('отказ от необязательной статистики')) +
      card('Включили «Повторные посещения»', num(decisions.device_recognition), et('{{0}} профилей с признаком', num(device.profiles_with_signal))) +
      card('Данные с согласием', num(coverage.events_consented), et('{{0}} событий собрано до внедрения согласия', num(coverage.events_legacy))) +
      card('Профили с согласием', num(coverage.consented_profiles), et('{{0}} старых профилей', num(coverage.legacy_profiles))) +
      card('Охват от всех посетителей', et('нельзя измерить'), et('см. пояснение ниже'), 'consent') +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Почему нет процента охвата') + '</div>' +
      '<div class="ow-card-s">' + esc(tx(coverage.note || '')) + '</div></div>' +
    barList(data.by_source, { banner: 'Баннер', settings: 'Настройки', privacy_page: 'Страница политики' }, null, 'Где принято решение') +
    barList(data.by_platform, { web: 'Веб', ios: 'iOS', android: 'Android', unknown: 'Не указано' }, null, 'Платформа') +
    barList(data.by_policy, null, null, 'Версия политики') +
    lineChart(data.timeseries || [], ['accepted', 'only_necessary'], ['Согласились', 'Только необходимое']);
  }

  // ── AI-агенты ───────────────────────────────────────────────────────────────────────────────
  // Деятельность автоматизации, НЕ смешанная с людьми: люди в остальных разделах считаются по
  // traffic_class, куда агент никогда не попадает как human. Здесь показано ровно то, что сервер
  // действительно наблюдал: доказана ли личность агента подписью (Web Bot Auth), какой оператор,
  // какой аккаунт, что он делал и чем именно его остановили.
  var AGENT_CLASS_RU = {
    agent_verified: 'Проверенный AI-агент', agent_unverified: 'Непроверенная автоматизация', bot: 'Краулер / бот'
  };
  var AGENT_KIND_RU = {
    visit: 'Визит', login: 'Вход', signup: 'Регистрация', purchase: 'Покупка',
    simulation: 'Симуляция', feature: 'Функция', blocked: 'Отказ'
  };
  var AGENT_EVIDENCE_RU = {
    web_bot_auth_verified: 'Подпись Web Bot Auth проверена',
    web_bot_auth_signature_mismatch: 'Подпись не совпала',
    web_bot_auth_directory_unavailable: 'Каталог ключей недоступен',
    web_bot_auth_unknown_key: 'Ключ не опубликован в каталоге',
    web_bot_auth_expired: 'Подпись просрочена',
    web_bot_auth_no_web_bot_auth_tag: 'Подпись не для Web Bot Auth',
    web_bot_auth_authority_not_covered: 'Подпись не покрывает домен',
    web_bot_auth_signature_agent_not_covered: 'Подпись не покрывает Signature-Agent',
    user_agent_claim: 'Заявлено только в User-Agent',
    automation_engine: 'Движок автоматизации (headless)',
    client_declared_webdriver: 'Страница сообщила navigator.webdriver',
    attributed_by_recent_agent_session: 'Связано с недавней сессией агента'
  };
  function agentEvidenceRu(key) {
    if (AGENT_EVIDENCE_RU[key]) return t(AGENT_EVIDENCE_RU[key]);
    if (key.indexOf('agent_operator:') === 0) return t('Оператор: {{0}}', key.slice(15));
    if (key.indexOf('declared_bot:') === 0) return t('Объявленный бот: {{0}}', key.slice(13));
    return LIB.evidenceRu ? LIB.evidenceRu(key) : key;
  }
  // Agent ledger amounts (a plain number + currency code; the store ledger's own money() is above).
  function agentMoney(value, currency) {
    var n = +value || 0;
    if (!n) return '—';
    return n.toLocaleString(intl(), { maximumFractionDigits: 2 }) + (currency ? ' ' + esc(currency) : '');
  }
  function renderAgents(data) {
    var s = data.summary || {};
    var evidence = {};
    Object.keys(data.evidence || {}).forEach(function (key) { evidence[agentEvidenceRu(key)] = data.evidence[key]; });
    var reasons = {};
    Object.keys(data.blocked_reasons || {}).forEach(function (key) { reasons[key] = data.blocked_reasons[key]; });
    var proven = function (r) { return r.verified ? t('доказана') : t('не доказана'); };
    return '<div class="ow-cards">' +
      card('Запросы автоматизации', num(s.requests), et('{{0}} аккаунт(ов) · {{1}} оператор(ов)', num(s.accounts), num(s.operators))) +
      card('Проверенные агенты', num(s.verified_requests), et('подпись Web Bot Auth проверена сервером')) +
      card('Непроверенная автоматизация', num(s.unverified_requests), et('заявлено, но не доказано')) +
      card('Краулеры и боты', num(s.bot_requests), et('объявленные индексаторы и скрипты')) +
      card('Визиты и входы', num(s.visits) + ' / ' + num(s.logins), et('визит · вход или регистрация')) +
      card('Симуляции', num(s.simulations), et('запуски моделей и разборов')) +
      card('Покупки агентами', num(s.purchases), et('подтверждено магазином: {{0}}', agentMoney(s.revenue))) +
      card('Отказы агентам', num(s.blocked), et('см. причины ниже')) +
    '</div>' +
    (Object.keys(reasons).length
      ? barList(reasons, null, null, 'Чем именно остановлен агент (причина отказа)')
      : '<div class="ow-block"><div class="ow-block-h">' + et('Чем именно остановлен агент') + '</div>' +
        '<div class="ow-empty">' + et('За период ни один агент не получил отказ') + '</div></div>') +
    barList(data.by_class, AGENT_CLASS_RU, null, 'Классы автоматизации') +
    barList(data.by_kind, AGENT_KIND_RU, null, 'Что делали агенты') +
    barList(evidence, null, null, 'На каком основании определён класс') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Операторы') + '</div>' +
      table([
        { title: 'Оператор', key: 'operator' },
        { title: 'Личность', key: 'verified', html: function (r) {
          return r.verified ? '<span class="ow-conf ow-conf-high" title="' + et('Подпись проверена сервером') + '">' + esc(proven(r)) + '</span>' +
            (r.trusted ? ' · ' + et('в списке доверия') : '')
            : '<span class="ow-conf ow-conf-low" title="' + et('Только заявление клиента') + '">' + esc(proven(r)) + '</span>';
        } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(AGENT_CLASS_RU, r.class)); } },
        { title: 'Запросы', key: 'requests', numeric: true },
        { title: 'Аккаунты', key: 'accounts', numeric: true },
        { title: 'Симуляции', key: 'simulations', numeric: true },
        { title: 'Покупки', key: 'purchases', numeric: true },
        { title: 'Сумма', key: 'revenue', numeric: true, html: function (r) { return agentMoney(r.revenue); } },
        { title: 'Отказы', key: 'blocked', numeric: true },
        { title: 'Последний', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } }
      ], data.operators, 'Автоматизация за период не обращалась') + '</div>' +
    barList(data.by_platform, PLATFORM_RU, null, 'Платформа') +
    '<div class="ow-block"><div class="ow-block-h">' + et('Действия') + '</div>' +
      table([
        { title: 'Время', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } },
        { title: 'Действие', key: 'kind', html: function (r) { return esc(label(AGENT_KIND_RU, r.kind)); } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(AGENT_CLASS_RU, r.class)); } },
        { title: 'Оператор', key: 'operator' },
        { title: 'Личность', key: 'verified', html: function (r) { return esc(proven(r)); } },
        { title: 'Аккаунт', key: 'account', html: function (r) { return esc(r.account || t('без входа')); } },
        { title: 'Деталь', key: 'detail', html: function (r) { return esc(r.detail ? tx(r.detail) : '—'); } },
        { title: 'Запросы', key: 'requests', numeric: true },
        { title: 'Сумма', key: 'amount', numeric: true, html: function (r) { return agentMoney(r.amount, r.currency); } },
        { title: 'Источник', key: 'source', html: function (r) {
          return esc(label({ client: 'клиент', server: 'сервер', store: 'магазин' }, r.source));
        } },
        { title: 'Основание', key: 'evidence', html: function (r) {
          return esc((r.evidence || []).map(agentEvidenceRu).join(' · '));
        } }
      ], data.rows, 'Автоматизация за период не обращалась') + '</div>' +
    lineChart(data.timeseries || [], ['verified', 'unverified', 'bot', 'blocked'],
      ['Проверенные', 'Непроверенные', 'Боты', 'Отказы']);
  }

  // ── the guest journey (migration 059): Новый гость → Активный гость → Новый пользователь → PRO ──
  // Units are printed on every card: guests are INSTALLATIONS on the consented path, users are
  // ACCOUNTS, visits are page loads. The day report embeds the same body (compact) as a block.
  function journeyStatus(key) {
    return key === 'guest' ? statusChip('guest') : statusChip(key || 'free');
  }
  function journeyBody(data, compact) {
    var s = data.scalars || {};
    var cur = { __current: s };
    var kinds = s.guest_actions_by_kind || {};
    var cohort = +s.cohort_new_guests || 0;
    var step = function (title, value, sub) {
      var width = cohort ? Math.max(2, Math.round(((+value || 0) / cohort) * 100)) : 0;
      return '<div class="ow-bar"><span class="ow-bar-l">' + et(title) + '</span>' +
        '<span class="ow-bar-t"><i style="width:' + width + '%"></i></span>' +
        '<span class="ow-bar-v">' + num(value) + (cohort ? ' · ' + esc(pctText(+value || 0, cohort)) : '') + '</span></div>' +
        (sub ? '<div class="ow-card-s" style="margin:-2px 0 6px">' + sub + '</div>' : '');
    };
    var html = '<div class="ow-cards">' +
      dayCard('Новые гости', 'new_guests', et('первый визит с согласием на аналитику · установки, не визиты'), 'journeyGuests', 'consented', cur) +
      dayCard('Вернувшиеся гости', 'returning_guests', et('были до периода, пришли снова без аккаунта'), 'journeyGuests', 'consented', cur) +
      dayCard('Активные гости', 'active_guests', et('с продуктовым действием: {{0}} · впервые: {{1}}', num(s.active_guests_product), num(s.first_time_active_guests)), 'journeyActive', 'consented', cur) +
      dayCard('Интерес к PRO (гости)', 'pro_interest_guests', et('попытка PRO-функции, экран PRO, начало оплаты'), 'journeyActive', 'consented', cur) +
      dayCard('Новые пользователи', 'registrations', et('до регистрации были гостями: {{0}} · активными гостями: {{1}}', num(s.registrations_from_guest), num(s.registrations_from_active_guest)), 'journeyUsers', 'exact', cur) +
      dayCard('Новые PRO', 'new_pro', et('первая оплата за период · были гостями: {{0}}', num(s.new_pro_from_guest)), 'journeyUsers', 'exact', cur) +
      dayCard('FREE сейчас', 'free_now', et('аккаунтов всего: {{0}} · активны за период: {{1}}', num(s.accounts_total_now), num(s.active_free_accounts)), 'journeyUsers', 'exact', cur) +
      dayCard('PRO сейчас', 'pro_now', et('действующий PRO-доступ · активны за период: {{0}}', num(s.active_pro_accounts)), 'journeyUsers', 'exact', cur) +
      (compact ? '' : dayCard('Визиты', 'visits_human', et('загрузки страницы — это не люди'), 'visitsHuman', 'filtered', cur)) +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Когорта новых гостей периода: что с ними стало к сегодняшнему дню') + how('journeyCohort') + '</div>' +
      (cohort
        ? step('Новые гости', cohort) + step('Стали активными', s.cohort_active) + step('Зарегистрировались (FREE)', s.cohort_registered) + step('Стали PRO', s.cohort_pro)
        : '<div class="ow-empty">' + et('Новых гостей с согласием за период нет') + '</div>') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Действия гостей') + how('journeyActive') + '</div>' +
      table([
        { title: 'Действие', key: 'kind', html: function (r) { return esc(label(LIB.ACTIVITY_RU, r.kind)); } },
        { title: 'Действий', key: 'actions', numeric: true },
        { title: 'Гостей', key: 'guests', numeric: true }
      ], (LIB.ACTIVITY_ORDER || Object.keys(kinds)).filter(function (k) { return kinds[k]; })
          .map(function (k) { return { kind: k, actions: kinds[k].actions, guests: kinds[k].guests }; }), 'Гости за период ничего не делали') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Активные гости') + how('journeyActive') + '</div>' +
      table([
        { title: 'Гость', key: 'who', html: function (r) {
          return esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country)) + '<div class="ow-card-s">' +
            esc([label(PLATFORM_RU, r.platform), r.locale, r.device].filter(Boolean).join(' · ')) + ' · #' + esc(r.who) + '</div>';
        } },
        { title: 'Первый визит', key: 'first_seen_at', html: function (r) { return esc(timeText(r.first_seen_at)); } },
        { title: 'Действия', key: 'actions', html: function (r) {
          return '<b>' + num(r.actions) + '</b><div class="ow-card-s">' + esc(LIB.activityText ? LIB.activityText(r.by_kind) : '') + '</div>';
        } },
        { title: 'Последнее действие', key: 'last_action_at', html: function (r) { return esc(timeText(r.last_action_at)); } },
        { title: 'Активное время', key: 'engaged_ms', html: function (r) { return +r.engaged_ms >= 60000 ? esc(dur(r.engaged_ms)) : '—'; } },
        { title: 'Сейчас', key: 'status_now', html: function (r) { return journeyStatus(r.status_now); } }
      ], (data.active_guests || []).slice(0, compact ? 12 : 60), 'Активных гостей за период нет') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">' + et('Переходы: новые пользователи и новые PRO') + how('journeyUsers') + '</div>' +
      table([
        { title: 'Аккаунт', key: 'who', html: function (r) { return '#' + esc(r.who); } },
        { title: 'Был гостем', key: 'guest', html: function (r) {
          var g = r.guest;
          if (!g) return '<span class="ow-card-s">' + et('нет связанной гостевой истории') + '</span>';
          return esc(t('с {{0}}', timeText(g.firstSeenAt))) + '<div class="ow-card-s">' +
            esc(+g.actions ? t('действий: {{0}}', num(g.actions)) + (LIB.activityText ? ' · ' + LIB.activityText(g.byKind) : '') : t('без действий')) + '</div>';
        } },
        { title: 'Регистрация', key: 'registered_at', html: function (r) { return esc(timeText(r.registered_at)); } },
        { title: 'PRO с', key: 'pro_since', html: function (r) { return r.pro_since ? esc(timeText(r.pro_since)) : '—'; } },
        { title: 'Сейчас', key: 'status_now', html: function (r) { return journeyStatus(r.status_now); } }
      ], data.transitions || [], 'За период не было новых пользователей и новых PRO') + '</div>' +
    '<div class="ow-card-s" style="margin-top:6px">' + esc(tx(data.note || '')) + '</div>';
    return html;
  }
  function renderJourney(data) { return journeyBody(data, false); }

  // ── lotteries × functions (migration 061, section `usage`) ─────────────────────────────────
  // Units on every table: people (account or installation), sessions and actions are separate
  // numbers; popularity is ordered by people. Rows, headers and cells are drill-down filters.
  var USAGE_METRICS = [['people', 'Люди'], ['sessions', 'Сессии'], ['actions', 'Действия']];
  // Codes the client sends as a use's detail (models stay their own ids: markov, consensus, qastro…).
  var DETAIL_RU = {
    free_counsel: 'Бесплатный защитник', defense: 'Защитник', jury_review: 'Присяжные: проверка', jury_generate: 'Присяжные: ряды',
    model_review: 'Разбор моделями', judge: 'Верховный судья', court_judge: 'Судья суда', world_analysis: 'Мировой анализ',
    trial: 'пробный запуск', free: 'FREE', full: 'полный',
    rows: 'ряды', matrix: 'матрица', copy: 'копия', official: 'официальный тираж', advice: 'совет', ticket: 'билет',
    drum: '3D-барабан', drum_replace: '3D-барабан (замена)', saved_draw: 'сохранённый тираж', life: '50 лет', favorites: 'избранное'
  };
  function lotName(id) { return LIB.lotteryName ? LIB.lotteryName(id) : (id || '—'); }
  function featName(id) { return LIB.usageLabel ? LIB.usageLabel(id) : (id || '—'); }
  function detailName(code) { return DETAIL_RU[code] ? t(DETAIL_RU[code]) : code; }
  // «Поделиться»: the channel code of app_share (migration 063). Brand names are not translated.
  var SHARE_CHANNEL_RU = {
    system: 'Системное меню', copy: 'Копировать ссылку', email: 'E-mail', facebook: 'Facebook', x: 'X', reddit: 'Reddit',
    telegram: 'Telegram', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok'
  };
  function shareChannel(code) { return SHARE_CHANNEL_RU[code] ? t(SHARE_CHANNEL_RU[code]) : code; }
  function flagName(iso) { return (LIB.flagEmoji ? LIB.flagEmoji(iso) + ' ' : '') + countryName(iso); }
  function gfp(r) { return num(r.guests) + ' / ' + num(r.free) + ' / ' + num(r.pro); }
  function usageSelect(id, label, current, list) {
    return '<label class="ow-u-f"><span>' + et(label) + '</span> <select id="' + id + '">' +
      list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
      '</select></label>';
  }
  function usageFilters(data) {
    var f = state.filters;
    var countries = (data.countries || []).map(function (r) { return r.country; });
    if (f.country !== 'all' && countries.indexOf(f.country) < 0) countries.unshift(f.country);
    var lotteries = (LIB.LOTTERY_ORDER || data.lotteries_catalog || []);
    var features = (LIB.USAGE_ORDER || data.features_catalog || []);
    return '<div class="ow-u-bar">' +
      usageSelect('ow-u-lottery', 'Лотерея', f.lottery, [['all', t('Все')]].concat(lotteries.map(function (id) { return [id, lotName(id)]; }))) +
      usageSelect('ow-u-feature', 'Функция', f.feature, [['all', t('Все')]].concat(features.map(function (id) { return [id, featName(id)]; }))) +
      usageSelect('ow-u-country', 'Страна', f.country, [['all', t('Все')]].concat(countries.map(function (iso) { return [iso, flagName(iso)]; }))) +
      usageSelect('ow-u-status', 'Статус', f.status, [['all', t('Все')], ['guest', label(LIB.STATUS_RU, 'guest')], ['free', 'FREE'], ['pro', 'PRO']]) +
      (f.lottery !== 'all' || f.feature !== 'all' || f.country !== 'all' || f.status !== 'all'
        ? '<button class="ow-btn" type="button" id="ow-u-reset">' + et('Сбросить фильтры') + '</button>' : '') +
    '</div>';
  }
  // A matrix of people / sessions / actions: rows × columns, shaded by value; every row, column and
  // cell carries the filters it stands for.
  function usageMatrix(title, howKey, cells, rowKey, colKey, rowName, colName, rowAttr, colAttr) {
    var metric = state.usageMetric;
    var rows = [], cols = [], val = {}, colTot = {}, max = 0;
    (cells || []).forEach(function (c) {
      var r = c[rowKey], k = c[colKey], v = +c[metric] || 0;
      if (rows.indexOf(r) < 0) rows.push(r);
      if (cols.indexOf(k) < 0) cols.push(k);
      val[r + '|' + k] = v;
      colTot[k] = (colTot[k] || 0) + (+c.people || 0);
      max = Math.max(max, v);
    });
    if (!rows.length) return '<div class="ow-block"><div class="ow-block-h">' + et(title) + how(howKey) + '</div><div class="ow-empty">' + et('Нет данных за период') + '</div></div>';
    var sum = function (r) { return cols.reduce(function (s, k) { return s + (val[r + '|' + k] || 0); }, 0); };
    rows.sort(function (a, b) { return sum(b) - sum(a); });
    cols.sort(function (a, b) { return (colTot[b] || 0) - (colTot[a] || 0); });
    return '<div class="ow-block"><div class="ow-block-h">' + et(title) + how(howKey) +
      '<span class="ow-u-metric" role="group" aria-label="' + et('Показатель') + '">' + USAGE_METRICS.map(function (m) {
        return '<button class="ow-chip" type="button" data-u-metric="' + m[0] + '" aria-pressed="' + (m[0] === metric) + '">' + et(m[1]) + '</button>';
      }).join('') + '</span></div>' +
      '<div class="ow-tw"><table class="ow-t ow-u-m"><thead><tr><th></th>' +
      cols.map(function (k) { return '<th class="num"><button type="button" class="ow-u-link" ' + colAttr + '="' + esc(k) + '">' + esc(colName(k)) + '</button></th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><th><button type="button" class="ow-u-link" ' + rowAttr + '="' + esc(r) + '">' + esc(rowName(r)) + '</button></th>' +
          cols.map(function (k) {
            var v = val[r + '|' + k] || 0;
            var a = max ? (0.08 + 0.62 * (v / max)).toFixed(2) : 0;
            return '<td class="num">' + (v ? '<button type="button" class="ow-u-cell" ' + rowAttr + '="' + esc(r) + '" ' + colAttr + '="' + esc(k) + '" style="--a:' + a + '">' + num(v) + '</button>' : '<span class="ow-u-zero">·</span>') + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }
  function journeyChips(person) {
    var steps = LIB.journeySteps ? LIB.journeySteps(person, countryName) : [];
    return '<div class="ow-path">' + steps.map(function (s, i) {
      return (i ? '<span class="ow-path-a" aria-hidden="true">→</span>' : '') +
        '<span class="ow-path-s ow-path-' + esc(s.type) + (s.seen ? ' ow-path-seen' : '') + '">' + esc(s.text) + '</span>';
    }).join('') + '</div>';
  }
  function detailText(details, name) {
    var keys = Object.keys(details || {});
    if (!keys.length) return '';
    return keys.slice(0, 6).map(function (k) { var d = details[k]; return (name || detailName)(k) + ' ×' + num(d && typeof d === 'object' ? d.actions : d); }).join(' · ');
  }
  // Who shared the app and through which channel: the `share` row of the functions table, one line per
  // channel (people first, like every popularity table); a closed share sheet is its «opened» count.
  function shareBlock(data) {
    var row = (data.features || []).filter(function (r) { return r.feature === 'share'; })[0];
    if (!row) return '';
    var d = row.details || {};
    var rows = Object.keys(d).map(function (k) { return { channel: k, people: +(d[k] && d[k].people) || 0, actions: +(d[k] && d[k].actions) || 0 }; })
      .sort(function (a, b) { return b.people - a.people || b.actions - a.actions; });
    return '<div class="ow-block" id="ow-u-share"><div class="ow-block-h">' + et('Поделиться: каналы') + how('usageShare') + '</div>' +
      table([
        { title: 'Канал', key: 'channel', html: function (r) { return esc(shareChannel(r.channel)); } },
        { title: 'Люди', key: 'people', numeric: true, html: function (r) { return '<b>' + num(r.people) + '</b>'; } },
        { title: 'Действия', key: 'actions', numeric: true }
      ], rows, 'Нет данных за период') +
      (+row.views ? '<div class="ow-card-s">' + et('Закрыли меню «Поделиться» без отправки: {{0}}', num(row.views)) + '</div>' : '') + '</div>';
  }
  function renderUsage(data) {
    var s = data.totals || {};
    var tr = data.transitions || {};
    var guests = +tr.guests || 0;
    var step = function (title, value) {
      var width = guests ? Math.max(2, Math.round(((+value || 0) / guests) * 100)) : 0;
      return '<div class="ow-bar"><span class="ow-bar-l">' + et(title) + '</span><span class="ow-bar-t"><i style="width:' + width + '%"></i></span>' +
        '<span class="ow-bar-v">' + num(value) + (guests ? ' · ' + esc(pctText(+value || 0, guests)) : '') + '</span></div>';
    };
    return usageFilters(data) +
      '<div class="ow-cards">' +
        card('Люди', num(s.people), et('с действием: {{0}} · установок: {{1}}', num(s.active_people), num(s.installs)), 'usage') +
        card('Сессии', num(s.sessions), et('лотерей: {{0}} · стран: {{1}}', num(s.lotteries), num(s.countries)), 'usage') +
        card('Действия', num(s.actions), et('открытий: {{0}}', num(s.views)), 'usageUnits') +
        card('Гости / FREE / PRO', gfp(s), et('люди по статусу в момент действия'), 'usageStatus') +
        card('Человек ✓ / вероятно', num(s.human_confirmed) + ' / ' + num(s.human_likely), et('по доказательствам сервера'), 'human') +
        card('Время в лотереях', +s.engaged_ms >= 1000 ? esc(dur(s.engaged_ms)) : '—', et('активное время на экране лотереи'), 'usageUnits') +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Лотереи') + how('usage') + '</div>' +
        table([
          { title: 'Лотерея', key: 'lottery', html: function (r) { return '<button type="button" class="ow-u-link" data-u-lottery="' + esc(r.lottery) + '">' + esc(lotName(r.lottery)) + '</button>'; } },
          { title: 'Люди', key: 'people', numeric: true, html: function (r) { return '<b>' + num(r.people) + '</b>'; } },
          { title: 'С действием', key: 'active_people', numeric: true },
          { title: 'Сессии', key: 'sessions', numeric: true },
          { title: 'Действия', key: 'actions', numeric: true },
          { title: 'Открытия', key: 'views', numeric: true },
          { title: 'Гости / FREE / PRO', key: 'guests', numeric: true, html: gfp },
          { title: 'Стран', key: 'countries', numeric: true },
          { title: 'Время', key: 'engaged_ms', numeric: true, html: function (r) { return +r.engaged_ms >= 1000 ? esc(dur(r.engaged_ms)) : '—'; } },
          { title: 'Главная функция', key: 'top_feature', html: function (r) { return r.top_feature ? esc(featName(r.top_feature)) : '—'; } }
        ], data.lotteries, 'Нет действий в лотереях за период') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Функции') + how('usageUnits') + '</div>' +
        table([
          { title: 'Функция', key: 'feature', html: function (r) { return '<button type="button" class="ow-u-link" data-u-feature="' + esc(r.feature) + '">' + esc(featName(r.feature)) + '</button>'; } },
          { title: 'Люди', key: 'people', numeric: true, html: function (r) { return '<b>' + num(r.people) + '</b>'; } },
          { title: 'С действием', key: 'active_people', numeric: true },
          { title: 'Сессии', key: 'sessions', numeric: true },
          { title: 'Действия', key: 'actions', numeric: true },
          { title: 'Открытия', key: 'views', numeric: true },
          { title: 'Гости / FREE / PRO', key: 'guests', numeric: true, html: gfp },
          { title: 'Лотерей', key: 'lotteries', numeric: true },
          { title: 'Модели и режимы', key: 'details', html: function (r) { return '<span class="ow-card-s">' + esc(detailText(r.details, r.feature === 'share' ? shareChannel : null)) + '</span>'; } }
        ], data.features, 'Функциями за период не пользовались') + '</div>' +
      shareBlock(data) +
      usageMatrix('Функция × лотерея', 'usageMatrix', data.feature_lottery, 'feature', 'lottery', featName, lotName, 'data-u-feature', 'data-u-lottery') +
      usageMatrix('Страна × лотерея', 'usageMatrix', data.country_lottery, 'country', 'lottery', flagName, lotName, 'data-u-country', 'data-u-lottery') +
      usageMatrix('Страна × функция', 'usageMatrix', data.country_feature, 'country', 'feature', flagName, featName, 'data-u-country', 'data-u-feature') +
      '<div class="ow-block"><div class="ow-block-h">' + et('Гость, FREE, PRO') + how('usageStatus') + '</div>' +
        table([
          { title: 'Статус', key: 'status', html: function (r) { return '<button type="button" class="ow-u-link" data-u-status="' + esc(r.status) + '">' + statusChip(r.status) + '</button>'; } },
          { title: 'Люди', key: 'people', numeric: true, html: function (r) { return '<b>' + num(r.people) + '</b>'; } },
          { title: 'Установки', key: 'installs', numeric: true },
          { title: 'Сессии', key: 'sessions', numeric: true },
          { title: 'Действия', key: 'actions', numeric: true },
          { title: 'Открытия', key: 'views', numeric: true }
        ], data.statuses, 'Нет данных за период') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Переходы: гость → регистрация → аккаунт → PRO') + how('usageTransitions') + '</div>' +
        (guests
          ? step('Были гостями', guests) + step('Зарегистрировались (FREE)', tr.registered) + step('Действовали в аккаунте', tr.active_accounts) + step('Стали PRO', tr.pro)
          : '<div class="ow-empty">' + et('Гостей в этом срезе нет') + '</div>') +
        (+tr.accounts_without_guest ? '<div class="ow-card-s">' + et('Сразу с аккаунтом, без гостевой истории: {{0}}', num(tr.accounts_without_guest)) + '</div>' : '') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Люди и их путь: {{0}}', num(data.people_total)) + how('usagePeople') + '</div>' +
        table([
          { title: 'Человек', key: 'who', html: function (r) {
            return esc(flagName(r.country)) + (r.region ? '<div class="ow-card-s">' + esc(r.region) + '</div>' : '') +
              '<div class="ow-card-s">' + esc([label(PLATFORM_RU, r.platform), r.device, r.locale].filter(Boolean).join(' · ')) + ' · #' + esc(r.who) + '</div>';
          } },
          { title: 'Путь', key: 'lotteries', html: journeyChips },
          { title: 'Сейчас', key: 'status_now', html: function (r) {
            return humanChip(r.human) + ' ' + journeyStatus(r.status_now) + ((r.statuses || []).length > 1 ? '<div class="ow-card-s">' + esc((r.statuses || []).map(function (k) { return label(LIB.STATUS_RU, k); }).join(' → ')) + '</div>' : '');
          } },
          { title: 'Действия', key: 'actions', numeric: true },
          { title: 'Сессии', key: 'sessions', numeric: true },
          { title: 'Активно', key: 'engaged_ms', numeric: true, html: function (r) { return +r.engaged_ms >= 1000 ? esc(dur(r.engaged_ms)) : '—'; } },
          { title: 'Источник', key: 'channel', html: function (r) { return esc(r.channel ? label(LIB.CHANNEL_RU, r.channel) : '—'); } },
          { title: 'Последняя активность', key: 'last_at', html: function (r) { return esc(timeText(r.last_at)); } }
        ], data.people, 'Никого за период') + '</div>' +
      '<div class="ow-card-s" style="margin-top:6px">' + esc(tx(data.note || '')) + '</div>';
  }

  // ── activity: the connected trail (migration 202610180067) ─────────────────────────────────
  // One section answers «who did what, when, what happened next»: the consented client events and
  // the server's own operations merged per visitor (owner_activity). Four views share one filter
  // set; switching a view or a chart type never drops a filter.
  var ACT_VIEWS = [['overview', 'Обзор'], ['timeline', 'Хронология'], ['ai', 'AI и движки'], ['errors', 'Ошибки']];
  var ACT_ACTORS = [['all', 'Все'], ['user', 'Пользователи'], ['guest', 'Гости'], ['admin', 'Владелец'], ['agent', 'AI-агенты и боты'], ['system', 'Система']];
  var ACT_SOURCES = [['all', 'Все'], ['client', 'Приложение'], ['server', 'Сервер']];
  var ACT_STATUSES = [['all', 'Все'], ['ok', 'Успешно'], ['fail', 'С ошибкой или отказом']];
  var ACT_KINDS = [['all', 'Все'], ['generation', 'Генерация'], ['simulation', 'Симуляция'], ['draw3d', '3D-тираж'], ['court', 'Суд'],
    ['analysis', 'Анализ'], ['calendar', 'Календарь'], ['combinations', 'Комбинации'], ['pro_models', 'PRO-модели'], ['pro_interest', 'Интерес к PRO'],
    ['ticket_check', 'Проверка билета'], ['share', 'Поделиться'], ['view', 'Просмотры'], ['account', 'Аккаунт'], ['commerce', 'Оплата'], ['error', 'Ошибки']];
  var ACT_ACTOR_RU = { user: 'Пользователь', guest: 'Гость', admin: 'Владелец', agent: 'AI-агент / бот', system: 'Система' };
  var ACT_STATUS_RU = { ok: 'успешно', error: 'ошибка', denied: 'отказ в доступе', limited: 'лимит запросов', invalid: 'неверный запрос', conflict: 'уже выполняется' };
  var ACT_SRC_RU = { client: 'Приложение', server: 'Сервер', ledger: 'Журнал прогнозов', store: 'Магазин' };
  var ACT_CATEGORY_ICON = { action: '⚡', view: '👁', session: '◦', error: '⚠', account: '👤', commerce: '💳', settings: '⚙', operation: '🖥' };
  // Server operations in words: what the backend did for the person.
  var ACT_OP_RU = {
    'pro-compute:generate': 'Сервер сгенерировал ряды PRO-моделью', 'pro-compute:wheel': 'Сервер построил колесо (систему рядов)',
    'pro-compute:judge': 'Верховный судья проверил ряды', 'pro-compute:jury_review': 'Присяжные рассмотрели комбинацию',
    'pro-compute:jury_generate': 'Присяжные сформировали комбинации', 'pro-compute:defense': 'Защитник разобрал комбинацию',
    'pro-compute:court_judge': 'Судья вынес решение', 'pro-compute:model_review': 'Разбор моделей',
    'pro-analysis:analysis': 'PRO-анализ архива тиражей', 'free-analysis:analysis': 'Бесплатный анализ архива',
    'free-counsel:defense': 'Бесплатный защитник разобрал комбинацию', 'archive:calendar': 'Календарный анализ: чтение архива',
    'archive:archive': 'Чтение архива тиражей', 'consume-feature:unlock': 'Списание доступа к PRO-функции',
    'prediction-ledger:record': 'Прогнозы записаны в журнал', 'prediction-ledger:decide': 'Решение по спорному числу',
    'prediction-ledger:decide_rows': 'Решение по рядам'
  };
  var ACT_CHART_RU = { line: 'Линии', bar: 'Столбцы', area: 'Области', donut: 'Кольцо' };
  var ACT_SEEN_KEY = 'ow_activity_seen';
  var DOW_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  HOW.activity = 'Хронология всего, что произошло: действия посетителей в приложении (события с согласием на аналитику) и операции, которые сервер выполнил для них (генерация, суд, анализ, календарь, журнал прогнозов). Одна строка — одно событие; события одного человека связаны его псевдонимом, сессией, номером запроса и номером сущности (например, номер 3D-тиража связывает тираж и сохранённую из него комбинацию). Владелец здесь показан и помечен, потому что это консоль наблюдения, а не статистика; переключатель «Показывать владельца» его скрывает, и тогда видно, сколько строк скрыто.';
  HOW.activityAi = 'Внешние AI-провайдеры (Grok, OpenAI, Anthropic и другие) приложением не вызываются: ни один серверный код не отправляет им запросов. «AI» в продукте — собственные серверные движки Lotto Simulator: PRO-модели генерации, присяжные, защитники, судья, анализ и календарь. Они считают на архиве официальных тиражей (таблица lottery_draws, окно текущих правил) и записывают прогнозы в журнал (prediction_ledger). Внешний AI-агент, управляющий браузером, для приложения — обычный посетитель: его визиты и серверные запросы видны как «AI-агент / бот». Доступа к компьютеру пользователя у приложения нет.';
  HOW.activityLineage = 'Путь данных одной операции: действие в приложении → событие клиента с номером запроса → запрос к серверной функции (тот же номер, сессия посетителя — только при согласии) → чтение данных (источники ниже) → расчёт движка → запись результата (журнал прогнозов или журнал списаний) → ответ приложению. Совпадающий номер запроса связывает эти шаги в одну цепочку.';
  HOW.activityErrors = 'Ошибки приложения у посетителей (события с согласием), отказы и сбои серверных операций (с кодом ответа) и отклонённые пакеты приёма аналитики. «Отказ в доступе» и «лимит запросов» — штатные отказы, «ошибка» — сбой на нашей стороне.';
  HOW.activityHeat = 'Количество действий, просмотров и серверных операций по дням недели и часам (часовой пояс отчёта). Чем темнее клетка, тем больше событий.';

  function actState() {
    if (!state.act) state.act = { view: 'overview', actor: 'all', source: 'all', status: 'all', kind: 'all', q: '', owner: true, charts: { series: 'line', kinds: 'bar', ops: 'bar' }, prevSeen: null };
    return state.act;
  }
  // The section's own parameters on top of the panel's (period, time zone, lottery, platform).
  function actExtra(extra) {
    var a = actState();
    var mode = a.view === 'ai' ? 'operations' : a.view === 'errors' ? 'errors' : 'feed';
    return Object.assign({ mode: mode, actor: a.actor, source: a.source, status: a.status, kind: a.kind, q: a.q,
      include_owner: a.owner, include_bots: true, limit: a.view === 'timeline' ? 100 : 50 }, extra || {});
  }
  function actParams(extra) { return params(actExtra(extra)); }
  // Seen marker: what arrived since the owner last looked at this section is highlighted («новое»).
  function actSeen() {
    var a = actState();
    if (a.prevSeen == null) { try { a.prevSeen = W.localStorage.getItem(ACT_SEEN_KEY) || ''; } catch (e) { a.prevSeen = ''; } }
    return a.prevSeen;
  }
  function actMarkSeen(lastAt) { if (!lastAt) return; try { W.localStorage.setItem(ACT_SEEN_KEY, String(lastAt)); } catch (e) {} }
  function actIsNew(at) { var seen = actSeen(); return !!(seen && at && String(at) > seen); }
  function actorChip(actor, owner) {
    return '<span class="ow-act-actor ow-act-actor-' + esc(actor || 'system') + '">' + esc(label(ACT_ACTOR_RU, actor)) + '</span>' +
      (owner && actor !== 'admin' ? ' <span class="ow-act-actor ow-act-actor-admin">' + et('владелец') + '</span>' : '');
  }
  function actStatusChip(status) {
    return '<span class="ow-act-st ow-act-st-' + (status === 'ok' ? 'ok' : status === 'error' ? 'err' : 'warn') + '">' + esc(label(ACT_STATUS_RU, status)) + '</span>';
  }
  function actMs(ms) {
    if (ms == null || ms === '') return '';
    var n = +ms;
    if (!isFinite(n)) return '';
    return n < 1000 ? t('{{0}} мс', Math.round(n)) : n < 60000 ? t('{{0}} с', (n / 1000).toLocaleString(intl(), { maximumFractionDigits: 1 })) : dur(n);
  }
  // The title of a row in words: a client event by its label, a server operation by what it did.
  function actTitle(r) {
    if (r.src === 'server') return ACT_OP_RU[r.type] ? t(ACT_OP_RU[r.type]) : r.type;
    if (r.src === 'ledger') return t('Прогнозы зафиксированы в журнале: {{0}}', num(r.x && r.x.count));
    if (r.src === 'store') return label(LIB.EVENT_RU, r.type) !== r.type ? label(LIB.EVENT_RU, r.type) : t('Событие магазина: {{0}}', r.type);
    return label(LIB.EVENT_RU, r.type);
  }
  function actSubline(r) {
    var parts = [];
    if (r.lottery) parts.push(esc(lotName(r.lottery)));
    if (r.model) parts.push(esc(t('модель {{0}}', r.model)));
    var props = (r.x && r.x.props) || {};
    if (props.context && r.src === 'client') parts.push(esc(detailName(props.context)));
    if (props.rows) parts.push(esc(t('{{0}} ряд.', num(props.rows))));
    if (r.ms != null && r.type !== 'user_engagement') parts.push('⏱ ' + esc(actMs(r.ms)));
    if (r.type === 'user_engagement' && r.ms) parts.push(esc(t('активно {{0}}', actMs(r.ms))));
    if (r.status && r.status !== 'ok') parts.push(actStatusChip(r.status));
    if (r.x && r.x.error) parts.push('<code>' + esc(r.x.error) + '</code>');
    if (r.etype && r.eid) parts.push('<span class="ow-act-link" title="' + esc(r.eid) + '">🔗 ' + esc(actEntityName(r.etype)) + ' ' + esc(actShort(r.eid)) + '</span>');
    else if (r.op) parts.push('<span class="ow-act-link" title="' + esc(r.op) + '">🔗 ' + et('запрос') + ' ' + esc(actShort(r.op)) + '</span>');
    return parts.join(' · ');
  }
  // «compute:markov:9f3c…» / «r-9f3c…» → «9f3c…»: the part of an id a person can compare by eye.
  function actShort(id) { return String(id || '').split(':').pop().replace(/^r-/, '').slice(0, 8); }
  function actFullTime(value) {
    try { return new Date(value).toLocaleString(intl(), { timeZone: state.tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return String(value); }
  }
  function actEntityName(type) {
    return ({ draw3d: t('3D-тираж'), combination: t('комбинация'), prediction: t('прогнозы'), operation: t('операция'), usage: t('списание') })[type] || type;
  }
  // Progressive disclosure: the row → plain facts → technical ids → raw metadata.
  function actDetails(r) {
    var x = r.x || {};
    var facts = [
      [t('Время'), esc(actFullTime(r.at))],
      [t('Кто'), actorChip(r.actor, r.owner) + (r.who ? ' <code>' + esc(r.who) + '</code>' : '')],
      [t('Источник'), esc(label(ACT_SRC_RU, r.src))],
      r.ms != null ? [t('Длительность'), esc(actMs(r.ms))] : null,
      r.status ? [t('Итог'), actStatusChip(r.status)] : null,
      r.etype ? [t('Связанная сущность'), esc(actEntityName(r.etype)) + (r.eid ? ' <code>' + esc(r.eid) + '</code>' : '')] : null,
      r.page ? [t('Экран'), esc(r.page)] : null
    ].filter(Boolean);
    var tech = [];
    if (r.src === 'server') {
      tech.push([t('Функция'), '<code>' + esc(x.function) + '</code> · <code>' + esc(x.operation) + '</code>']);
      tech.push([t('Движок и модель'), esc((x.engine || '—') + (x.model ? ' · ' + x.model : ''))]);
      if (x.sources && x.sources.length) tech.push([t('Данные (откуда)'), x.sources.map(function (s) { return '<code>' + esc(s) + '</code>'; }).join('<br>')]);
      if (x.input && Object.keys(x.input).length) tech.push([t('Вход (без содержимого)'), actKv(x.input)]);
      if (x.output && Object.keys(x.output).length) tech.push([t('Результат'), actKv(x.output)]);
      if (x.http) tech.push([t('Ответ'), 'HTTP ' + esc(x.http) + (x.error ? ' · <code>' + esc(x.error) + '</code>' : '')]);
      if (x.automation && x.automation !== 'human') tech.push([t('Автоматизация'), esc(x.automation + (x.agent ? ' · ' + x.agent : ''))]);
    } else if (r.src === 'ledger') {
      tech.push([t('Таблица'), '<code>prediction_ledger</code>']);
      tech.push([t('Источник прогноза'), esc((x.source_kind || '') + ' · ' + (x.source_id || '') + ' · ' + (x.operation || ''))]);
      tech.push([t('Проверено тиражом'), esc(num(x.evaluated)) + (x.best_hits != null ? ' · ' + esc(t('лучшее совпадение {{0}}', x.best_hits)) : '')]);
    } else if (r.src === 'client') {
      if (x.access) tech.push([t('Доступ'), esc(String(x.access).toUpperCase())]);
      if (x.received_at) tech.push([t('Получено сервером'), esc(clockText(x.received_at))]);
      if (x.app_version) tech.push([t('Версия'), '<code>' + esc(x.app_version) + '</code>']);
      if (x.browser || x.os) tech.push([t('Браузер'), esc([x.browser, x.os].filter(Boolean).join(' · '))]);
    }
    var ids = [['event', r.id], ['session', r.session], ['request', r.op], ['entity', r.eid], ['person', r.person]]
      .filter(function (p) { return p[1]; }).map(function (p) { return '<div><span>' + esc(p[0]) + '</span> <code>' + esc(p[1]) + '</code></div>'; }).join('');
    return '<div class="ow-act-facts">' + facts.map(actFact).join('') + '</div>' +
      (tech.length ? '<details class="ow-act-tech"><summary>' + et('Технические детали') + '</summary><div class="ow-act-facts">' + tech.map(actFact).join('') + '</div>' +
        '<details class="ow-act-raw"><summary>' + et('Идентификаторы и исходные данные') + '</summary><div class="ow-act-ids">' + ids + '</div>' +
        '<pre>' + esc(JSON.stringify(x, null, 1)) + '</pre></details></details>'
        : '<details class="ow-act-raw"><summary>' + et('Идентификаторы и исходные данные') + '</summary><div class="ow-act-ids">' + ids + '</div><pre>' + esc(JSON.stringify(x, null, 1)) + '</pre></details>');
  }
  function actFact(pair) { return '<div class="ow-act-fact"><span>' + esc(pair[0]) + '</span><b>' + pair[1] + '</b></div>'; }
  function actKv(map) { return Object.keys(map).map(function (k) { return '<code>' + esc(k) + '</code> ' + esc(Array.isArray(map[k]) ? map[k].join(', ') : map[k]); }).join('<br>'); }
  function actRow(r, withWho) {
    var cat = r.src === 'server' || r.src === 'ledger' ? 'operation' : (r.category || 'view');
    return '<details class="ow-act-ev ow-act-' + esc(cat) + (r.status && r.status !== 'ok' ? ' ow-act-fail' : '') + (actIsNew(r.at) ? ' ow-new' : '') + '">' +
      '<summary><span class="ow-act-t">' + esc(clockText(r.at)) + '</span>' +
      '<span class="ow-act-i" aria-hidden="true">' + (ACT_CATEGORY_ICON[cat] || '·') + '</span>' +
      '<span class="ow-act-m"><span class="ow-act-h">' + esc(actTitle(r)) + (actIsNew(r.at) ? ' <span class="ow-new-tag">' + et('новое') + '</span>' : '') + '</span>' +
        '<span class="ow-act-s">' + (withWho ? actorChip(r.actor, r.owner) + (r.who ? ' <code>' + esc(r.who) + '</code>' : '') + (actSubline(r) ? ' · ' : '') : '') + actSubline(r) + '</span></span>' +
      '<span class="ow-act-src">' + esc(label(ACT_SRC_RU, r.src)) + '</span></summary>' +
      '<div class="ow-act-d">' + actDetails(r) + '</div></details>';
  }
  function actSelect(id, title, list, current) {
    return '<label><span>' + et(title) + '</span> <select id="' + id + '">' + options(list, current) + '</select></label>';
  }
  function actFilters() {
    var a = actState();
    return '<div class="ow-act-views" role="tablist">' + ACT_VIEWS.map(function (v) {
      return '<button type="button" class="ow-chip" role="tab" data-act-view="' + v[0] + '" aria-pressed="' + (a.view === v[0]) + '" aria-selected="' + (a.view === v[0]) + '">' + et(v[1]) + '</button>';
    }).join('') + '</div>' +
      '<div class="ow-u-filters ow-act-filters">' +
        actSelect('ow-a-actor', 'Кто', ACT_ACTORS, a.actor) +
        actSelect('ow-a-source', 'Источник', ACT_SOURCES, a.source) +
        actSelect('ow-a-status', 'Итог', ACT_STATUSES, a.status) +
        actSelect('ow-a-kind', 'Что', ACT_KINDS, a.kind) +
        '<form class="ow-act-search" id="ow-a-search"><input type="search" id="ow-a-q" maxlength="160" value="' + esc(a.q) + '" placeholder="' + esc(t('Поиск: псевдоним, номер запроса или тиража')) + '" aria-label="' + esc(t('Поиск')) + '"><button class="ow-btn" type="submit">' + et('Найти') + '</button></form>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-a-owner"' + (a.owner ? ' checked' : '') + '> <span>' + et('Показывать владельца') + '</span></label>' +
        '<button class="ow-btn" type="button" id="ow-a-reset">' + et('Сбросить') + '</button>' +
      '</div>';
  }
  function chartSwitch(key, kinds) {
    var a = actState();
    return '<span class="ow-act-cs" role="group" aria-label="' + esc(t('Вид графика')) + '">' + kinds.map(function (k) {
      return '<button type="button" class="ow-chip" data-act-chart="' + key + ':' + k + '" aria-pressed="' + (a.charts[key] === k) + '">' + et(ACT_CHART_RU[k]) + '</button>';
    }).join('') + '</span>';
  }
  function actBucketLabel(value, bucket) {
    var s = String(value || '');
    return bucket === 'hour' ? s.slice(8, 10) + ' ' + s.slice(11, 16) : s.slice(5, 10);
  }
  // One time-series chart in three forms (lines / bars / areas) over the same points.
  function actSeriesChart(points, keys, titles, kind, bucket) {
    if (!points || !points.length) return '<div class="ow-empty">' + et('Нет данных за период') + '</div>';
    var width = 720, height = 200, padLeft = 42, padBottom = 26, padTop = 12, colors = chartColors().concat(['#e11d48']);
    var max = 1;
    points.forEach(function (p) { keys.forEach(function (k) { max = Math.max(max, +p[k] || 0); }); });
    var plotW = width - padLeft - 10, plotH = height - padTop - padBottom;
    var n = points.length, slot = plotW / Math.max(1, n), stepX = n > 1 ? plotW / (n - 1) : 0;
    var y = function (v) { return padTop + plotH * (1 - (+v || 0) / max); };
    var marks = '';
    if (kind === 'bar') {
      var bw = Math.max(1.5, (slot * 0.8) / keys.length);
      points.forEach(function (p, i) {
        keys.forEach(function (k, j) {
          var x = padLeft + i * slot + slot * 0.1 + j * bw, top = y(p[k]);
          marks += '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, padTop + plotH - top).toFixed(1) + '" fill="' + colors[j % colors.length] + '" rx="1.5"><title>' + esc(t(titles[j])) + ': ' + num(p[k]) + '</title></rect>';
        });
      });
    } else {
      keys.forEach(function (k, j) {
        var pts = points.map(function (p, i) { return [n > 1 ? padLeft + i * stepX : padLeft + plotW / 2, y(p[k])]; });
        var d = pts.map(function (pt, i) { return (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
        if (kind === 'area') marks += '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padTop + plotH) + ' L' + pts[0][0].toFixed(1) + ' ' + (padTop + plotH) + ' Z" fill="' + colors[j % colors.length] + '" fill-opacity=".18"/>';
        marks += '<path d="' + d + '" fill="none" stroke="' + colors[j % colors.length] + '" stroke-width="2.2" stroke-linejoin="round"/>';
        if (n === 1) marks += '<circle cx="' + pts[0][0] + '" cy="' + pts[0][1] + '" r="3.5" fill="' + colors[j % colors.length] + '"/>';
      });
    }
    var ticks = [0, 0.5, 1].map(function (f) {
      var yy = padTop + plotH * (1 - f);
      return '<line x1="' + padLeft + '" y1="' + yy + '" x2="' + (width - 10) + '" y2="' + yy + '" class="ow-grid"/><text x="6" y="' + (yy + 4) + '" class="ow-axis">' + num(Math.round(max * f)) + '</text>';
    }).join('');
    var every = Math.max(1, Math.ceil(n / 8));
    var labels = points.map(function (p, i) {
      if (i % every && i !== n - 1) return '';
      var x = kind === 'bar' ? padLeft + i * slot + slot / 2 : (n > 1 ? padLeft + i * stepX : padLeft + plotW / 2);
      var anchor = n > 1 && i === 0 && kind !== 'bar' ? 'start' : n > 1 && i === n - 1 && kind !== 'bar' ? 'end' : 'middle';
      return '<text x="' + x.toFixed(1) + '" y="' + (height - 8) + '" class="ow-axis" text-anchor="' + anchor + '">' + esc(actBucketLabel(p.t, bucket)) + '</text>';
    }).join('');
    var legend = keys.map(function (k, j) { return '<span><i style="background:' + colors[j % colors.length] + '"></i>' + et(titles[j]) + '</span>'; }).join('');
    return '<div class="ow-chart"><svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="' + esc(t('График')) + '">' + ticks + marks + labels + '</svg><div class="ow-legend">' + legend + '</div></div>';
  }
  // Shares of a whole: a donut, or the same numbers as bars.
  function actShareChart(rows, keyName, valueName, nameOf, kind) {
    if (!rows || !rows.length) return '<div class="ow-empty">' + et('Нет данных за период') + '</div>';
    var total = rows.reduce(function (s, r) { return s + (+r[valueName] || 0); }, 0) || 1;
    var palette = ['#1d4ed8', '#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777', '#4b5563', '#65a30d', '#0ea5e9', '#9333ea'];
    if (ovEl && ovEl.getAttribute('data-ow-theme') === 'dark') palette = ['#6fb7ff', '#5eead4', '#c4b5fd', '#6ee7b7', '#fcd34d', '#f9a8d4', '#cbd5e1', '#bef264', '#7dd3fc', '#d8b4fe'];
    if (kind === 'donut') {
      var r = 54, c = 2 * Math.PI * r, offset = 0;
      var arcs = rows.slice(0, 10).map(function (row, i) {
        var part = (+row[valueName] || 0) / total, len = part * c;
        var arc = '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + palette[i % palette.length] + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 70 70)"><title>' + esc(nameOf(row[keyName])) + ': ' + num(row[valueName]) + '</title></circle>';
        offset += len;
        return arc;
      }).join('');
      return '<div class="ow-act-donut"><svg viewBox="0 0 140 140" role="img" aria-label="' + esc(t('Доли')) + '">' + arcs + '<text x="70" y="76" text-anchor="middle" class="ow-act-donut-n">' + num(total) + '</text></svg>' +
        '<div class="ow-act-legend">' + rows.slice(0, 10).map(function (row, i) {
          return '<div><i style="background:' + palette[i % palette.length] + '"></i>' + esc(nameOf(row[keyName])) + ' <b>' + num(row[valueName]) + '</b> <span>' + pctText(+row[valueName] || 0, total) + '</span></div>';
        }).join('') + '</div></div>';
    }
    var entries = {}, names = {};
    rows.forEach(function (row) { entries[row[keyName]] = +row[valueName] || 0; names[row[keyName]] = nameOf(row[keyName]); });
    var max = rows.reduce(function (m, row) { return Math.max(m, +row[valueName] || 0); }, 0);
    return rows.map(function (row) {
      return '<div class="ow-bar"><span class="ow-bar-l">' + esc(names[row[keyName]]) + '</span><span class="ow-bar-t"><i style="width:' + (max ? Math.max(2, Math.round(((+row[valueName] || 0) / max) * 100)) : 0) + '%"></i></span><span class="ow-bar-v">' + num(row[valueName]) + '</span></div>';
    }).join('');
  }
  function actHeat(cells) {
    if (!cells || !cells.length) return '<div class="ow-empty">' + et('Нет данных за период') + '</div>';
    var grid = {}, max = 0;
    cells.forEach(function (c) { grid[c.dow + ':' + c.hour] = +c.n || 0; max = Math.max(max, +c.n || 0); });
    var head = '<div class="ow-act-hh"></div>' + Array.from({ length: 24 }, function (_, h) { return '<div class="ow-act-hh">' + (h % 3 ? '' : h) + '</div>'; }).join('');
    var body = [1, 2, 3, 4, 5, 6, 7].map(function (dow) {
      return '<div class="ow-act-hd">' + et(DOW_RU[dow - 1]) + '</div>' + Array.from({ length: 24 }, function (_, h) {
        var n = grid[dow + ':' + h] || 0;
        return '<div class="ow-act-hc" style="--a:' + (max ? (0.08 + 0.92 * n / max).toFixed(2) : 0) + '" title="' + esc(t(DOW_RU[dow - 1]) + ' ' + h + ':00 — ' + num(n)) + '"></div>';
      }).join('');
    }).join('');
    return '<div class="ow-act-heat">' + head + body + '</div>';
  }
  function actKindName(k) { return k === 'view' ? t('Просмотры') : featName(k); }
  function renderActivityOverview(d) {
    var s = d.summary || {};
    var a = actState();
    var hidden = d.hidden_owner ? '<div class="ow-act-note">' + et('Скрыто строк владельца: {{0}}. Включите «Показывать владельца», чтобы увидеть их.', num(d.hidden_owner)) + '</div>' : '';
    return hidden +
      '<div class="ow-cards">' +
        card('Посетители', num(s.visitors), et('активны сейчас: {{0}}', num(s.active_now)), 'activity') +
        card('Сессии', num(s.sessions)) +
        card('Действия', num(s.actions), et('просмотров: {{0}}', num(s.views))) +
        card('3D-тиражи', num(s.draws), et('сохранено комбинаций: {{0}}', num(s.saves))) +
        card('Генерации', num(s.generations)) +
        card('Операции сервера', num(s.operations), et('с ошибкой или отказом: {{0}}', num(s.operations_failed)), 'activityAi') +
        card('Время операции', s.avg_op_ms != null ? esc(actMs(s.avg_op_ms)) : none(), s.p95_op_ms != null ? et('95% быстрее {{0}}', actMs(s.p95_op_ms)) : '') +
        card('Ошибки в приложении', num(s.client_errors), '', 'activityErrors') +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Как менялась активность') + ' ' + chartSwitch('series', ['line', 'bar', 'area']) + '</div>' +
        actSeriesChart(d.series, ['actions', 'operations', 'errors', 'visitors'], ['Действия', 'Операции сервера', 'Ошибки', 'Посетители'], a.charts.series, d.bucket) + '</div>' +
      '<div class="ow-act-grid">' +
        '<div class="ow-block"><div class="ow-block-h">' + et('Что делали') + ' ' + chartSwitch('kinds', ['bar', 'donut']) + '</div>' +
          actShareChart(d.kinds, 'kind', 'n', actKindName, a.charts.kinds) + '</div>' +
        '<div class="ow-block"><div class="ow-block-h">' + et('Лотереи') + '</div>' + actShareChart(d.lotteries, 'lottery', 'n', lotName, 'bar') + '</div>' +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Когда активны') + how('activityHeat') + '</div>' + actHeat(d.heat) + '</div>' +
      '<div class="ow-block"><div class="ow-block-h"><span class="ow-live-dot" aria-hidden="true"></span>' + et('Последние события') + '</div>' +
        ((d.recent || []).length ? (d.recent || []).slice(0, 25).map(function (r) { return actRow(r, true); }).join('') : '<div class="ow-empty">' + et('Нет событий') + '</div>') + '</div>';
  }
  function renderActivityTimeline(d) {
    var a = actState();
    var hidden = d.hidden_owner ? '<div class="ow-act-note">' + et('Скрыто строк владельца: {{0}}. Включите «Показывать владельца», чтобы увидеть их.', num(d.hidden_owner)) + '</div>' : '';
    var rows = (d.visitors || []).map(function (v) { return Object.assign({ __click: true, __class: actIsNew(v.last_at) ? 'ow-new' : '' }, v); });
    return hidden + '<div class="ow-block"><div class="ow-block-h">' + et('Посетители') + ' · ' + num(d.visitors_total) + how('activity') + '</div>' +
      '<div class="ow-card-s">' + et('Нажмите на посетителя, чтобы открыть его полную хронологию.') + '</div>' +
      table([
        { title: 'Кто', key: 'who', html: function (v) { return actorChip(v.actor, v.owner) + ' <code>' + esc(v.who) + '</code>' + (actIsNew(v.last_at) ? ' <span class="ow-new-tag">' + et('новое') + '</span>' : ''); } },
        { title: 'Последнее', key: 'last_at', html: function (v) { return esc(timeText(v.last_at)) + '<br><span class="ow-card-s">' + esc(label(LIB.EVENT_RU, v.last_type)) + (v.lottery ? ' · ' + esc(lotName(v.lottery)) : '') + '</span>'; } },
        { title: 'Место', key: 'country', html: function (v) { return esc([v.country ? flagName(v.country) : '', v.platform, v.device].filter(Boolean).join(' · ') || '—'); } },
        { title: 'Сессии', key: 'sessions', numeric: true },
        { title: 'Действия', key: 'actions', numeric: true },
        { title: '3D', key: 'draws', numeric: true },
        { title: 'Генерации', key: 'generations', numeric: true },
        { title: 'Сервер', key: 'operations', numeric: true },
        { title: 'Ошибки', key: 'errors', numeric: true, html: function (v) { return v.errors ? '<b class="ow-act-errn">' + num(v.errors) + '</b>' : '0'; } }
      ], rows, 'Нет посетителей за период') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Все события подряд') + '</div>' +
        ((d.recent || []).length ? (d.recent || []).map(function (r) { return actRow(r, true); }).join('') : '<div class="ow-empty">' + et('Нет событий') + '</div>') + '</div>';
  }
  function renderActivityAi(d) {
    var s = d.summary || {};
    var a = actState();
    var ag = d.agents || {};
    var opRows = (d.by_operation || []).map(function (o) { return { name: ACT_OP_RU[o.operation] ? t(ACT_OP_RU[o.operation]) : o.operation, n: o.n, avg: o.avg_ms || 0, p95: o.p95_ms || 0, failed: o.failed, people: o.people, last_at: o.last_at, operation: o.operation }; });
    return '<div class="ow-act-note ow-act-arch">' + et('Как это устроено') + how('activityAi') + '<br>' +
        '<span class="ow-act-chain">' + [t('Действие в приложении'), t('Событие клиента'), t('Серверная функция'), t('Архив тиражей'), t('Движок Lotto Simulator'), t('Журнал прогнозов'), t('Ответ на экране')].map(esc).join(' <b>→</b> ') + '</span>' + how('activityLineage') + '</div>' +
      '<div class="ow-cards">' +
        card('Операции сервера', num(s.operations), et('посетителей: {{0}}', num(s.people))) +
        card('С ошибкой или отказом', num(s.failed)) +
        card('Медиана времени', s.p50_ms != null ? esc(actMs(s.p50_ms)) : none(), s.p95_ms != null ? et('95% быстрее {{0}}', actMs(s.p95_ms)) : '') +
        card('Самая долгая', s.max_ms != null ? esc(actMs(s.max_ms)) : none()) +
        card('Запросы AI-агентов', num(ag.requests), et('серверных операций агентов: {{0}}', num(s.agents))) +
      '</div>' +
      '<div class="ow-act-grid">' +
        '<div class="ow-block"><div class="ow-block-h">' + et('Какие операции') + ' ' + chartSwitch('ops', ['bar', 'donut']) + '</div>' + actShareChart(opRows, 'name', 'n', function (x) { return x; }, a.charts.ops) + '</div>' +
        '<div class="ow-block"><div class="ow-block-h">' + et('Сколько времени занимают') + '</div>' +
          table([
            { title: 'Операция', key: 'name' },
            { title: 'Раз', key: 'n', numeric: true },
            { title: 'Среднее', key: 'avg', numeric: true, html: function (o) { return esc(actMs(o.avg)); } },
            { title: '95%', key: 'p95', numeric: true, html: function (o) { return esc(actMs(o.p95)); } },
            { title: 'Ошибки', key: 'failed', numeric: true }
          ], opRows, 'Нет операций за период') + '</div>' +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Операции во времени') + ' ' + chartSwitch('series', ['line', 'bar', 'area']) + '</div>' +
        actSeriesChart(d.series, ['n', 'failed'], ['Операции сервера', 'С ошибкой или отказом'], a.charts.series, d.bucket) + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Журнал операций') + ' · ' + num(d.total) + '</div>' +
        ((d.rows || []).length ? (d.rows || []).map(function (r) {
          var row = Object.assign({ src: 'server' }, r);
          var lineage = r.client ? '<div class="ow-act-lin">↳ ' + et('запрошено событием «{{0}}» в {{1}}', label(LIB.EVENT_RU, r.client.type), clockText(r.client.at)) + '</div>' : '';
          var ledger = r.ledger ? '<div class="ow-act-lin">↳ ' + et('записано прогнозов: {{0}}', num(r.ledger)) + '</div>' : '';
          return actRow(row, true).replace('<div class="ow-act-d">', '<div class="ow-act-d">' + lineage + ledger);
        }).join('') : '<div class="ow-empty">' + et('Нет операций за период') + '</div>') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('AI-агенты и автоматизация (счётчики по часам)') + '</div>' +
        table([
          { title: 'Оператор', key: 'operator' },
          { title: 'Класс', key: 'class', html: function (o) { return esc(o.class) + (o.verified ? ' ✓' : ''); } },
          { title: 'Запросы', key: 'requests', numeric: true },
          { title: 'Симуляции', key: 'simulations', numeric: true },
          { title: 'Аккаунты', key: 'accounts', numeric: true },
          { title: 'Последний', key: 'last_seen', html: function (o) { return esc(timeText(o.last_seen)); } }
        ], ag.operators || [], 'AI-агентов за период не было') +
        '<div class="ow-card-s">' + et('Браузер агента не отправляет событий приложения (автоматизация не даёт согласия на аналитику), поэтому его действия видны только как визиты и серверные операции.') + '</div></div>';
  }
  function renderActivityErrors(d) {
    var s = d.summary || {};
    return '<div class="ow-cards">' +
        card('Ошибки в приложении', num(s.client), '', 'activityErrors') +
        card('Отказы и сбои сервера', num(s.server), et('сбоев на нашей стороне: {{0}}', num(s.server_error))) +
        card('Отклонено при приёме', num(s.ingest_rejected)) +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Какие ошибки чаще всего') + '</div>' +
        table([
          { title: 'Где', key: 'src', html: function (r) { return esc(label(ACT_SRC_RU, r.src)); } },
          { title: 'Что', key: 'type', html: function (r) { return esc(r.src === 'server' ? (ACT_OP_RU[r.type] ? t(ACT_OP_RU[r.type]) : r.type) : label(LIB.EVENT_RU, r.type)); } },
          { title: 'Код', key: 'code', html: function (r) { return '<code>' + esc(r.code) + '</code> ' + actStatusChip(r.status); } },
          { title: 'Раз', key: 'n', numeric: true },
          { title: 'Людей', key: 'people', numeric: true },
          { title: 'Последний', key: 'last_at', html: function (r) { return esc(timeText(r.last_at)); } }
        ], d.by_code || [], 'Ошибок за период нет') + '</div>' +
      ((d.ingest || []).length ? '<div class="ow-block"><div class="ow-block-h">' + et('Приём аналитики: отклонённые пакеты') + '</div>' +
        table([{ title: 'Итог', key: 'outcome' }, { title: 'Причина', key: 'reason', html: function (r) { return '<code>' + esc(r.reason) + '</code>'; } }, { title: 'Событий', key: 'n', numeric: true },
          { title: 'Последний', key: 'last_at', html: function (r) { return esc(timeText(r.last_at)); } }], d.ingest) + '</div>' : '') +
      '<div class="ow-block"><div class="ow-block-h">' + et('Хронология ошибок') + '</div>' +
        ((d.rows || []).length ? d.rows.map(function (r) { return actRow(r, true); }).join('') : '<div class="ow-empty">' + et('Ошибок за период нет') + '</div>') + '</div>';
  }
  function renderActivity(data) {
    var a = actState();
    var body = data.mode === 'operations' ? renderActivityAi(data) : data.mode === 'errors' ? renderActivityErrors(data)
      : a.view === 'timeline' ? renderActivityTimeline(data) : renderActivityOverview(data);
    var lastAt = data.summary && data.summary.last_at || (data.rows && data.rows[0] && data.rows[0].at);
    if (lastAt) actMarkSeen(lastAt);
    return '<div class="ow-act">' + actFilters() + body + '</div>';
  }
  // Re-asks the server for the current view (filters kept), quietly while the owner is looking at
  // a period that is still running; anything newer than the last look is highlighted.
  async function reloadActivity(quiet) {
    if (quiet) {
      if (state.busy || state.section !== 'activity' || ovEl.querySelector('#ow-sheet')) return;
      try {
        var response = await api({ section: 'activity', params: actParams() });
        if (state.section !== 'activity') return;
        state.data.activity = response; state.error = null;
        // what the owner had unfolded stays unfolded across the quiet refresh
        var key = function (el) { var sum = el.querySelector('summary'); return sum ? sum.textContent : ''; };
        var open = Array.prototype.map.call(ovEl.querySelectorAll('#ow-section details[open]'), key);
        render();
        if (open.length) Array.prototype.forEach.call(ovEl.querySelectorAll('#ow-section details'), function (el) { if (open.indexOf(key(el)) >= 0) el.open = true; });
      } catch (e) { /* the next tick tries again */ }
      return;
    }
    state.data.activity = null;
    await load('activity', actExtra());
    render();
  }
  function startActivityPoll() {
    stopLive();
    var range = currentRange();
    if (new Date(range.to).getTime() < Date.now() - 60000) return;   // a closed period does not change
    livePoll = setInterval(function () { reloadActivity(true); }, 20000);
  }
  // The visitor card: who, how much, and the full chronological story, page after page.
  async function openVisitor(person) {
    setHourglass(true, function () { return t('Загрузка хронологии…'); });
    var rows = [], visitor = null, next = null, more = false;
    async function fetchPage(after) {
      var response = await api({ section: 'activity', params: actParams({ mode: 'timeline', person: person, limit: 300, after: after || '' }) });
      var d = response.data || {};
      rows = rows.concat(d.rows || []);
      rows.sort(function (x, y) { return String(x.at).localeCompare(String(y.at)); });
      if (d.visitor && !visitor) visitor = d.visitor;
      next = d.next_after; more = !!d.has_more;
    }
    try { await fetchPage(null); }
    catch (error) { setHourglass(false); openPopup('Ошибка', function () { return esc(error.message ? tx(error.message) : t('не удалось загрузить')); }); return; }
    setHourglass(false);
    var sheet = openSheet(function () { return visitorSheetHtml(visitor || {}, rows, more); }, function () { return t('Хронология посетителя'); });
    sheet.addEventListener('click', async function (event) {
      if (event.target === sheet || event.target.id === 'ow-sheet-close') { sheet.remove(); return; }
      if (event.target.id === 'ow-v-more' && more) {
        event.target.disabled = true;
        try { await fetchPage(next); } catch (e) { /* the button stays for another try */ }
        sheet.__render();
      }
    });
  }
  function visitorSheetHtml(v, rows, more) {
    var life = v.lifetime || {};
    var sessions = [], bySession = {};
    rows.forEach(function (r) {
      var key = r.session || (r.src === 'server' ? 'server' : r.src);
      if (!bySession[key]) { bySession[key] = []; sessions.push(key); }
      bySession[key].push(r);
    });
    return '<div class="ow-sheet-in ow-act">' +
      '<div class="ow-block-h">' + actorChip(v.actor, v.owner) + ' <code>' + esc(v.who) + '</code>' +
        (v.country ? ' · ' + esc(flagName(v.country)) : '') + (v.platform ? ' · ' + esc(v.platform) : '') + (v.device ? ' · ' + esc(v.device) : '') + (v.locale ? ' · ' + esc(v.locale) : '') + '</div>' +
      '<div class="ow-cards">' +
        card('Первый визит', esc(timeText(life.first_at || v.first_at)), et('в периоде: {{0}}', timeText(v.first_at))) +
        card('Последний визит', esc(timeText(life.last_at || v.last_at))) +
        card('Сессии', num(v.sessions), et('за всё время: {{0}}', num(life.sessions))) +
        card('Активное время', esc(dur(v.engaged_ms))) +
        card('События', num(v.events), et('действий: {{0}} · просмотров: {{1}}', num(v.actions), num(v.views))) +
        card('3D-тиражи', num(v.draws), et('сохранено: {{0}}', num(v.saves))) +
        card('Генерации', num(v.generations)) +
        card('Операции сервера', num(v.operations)) +
        card('Ошибки', num(v.errors)) +
        card('Лотереи', '<span class="ow-act-small">' + esc((v.lotteries || []).map(lotName).join(', ') || '—') + '</span>', et('экраны: {{0}}', (v.pages || []).join(', ') || '—')) +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">' + et('Хронология') + ' · ' + num(rows.length) + how('activity') + '</div>' +
        (rows.length ? sessions.map(function (key) {
          var list = bySession[key];
          var head = key === 'server' ? t('Серверные операции без сессии приложения') : key === 'ledger' ? t('Журнал прогнозов') : key === 'store' ? t('Магазин') : t('Сессия {{0}}', String(key).slice(0, 8));
          return '<div class="ow-act-session"><div class="ow-act-sh">' + esc(head) + ' · ' + esc(timeText(list[0].at)) + '</div>' + list.map(function (r) { return actRow(r, false); }).join('') + '</div>';
        }).join('') : '<div class="ow-empty">' + et('Нет событий') + '</div>') +
        (more ? '<button class="ow-btn" id="ow-v-more" type="button" style="margin-top:8px">' + et('Показать ещё') + '</button>' : '') +
      '</div>' +
      '<button class="ow-btn ow-btn-primary" id="ow-sheet-close" type="button" style="margin-top:10px">' + et('Закрыть') + '</button></div>';
  }
  function wireActivity() {
    var content = ovEl.querySelector('#ow-content');
    content.addEventListener('click', function (event) {
      if (state.section !== 'activity') return;
      var a = actState();
      var view = event.target.closest('[data-act-view]');
      if (view) { a.view = view.getAttribute('data-act-view'); reloadActivity(false); return; }
      var chart = event.target.closest('[data-act-chart]');
      if (chart) { var p = chart.getAttribute('data-act-chart').split(':'); a.charts[p[0]] = p[1]; render(); return; }
      if (event.target.closest('#ow-a-reset')) { Object.assign(a, { actor: 'all', source: 'all', status: 'all', kind: 'all', q: '', owner: true }); reloadActivity(false); return; }
      var row = event.target.closest('tr.ow-click');
      if (row) {
        var response = state.data.activity;
        var visitor = response && response.data && response.data.visitors && response.data.visitors[+row.getAttribute('data-row')];
        if (visitor) openVisitor(visitor.person);
      }
    });
    content.addEventListener('change', function (event) {
      if (state.section !== 'activity') return;
      var a = actState();
      var map = { 'ow-a-actor': 'actor', 'ow-a-source': 'source', 'ow-a-status': 'status', 'ow-a-kind': 'kind' };
      if (map[event.target.id]) { a[map[event.target.id]] = event.target.value; reloadActivity(false); }
      else if (event.target.id === 'ow-a-owner') { a.owner = event.target.checked; reloadActivity(false); }
    });
    content.addEventListener('submit', function (event) {
      if (event.target.id !== 'ow-a-search') return;
      event.preventDefault();
      actState().q = String(ovEl.querySelector('#ow-a-q').value || '').trim().slice(0, 160);
      reloadActivity(false);
    });
  }

  var RENDERERS = {
    activity: renderActivity, day: renderDay, journey: renderJourney, usage: renderUsage, overview: renderOverview, live: renderLive, people: renderPeople, households: renderHouseholds,
    devices: renderDevices, sessions: renderSessions, acquisition: renderAcquisition, geography: renderGeography,
    map: renderMap, games: renderGames, features: renderFeatures, funnels: renderFunnels,
    retention: renderRetention, bots: renderBots, agents: renderAgents, consent: renderConsent, quality: renderQuality
  };

  function render() {
    var host = ovEl.querySelector('#ow-section');
    var response = state.data[state.section];
    if (state.error) { host.innerHTML = ''; renderError(state.error, reload); return; }
    if (!response) { host.innerHTML = '<div class="ow-empty">' + et('Нет данных') + '</div>'; return; }
    var renderer = RENDERERS[state.section];
    host.innerHTML = renderer ? renderer(response.data || {}) : '<div class="ow-empty">' + et('Раздел недоступен') + '</div>';
    var range = response.range || {};
    var took = response.ms;
    var ms = function () { return took != null ? ' · ' + t('{{0}} мс', took) : ''; };
    if (!state.lastRefresh && state.preset === 'day') {
      var day = state.day, tz = range.tz || state.tz, country = state.filters.country;
      setStatus(function () {
        return et('День {{0}}', day) + ' · ' + esc(tz) + (country !== 'all' ? ' · ' + et('страна {{0}}', country) : '') + esc(ms());
      });
    } else if (!state.lastRefresh) {
      setStatus(function () {
        return et('Период {{0}} — {{1}}', String(range.from || '').slice(0, 16).replace('T', ' '), String(range.to || '').slice(0, 16).replace('T', ' ')) +
          ' · ' + esc(range.tz || '') + esc(ms());
      });
    }
  }

  // ── export ─────────────────────────────────────────────────────────────────────────────────
  function exportCurrent() {
    var response = state.data[state.section];
    if (!response) return;
    var data = response.data || {};
    var rows = Array.isArray(data.rows) ? data.rows : (Array.isArray(data.points) ? data.points : (Array.isArray(data.countries) ? data.countries : null));
    var name = 'loto-analytics-' + state.section + '-' + new Date().toISOString().slice(0, 10);
    var blob, filename;
    if (rows && rows.length && LIB.csv) {
      var columns = Object.keys(rows[0]).filter(function (key) { return key.indexOf('__') !== 0; }).map(function (key) { return { key: key, title: key }; });
      blob = new Blob(['﻿' + LIB.csv(columns, rows)], { type: 'text/csv;charset=utf-8' });
      filename = name + '.csv';
    } else {
      blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      filename = name + '.json';
    }
    var url = URL.createObjectURL(blob);
    var link = D.createElement('a');
    link.href = url;
    link.download = filename;
    D.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ── wiring ─────────────────────────────────────────────────────────────────────────────────
  function wire() {
    ovEl.querySelector('#ow-back').addEventListener('click', close);
    ovEl.querySelector('#ow-lang').addEventListener('click', function (event) {
      var b = event.target.closest('button[data-lang]');
      if (!b || !i18n()) return;
      // The same language again changes nothing visible, but the press is still the newest choice.
      if (!i18n().setLang(b.getAttribute('data-lang'))) relabel();
    });
    // ⓘ buttons live in the sections AND in the country / person sheets (appended to the panel, not
    // to #ow-content), so the one «Как считается» handler listens on the whole panel.
    ovEl.addEventListener('click', function (event) {
      var howButton = event.target.closest('[data-how]');
      if (!howButton || !ovEl.contains(howButton)) return;
      var key = howButton.getAttribute('data-how');
      openPopup('Как считается', function () { return esc(t(HOW[key] || '')); });
    });
    ovEl.querySelector('#ow-refresh').addEventListener('click', refresh);
    ovEl.querySelector('#ow-export').addEventListener('click', exportCurrent);
    ovEl.querySelector('#ow-filters').addEventListener('click', function () {
      var bar = ovEl.querySelector('#ow-controls');
      var open = !bar.classList.contains('open');
      bar.classList.toggle('open', open);
      this.setAttribute('aria-expanded', String(open));
    });
    ovEl.querySelector('#ow-theme').addEventListener('click', function () {
      var next = ovEl.getAttribute('data-ow-theme') === 'dark' ? 'light' : 'dark';
      ovEl.setAttribute('data-ow-theme', next);
      try { W.localStorage.setItem(THEME_KEY, next); } catch (e) {}
      // render() rebuilds the section markup, which replaces #ow-mapbox: the map must be re-mounted
      // into the new element (a theme swap on the orphaned map instance would leave an empty box).
      if (state.data[state.section]) render();
      if (state.section === 'map') mountMap(true);
    });
    ovEl.querySelector('#ow-tabs').addEventListener('click', function (event) {
      var tab = event.target.closest('[data-section]');
      if (!tab) return;
      state.page = 0;
      show(tab.getAttribute('data-section'));
    });
    ovEl.querySelector('#ow-preset').addEventListener('change', function (event) {
      state.preset = event.target.value;
      if (state.preset === 'day' && !state.day && LIB.todayYMD) state.day = LIB.todayYMD(state.tz);
      syncControls();
      if (state.preset !== 'custom' || (state.custom.from && state.custom.to)) { state.data = {}; state.page = 0; reload(); }
    });
    // Calendar: quick chips (today / yesterday / day before), one-day arrows, any date of any year.
    ovEl.querySelector('#ow-daybar').addEventListener('click', function (event) {
      var chip = event.target.closest('.ow-chip[data-day]');
      if (chip && LIB.todayYMD && LIB.shiftDay) { setDay(LIB.shiftDay(LIB.todayYMD(state.tz), +chip.getAttribute('data-day'))); return; }
      var nav = event.target.closest('#ow-day-prev, #ow-day-next');
      if (nav && LIB.shiftDay) setDay(LIB.shiftDay(state.day || LIB.todayYMD(state.tz), nav.id === 'ow-day-prev' ? -1 : 1));
    });
    ovEl.querySelector('#ow-day').addEventListener('change', function (event) { if (event.target.value) setDay(event.target.value); });
    ovEl.querySelector('#ow-from').addEventListener('change', function (event) {
      state.custom.from = event.target.value;
      if (state.custom.to) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-to').addEventListener('change', function (event) {
      state.custom.to = event.target.value;
      if (state.custom.from) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-tz').addEventListener('change', function (event) { state.tz = event.target.value; state.data = {}; syncControls(); reload(); });
    ovEl.querySelector('#ow-platform').addEventListener('change', function (event) { state.filters.platform = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-lottery').addEventListener('change', function (event) { state.filters.lottery = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-audience').addEventListener('change', function (event) { state.filters.audience = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-compare').addEventListener('change', function (event) { state.compare = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-owner').addEventListener('change', function (event) { state.toggles.owner = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-bots').addEventListener('change', function (event) { state.toggles.bots = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-unknown').addEventListener('change', function (event) { state.toggles.unknown = event.target.checked; state.data = {}; reload(); });

    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      var anchor = event.target.closest('.ow-anchors a[data-block]');
      if (anchor) { event.preventDefault(); state.block = anchor.getAttribute('data-block'); focusBlock(); return; }
      if (event.target.closest('[data-how]')) return;
      var pageButton = event.target.closest('[data-page]');
      if (pageButton) {
        state.page = Math.max(0, state.page + (pageButton.getAttribute('data-page') === 'next' ? 1 : -1));
        state.data[state.section] = null;
        show(state.section, { limit: 50, offset: state.page * 50, kind: state.peopleKind !== 'all' ? state.peopleKind : undefined });
        return;
      }
      if (event.target.closest('[data-kpi-retry]')) { state.data.kpi = null; show('overview'); return; }
      var row = event.target.closest('tr.ow-click');
      if (row && state.section === 'map') {
        var country = countryRows()[+row.getAttribute('data-row')];
        if (country) { openCountry(country.country); if (mapApi) mapApi.focus(country.country); }
        return;
      }
      if (row && state.section === 'people') {
        var response = state.data.people;
        var person = response && response.data && response.data.rows && response.data.rows[+row.getAttribute('data-row')];
        if (person) openPerson(person.person);
      }
    });
    wireActivity();
    ovEl.querySelector('#ow-content').addEventListener('change', function (event) {
      if (event.target.id === 'ow-kind') {
        state.peopleKind = event.target.value;
        state.page = 0;
        state.data.people = null;
        show('people', { kind: state.peopleKind !== 'all' ? state.peopleKind : undefined });
      }
      if (event.target.id === 'ow-mapmetric') {
        state.mapMetric = event.target.value;
        if (mapApi) mapApi.setMetric(state.mapMetric);
        var legend = ovEl.querySelector('.ow-legend-scale span:last-child');
        if (legend) legend.textContent = t('больше · {{0}}', metricLabel(state.mapMetric));
      }
      // «Лотереи и функции»: its own filters (the lottery and the country are the panel's shared ones)
      var usageFilter = { 'ow-u-lottery': 'lottery', 'ow-u-feature': 'feature', 'ow-u-country': 'country', 'ow-u-status': 'status' }[event.target.id];
      if (usageFilter) { setUsageFilters(usageFilter, event.target.value); return; }
      if (event.target.id === 'ow-continent') { state.continent = event.target.value; if (mapApi) mapApi.setContinent(state.continent); }
    });
    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      if (state.section !== 'usage') return;
      var metric = event.target.closest('[data-u-metric]');
      if (metric) { state.usageMetric = metric.getAttribute('data-u-metric'); render(); return; }
      if (event.target.closest('#ow-u-reset')) { setUsageFilters({ lottery: 'all', feature: 'all', country: 'all', status: 'all' }); return; }
      var drill = event.target.closest('[data-u-lottery], [data-u-feature], [data-u-country], [data-u-status]');
      if (!drill) return;
      var next = {};
      [['lottery', 'data-u-lottery'], ['feature', 'data-u-feature'], ['country', 'data-u-country'], ['status', 'data-u-status']].forEach(function (pair) {
        if (drill.hasAttribute(pair[1])) next[pair[0]] = drill.getAttribute(pair[1]);
      });
      setUsageFilters(next);
    });
    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      if (event.target.id === 'ow-fit' && mapApi) { state.continent = 'all'; var sel = ovEl.querySelector('#ow-continent'); if (sel) sel.value = 'all'; mapApi.setContinent('all'); }
    });
    // Without the shell's modal manager (it handles Escape first and calls __lotoClose above).
    D.addEventListener('keydown', function (event) {
      if (!ovEl || !ovEl.classList.contains('show') || event.key !== 'Escape' || event.defaultPrevented) return;
      if (!closeInnermost()) close();
    });
  }

  // One place changes the usage filters: the lottery and the country are shared with the rest of the
  // panel (the header select and the map), so every cached section is dropped, like the header does.
  function setUsageFilters(key, value) {
    var next = typeof key === 'object' ? key : {};
    if (typeof key === 'string') next[key] = value;
    Object.keys(next).forEach(function (k) { state.filters[k] = next[k] || 'all'; });
    var header = ovEl.querySelector('#ow-lottery');
    if (header) header.value = state.filters.lottery;
    if (next.country !== undefined) state.selectedCountry = state.filters.country === 'all' ? null : state.filters.country;
    state.data = {};
    reload();
  }

  function fillLotteries() {
    try {
      var select = ovEl.querySelector('#ow-lottery');
      var keys = Object.values(W.LOTO_APP_LOTTERY_KEYS || {});
      if (!keys.length || select.options.length > 1) return;
      var order = LIB.LOTTERY_ORDER || [];
      keys.sort(function (a, b) { return (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99); });
      select.innerHTML = '<option value="all">' + esc(t('Все')) + '</option>' + keys.map(function (key) {
        return '<option value="' + esc(key) + '"' + (key === state.filters.lottery ? ' selected' : '') + '>' + esc(LIB.lotteryName ? LIB.lotteryName(key) : key) + '</option>';
      }).join('');
    } catch (e) {}
  }

  // ── open / close ───────────────────────────────────────────────────────────────────────────
  var fromAccount = false;
  // The panel's ru/en/no catalog (owner-i18n.js) is fetched with the panel, never at startup; if it
  // cannot load, the panel simply stays Russian.
  var i18nPromise = null;
  function loadI18n() {
    if (W.LotoOwnerI18n) return Promise.resolve();
    if (!i18nPromise) {
      i18nPromise = (typeof W.LotoLoadRuntimeScript === 'function' ? W.LotoLoadRuntimeScript('owner-i18n.js') : Promise.reject(new Error('no_loader')))
        .catch(function () { i18nPromise = null; });
    }
    return i18nPromise;
  }
  function renderDenied() {
    ovEl.querySelector('#ow-section').innerHTML = '<div class="ow-deny"><h2>' + et('Доступ только для владельца') + '</h2>' +
      '<p>' + et('Эта панель доступна только аккаунту владельца проекта.') + '</p></div>';
  }
  async function open(viaAccount) {
    fromAccount = !!viaAccount;
    await loadI18n();
    build();
    fillLotteries();
    syncControls();
    ovEl.classList.add('show');
    D.documentElement.style.overflow = 'hidden';
    if (ovEl.__syncTop) ovEl.__syncTop();
    var owner = await isOwner();
    state.denied = !owner;
    if (!owner) { renderDenied(); return; }
    startOwnerNotifications();
    await show(state.section);
  }
  // A switch of the panel language re-renders everything on screen from the data already held:
  // shell, section, status line, an open sheet or ⓘ note and the map. No request is repeated.
  function onLanguageChange() {
    if (!ovEl) return;
    relabel();
    if (state.denied) renderDenied();
    else if (!state.busy && (state.data[state.section] || state.error)) {
      render();
      if (state.section === 'map') mountMap(true);
    }
    if (statusView) setStatus(statusView);
    if (stageView) { var stages = ovEl.querySelector('#ow-stages'); if (stages) stages.textContent = stageView(); }
    var sheet = ovEl.querySelector('#ow-sheet'); if (sheet && sheet.__render) sheet.__render();
    var note = ovEl.querySelector('#ow-pop-back'); if (note && note.__render) note.__render();
  }
  W.addEventListener('loto:ownerlanguagechange', onLanguageChange);
  // The Owner Notification Center is part of THIS panel, not of the public page: it is fetched on
  // the first open and started/stopped with the panel, so no owner query, listener or timer can
  // run while the panel is closed.
  var notifPromise = null;
  function startOwnerNotifications() {
    if (W.LotoOwnerNotifications) { W.LotoOwnerNotifications.start(); return; }
    if (!notifPromise) {
      var load = (typeof W.LotoLoadRuntimeScript === 'function')
        ? W.LotoLoadRuntimeScript('owner-notifications.js')
        : Promise.reject(new Error('no_loader'));
      notifPromise = load.catch(function (error) { notifPromise = null; throw error; });
    }
    notifPromise.then(function () {
      if (W.LotoOwnerNotifications && ovEl && ovEl.classList.contains('show')) W.LotoOwnerNotifications.start();
    }).catch(function () { /* the bell simply stays hidden; the report itself is unaffected */ });
  }
  function stopOwnerNotifications() {
    try { if (W.LotoOwnerNotifications) W.LotoOwnerNotifications.stop(); } catch (e) {}
  }
  function close() {
    if (!ovEl) return;
    ovEl.classList.remove('show');
    D.documentElement.style.overflow = '';
    stopLive();
    stopOwnerNotifications();
    closePopup();
    if (mapApi) { mapApi.destroy(); mapApi = null; }
    if (location.hash.indexOf('#owner') === 0) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    }
    if (fromAccount) { fromAccount = false; try { if (typeof W.openAccount === 'function') W.openAccount(); } catch (e) {} }
  }

  // Reveal the «Панель владельца» button in Личный кабинет — ONLY after a server owner probe.
  function revealAccountEntry() {
    (async function () {
      try {
        if (!(W.LotoAuth && W.LotoAuth.getSession)) return;
        var session = await W.LotoAuth.getSession();
        var button = D.getElementById('acc-owner-btn');
        if (!session || !session.user || session.user.is_anonymous) { if (button) button.hidden = true; return; }
        var owner = await isOwner();
        if (!button) return;
        if (!button.textContent) button.textContent = 'Панель владельца';
        button.hidden = !owner;
        if (owner && !button.__wired) {
          button.__wired = true;
          button.addEventListener('click', function () {
            try { if (typeof W.closeAccount === 'function') W.closeAccount(); } catch (e) {}
            open(true);
          });
        }
      } catch (e) {}
    })();
  }

  // ── deep links: #owner?d=YYYY-MM-DD&s=<section>&b=<block>&c=<country> ─────────────────────
  // Every owner notification (push and in-app) carries such a link; opening it lands on that day,
  // that section and that block with the country filter applied. Unknown values fall back safely.
  function applyLink(link) {
    if (!link) return;
    if (link.d) { state.preset = 'day'; state.day = link.d; }
    if (link.c && /^[A-Z]{2}$/.test(link.c)) { state.filters.country = link.c; state.selectedCountry = link.c; }
    else if (link.c === 'all') state.filters.country = 'all';
    var section = link.s;
    var known = SECTIONS.some(function (x) { return x.id === section; });
    state.section = known ? section : (link.d || link.b ? 'day' : state.section);
    state.block = link.b || null;
    state.data = {};
    state.page = 0;
  }
  async function openLink(hash) {
    var link = LIB.parseOwnerLink ? LIB.parseOwnerLink(hash) : null;
    if (link === null) link = {};
    applyLink(link);
    if (ovEl && ovEl.classList.contains('show')) { syncControls(); await show(state.section); return; }
    await open(false);
  }
  // _map / _state: read-only accessors for the browser tests (the panel is owner-only; this grants nothing).
  W.LotoOwnerDashboard = { open: open, close: close, openLink: openLink, revealAccountEntry: revealAccountEntry,
    _map: function () { return mapApi; }, _state: function () { return JSON.parse(JSON.stringify(state, function (k, v) { return k === 'data' ? undefined : v; })); } };
  W.addEventListener('hashchange', function () { if (location.hash.indexOf('#owner') === 0) openLink(location.hash); });
  try { W.addEventListener('loto:accesschange', revealAccountEntry); } catch (e) {}
  function wrapOpenAccount() {
    try {
      var orig = W.openAccount;
      if (typeof orig === 'function' && !orig.__owWrapped) {
        var wrapped = function () { var result = orig.apply(this, arguments); try { revealAccountEntry(); } catch (e) {} return result; };
        wrapped.__owWrapped = true;
        W.openAccount = wrapped;
      }
    } catch (e) {}
  }
  function boot() {
    if (location.hash.indexOf('#owner') === 0) openLink(location.hash);
    revealAccountEntry();
    wrapOpenAccount();
    var tries = 0;
    var timer = setInterval(function () { wrapOpenAccount(); if (++tries >= 6) clearInterval(timer); }, 800);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
