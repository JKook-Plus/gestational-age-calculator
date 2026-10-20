// Run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/calc.js");
const W = require("../assets/weeks.js");

// Pinned like calc.test.js: 20 October 2026, 00:16 local time, so UTC is still
// the 19th in any timezone east of Greenwich.
const NOW = new Date(2026, 9, 20, 0, 16);
// 23:44 local time on the same day, so UTC is already the 21st west of Greenwich.
const LATE = new Date(2026, 9, 20, 23, 44);

const day = (text) => C.parseDate(text, "date", NOW).date;
const iso = (m) => m.format("YYYY-MM-DD");
const month = (text) => W.monthNumber(day(text));

test("a due date and a calculation date pin down the pregnancy", () => {
	const p = W.pregnancy({ edd: day("18/02/2027"), date: day("20/10/2026"), gaDays: null }, NOW);
	assert.equal(iso(p.start), "2026-05-14");
	assert.equal(p.start.format("dddd"), "Thursday");
	assert.equal(p.focusDays, 159);
	assert.equal(W.label(p.focusDays), "22+5");
	assert.equal(W.weekOf(p.focusDays), 22);
	assert.equal(W.trimester(p.focusDays).number, 2);
	assert.equal(p.focusIsToday, false);
	assert.equal(W.range(W.dateOf(p, 154), W.dateOf(p, 160), true), "15 Oct to 21 Oct 2026");
});

test("a calculation date and a gestational age give the due date", () => {
	const p = W.pregnancy({ edd: null, date: day("20/10/2026"), gaDays: 159 }, NOW);
	assert.equal(iso(p.edd), "2027-02-18");
	assert.equal(iso(p.start), "2026-05-14");
});

test("with all three values, as the page sends after working one out, the due date wins", () => {
	// The page never sends a mismatch; a deliberate one shows which value is trusted.
	const p = W.pregnancy({ edd: day("18/02/2027"), date: day("20/10/2026"), gaDays: 10 }, NOW);
	assert.equal(iso(p.start), "2026-05-14");
	assert.equal(p.focusDays, 159);
});

test("without a calculation date the focus is today, on the local calendar day", () => {
	for (const now of [NOW, LATE]) {
		const p = W.pregnancy({ edd: day("18/02/2027"), date: null, gaDays: null }, now);
		assert.equal(p.focusIsToday, true);
		assert.equal(iso(p.focus), "2026-10-20");
		assert.equal(iso(p.today), "2026-10-20");
		assert.equal(p.focusDays, 159);
	}
});

test("today is right on the morning the clocks go forward", () => {
	// 03:30 on 4 October 2026, the first hour of daylight saving in Sydney.
	const p = W.pregnancy({ edd: day("18/02/2027"), date: null, gaDays: null }, new Date(2026, 9, 4, 3, 30));
	assert.equal(iso(p.today), "2026-10-04");
	assert.equal(p.focusDays, 143);
});

test("values that do not pin down a pregnancy give null", () => {
	assert.equal(W.pregnancy(null, NOW), null);
	assert.equal(W.pregnancy({ edd: null, date: null, gaDays: 100 }, NOW), null);
	assert.equal(W.pregnancy({ edd: null, date: day("20/10/2026"), gaDays: null }, NOW), null);
});

test("a date before the pregnancy has a negative day count and no trimester", () => {
	const p = W.pregnancy({ edd: day("18/02/2027"), date: day("01/05/2026"), gaDays: null }, NOW);
	assert.equal(p.focusDays, -13);
	assert.equal(W.weekOf(p.focusDays), -2);
	assert.equal(W.trimester(p.focusDays), null);
});

test("a date after 42+6 is past the last day the calendar counts", () => {
	const p = W.pregnancy({ edd: day("18/02/2027"), date: day("01/04/2027"), gaDays: null }, NOW);
	assert.equal(W.LAST_DAY, 300);
	assert.equal(W.label(W.LAST_DAY), "42+6");
	assert.equal(p.focusDays, 322);
	assert.ok(p.focusDays > W.LAST_DAY);
});

test("trimesters change at 14+0 and 28+0", () => {
	assert.equal(W.trimester(0).number, 1);
	assert.equal(W.trimester(13 * 7 + 6).number, 1);
	assert.equal(W.trimester(14 * 7).number, 2);
	assert.equal(W.trimester(27 * 7 + 6).number, 2);
	assert.equal(W.trimester(28 * 7).number, 3);
	assert.equal(W.trimester(42 * 7 + 6).number, 3);
});

test("milestones fall on their own days", () => {
	assert.equal(W.milestoneOn(14 * 7).label, "Second trimester");
	assert.equal(W.milestoneOn(28 * 7).label, "Third trimester");
	assert.equal(W.milestoneOn(37 * 7).label, "Term");
	assert.equal(W.milestoneOn(40 * 7).label, "Due date");
	assert.equal(W.milestoneOn(42 * 7).label, "42 weeks");
	assert.equal(W.milestoneOn(14 * 7 + 1), null);
});

test("labels and dates round-trip", () => {
	const p = W.pregnancy({ edd: day("18/02/2027"), date: day("20/10/2026"), gaDays: null }, NOW);
	assert.equal(W.label(0), "0+0");
	assert.equal(W.label(279), "39+6");
	assert.equal(W.label(280), "40+0");
	for (const days of [0, 1, 97, 98, 159, 280, 300]) {
		assert.equal(W.daysOn(p, W.dateOf(p, days)), days);
	}
	assert.equal(iso(W.dateOf(p, W.TERM_DAYS)), "2027-02-18");
});

test("the whole-pregnancy view spans 0+0 to 42+6 and takes in a focus close by", () => {
	const edd = day("18/02/2027");
	const span = (date) => W.monthRange(W.pregnancy({ edd: edd, date: date ? day(date) : null, gaDays: null }, NOW));
	// 0+0 is 14 May 2026 and 42+6 is 10 March 2027.
	assert.deepEqual(span("20/10/2026"), { first: month("01/05/2026"), last: month("01/03/2027") });
	// A date past 42 weeks, within six months, adds its month.
	assert.deepEqual(span("15/09/2027"), { first: month("01/05/2026"), last: month("01/09/2027") });
	// One before the pregnancy, within six months, too.
	assert.deepEqual(span("20/11/2025"), { first: month("01/11/2025"), last: month("01/03/2027") });
	// Further away it is left out.
	assert.deepEqual(span("20/10/2027"), { first: month("01/05/2026"), last: month("01/03/2027") });
});

test("ranges add the year at the end, and at the start when it differs", () => {
	assert.equal(W.range(day("15/10/2026"), day("21/10/2026"), false), "15 Oct to 21 Oct");
	assert.equal(W.range(day("15/10/2026"), day("21/10/2026"), true), "15 Oct to 21 Oct 2026");
	assert.equal(W.range(day("28/12/2026"), day("03/01/2027"), true), "28 Dec 2026 to 3 Jan 2027");
	assert.equal(W.shortDate(day("03/07/2027"), true), "3 Jul 2027");
});
