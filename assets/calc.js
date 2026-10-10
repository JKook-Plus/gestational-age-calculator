/*
 * Parsing and arithmetic for the gestational age calculator.
 *
 * Nothing in here touches the page, so the same file runs in the browser
 * (as window.GACalc) and under Node for the tests in /tests.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./vendor/moment-2.30.1.min.js"));
	} else {
		root.GACalc = factory(root.moment);
	}
})(typeof self !== "undefined" ? self : this, function (moment) {
	"use strict";

	// A pregnancy is dated as 40 weeks from week 0 to the estimated due date.
	var TERM_DAYS = 40 * 7;
	// Results past this are still shown, with a warning.
	var WARN_ABOVE_DAYS = 44 * 7;
	// A due date typed without a year stays in the past only if it passed this recently.
	var YEARLESS_LOOKBACK_DAYS = 8 * 7;

	var DATE_FORMATS = [
		"DD/MM/YYYY", // 03/07/2024
		"DD/MM/YY", // 03/07/24
		"DD/MM", // 03/07
		"D/MM/YYYY", // 3/07/2024
		"D/MM/YY", // 3/07/24
		"D/MM", // 3/07
		"DD/M/YYYY", // 03/7/2024
		"DD/M/YY", // 03/7/24
		"DD/M", // 03/7
		"D/M/YYYY", // 3/7/2024
		"D/M/YY", // 3/7/24
		"D/M", // 3/7
		"YYYY/MM/DD", // 2024/07/03
		"YY/MM/DD", // 24/07/03
		"DD-MMM-YYYY", // 03-Jul-2024
		"D-MMM-YYYY", // 3-Jul-2024
		"MMMM DD YYYY", // July 03 2024
		"MMM DD YYYY", // Jul 03 2024
		"MMM D YYYY", // Jul 3 2024
		"MMMM, D YYYY", // July, 3 2024
		"MMMM D, YYYY", // July 3, 2024
		"MMM DD, YYYY", // Jul 03, 2024
		"MMM D, YYYY", // Jul 3, 2024
		"DD MMMM YYYY", // 03 July 2024
		"DD MMMM", // 03 July
		"D MMMM YYYY", // 3 July 2024
		"DD MMM YYYY", // 03 Jul 2024
		"DD MMM", // 03 Jul
		"D MMM", // 3 Jul
		"DDMMM", // 03Jul
		"DD, MMM", // 03, Jul
		"DD,MMM", // 03,Jul
		"DD MMM YY", // 03 Jul 24
		"DMMM", // 3Jul
		"D, MMM", // 3, Jul
		"D,MMM", // 3,Jul
		"D MMM YY", // 3 Jul 24
		"D MMM YYYY", // 3 Jul 2024
		"YYYY-MM-DD", // 2024-07-03
		"MMM DD", // Jul 03
		"MMM D", // Jul 3
		"MMMM DD", // July 03
		"MMMM D", // July 3
		"DD.MM.YYYY", // 03.07.2024
		"DD.MM.YY", // 03.07.24
		"DD.MM", // 03.07
		"D.M.YY", // 3.7.24
		"D.M.YYYY", // 3.7.2024
		"DD MMMM, YYYY", // 03 July, 2024
		"D MMMM, YYYY", // 3 July, 2024
		"MMM DD, YY", // Jul 03, 24
		"DDMM", // 0307
		"DD MM", // 03 07
		"D MM", // 3 07
		"DD M", // 03 7
		"D M", // 3 7
		"DDMMYY", // 030724
		"DDMMYYYY", // 03072024
		"DDMM YY", // 0307 24
		"DDMM YYYY", // 0307 2024
		"DD MM YY", // 03 07 24
		"DD MM YYYY", // 03 07 2024
		"D MMYY", // 3 07 24
		"D MMYYYY", // 3 07 2024
		"DD M YY", // 03 7 24
		"DD M YYYY", // 03 7 2024
		"D M YY", // 3 7 24
		"D M YYYY", // 3 7 2024
	];

	var YEARLESS_FORMATS = DATE_FORMATS.filter(function (format) {
		return !/Y/.test(format);
	});
	// The same formats with an explicit year appended, so a candidate year can be tried.
	var YEARLESS_WITH_YEAR = YEARLESS_FORMATS.map(function (format) {
		return format + "|YYYY";
	});

	// The user's local calendar day (not the UTC day), normalised to midnight
	// UTC like every parsed date.
	function localToday(now) {
		var local = now ? moment(now) : moment();
		return moment.utc(local.format("YYYY-MM-DD"), "YYYY-MM-DD", true);
	}

	// "t", "t+3", "w+3", "m+3", "y+3". Anchored so date text like "May+2"
	// can't be misread as a shortcut.
	function parseShortcut(text, today) {
		if (/^t$/i.test(text)) {
			return today.clone();
		}
		var match = /^([twmy])\+(\d+)$/i.exec(text);
		if (!match) {
			return null;
		}
		var unit = { t: "days", w: "weeks", m: "months", y: "years" }[match[1].toLowerCase()];
		return today.clone().add(Number(match[2]), unit);
	}

	// Picks the year for a date typed without one.
	//   role "edd":  the next occurrence, unless it passed in the last 8 weeks.
	//   role "date": the occurrence closest to today.
	function resolveYearless(text, role, today) {
		var year = today.year();
		var candidates = [year - 1, year, year + 1]
			.map(function (candidateYear) {
				return moment.utc(text + "|" + candidateYear, YEARLESS_WITH_YEAR, true);
			})
			.filter(function (candidate) {
				return candidate.isValid();
			});
		if (!candidates.length) {
			return null;
		}

		if (role === "edd") {
			var earliest = today.clone().subtract(YEARLESS_LOOKBACK_DAYS, "days");
			for (var i = 0; i < candidates.length; i++) {
				if (!candidates[i].isBefore(earliest)) {
					return candidates[i];
				}
			}
			return candidates[candidates.length - 1];
		}

		return candidates.reduce(function (best, candidate) {
			return Math.abs(candidate.diff(today)) < Math.abs(best.diff(today)) ? candidate : best;
		});
	}

	// Reads a date field. `role` is "edd" or "date"; `now` is only passed by tests.
	// Returns { empty, ok, date, relative, yearless } where `date` is a moment at
	// midnight UTC, `relative` marks a shortcut that moves with the calendar, and
	// `yearless` marks a date whose year was chosen for the user.
	function parseDate(text, role, now) {
		var result = { empty: true, ok: false, date: null, relative: false, yearless: false };
		if (typeof text !== "string") {
			return result;
		}
		text = text.trim();
		if (text === "") {
			return result;
		}
		result.empty = false;

		var today = localToday(now);
		var shortcut = parseShortcut(text, today);
		if (shortcut) {
			result.relative = true;
			result.ok = shortcut.isValid();
			result.date = result.ok ? shortcut : null;
			return result;
		}

		var parsed = moment.utc(text, DATE_FORMATS, true);
		if (parsed.isValid() && /Y/.test(parsed.creationData().format)) {
			result.ok = true;
			result.date = parsed;
			return result;
		}

		var resolved = resolveYearless(text, role, today);
		if (resolved) {
			result.ok = true;
			result.yearless = true;
			result.date = resolved;
		}
		return result;
	}

	// Reads a gestational age. Returns { empty, ok, days }.
	// Accepts 39+2, 39+2/40, 39/40, 39+2 days, 39w2d, 39 weeks 2 days, 39w 2 and "39 2".
	// The days part must be 0-6 and the only denominator accepted is /40.
	function parseGA(text) {
		var result = { empty: true, ok: false, days: null };
		if (typeof text !== "string") {
			return result;
		}
		text = text.trim();
		if (text === "") {
			return result;
		}
		result.empty = false;

		var match =
			/^(\d{1,3})\s*(?:\+\s*(\d{1,2})\s*(?:d|days?)?)?\s*(?:\/\s*40)?$/i.exec(text) ||
			/^(\d{1,3})\s*w(?:eeks?)?(?:\s*(?:and\s*)?(\d{1,2})\s*(?:d(?:ays?)?)?)?$/i.exec(text) ||
			/^(\d{1,3})\s+(\d{1,2})$/.exec(text);
		if (!match) {
			return result;
		}

		var weeks = parseInt(match[1], 10);
		var days = match[2] ? parseInt(match[2], 10) : 0;
		if (days > 6) {
			return result;
		}
		result.ok = true;
		result.days = weeks * 7 + days;
		return result;
	}

	// Works out the missing value. `output` is "edd", "date" or "ga"; `values`
	// holds the other two as { edd, date, gaDays }.
	// Returns { ok, edd, date, gaDays, flag } where flag is
	//   "ok", "warn" (past 44 weeks, or the dates are over a year apart), or
	//   "before" (the date is before week 0, so there is no gestational age).
	function solve(output, values) {
		var result = { ok: false, edd: values.edd || null, date: values.date || null, gaDays: values.gaDays == null ? null : values.gaDays, flag: "ok" };

		if (output === "ga") {
			if (!result.edd || !result.date) {
				return result;
			}
			result.gaDays = TERM_DAYS - Math.round(result.edd.diff(result.date, "days", true));
		} else if (output === "edd") {
			if (!result.date || result.gaDays == null) {
				return result;
			}
			result.edd = result.date.clone().add(TERM_DAYS - result.gaDays, "days");
		} else {
			if (!result.edd || result.gaDays == null) {
				return result;
			}
			result.date = result.edd.clone().subtract(TERM_DAYS - result.gaDays, "days");
		}

		result.ok = true;
		if (result.gaDays < 0) {
			result.flag = "before";
		} else if (result.gaDays > WARN_ABOVE_DAYS || Math.abs(result.edd.diff(result.date, "days")) > 366) {
			result.flag = "warn";
		}
		return result;
	}

	function formatGA(days) {
		var weeks = Math.floor(days / 7);
		var rest = days % 7;
		return weeks + (weeks === 1 ? " week " : " weeks ") + rest + (rest === 1 ? " day" : " days");
	}

	function formatGAShort(days) {
		return Math.floor(days / 7) + "+" + (days % 7) + "/40";
	}

	function formatDate(date) {
		return date.format("DD/MM/YYYY");
	}

	// The calendar widget hands over plain Date objects at midnight UTC.
	function fromJSDate(date) {
		return moment.utc(date);
	}

	function formatDateLong(date) {
		return date.format("MMMM DD YYYY");
	}

	return {
		TERM_DAYS: TERM_DAYS,
		WARN_ABOVE_DAYS: WARN_ABOVE_DAYS,
		DATE_FORMATS: DATE_FORMATS,
		localToday: localToday,
		parseDate: parseDate,
		parseGA: parseGA,
		solve: solve,
		formatGA: formatGA,
		formatGAShort: formatGAShort,
		formatDate: formatDate,
		fromJSDate: fromJSDate,
		formatDateLong: formatDateLong,
	};
});
