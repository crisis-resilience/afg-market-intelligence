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
//   province     Used by the Province filter.
//   place, time, language, price   Shown as written.
//   capacity, registered   Numbers. When registered reaches capacity the
//                event shows as Full with a waiting-list link. Leave both out
//                to show "Places available".
//   applyBy      'YYYY-MM-DD' (optional) — shown instead of places left.
//   registerUrl  Where the Register button goes. '#' until registration is set
//                up.
//   waitlistUrl  Where "Join the waiting list" goes when the event is full.
//
// The entries below are the sample events from the design mockup.
// =============================================================================

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
    registerUrl: '#'
  },
  {
    date: '2026-10-06',
    type: 'training',
    topic: 'export-readiness',
    title: 'Export documentation — what a shipment needs',
    short: 'Export documentation',
    description: 'Certificates of origin, phytosanitary certificates, packing lists, and the customs declaration. One day, hands on, with the real forms.',
    province: 'Kabul',
    place: 'Kabul centre',
    time: '09:00–15:00',
    language: 'Dari and Pashto',
    price: 'Free',
    capacity: 15,
    registered: 15,
    registerUrl: '#',
    waitlistUrl: '#'
  },
  {
    date: '2026-10-15',
    type: 'deadline',
    title: 'Quarterly business tax filing deadline',
    short: 'Tax filing deadline'
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
    registerUrl: '#'
  },
  {
    date: '2026-11-02',
    type: 'training',
    topic: 'finance',
    title: 'Keeping books a lender will accept',
    short: 'Keeping books for lenders',
    description: 'Three half-days. What records to keep, how to show cash flow, and how to put together the pack banks ask for. Bring your own figures if you have them.',
    province: 'Nangarhar',
    place: 'Jalalabad · ACCI branch',
    time: 'Three mornings',
    language: 'Pashto',
    price: 'Free',
    registerUrl: '#'
  }
];
