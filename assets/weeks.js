/*
 * Week arithmetic for the week calendar under the calculator.
 *
 * A pregnancy runs from day 0 (0+0, 280 days before the due date) to the due
 * date at 40+0. Every date here is a moment at midnight UTC, like the dates in
 * calc.js, so day counts never drift across a daylight saving change.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./vendor/moment-2.30.1.min.js"), require("./calc.js"));
	} else {
		root.GAWeeks = factory(root.moment, root.GACalc);
	}
})(typeof self !== "undefined" ? self : this, function (moment, GACalc) {
	"use strict";

	var TERM_DAYS = GACalc.TERM_DAYS;

	// The calendars run to 42+6, the end of the last week a pregnancy is usually allowed.
	var LAST_WEEK = 42;

	// Trimesters as ACOG defines them: the second starts at 14+0, the third at 28+0.
	var TRIMESTERS = [
		{ number: 1, from: 0, name: "First trimester" },
		{ number: 2, from: 14 * 7, name: "Second trimester" },
		{ number: 3, from: 28 * 7, name: "Third trimester" },
	];

	var MILESTONES = [
		{ days: 14 * 7, label: "Second trimester" },
		{ days: 28 * 7, label: "Third trimester" },
		{ days: 37 * 7, label: "Term" },
		{ days: 40 * 7, label: "Due date" },
		{ days: 42 * 7, label: "42 weeks" },
	];

	// The pregnancy behind the calculator's values, or null when they do not
	// pin one down. `values` is the detail of the page's "ga:values" event.
	// The focus is the calculation date when there is one, otherwise today.
	function pregnancy(values, now) {
		if (!values) {
			return null;
		}
		var edd = values.edd;
		if (!edd && values.date && values.gaDays != null) {
			edd = values.date.clone().add(TERM_DAYS - values.gaDays, "days");
		}
		if (!edd) {
			return null;
		}
		edd = edd.clone();
		var start = edd.clone().subtract(TERM_DAYS, "days");
		var today = GACalc.localToday(now);
		var focus = values.date ? values.date.clone() : today.clone();
		return {
			start: start,
			edd: edd,
			today: today,
			todayDays: today.diff(start, "days"),
			focus: focus,
			focusDays: focus.diff(start, "days"),
			// True when there is no calculation date and the focus is today.
			focusIsToday: !values.date,
		};
	}

	// Days since 0+0 on `date`. Negative before the pregnancy began.
	function daysOn(p, date) {
		return date.diff(p.start, "days");
	}

	function dateOf(p, days) {
		return p.start.clone().add(days, "days");
	}

	function weekOf(days) {
		return Math.floor(days / 7);
	}

	// "24+3". Only meaningful for days >= 0.
	function label(days) {
		return Math.floor(days / 7) + "+" + (days % 7);
	}

	function trimester(days) {
		if (days < 0) {
			return null;
		}
		for (var i = TRIMESTERS.length - 1; i >= 0; i--) {
			if (days >= TRIMESTERS[i].from) {
				return TRIMESTERS[i];
			}
		}
		return null;
	}

	// The milestone that falls inside week `week`, if any.
	function milestoneInWeek(week) {
		for (var i = 0; i < MILESTONES.length; i++) {
			if (weekOf(MILESTONES[i].days) === week) {
				return MILESTONES[i];
			}
		}
		return null;
	}

	function sameDay(a, b) {
		return !!a && !!b && a.isSame(b, "day");
	}

	// "3 Jul", or "3 Jul 2027" when `withYear` is set.
	function shortDate(date, withYear) {
		return date.format(withYear ? "D MMM YYYY" : "D MMM");
	}

	// "29 Jun to 5 Jul". The year is added to the end, and to the start when it differs.
	function range(from, to, withYear) {
		var split = from.year() !== to.year();
		return shortDate(from, withYear && split) + " to " + shortDate(to, withYear);
	}

	// "Thursday", the weekday every pregnancy week starts on.
	function weekdayName(p) {
		return p.start.format("dddd");
	}

	return {
		TERM_DAYS: TERM_DAYS,
		LAST_WEEK: LAST_WEEK,
		TRIMESTERS: TRIMESTERS,
		MILESTONES: MILESTONES,
		pregnancy: pregnancy,
		daysOn: daysOn,
		dateOf: dateOf,
		weekOf: weekOf,
		label: label,
		trimester: trimester,
		milestoneInWeek: milestoneInWeek,
		sameDay: sameDay,
		shortDate: shortDate,
		range: range,
		weekdayName: weekdayName,
	};
});
