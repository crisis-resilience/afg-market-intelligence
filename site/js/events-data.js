// =============================================================================
// Trainings & Events — the list the Events page is drawn from
// =============================================================================
// To add an event, copy an entry, change the values and keep the comma between
// entries. Order doesn't matter; the page sorts by date. Past events stay
// here: once their date has gone by they move to the "Past" tab by themselves.
//
//   date         'YYYY-MM-DD' (Gregorian). The Solar Hijri date is worked out
//                automatically.
//   type         'training' | 'b2b' | 'matchmaking' | 'deadline'
//                A 'deadline' is not a Centre event (e.g. a tax filing date);
//                it is listed so businesses see it alongside everything else,
//                and needs only date, title and short.
//   topic        'export-readiness' | 'finance' | 'sector'   (optional)
//   title        Full name, shown in the list and the day card.
//   short        Shorter name for the calendar squares.
//   description  One or two sentences.
//   province     Not shown at the moment (the page has no province filter);
//                keep filling it in so the filter can come back.
//   place, time, language, price   Shown as written.
//   capacity     Number of seats. The seats taken are counted automatically
//                from the registration sheet (see below), and the event shows
//                "X places left", then Full with a waiting-list link. Leave it
//                out to show "Places available" with no count.
//   registered   (optional) Seats taken, typed by hand. Only used when the
//                sheet can't be reached; the sheet's count replaces it.
//   applyBy      'YYYY-MM-DD' (optional) — shown instead of places left.
//   registerUrl  (optional) A different place for this event's Register button.
//                Leave it out to use the registration form below.
//   waitlistUrl  (optional) The same, for "Join the waiting list".
//   fa, ps       The Dari (fa) and Pashto (ps) wording, for fa/events.html
//                and ps/events.html: any of title, short, description, place,
//                time, language, price. Anything left out shows in English.
//
// The entries below are examples. The trainings use the real course names
// from the three training topics; their dates, places and numbers are made up.
// =============================================================================

// ── Registration form ────────────────────────────────────────────────────────
// Every Register and "Join the waiting list" button opens this form with its
// first question ("Training / event") already filled in, e.g.
// "Where should I export? (4 Nov 2026)". Responses stay in the form owner's
// Google account, never on this website or in the code.
//
//   formUrl     The form's link, ending in /viewform.
//   eventField  The code of the "Training / event" question (entry.<number>).
//               Find it with ⋮ > Get pre-filled link in the form editor.
//   countsUrl   The Web app URL of the script in the response sheet
//               (scripts/registration_sheet.gs). The page asks it how many
//               seats each event has taken: numbers only, no personal data.
//               Leave it '' to show the capacity without counting.
//
// To move to another form tool later (e.g. KoboToolbox), change these.
window.MSME_REGISTRATION = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfWKTEw6mrAMdQIsg40hopQFeejzhnpHXUnMoG1nx-yL0U0ow/viewform',
  eventField: 'entry.41557620',
  countsUrl: 'https://script.google.com/macros/s/AKfycbxoPqdw0741aSQsl7cXky1Z9oB2E-ivULSEbv_NVnqoKo2wy0OJsQ-4NVyUfE4MLLjz/exec'
};

window.MSME_EVENTS = [
  {
    date: '2026-09-24',
    type: 'b2b',
    topic: 'sector',
    title: 'Saffron buyers B2B — Gulf importers',
    short: 'Saffron buyers B2B',
    description: 'Twelve confirmed importers from the UAE, Saudi Arabia and Qatar. Bring samples and your certification paperwork. For producers already exporting or ready to.',
    province: 'Herat',
    place: 'Herat · ACCI branch',
    time: '09:00–16:00',
    language: 'Dari and English',
    price: 'Free',
    capacity: 40,
    registered: 32,
    fa: {
      title: 'B2B خریداران زعفران — واردکنندگان کشورهای خلیج',
      short: 'B2B خریداران زعفران',
      description: 'دوازده واردکنندهٔ تأییدشده از امارات متحدهٔ عربی، عربستان سعودی و قطر. نمونه‌ها و اسناد تصدیق‌نامهٔ خود را همراه بیاورید. برای تولیدکنندگانی که صادرات دارند یا آمادهٔ آن هستند.',
      place: 'هرات · نمایندگی ACCI',
      language: 'دری و انگلیسی',
      price: 'رایگان'
    },
    ps: {
      title: 'د زعفرانو پېرودونکو B2B — د خلیج هېوادونو واردوونکي',
      short: 'د زعفرانو B2B',
      description: 'له متحده عربي اماراتو، سعودي عربستان او قطر څخه دولس تایید شوي واردوونکي. خپلې نمونې او د تصدیق اسناد له ځانه سره راوړئ. د هغو تولیدوونکو لپاره چې صادرات لري یا ورته چمتو دي.',
      place: 'هرات · د ACCI څانګه',
      language: 'دري او انګلیسي',
      price: 'وړیا'
    }
  },
  {
    date: '2026-10-19',
    type: 'matchmaking',
    topic: 'finance',
    title: 'Financial matchmaking — dried fruit processors',
    short: 'Financial matchmaking',
    description: 'Fifteen-minute meetings with four banks and two investment funds. Come with the application pack from the finance training, or book a session to prepare one first.',
    province: 'Balkh',
    place: 'Mazar-e Sharif · ACCI branch',
    time: '10:00–16:00',
    language: 'Dari',
    price: 'Free',
    applyBy: '2026-10-12',
    fa: {
      title: 'ارتباط‌دهی مالی — پروسس‌کنندگان میوهٔ خشک',
      short: 'ارتباط‌دهی مالی',
      description: 'ملاقات‌های پانزده‌دقیقه‌ای با چهار بانک و دو صندوق سرمایه‌گذاری. بستهٔ درخواست را از آموزش تمویل همراه بیاورید، یا اول یک جلسه برای آماده‌سازی آن بگیرید.',
      place: 'مزار شریف · نمایندگی ACCI',
      language: 'دری',
      price: 'رایگان'
    },
    ps: {
      title: 'مالي نښلول — د وچې مېوې پروسس کوونکي',
      short: 'مالي نښلول',
      description: 'له څلورو بانکونو او دوو پانګونې صندوقونو سره پنځلس دقیقې لیدنې. د تمویل له روزنې څخه د غوښتنلیک کڅوړه راوړئ، یا لومړی د هغې د چمتو کولو لپاره یوه ناسته ونیسئ.',
      place: 'مزار شریف · د ACCI څانګه',
      language: 'دري',
      price: 'وړیا'
    }
  },
  {
    date: '2026-11-04',
    type: 'training',
    topic: 'export-readiness',
    title: 'Where should I export?',
    short: 'Where to export',
    province: 'Kabul',
    place: 'Kabul centre',
    time: '09:00–15:00',
    language: 'Dari',
    price: 'Free',
    capacity: 20,
    fa: {
      title: 'به کجا صادر کنم؟',
      short: 'بازار صادراتی',
      place: 'مرکز کابل',
      language: 'دری',
      price: 'رایگان'
    },
    ps: {
      title: 'چېرته صادرات وکړم؟',
      short: 'صادراتي بازار',
      place: 'د کابل مرکز',
      language: 'دري',
      price: 'وړیا'
    }
  },
  {
    date: '2026-11-10',
    type: 'training',
    topic: 'sector',
    title: 'Product Quality and Standards Readiness',
    short: 'Product quality',
    province: 'Kabul',
    place: 'Kabul centre',
    time: '09:00–15:00',
    language: 'Dari and Pashto',
    price: 'Free',
    capacity: 30,
    fa: {
      title: 'کیفیت محصول و آمادگی برای معیارها',
      short: 'کیفیت محصول',
      place: 'مرکز کابل',
      language: 'دری و پشتو',
      price: 'رایگان'
    },
    ps: {
      title: 'د محصول کیفیت او معیارونو ته چمتووالی',
      short: 'د محصول کیفیت',
      place: 'د کابل مرکز',
      language: 'دري او پښتو',
      price: 'وړیا'
    }
  },
  {
    date: '2026-11-23',
    type: 'training',
    topic: 'finance',
    title: 'Business Formalization and Regulatory Compliance',
    short: 'Business formalization',
    province: 'Kabul',
    place: 'Kabul centre',
    time: '09:00–15:00',
    language: 'Dari and Pashto',
    price: 'Free',
    capacity: 30,
    fa: {
      title: 'رسمی‌سازی کسب‌وکار و رعایت مقررات',
      short: 'رسمی‌سازی کسب‌وکار',
      place: 'مرکز کابل',
      language: 'دری و پشتو',
      price: 'رایگان'
    },
    ps: {
      title: 'د سوداګرۍ رسمي کول او له مقرراتو سره سمون',
      short: 'د سوداګرۍ رسمي کول',
      place: 'د کابل مرکز',
      language: 'دري او پښتو',
      price: 'وړیا'
    }
  }
];
