// Trainings & Events page: draws the list and the month calendar from
// window.MSME_EVENTS (js/events-data.js), and runs the filters and switches.
//
// Dates are handled as UTC-midnight timestamps of the calendar day, so a
// date never shifts with the visitor's time zone. Solar Hijri dates come from
// the browser's built-in Persian calendar, which is the calendar Afghanistan
// uses; only the month names differ, so they are listed here in their Dari
// form.
//
// The same script runs the English page and the Dari and Pashto ones
// (fa/events.html, ps/events.html): the page's <html lang> picks the wording,
// and each event's `fa` / `ps` entry in events-data.js supplies its text.
(function () {
  'use strict';

  var app = document.getElementById('events-app');
  if (!app) return;

  var DAY = 86400000;
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);   // 'en', 'fa' (Dari) or 'ps' (Pashto)
  var LOCAL = LANG === 'fa' || LANG === 'ps';

  // Every piece of wording the script writes, in Dari, Pashto and English
  var T = LANG === 'fa' ? {
    solarMonths: ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'],
    gMonths: ['جنوری', 'فبروری', 'مارچ', 'اپریل', 'می', 'جون', 'جولای', 'اگست', 'سپتمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    weekdays: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
    types: { training: 'آموزش', b2b: 'B2B', matchmaking: 'ارتباط‌دهی', deadline: 'مهلت' },
    topics: { 'export-readiness': 'آمادگی صادراتی', finance: 'تمویل', sector: 'ویژهٔ سکتور' },
    full: 'تکمیل',
    taken: 'این رویداد برگزار شده است.',
    registered: 'ثبت‌نام شده',
    waitlist: 'پیوستن به فهرست انتظار',
    register: 'ثبت‌نام',
    registerFor: function (title) { return 'ثبت‌نام برای ' + title; },
    applyBy: 'درخواست تا ',
    placesLeft: function (left, cap) { return left + ' جای خالی از ' + cap; },
    available: 'جای خالی موجود است',
    checking: 'در حال بررسی جاهای خالی…',
    notCentreNote: 'رویداد مرکز نیست؛ اینجا آمده تا آن را در کنار سایر موارد ببینید',
    count: function (n, when) { return n + ' رویداد ' + (when === 'past' ? 'گذشته' : 'پیش رو'); },
    countIn: function (n, month) { return n + ' رویداد در ' + month; },
    none: function (when, filtered) {
      var w = when === 'past' ? 'گذشته' : 'پیش رو';
      return filtered
        ? 'هیچ رویداد ' + w + ' با این فیلترها مطابقت ندارد. <button type="button" class="link-button" data-clear-filters>نمایش همه رویدادها</button>'
        : 'هنوز رویداد ' + w + ' وجود ندارد.';
    },
    events: function (n) { return '، ' + n + ' رویداد'; },
    noEvents: 'در این روز رویدادی نیست.'
  } : LANG === 'ps' ? {
    solarMonths: ['وری', 'غویی', 'غبرګولی', 'چنګاښ', 'زمری', 'وږی', 'تله', 'لړم', 'لیندۍ', 'مرغومی', 'سلواغه', 'کب'],
    gMonths: ['جنوري', 'فبروري', 'مارچ', 'اپریل', 'مې', 'جون', 'جولای', 'اګست', 'سپتمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    weekdays: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
    types: { training: 'روزنه', b2b: 'B2B', matchmaking: 'نښلول', deadline: 'وروستۍ نېټه' },
    topics: { 'export-readiness': 'صادراتي چمتووالی', finance: 'تمویل', sector: 'د سکتور ځانګړې' },
    full: 'ډک',
    taken: 'دا غونډه شوې ده.',
    registered: 'نوم یې لیکلی',
    waitlist: 'د انتظار لېست ته ورګډ شئ',
    register: 'نوم لیکنه',
    registerFor: function (title) { return 'د ' + title + ' لپاره نوم لیکنه'; },
    applyBy: 'د غوښتنې وروستۍ نېټه: ',
    placesLeft: function (left, cap) { return 'له ' + cap + ' ځایونو ' + left + ' پاتې دي'; },
    available: 'ځای شته',
    checking: 'د خالي ځایونو کتنه…',
    notCentreNote: 'د مرکز غونډه نه ده؛ دلته راغلې چې له نورو سره یې یوځای ووینئ',
    count: function (n, when) { return n + ' ' + (when === 'past' ? 'تېرې غونډې' : 'راتلونکې غونډې'); },
    countIn: function (n, month) { return n + ' غونډې په ' + month + ' کې'; },
    none: function (when, filtered) {
      var w = when === 'past' ? 'تېره' : 'راتلونکې';
      return filtered
        ? 'هېڅ ' + w + ' غونډه له دې فلټرونو سره سمون نه لري. <button type="button" class="link-button" data-clear-filters>ټولې غونډې وښایئ</button>'
        : 'تر اوسه ' + w + ' غونډه نشته.';
    },
    events: function (n) { return '، ' + n + ' غونډې'; },
    noEvents: 'په دې ورځ کومه غونډه نشته.'
  } : {
    solarMonths: ['Hamal', 'Sawr', 'Jawza', 'Saratan', 'Asad', 'Sunbula', 'Mizan', 'Aqrab', 'Qaws', 'Jadi', 'Dalw', 'Hut'],
    gMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    types: { training: 'Training', b2b: 'B2B', matchmaking: 'Matchmaking', deadline: 'Deadline' },
    topics: { 'export-readiness': 'Export readiness', finance: 'Finance', sector: 'Sector specific' },
    full: 'Full',
    taken: 'This event has taken place.',
    registered: 'registered',
    waitlist: 'Join the waiting list',
    register: 'Register',
    registerFor: function (title) { return 'Register for ' + title; },
    applyBy: 'Apply by ',
    placesLeft: function (left, cap) { return left + ' of ' + cap + ' places left'; },
    available: 'Places available',
    checking: 'Checking places…',
    notCentreNote: 'Not a Centre event — listed so you see it alongside everything else',
    count: function (n, when) { return n + ' ' + when; },
    countIn: function (n, month) { return n + ' in ' + month; },
    none: function (when, filtered) {
      return 'No ' + when + ' events' + (filtered ? ' match these filters. <button type="button" class="link-button" data-clear-filters>Show all events</button>' : ' yet.');
    },
    events: function (n) { return ', ' + n + (n === 1 ? ' event' : ' events'); },
    noEvents: 'No events on this day.'
  };

  var EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SOLAR_MONTHS = T.solarMonths;
  var G_MONTHS = T.gMonths;
  var WEEKDAYS = T.weekdays;
  var TYPES = {
    training: { label: T.types.training, tone: 'amber' },
    b2b: { label: T.types.b2b, tone: 'blue' },
    matchmaking: { label: T.types.matchmaking, tone: 'blue' },
    deadline: { label: T.types.deadline, tone: 'deadline' }
  };
  var TOPICS = T.topics;
  var CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8690F" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7v5.5l3.5 2"></path></svg>';
  var CLOCK_SMALL = CLOCK.replace('width="18" height="18"', 'width="11" height="11"').replace('stroke-width="1.9"', 'stroke-width="2.2"');

  // ── Dates ──────────────────────────────────────────────────────────────────

  function parseDate(iso) {
    var p = String(iso).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function todayStamp() {
    var now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function greg(t) {
    var d = new Date(t);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  var persianParts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric'
  });
  function solar(t) {
    var out = {};
    persianParts.formatToParts(new Date(t)).forEach(function (p) {
      if (p.type === 'year' || p.type === 'month' || p.type === 'day') out[p.type] = parseInt(p.value, 10);
    });
    return { y: out.year, m: out.month, d: out.day };
  }

  // First day of a Solar Hijri month. Starts from an estimate (1 Hamal is
  // about 21 March; months 1–6 have 31 days, 7–11 have 30) and walks to the
  // exact day.
  function solarMonthStart(y, m) {
    var t = Date.UTC(y + 621, 2, 21) + (m <= 7 ? (m - 1) * 31 : 186 + (m - 7) * 30) * DAY;
    for (var i = 0; i < 60; i++) {
      var s = solar(t);
      var diff = (s.y - y) * 12 + (s.m - m);
      if (diff === 0) return t - (s.d - 1) * DAY;
      t += diff < 0 ? DAY : -DAY;
    }
    return t;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  // Dari and Pashto don't abbreviate month names
  function gShort(m) { return LOCAL ? G_MONTHS[m - 1] : G_MONTHS[m - 1].slice(0, 3); }

  // "12 Oct" or "20 Mizan", in the chosen calendar
  function shortDate(t, sys) {
    if (sys === 's') { var s = solar(t); return s.d + ' ' + SOLAR_MONTHS[s.m - 1]; }
    var g = greg(t); return g.d + ' ' + gShort(g.m);
  }
  function shortDateWithOther(t) {
    var other = state.cal === 's' ? 'g' : 's';
    return esc(shortDate(t, state.cal)) + ' <span class="other-cal">(' + esc(shortDate(t, other)) + ')</span>';
  }

  // Big day number, month, and the other calendar's date underneath
  function dateBox(t) {
    var g = greg(t), s = solar(t);
    var day, mon, alt;
    if (state.cal === 's') { day = pad(s.d); mon = SOLAR_MONTHS[s.m - 1]; alt = g.d + ' ' + gShort(g.m); }
    else { day = pad(g.d); mon = gShort(g.m); alt = s.d + ' ' + SOLAR_MONTHS[s.m - 1]; }
    return '<div class="datebox"><div class="datebox__day">' + day + '</div>' +
      '<div class="datebox__mon">' + mon + '</div><div class="datebox__alt">' + alt + '</div></div>';
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  var events = (window.MSME_EVENTS || []).map(function (ev) {
    var copy = {};
    for (var k in ev) copy[k] = ev[k];
    // On the Dari and Pashto pages, the event's own wording replaces the English
    if (LOCAL && ev[LANG]) for (var f in ev[LANG]) copy[f] = ev[LANG][f];
    // How the event is named in the registration form: always the English
    // title and date, so responses from all three language pages sort together
    var g = greg(parseDate(ev.date));
    copy.formLabel = ev.title + ' (' + g.d + ' ' + EN_MONTHS[g.m - 1] + ' ' + g.y + ')';
    copy.isFree = /^free$/i.test(ev.price || '');
    copy.t = parseDate(ev.date);
    if (ev.applyBy) copy.applyT = parseDate(ev.applyBy);
    copy.isFull = !!ev.capacity && ev.registered >= ev.capacity;
    return copy;
  }).sort(function (a, b) { return a.t - b.t; });

  var today = todayStamp();

  // While the live seat counts are loading, events with a seat limit say
  // "Checking places…" rather than showing numbers that may be out of date
  var countsUrl = window.MSME_REGISTRATION && window.MSME_REGISTRATION.countsUrl;
  var countsPending = !!(countsUrl && window.fetch);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────

  var params = new URLSearchParams(location.search);
  var state = {
    when: params.get('when') === 'past' ? 'past' : 'upcoming',
    view: params.get('view') === 'calendar' ? 'calendar' : 'list',
    cal: LOCAL ? 's' : 'g',
    type: TYPES[params.get('type')] && params.get('type') !== 'deadline' ? params.get('type') : 'all',
    topic: TOPICS[params.get('topic')] ? params.get('topic') : null,
    month: null,     // { y, m } in the current calendar system
    selected: null   // timestamp of the selected day in the calendar
  };
  try {
    var savedCal = localStorage.getItem('msme.calendar');
    if (savedCal === 's' || savedCal === 'g') state.cal = savedCal;
  } catch (e) { /* storage unavailable */ }

  function matches(ev) {
    // Deadlines aren't Centre events: show them only when no filter is narrowing the list
    if (ev.type === 'deadline') return state.type === 'all' && !state.topic;
    if (state.type !== 'all' && ev.type !== state.type) return false;
    if (state.topic && ev.topic !== state.topic) return false;
    return true;
  }

  // ── Pieces shared by the list and the day card ─────────────────────────────

  function tagsHtml(ev) {
    var type = TYPES[ev.type];
    var html = '<span class="tag tag--' + type.tone + '">' + type.label + '</span>';
    if (ev.topic && TOPICS[ev.topic]) html += '<span class="tag tag--topic">' + TOPICS[ev.topic] + '</span>';
    if (ev.isFull) html += '<span class="tag tag--full">' + T.full + '</span>';
    return '<div class="tags">' + html + '</div>';
  }

  // Link to the registration form with the event already filled in
  function formLink(ev, waitlist) {
    var form = window.MSME_REGISTRATION;
    if (!form || !form.formUrl || !form.eventField) return null;
    return form.formUrl + '?usp=pp_url&' + form.eventField + '=' +
      encodeURIComponent(ev.formLabel + (waitlist ? ' – waiting list' : ''));
  }
  function ownLink(url) { return url && url !== '#' ? url : null; }

  function priceHtml(ev) {
    if (!ev.price) return '';
    return ev.isFree ? '<span class="free">' + esc(ev.price) + '</span>' : esc(ev.price);
  }

  function actionHtml(ev) {
    if (ev.t < today) return '<div class="event__status">' + T.taken + '</div>';
    var button, status;
    if (ev.isFull) {
      button = '<span class="button button-primary button-arrow is-disabled" aria-disabled="true">' + T.full + '</span>';
      status = '<div class="event__status"><span class="full-count">' + ev.registered + '/' + ev.capacity + '</span> ' + T.registered + '</div>';
      var waitUrl = ownLink(ev.waitlistUrl) || formLink(ev, true);
      if (waitUrl) status += '<a class="event__status text-link" href="' + esc(waitUrl) + '" target="_blank" rel="noopener">' + T.waitlist + '</a>';
    } else {
      button = '<a class="button button-primary button-arrow" href="' + esc(ownLink(ev.registerUrl) || formLink(ev) || '#') + '" target="_blank" rel="noopener" aria-label="' + esc(T.registerFor(ev.title)) + '">' + T.register + '</a>';
      if (ev.applyT) status = T.applyBy + shortDateWithOther(ev.applyT);
      else if (ev.capacity && countsPending) status = T.checking;
      else if (ev.capacity) status = T.placesLeft(ev.capacity - (ev.registered || 0), ev.capacity);
      else status = T.available;
      status = '<div class="event__status">' + status + '</div>';
    }
    return button + status;
  }

  // ── List view ──────────────────────────────────────────────────────────────

  function eventItem(ev) {
    if (ev.type === 'deadline') {
      return '<li class="event event--deadline"><div class="event__date">' + dateBox(ev.t) + '</div>' +
        '<div class="event__body">' + CLOCK + '<div><h3 class="event__title">' + esc(ev.title) + '</h3>' +
        '<p class="event__note">' + T.notCentreNote + '</p></div></div></li>';
    }
    var meta = [ev.place, ev.time, ev.language].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; });
    if (ev.price) meta.push('<span>' + priceHtml(ev) + '</span>');
    return '<li class="event"><div class="event__date">' + dateBox(ev.t) + '</div>' +
      '<div class="event__body">' + tagsHtml(ev) +
      '<h3 class="event__title">' + esc(ev.title) + '</h3>' +
      (ev.description ? '<p class="event__desc">' + esc(ev.description) + '</p>' : '') +
      '<div class="event__meta">' + meta.join('') + '</div></div>' +
      '<div class="event__action">' + actionHtml(ev) + '</div></li>';
  }

  function renderList() {
    var list = events.filter(matches).filter(function (ev) {
      return state.when === 'past' ? ev.t < today : ev.t >= today;
    });
    if (state.when === 'past') list.reverse();

    var real = list.filter(function (ev) { return ev.type !== 'deadline'; }).length;
    if (state.view === 'list') {
      document.getElementById('events-count').textContent = T.count(real, state.when);
    }

    var el = document.getElementById('event-list');
    if (!list.length) {
      var filtered = state.type !== 'all' || state.topic;
      el.innerHTML = '<li class="events-empty">' + T.none(state.when, filtered) + '</li>';
      return;
    }
    el.innerHTML = list.map(eventItem).join('');
  }

  // ── Calendar view ──────────────────────────────────────────────────────────

  function monthOf(t) {
    var p = state.cal === 's' ? solar(t) : greg(t);
    return { y: p.y, m: p.m };
  }

  function monthRange(month) {
    if (state.cal === 's') {
      var next = month.m === 12 ? { y: month.y + 1, m: 1 } : { y: month.y, m: month.m + 1 };
      return { start: solarMonthStart(month.y, month.m), end: solarMonthStart(next.y, next.m) };
    }
    return { start: Date.UTC(month.y, month.m - 1, 1), end: Date.UTC(month.y, month.m, 1) };
  }

  function shiftMonth(month, by) {
    var i = month.y * 12 + (month.m - 1) + by;
    return { y: Math.floor(i / 12), m: (i % 12) + 1 };
  }

  // The day to select when a month opens: the next event from today on,
  // otherwise the month's first event, otherwise today, otherwise the 1st.
  function defaultSelection(range) {
    var inMonth = events.filter(matches).filter(function (ev) { return ev.t >= range.start && ev.t < range.end; });
    var next = inMonth.filter(function (ev) { return ev.t >= today; })[0];
    if (next) return next.t;
    if (inMonth.length) return inMonth[0].t;
    if (today >= range.start && today < range.end) return today;
    return range.start;
  }

  function monthTitles(range) {
    var first = range.start, last = range.end - DAY;
    if (state.cal === 's') {
      var s = solar(first), g1 = greg(first), g2 = greg(last);
      var sub = g1.y === g2.y
        ? g1.d + ' ' + gShort(g1.m) + ' – ' + g2.d + ' ' + gShort(g2.m) + ' ' + g2.y
        : g1.d + ' ' + gShort(g1.m) + ' ' + g1.y + ' – ' + g2.d + ' ' + gShort(g2.m) + ' ' + g2.y;
      return { title: SOLAR_MONTHS[s.m - 1] + ' ' + s.y, sub: sub };
    }
    var g = greg(first), s1 = solar(first), s2 = solar(last);
    var alt = s1.y === s2.y
      ? SOLAR_MONTHS[s1.m - 1] + ' – ' + SOLAR_MONTHS[s2.m - 1] + ' ' + s2.y
      : SOLAR_MONTHS[s1.m - 1] + ' ' + s1.y + ' – ' + SOLAR_MONTHS[s2.m - 1] + ' ' + s2.y;
    return { title: G_MONTHS[g.m - 1] + ' ' + g.y, sub: alt };
  }

  function longDate(t, sys) {
    var g = greg(t), s = solar(t), wd = WEEKDAYS[new Date(t).getUTCDay()];
    return sys === 's'
      ? { main: wd + ' ' + s.d + ' ' + SOLAR_MONTHS[s.m - 1], alt: g.d + ' ' + G_MONTHS[g.m - 1] + ' ' + g.y, full: wd + ' ' + s.d + ' ' + SOLAR_MONTHS[s.m - 1] + ' ' + s.y }
      : { main: wd + ' ' + g.d + ' ' + G_MONTHS[g.m - 1], alt: s.d + ' ' + SOLAR_MONTHS[s.m - 1] + ' ' + s.y, full: wd + ' ' + g.d + ' ' + G_MONTHS[g.m - 1] + ' ' + g.y };
  }

  function chipHtml(ev) {
    if (ev.type === 'deadline') {
      return '<span class="cal-chip cal-chip--deadline">' + CLOCK_SMALL + '<span>' + esc(ev.short || ev.title) + '</span></span>';
    }
    var html = '<span class="cal-chip cal-chip--' + TYPES[ev.type].tone + '">' + esc(ev.short || ev.title) + '</span>';
    if (ev.isFull) html += '<span class="cal-full">' + T.full + ' · <span>' + ev.registered + '/' + ev.capacity + '</span></span>';
    return html;
  }

  function renderCalendar() {
    var range = monthRange(state.month);
    var titles = monthTitles(range);
    document.getElementById('cal-title').textContent = titles.title;
    document.getElementById('cal-sub').textContent = titles.sub;

    var visible = events.filter(matches);
    var byDay = {};
    visible.forEach(function (ev) { (byDay[ev.t] = byDay[ev.t] || []).push(ev); });

    if (state.view === 'calendar') {
      var n = visible.filter(function (ev) { return ev.type !== 'deadline' && ev.t >= range.start && ev.t < range.end; }).length;
      document.getElementById('events-count').textContent = T.countIn(n, titles.title.split(' ')[0]);
    }

    // Weeks start on Saturday; Friday is the last column
    var lead = (new Date(range.start).getUTCDay() + 1) % 7;
    var t = range.start - lead * DAY;
    var cells = [];
    var first = true;
    while (t < range.end || cells.length % 7 !== 0) {
      var g = greg(t), s = solar(t);
      var mainDay = state.cal === 's' ? s.d : g.d;
      var mainMon = state.cal === 's' ? SOLAR_MONTHS[s.m - 1] : gShort(g.m);
      var altDay = state.cal === 's' ? g.d : s.d;
      var altMon = state.cal === 's' ? gShort(g.m) : SOLAR_MONTHS[s.m - 1];
      var dayEvents = byDay[t] || [];
      var classes = ['day'];
      if (t < range.start || t >= range.end) classes.push('is-outside');
      if (t === today) classes.push('is-today');
      if (t === state.selected) classes.push('is-selected');
      var label = longDate(t, state.cal).full + (dayEvents.length ? T.events(dayEvents.length) : '');
      cells.push(
        '<button type="button" class="' + classes.join(' ') + '" data-day="' + t + '" aria-label="' + esc(label) + '"' +
        (t === state.selected ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
        '<span class="day__head" aria-hidden="true"><span class="day__num">' + mainDay + (mainDay === 1 ? '<small>' + mainMon + '</small>' : '') + '</span>' +
        '<span class="day__alt">' + altDay + (altDay === 1 || first ? ' ' + altMon : '') + '</span></span>' +
        dayEvents.map(chipHtml).join('') + '</button>'
      );
      first = false;
      t += DAY;
    }
    document.getElementById('month-grid').innerHTML = cells.join('');

    renderDayCard(byDay[state.selected] || []);
  }

  function renderDayCard(dayEvents) {
    var d = longDate(state.selected, state.cal);
    var html = '<div><div class="day-card__date">' + esc(d.main) + '</div><div class="day-card__alt">' + esc(d.alt) + '</div></div>';
    if (!dayEvents.length) {
      html += '<p class="day-card__empty">' + T.noEvents + '</p>';
    }
    dayEvents.forEach(function (ev) {
      if (ev.type === 'deadline') {
        html += '<div class="day-card__event"><h3 class="day-card__title">' + esc(ev.title) + '</h3>' +
          '<p class="day-card__desc">' + T.notCentreNote + '.</p></div>';
        return;
      }
      var line2 = [ev.time, ev.language].filter(Boolean).map(esc);
      if (ev.price) line2.push(priceHtml(ev));
      html += '<div class="day-card__event">' + tagsHtml(ev) +
        '<h3 class="day-card__title">' + esc(ev.title) + '</h3>' +
        (ev.description ? '<p class="day-card__desc">' + esc(ev.description) + '</p>' : '') +
        '<div class="day-card__meta"><span>' + esc(ev.place) + '</span><span>' + line2.join(' · ') + '</span></div>' +
        '<div class="event__action">' + actionHtml(ev) + '</div></div>';
    });
    document.getElementById('day-card').innerHTML = html;
  }

  // ── Training topics tabs ───────────────────────────────────────────────────

  var topicTabs = Array.prototype.slice.call(app.querySelectorAll('[data-topic-tab]'));

  function showTopicTab(topic, focus) {
    topicTabs.forEach(function (tab) {
      var on = tab.getAttribute('data-topic-tab') === topic;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    app.querySelectorAll('[data-topic-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-topic-panel') !== topic;
    });
  }

  // Arrow keys move between tabs; on right-to-left pages "next" is to the left
  if (topicTabs.length) {
    topicTabs[0].parentNode.addEventListener('keydown', function (e) {
      var i = topicTabs.indexOf(document.activeElement);
      if (i < 0) return;
      var rtl = getComputedStyle(app).direction === 'rtl';
      var step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? topicTabs.length - 1 : step ? (i + step + topicTabs.length) % topicTabs.length : -1;
      if (next < 0) return;
      e.preventDefault();
      showTopicTab(topicTabs[next].getAttribute('data-topic-tab'), true);
    });
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function setPressed(selector, attr, value) {
    app.querySelectorAll(selector).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value));
    });
  }

  function render() {
    setPressed('[data-when]', 'data-when', state.when);
    setPressed('[data-view]', 'data-view', state.view);
    setPressed('[data-cal]', 'data-cal', state.cal);
    setPressed('[data-type]', 'data-type', state.type);
    setPressed('[data-topic]', 'data-topic', state.topic || '');
    if (state.topic && topicTabs.length) showTopicTab(state.topic);
    document.getElementById('list-view').hidden = state.view !== 'list';
    document.getElementById('calendar-view').hidden = state.view !== 'calendar';
    // The calendar sits on a light grey background; the list stays on white
    document.querySelector('.events-panel').classList.toggle('is-calendar', state.view === 'calendar');
    renderList();
    renderCalendar();
  }

  function openMonth(month) {
    state.month = month;
    state.selected = defaultSelection(monthRange(month));
  }

  app.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-topic-tab')) {
      showTopicTab(b.getAttribute('data-topic-tab'));
      return;
    }
    if (b.hasAttribute('data-show-topic')) {
      // "See events on this topic": set the Topic filter and jump to the list
      state.topic = b.getAttribute('data-show-topic');
      state.when = 'upcoming';
      openMonth(state.month);
      render();
      document.getElementById('filters').scrollIntoView({ block: 'start' });
      return;
    }
    if (b.hasAttribute('data-when')) {
      state.when = b.getAttribute('data-when');
      state.view = 'list';
    } else if (b.hasAttribute('data-view')) {
      state.view = b.getAttribute('data-view');
    } else if (b.hasAttribute('data-cal')) {
      var anchor = state.selected;
      state.cal = b.getAttribute('data-cal');
      try { localStorage.setItem('msme.calendar', state.cal); } catch (err) { /* storage unavailable */ }
      state.month = monthOf(anchor);
    } else if (b.hasAttribute('data-type')) {
      state.type = b.getAttribute('data-type');
      openMonth(state.month);
    } else if (b.hasAttribute('data-topic')) {
      var topic = b.getAttribute('data-topic');
      state.topic = state.topic === topic ? null : topic;
      openMonth(state.month);
    } else if (b.hasAttribute('data-clear-filters')) {
      state.type = 'all'; state.topic = null;
      openMonth(state.month);
    } else if (b.hasAttribute('data-day')) {
      var t = +b.getAttribute('data-day');
      var range = monthRange(state.month);
      if (t < range.start || t >= range.end) state.month = monthOf(t);
      state.selected = t;
    } else if (b.id === 'cal-prev' || b.id === 'cal-next') {
      openMonth(shiftMonth(state.month, b.id === 'cal-prev' ? -1 : 1));
    } else if (b.id === 'cal-today') {
      state.month = monthOf(today);
      state.selected = today;
    } else if (b.id === 'show-past') {
      state.when = 'past';
      state.view = 'list';
      render();
      document.getElementById('filters').scrollIntoView({ block: 'start' });
      return;
    } else {
      return;
    }
    render();
  });

  showTopicTab(state.topic || (topicTabs[0] && topicTabs[0].getAttribute('data-topic-tab')));
  openMonth(monthOf(today));
  render();

  // Seats taken, counted live from the registration sheet (numbers only).
  // Until they arrive, or if the sheet can't be reached, the page shows the
  // numbers in events-data.js.
  if (countsUrl && window.fetch) {
    fetch(countsUrl)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var counts = (d && d.counts) || {};
        events.forEach(function (ev) {
          if (!ev.capacity) return;
          ev.registered = counts[ev.formLabel] || 0;
          ev.isFull = ev.registered >= ev.capacity;
        });
        countsPending = false;
        render();
      })
      .catch(function () {
        // Sheet unreachable: show the numbers from events-data.js instead
        countsPending = false;
        render();
      });
  }
})();
