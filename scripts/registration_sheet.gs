/**
 * @OnlyCurrentDoc  Limits the script's access to this one spreadsheet.
 *
 * MSME Support Centre: registration sheet automation (Google Apps Script)
 * =============================================================================
 * Lives inside the Google Sheet that collects the registration form's
 * responses (Extensions > Apps Script). This file is the master copy; paste it
 * there. It contains no personal data, so it is safe to keep in the repository.
 *
 * What it does, automatically, every time someone submits the form:
 *   - Rebuilds the "Registrations" tab: one row per response, grouped by event
 *     in the order they arrived, each marked
 *       Registered    has a seat (numbered 1, 2, 3 ... per event)
 *       Waiting list  came in through "Join the waiting list"
 *       Duplicate     same event, and the same name or the same phone number as
 *                     someone before them; left out of the counts
 *   - The website asks this script how many seats each event has taken
 *     (doGet below) and shows "X places left" or "Full" by itself. Only event
 *     names and numbers are sent; never names, phones or answers.
 *
 * The form's own "Form Responses 1" tab is never changed.
 *
 * Install once (about 10 minutes): see the steps the Centre's website team
 * keeps with this file, or in short:
 *   1. In the response sheet: Extensions > Apps Script. Replace the editor's
 *      contents with this file. Save.
 *   2. Choose "setup" in the function list at the top, click Run, and allow
 *      the permissions it asks for.
 *   3. Deploy > New deployment > type "Web app". Execute as: Me.
 *      Who has access: Anyone. Deploy, and copy the Web app URL into
 *      site/js/events-data.js (MSME_REGISTRATION.countsUrl).
 * =============================================================================
 */

var RESPONSES_SHEET = 'Form Responses 1';   // the tab the form writes to
var OUTPUT_SHEET = 'Registrations';         // the tab this script keeps up to date
var WAITLIST_SUFFIX = ' – waiting list';    // added by the website's waiting-list link

// The start of each question's title in the form (the English part is enough)
var QUESTIONS = {
  event: 'Training / event',
  name: 'First name',
  phone: 'Phone',
  member: 'Are you a member'
};

var COLOURS = { 'Registered': '#E6F4EA', 'Waiting list': '#FEF7E0', 'Duplicate': '#FCE8E6', 'No event given': '#F1F3F4' };


/** Run once after pasting: creates the automatic trigger and the first list. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onResponse') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onResponse').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
  rebuild();
}

/** Adds a "Registrations > Rebuild list now" menu to the sheet. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Registrations').addItem('Rebuild list now', 'rebuild').addToUi();
}

/** Runs by itself after every form submission. */
function onResponse() {
  rebuild();
}


/** Writes the "Registrations" tab from all responses. */
function rebuild() {
  var entries = classify_(readResponses_());
  entries.sort(function (a, b) {
    return a.event < b.event ? -1 : a.event > b.event ? 1 : a.time - b.time;
  });

  var ss = SpreadsheetApp.getActive();
  var out = ss.getSheetByName(OUTPUT_SHEET) || ss.insertSheet(OUTPUT_SHEET);
  out.clear();
  var rows = [['Event', 'Seat', 'Status', 'Name', 'Phone', 'Member?', 'Submitted']];
  entries.forEach(function (e) {
    rows.push([e.event || '(none)', e.seat || '', e.status, e.name, e.phone, e.member, e.time]);
  });
  // Phone numbers as text (set before writing), so leading zeros and + signs survive
  if (rows.length > 1) out.getRange(2, 5, rows.length - 1, 1).setNumberFormat('@');
  out.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  out.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  out.setFrozenRows(1);
  if (rows.length > 1) {
    // All row colours in one request (one request per row gets slow as the list grows)
    out.getRange(2, 1, rows.length - 1, rows[0].length).setBackgrounds(entries.map(function (e) {
      var colour = COLOURS[e.status] || null;
      return rows[0].map(function () { return colour; });
    }));
  }
  out.autoResizeColumns(1, rows[0].length);
}


/** For the website: seats taken per event, as JSON. No personal data. */
function doGet() {
  var counts = {};
  classify_(readResponses_()).forEach(function (e) {
    if (e.status === 'Registered') counts[e.event] = (counts[e.event] || 0) + 1;
  });
  return ContentService
    .createTextOutput(JSON.stringify({ counts: counts, updated: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Helpers ─────────────────────────────────────────────────────────────────

function readResponses_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(RESPONSES_SHEET);
  if (!sheet) throw new Error('No tab called "' + RESPONSES_SHEET + '". Rename RESPONSES_SHEET at the top of the script.');
  var values = sheet.getDataRange().getValues();
  var head = values.shift().map(String);
  function col(start) {
    for (var i = 0; i < head.length; i++) if (head[i].indexOf(start) === 0) return i;
    throw new Error('No question starting with "' + start + '" in ' + RESPONSES_SHEET + '.');
  }
  var c = { event: col(QUESTIONS.event), name: col(QUESTIONS.name), phone: col(QUESTIONS.phone), member: col(QUESTIONS.member) };
  return values
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      return {
        time: r[0],
        event: String(r[c.event]).trim(),
        name: String(r[c.name]).trim(),
        phone: String(r[c.phone]).trim(),
        member: r[c.member]
      };
    });
}

// Same person = same name (ignoring capitals and extra spaces) or same phone
// number (ignoring spaces, dashes and the country code)
function nameKey_(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }
function phoneKey_(s) { var d = s.replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; }

/** Marks every response Registered / Waiting list / Duplicate, in order of arrival. */
function classify_(rows) {
  rows.sort(function (a, b) { return a.time - b.time; });
  var seen = {};    // event -> people already counted for it
  var seats = {};   // event -> seats given so far
  return rows.map(function (r) {
    var waiting = r.event.slice(-WAITLIST_SUFFIX.length) === WAITLIST_SUFFIX;
    var event = waiting ? r.event.slice(0, -WAITLIST_SUFFIX.length) : r.event;
    var nk = nameKey_(r.name), pk = phoneKey_(r.phone);
    var people = seen[event] = seen[event] || [];
    var duplicate = people.some(function (p) { return p.nk === nk || (pk && p.pk === pk); });
    var e = { time: r.time, event: event, name: r.name, phone: r.phone, member: r.member, seat: null };
    if (!event) e.status = 'No event given';
    else if (duplicate) e.status = 'Duplicate';
    else if (waiting) e.status = 'Waiting list';
    else {
      e.status = 'Registered';
      e.seat = seats[event] = (seats[event] || 0) + 1;
    }
    if (e.status !== 'Duplicate') people.push({ nk: nk, pk: pk });
    return e;
  });
}
