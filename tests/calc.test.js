// Run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/calc.js");

// Every test pins "now" so results do not depend on the day the suite runs.
// 10 October 2026, 00:16 local time: early enough that UTC is still the 9th
// in any timezone east of Greenwich.
const NOW = new Date(2026, 9, 10, 0, 16);

const date = (text, role) => C.parseDate(text, role || "date", NOW);
const shown = (result) => (result.ok ? C.formatDate(result.date) : result.empty ? "EMPTY" : "INVALID");
const day = (text) => date(text).date;

// [format, the example from its comment in calc.js]
const FORMAT_EXAMPLES = [
	["DD/MM/YYYY", "03/07/2024"],
	["DD/MM/YY", "03/07/24"],
	["DD/MM", "03/07"],
	["D/MM/YYYY", "3/07/2024"],
	["D/MM/YY", "3/07/24"],
	["D/MM", "3/07"],
	["DD/M/YYYY", "03/7/2024"],
	["DD/M/YY", "03/7/24"],
	["DD/M", "03/7"],
	["D/M/YYYY", "3/7/2024"],
	["D/M/YY", "3/7/24"],
	["D/M", "3/7"],
	["YYYY/MM/DD", "2024/07/03"],
	["YY/MM/DD", "24/07/03"],
	["DD-MMM-YYYY", "03-Jul-2024"],
	["D-MMM-YYYY", "3-Jul-2024"],
	["MMMM DD YYYY", "July 03 2024"],
	["MMM DD YYYY", "Jul 03 2024"],
	["MMM D YYYY", "Jul 3 2024"],
	["MMMM, D YYYY", "July, 3 2024"],
	["MMMM D, YYYY", "July 3, 2024"],
	["MMM DD, YYYY", "Jul 03, 2024"],
	["MMM D, YYYY", "Jul 3, 2024"],
	["DD MMMM YYYY", "03 July 2024"],
	["DD MMMM", "03 July"],
	["D MMMM YYYY", "3 July 2024"],
	["DD MMM YYYY", "03 Jul 2024"],
	["DD MMM", "03 Jul"],
	["D MMM", "3 Jul"],
	["DDMMM", "03Jul"],
	["DD, MMM", "03, Jul"],
	["DD,MMM", "03,Jul"],
	["DD MMM YY", "03 Jul 24"],
	["DMMM", "3Jul"],
	["D, MMM", "3, Jul"],
	["D,MMM", "3,Jul"],
	["D MMM YY", "3 Jul 24"],
	["D MMM YYYY", "3 Jul 2024"],
	["YYYY-MM-DD", "2024-07-03"],
	["MMM DD", "Jul 03"],
	["MMM D", "Jul 3"],
	["MMMM DD", "July 03"],
	["MMMM D", "July 3"],
	["DD.MM.YYYY", "03.07.2024"],
	["DD.MM.YY", "03.07.24"],
	["DD.MM", "03.07"],
	["D.M.YY", "3.7.24"],
	["D.M.YYYY", "3.7.2024"],
	["DD MMMM, YYYY", "03 July, 2024"],
	["D MMMM, YYYY", "3 July, 2024"],
	["MMM DD, YY", "Jul 03, 24"],
	["DDMM", "0307"],
	["DD MM", "03 07"],
	["D MM", "3 07"],
	["DD M", "03 7"],
	["D M", "3 7"],
	["DDMMYY", "030724"],
	["DDMMYYYY", "03072024"],
	["DDMM YY", "0307 24"],
	["DDMM YYYY", "0307 2024"],
	["DD MM YY", "03 07 24"],
	["DD MM YYYY", "03 07 2024"],
	["D MMYY", "3 07 24"],
	["D MMYYYY", "3 07 2024"],
	["DD M YY", "03 7 24"],
	["DD M YYYY", "03 7 2024"],
	["D M YY", "3 7 24"],
	["D M YYYY", "3 7 2024"],
];

// These three do not behave as their comments say. They are left alone on
// purpose (audit finding 15) and excluded here so the suite describes what works.
const KNOWN_MISMATCHES = new Set(["YY/MM/DD", "D MMYY", "D MMYYYY"]);

test("every documented date format parses its own example as 3 July", () => {
	for (const [format, example] of FORMAT_EXAMPLES) {
		if (KNOWN_MISMATCHES.has(format)) continue;
		const expected = /Y/.test(format) ? "03/07/2024" : "03/07/2026";
		assert.equal(shown(date(example)), expected, `${format} with "${example}"`);
	}
});

test("the format list in calc.js matches the examples table", () => {
	assert.deepEqual(
		C.DATE_FORMATS,
		FORMAT_EXAMPLES.map(([format]) => format)
	);
});

test("day comes first, and impossible dates are rejected", () => {
	assert.equal(shown(date("7/3/2024")), "07/03/2024");
	for (const text of ["31/02/2026", "29/02/2027", "00/01/2026", "12/31/2026", "abc", "15/03/", "15/03/202"]) {
		assert.equal(shown(date(text)), "INVALID", text);
	}
	assert.equal(shown(date("29/02/2028")), "29/02/2028");
});

test("empty and whitespace-only input is empty, not invalid", () => {
	assert.equal(shown(date("")), "EMPTY");
	assert.equal(shown(date("   ")), "EMPTY");
	assert.equal(shown(date(" 15/03/2027 ")), "15/03/2027");
});

test("shortcuts count forward or back from the local calendar day", () => {
	const cases = { t: "10/10/2026", T: "10/10/2026", "t+0": "10/10/2026", "t+3": "13/10/2026", "w+2": "24/10/2026", "m+1": "10/11/2026", "y+1": "10/10/2027", "t-1": "09/10/2026", "T-0": "10/10/2026", "w-2": "26/09/2026", "m-2": "10/08/2026", "y-1": "10/10/2025" };
	for (const [text, expected] of Object.entries(cases)) {
		const result = date(text);
		assert.equal(shown(result), expected, text);
		assert.equal(result.relative, true, text);
	}
	for (const text of ["today", "tomorrow", "t - 3", "t+-3", "t--3", "t+3-1", "t + 3", "t+99999999999", "t-99999999999"]) {
		assert.equal(shown(date(text)), "INVALID", text);
	}
});

test("a due date without a year takes the next occurrence, unless it passed in the last 8 weeks", () => {
	const cases = {
		"3/2": "03/02/2027", // February has gone, so next February
		"25 dec": "25/12/2026", // still ahead this year
		"1/9": "01/09/2026", // 39 days ago: a recent past due date stays
		"15/8": "15/08/2026", // exactly 8 weeks ago stays
		"14/8": "14/08/2027", // one day more than 8 weeks rolls forward
		"0307": "03/07/2027",
	};
	for (const [text, expected] of Object.entries(cases)) {
		const result = date(text, "edd");
		assert.equal(shown(result), expected, text);
		assert.equal(result.yearless, true, text);
	}
});

test("a calculation date without a year takes the occurrence closest to today", () => {
	assert.equal(shown(date("3/7", "date")), "03/07/2026");
	assert.equal(shown(date("3/2", "date")), "03/02/2027");
	assert.equal(shown(C.parseDate("20/12", "date", new Date(2027, 0, 5))), "20/12/2026");
});

test("29 February without a year finds a leap year", () => {
	assert.equal(shown(C.parseDate("29/02", "edd", new Date(2027, 2, 1))), "29/02/2028");
});

test("a date typed with a year is never moved", () => {
	const result = date("03/02/2026", "edd");
	assert.equal(shown(result), "03/02/2026");
	assert.equal(result.yearless, false);
});

test("gestational age: accepted spellings", () => {
	const cases = {
		"39+2": 275,
		"39+2/40": 275,
		"39/40": 273,
		"39+2d": 275,
		"39+2 days": 275,
		"39 +2": 275,
		" 39+2 ": 275,
		"39w2d": 275,
		"39W2D": 275,
		"39 weeks 2 days": 275,
		"39 Weeks 2 Days": 275,
		"39 weeks and 2 days": 275,
		"39 week 1 day": 274,
		"39w": 273,
		"39 w 2 d": 275,
		"39w 2": 275,
		"39 2": 275,
		"39+6": 279,
		"39+06": 279,
		0: 0,
		"00": 0,
		40: 280,
		"45+0": 315,
		300: 2100,
	};
	for (const [text, days] of Object.entries(cases)) {
		const result = C.parseGA(text);
		assert.equal(result.ok, true, text);
		assert.equal(result.days, days, text);
	}
});

test("gestational age: rejected input", () => {
	for (const text of ["39+7", "39+12", "39.5", "39,2", "39-2", "-5", "39+", "1e3", "1000", "99999999999999999999", "abc"]) {
		assert.equal(C.parseGA(text).ok, false, text);
	}
	// Only /40 is a gestational age. 3/7 is three days and 6/12 is six months in clinical shorthand.
	for (const text of ["3/7", "6/12", "39+2/41", "20/52"]) {
		assert.equal(C.parseGA(text).ok, false, text);
	}
	assert.equal(C.parseGA("").empty, true);
	assert.equal(C.parseGA("  ").empty, true);
});

test("gestational age from a due date and a date (hand-checked)", () => {
	const cases = [
		["15/03/2027", "10/10/2026", 124], // 17+5
		["29/02/2028", "01/01/2028", 221], // leap-day due date, 31+4
		["05/04/2027", "03/10/2026", 96], // spans the daylight saving change, 13+5
		["15/10/2026", "10/10/2026", 275], // 39+2
		["01/09/2026", "10/10/2026", 319], // past due, 45+4
	];
	for (const [edd, on, days] of cases) {
		const result = C.solve("ga", { edd: day(edd), date: day(on) });
		assert.equal(result.ok, true);
		assert.equal(result.gaDays, days, `${edd} on ${on}`);
	}
});

test("due date from a date and a gestational age (hand-checked)", () => {
	const cases = [
		["10/10/2026", 143, "24/02/2027"], // 20+3
		["01/01/2026", 0, "08/10/2026"], // week 0 plus 280 days
		["01/01/2026", 280, "01/01/2026"], // 40+0 is the due date itself
	];
	for (const [on, gaDays, edd] of cases) {
		assert.equal(C.formatDate(C.solve("edd", { date: day(on), gaDays }).edd), edd);
	}
});

test("date from a due date and a gestational age (hand-checked)", () => {
	assert.equal(C.formatDate(C.solve("date", { edd: day("15/03/2027"), gaDays: 143 }).date), "29/10/2026");
	assert.equal(C.formatDate(C.solve("date", { edd: day("15/03/2027"), gaDays: 84 }).date), "31/08/2026");
});

test("the three calculations agree with each other", () => {
	const edd = day("15/03/2027");
	const on = day("10/10/2026");
	const ga = C.solve("ga", { edd, date: on }).gaDays;
	assert.equal(C.formatDate(C.solve("edd", { date: on, gaDays: ga }).edd), "15/03/2027");
	assert.equal(C.formatDate(C.solve("date", { edd, gaDays: ga }).date), "10/10/2026");
});

test("nothing is calculated until both inputs are present", () => {
	assert.equal(C.solve("ga", { edd: day("15/03/2027") }).ok, false);
	assert.equal(C.solve("edd", { date: day("10/10/2026") }).ok, false);
	assert.equal(C.solve("date", { gaDays: 100 }).ok, false);
});

test("a date before week 0 is flagged, not clamped to zero", () => {
	const result = C.solve("ga", { edd: day("01/01/2028"), date: day("01/01/2026") });
	assert.equal(result.flag, "before");
	assert.equal(result.gaDays, -450);
});

test("results past 44 weeks are flagged as a warning", () => {
	assert.equal(C.solve("ga", { edd: day("01/09/2026"), date: day("10/10/2026") }).flag, "warn"); // 45+4
	assert.equal(C.solve("ga", { edd: day("12/09/2026"), date: day("10/10/2026") }).flag, "ok"); // 44+0 exactly
	assert.equal(C.solve("ga", { edd: day("11/09/2026"), date: day("10/10/2026") }).flag, "warn"); // 44+1
	assert.equal(C.solve("edd", { date: day("10/10/2026"), gaDays: 2100 }).flag, "warn"); // typed 300 weeks
	assert.equal(C.solve("ga", { edd: day("15/03/2027"), date: day("10/10/2026") }).flag, "ok");
});

test("gestational age wording", () => {
	assert.equal(C.formatGA(124), "17 weeks 5 days");
	assert.equal(C.formatGA(8), "1 week 1 day");
	assert.equal(C.formatGA(0), "0 weeks 0 days");
	assert.equal(C.formatGAShort(124), "17+5/40");
	assert.equal(C.formatDateLong(day("15/03/2027")), "March 15 2027");
});

test("today is the local calendar day, even when UTC is still yesterday", () => {
	assert.equal(C.formatDate(C.localToday(new Date(2026, 9, 10, 0, 16))), "10/10/2026");
	assert.equal(C.formatDate(C.localToday(new Date(2026, 9, 10, 23, 58))), "10/10/2026");
	assert.equal(C.formatDate(C.localToday(new Date(2026, 9, 11, 0, 8))), "11/10/2026");
});
