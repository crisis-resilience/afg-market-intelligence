// Trainings & Events page: draws the list and the month calendar from
// window.MSME_EVENTS (js/events-data.js), and runs the filters and switches.
//
// Dates are handled as UTC-midnight timestamps of the calendar day, so a
// date never shifts with the visitor's time zone. Solar Hijri dates come from
// the browser's built-in Persian calendar, which is the calendar Afghanistan
// uses; only the month names differ, so they are listed here in their Dari
// form.
(function () {
  'use strict';

  var app = document.getElementById('events-app');
  if (!app) return;

  var DAY = 86400000;
  var SOLAR_MONTHS = ['Hamal', 'Sawr', 'Jawza', 'Saratan', 'Asad', 'Sunbula', 'Mizan', 'Aqrab', 'Qaws', 'Jadi', 'Dalw', 'Hut'];
  var G_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var TYPES = {
    training: { label: 'Training', tone: 'amber' },
    b2b: { label: 'B2B', tone: 'blue' },
    matchmaking: { label: 'Matchmaking', tone: 'blue' },
    deadline: { label: 'Deadline', tone: 'deadline' }
  };
  var TOPICS = { 'export-readiness': 'Export readiness', finance: 'Finance', sector: 'Sector' };
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
  function gShort(m) { return G_MONTHS[m - 1].slice(0, 3); }

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
    copy.t = parseDate(ev.date);
    if (ev.applyBy) copy.applyT = parseDate(ev.applyBy);
    copy.isFull = !!ev.capacity && ev.registered >= ev.capacity;
    return copy;
  }).sort(function (a, b) { return a.t - b.t; });

  var today = todayStamp();

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
    cal: 'g',
    type: TYPES[params.get('type')] && params.get('type') !== 'deadline' ? params.get('type') : 'all',
    topic: TOPICS[params.get('topic')] ? params.get('topic') : null,
    province: 'all',
    month: null,     // { y, m } in the current calendar system
    selected: null   // timestamp of the selected day in the calendar
  };
  try { if (localStorage.getItem('msme.calendar') === 's') state.cal = 's'; } catch (e) { /* storage unavailable */ }

  function matches(ev) {
    // Deadlines aren't Centre events: show them only when no filter is narrowing the list
    if (ev.type === 'deadline') return state.type === 'all' && !state.topic && state.province === 'all';
    if (state.type !== 'all' && ev.type !== state.type) return false;
    if (state.topic && ev.topic !== state.topic) return false;
    if (state.province !== 'all' && ev.province !== state.province) return false;
    return true;
  }

  // ── Pieces shared by the list and the day card ─────────────────────────────

  function tagsHtml(ev) {
    var type = TYPES[ev.type];
    var html = '<span class="tag tag--' + type.tone + '">' + type.label + '</span>';
    if (ev.topic && TOPICS[ev.topic]) html += '<span class="tag tag--topic">' + TOPICS[ev.topic] + '</span>';
    if (ev.isFull) html += '<span class="tag tag--full">Full</span>';
    return '<div class="tags">' + html + '</div>';
  }

  function priceHtml(ev) {
    if (!ev.price) return '';
    return /^free$/i.test(ev.price) ? '<span class="free">' + esc(ev.price) + '</span>' : esc(ev.price);
  }

  function actionHtml(ev) {
    if (ev.t < today) return '<div class="event__status">This event has taken place.</div>';
    var button, status;
    if (ev.isFull) {
      button = '<span class="button button-primary button-arrow is-disabled" aria-disabled="true">Full</span>';
      status = '<div class="event__status"><span class="full-count">' + ev.registered + '/' + ev.capacity + '</span> registered</div>';
      if (ev.waitlistUrl) status += '<a class="event__status text-link" href="' + esc(ev.waitlistUrl) + '">Join the waiting list</a>';
    } else {
      button = '<a class="button button-primary button-arrow" href="' + esc(ev.registerUrl || '#') + '" aria-label="Register for ' + esc(ev.title) + '">Register</a>';
      if (ev.applyT) status = 'Apply by ' + shortDateWithOther(ev.applyT);
      else if (ev.capacity) status = (ev.capacity - (ev.registered || 0)) + ' of ' + ev.capacity + ' places left';
      else status = 'Places available';
      status = '<div class="event__status">' + status + '</div>';
    }
    return button + status;
  }

  function statusText(ev) {
    if (ev.type === 'deadline') return 'Not a Centre event';
    var parts = [esc(ev.place), TYPES[ev.type].label];
    if (ev.isFull) parts.push('<span class="full-count">Full (' + ev.registered + '/' + ev.capacity + ')</span>');
    return parts.join(' · ');
  }

  // ── List view ──────────────────────────────────────────────────────────────

  function eventItem(ev) {
    if (ev.type === 'deadline') {
      return '<li class="event event--deadline"><div class="event__date">' + dateBox(ev.t) + '</div>' +
        '<div class="event__body">' + CLOCK + '<div><h3 class="event__title">' + esc(ev.title) + '</h3>' +
        '<p class="event__note">Not a Centre event — listed so you see it alongside everything else</p></div></div></li>';
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
      document.getElementById('events-count').textContent = real + ' ' + state.when;
    }

    var el = document.getElementById('event-list');
    if (!list.length) {
      var filtered = state.type !== 'all' || state.topic || state.province !== 'all';
      el.innerHTML = '<li class="events-empty">No ' + state.when + ' events' + (filtered ? ' match these filters. <button type="button" class="link-button" data-clear-filters>Show all events</button>' : ' yet.') + '</li>';
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
    if (ev.isFull) html += '<span class="cal-full">Full · <span>' + ev.registered + '/' + ev.capacity + '</span></span>';
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
      document.getElementById('events-count').textContent = n + ' in ' + titles.title.split(' ')[0];
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
      var label = longDate(t, state.cal).full + (dayEvents.length ? ', ' + dayEvents.length + (dayEvents.length === 1 ? ' event' : ' events') : '');
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

    var others = visible.filter(function (ev) { return ev.t >= range.start && ev.t < range.end && ev.t !== state.selected; });
    document.getElementById('month-list').innerHTML = others.length
      ? others.map(function (ev) {
          return '<li><button type="button" data-day="' + ev.t + '">' + dateBox(ev.t) +
            '<span><span class="month-list__name">' + esc(ev.title) + '</span><br><span class="month-list__sub">' + statusText(ev) + '</span></span></button></li>';
        }).join('')
      : '<li><p class="day-card__empty month-list__empty">Nothing else this month.</p></li>';
  }

  function renderDayCard(dayEvents) {
    var d = longDate(state.selected, state.cal);
    var html = '<div><div class="day-card__date">' + esc(d.main) + '</div><div class="day-card__alt">' + esc(d.alt) + '</div></div>';
    if (!dayEvents.length) {
      html += '<p class="day-card__empty">No events on this day.</p>';
    }
    dayEvents.forEach(function (ev) {
      if (ev.type === 'deadline') {
        html += '<div class="day-card__event"><h3 class="day-card__title">' + esc(ev.title) + '</h3>' +
          '<p class="day-card__desc">Not a Centre event — listed so you see it alongside everything else.</p></div>';
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
    document.getElementById('province').value = state.province;
    document.getElementById('list-view').hidden = state.view !== 'list';
    document.getElementById('calendar-view').hidden = state.view !== 'calendar';
    renderList();
    renderCalendar();
  }

  function openMonth(month) {
    state.month = month;
    state.selected = defaultSelection(monthRange(month));
  }

  // Province options come from the events themselves
  var provinceSelect = document.getElementById('province');
  events.map(function (ev) { return ev.province; }).filter(Boolean)
    .filter(function (p, i, all) { return all.indexOf(p) === i; })
    .sort()
    .forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      provinceSelect.appendChild(opt);
    });

  app.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
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
      state.type = 'all'; state.topic = null; state.province = 'all';
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

  provinceSelect.addEventListener('change', function () {
    state.province = provinceSelect.value;
    openMonth(state.month);
    render();
  });

  openMonth(monthOf(today));
  render();
})();
