/*
 * The week calendar under the calculator.
 *
 * Ordinary Monday-first month grids, like the date picker's, with each day
 * tinted by trimester and the first day of every pregnancy week labelled with
 * its age ("22+0"). A settings dialog behind the gear in the header chooses
 * Off, This month (one month with arrows) or Whole pregnancy (every month
 * from 0+0 to 42+6).
 *
 * Browsing to another month is local view state. A change to the focus date
 * or the due date snaps the view back to the focus; a redraw that only moves
 * today (midnight, or the tab coming back) keeps the month being looked at.
 * The page is only ever scrolled when the user turns on Whole pregnancy or
 * asks to go to the focus, never while they type.
 */
(function () {
	"use strict";

	var W = window.GAWeeks;
	var root = document.getElementById("weekCalendar");
	if (!root || !W || !window.moment) {
		return;
	}

	var isPip = document.documentElement.classList.contains("pip");

	// The saved choice: "off" (the default), "month" or "pregnancy". Kept in
	// localStorage like the theme and followed across tabs. Storage can be
	// blocked, in which case the choice lasts until the page is closed.
	var setting = (function (key, allowed) {
		var memory = null;
		var listeners = [];

		function read() {
			try {
				return localStorage.getItem(key);
			} catch (e) {
				return memory;
			}
		}

		function get() {
			var value = read();
			return allowed.indexOf(value) === -1 ? allowed[0] : value;
		}

		window.addEventListener("storage", function (event) {
			if (event.key === key || event.key === null) {
				var value = get();
				listeners.forEach(function (listener) {
					listener(value);
				});
			}
		});

		return {
			get: get,
			set: function (value) {
				if (allowed.indexOf(value) === -1 || value === get()) {
					return;
				}
				memory = value;
				try {
					localStorage.setItem(key, value);
				} catch (e) {}
				listeners.forEach(function (listener) {
					listener(value);
				});
			},
			onChange: function (listener) {
				listeners.push(listener);
			},
		};
	})("weekCalendar", ["off", "month", "pregnancy"]);
	// 42+6, the last day the calendar counts as inside the pregnancy.
	var LAST_DAY = (W.LAST_WEEK + 1) * 7 - 1;
	var HINTS = {
		off: "No calendar under the calculator.",
		month: "One month, opening on the calculation date or today. Arrows move between months.",
		pregnancy: "Every month from 0+0 to 42+6, one after another.",
	};
	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	function $(id) {
		return document.getElementById(id);
	}

	var gear = $("wkSettingsBtn");
	var dialog = $("wkDialog");
	var hint = $("wkModeHint");
	var radios = Array.prototype.slice.call(dialog.querySelectorAll('input[name="wkMode"]'));
	var back = $("wkBack");
	var backText = $("wkBackText");
	var empty = $("wkEmpty");
	var ready = $("wkReady");
	var weekLine = $("wkWeek");
	var facts = $("wkFacts");
	var nav = $("wkNav");
	var monthTitle = $("wkMonth");
	var months = $("wkMonths");
	var legend = $("wkLegend");
	var status = $("wkStatus");
	var prevBtn = root.querySelector("[data-wk-prev]");
	var nextBtn = root.querySelector("[data-wk-next]");

	var values = window.GAPage && window.GAPage.values ? window.GAPage.values() : null;
	// What the focus depends on. When it changes the view snaps back to the focus.
	var focusKey = null;
	// The month being looked at in "This month", as year * 12 + month, or null to follow the focus.
	var view = null;
	var bounds = null;
	var focusMonth = null;
	// Set when the user picks Whole pregnancy: the focus month is scrolled into view once the dialog closes.
	var scrollPending = false;

	// Monday first, like the date picker.
	var WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
	var WEEKDAY_HEAD = WEEKDAYS.map(function (day) {
		var m = window.moment.utc().day(day);
		return '<th scope="col"><span aria-hidden="true">' + m.format("dd") + '</span><span class="wk-sr">' + m.format("dddd") + "</span></th>";
	}).join("");

	// ---- Dates ----

	function monthNumber(date) {
		return date.year() * 12 + date.month();
	}

	function monthStart(number) {
		return window.moment.utc([Math.floor(number / 12), number % 12, 1]);
	}

	function iso(date) {
		return date.format("YYYY-MM-DD");
	}

	function keyOf(p) {
		return p ? iso(p.edd) + "|" + (p.focusIsToday ? "today" : iso(p.focus)) : null;
	}

	function count(n, word) {
		return n + " " + word + (n === 1 ? "" : "s");
	}

	// "22 weeks 5 days", the form used in day names.
	function gaWords(days) {
		return count(Math.floor(days / 7), "week") + " " + count(days % 7, "day");
	}

	// "17 weeks 2 days", "3 days" or "6 weeks", for a span of time.
	function spanWords(days) {
		var weeks = Math.floor(days / 7);
		var rest = days % 7;
		if (!weeks) {
			return count(rest, "day");
		}
		return rest ? count(weeks, "week") + " " + count(rest, "day") : count(weeks, "week");
	}

	function longDate(date) {
		return date.format("dddd D MMMM YYYY");
	}

	function milestoneOn(days) {
		for (var i = 0; i < W.MILESTONES.length; i++) {
			if (W.MILESTONES[i].days === days) {
				return W.MILESTONES[i];
			}
		}
		return null;
	}

	// ---- Drawing ----

	function dayHtml(p, date) {
		var days = W.daysOn(p, date);
		var inside = days >= 0 && days <= LAST_DAY;
		var isFocus = W.sameDay(date, p.focus);
		var isToday = W.sameDay(date, p.today);
		var isDue = days === W.TERM_DAYS;
		var weekStart = inside && days % 7 === 0;
		var milestone = inside ? milestoneOn(days) : null;

		var classes = "wk-day";
		classes += inside ? " is-t" + W.trimester(days).number : " is-out";
		classes += weekStart ? " is-wstart" : "";
		classes += isFocus ? " is-focus" : "";
		classes += isToday ? " is-today" : "";
		classes += isDue ? " is-due" : "";

		var name = [longDate(date)];
		if (inside) {
			name.push(gaWords(days));
		} else {
			name.push(days < 0 ? "before the pregnancy" : "after 42 weeks 6 days");
		}
		if (milestone) {
			name.push(milestone.label.toLowerCase());
		}
		if (isFocus && !p.focusIsToday) {
			name.push("calculation date");
		}
		if (isToday) {
			name.push("today");
		}

		var html = '<td class="' + classes + '" data-wk-day="' + iso(date) + '"' + (inside ? ' data-wk-ga="' + W.label(days) + '"' : "") + ">";
		html += '<div class="wk-cell"><span class="wk-num" aria-hidden="true">' + date.date() + "</span>";
		if (weekStart) {
			html += '<span class="wk-tag" aria-hidden="true">' + (isDue ? "Due" : W.label(days)) + "</span>";
		}
		html += '<span class="wk-sr">' + name.join(", ") + "</span></div></td>";
		return html;
	}

	// One month as a table. In Whole pregnancy each month has its own heading.
	function monthHtml(p, number, own) {
		var first = monthStart(number);
		var total = first.daysInMonth();
		var lead = (first.day() + 6) % 7;
		var id = "wkM" + number;
		var html = "";
		if (own) {
			html += '<section class="wk-mon' + (number === focusMonth ? " is-focus-month" : "") + '" data-wk-month="' + first.format("YYYY-MM") + '" aria-labelledby="' + id + '">';
			html += '<h3 class="wk-mon-title" id="' + id + '">' + first.format("MMMM YYYY") + "</h3>";
		}
		html += '<table class="wk-grid" aria-labelledby="' + (own ? id : "wkMonth") + '"><thead><tr>' + WEEKDAY_HEAD + "</tr></thead><tbody><tr>";
		var cell = 0;
		for (; cell < lead; cell++) {
			html += '<td class="wk-blank"></td>';
		}
		for (var d = 0; d < total; d++, cell++) {
			if (cell > 0 && cell % 7 === 0) {
				html += "</tr><tr>";
			}
			html += dayHtml(p, first.clone().add(d, "days"));
		}
		for (; cell % 7 !== 0; cell++) {
			html += '<td class="wk-blank"></td>';
		}
		html += "</tr></tbody></table>";
		return own ? html + "</section>" : html;
	}

	function drawInfo(p) {
		var focusWeek = W.weekOf(p.focusDays);
		var inside = p.focusDays >= 0 && p.focusDays <= LAST_DAY;
		var date = longDate(p.focus) + (p.focusIsToday ? ", today" : "");

		if (p.focusDays < 0) {
			weekLine.textContent = "Before the pregnancy";
		} else if (!inside) {
			weekLine.textContent = "Week " + focusWeek + ", after 42 weeks";
		} else {
			weekLine.textContent = "Week " + focusWeek + ", " + W.trimester(p.focusDays).name.toLowerCase();
		}

		var lines = [p.focusDays >= 0 ? W.label(p.focusDays) + " on " + date : date];
		if (inside) {
			lines.push("Week " + focusWeek + " runs " + W.range(W.dateOf(p, focusWeek * 7), W.dateOf(p, focusWeek * 7 + 6), true));
		} else if (p.focusDays < 0) {
			lines.push("0+0 is " + longDate(p.start));
		}
		var toDue = W.TERM_DAYS - p.focusDays;
		lines.push("Due " + longDate(p.edd) + (toDue > 0 ? ", in " + spanWords(toDue) : toDue < 0 ? ", " + spanWords(-toDue) + " earlier" : ""));
		facts.innerHTML = lines
			.map(function (line) {
				return "<li>" + line + "</li>";
			})
			.join("");

		var keys = [
			['<span class="wk-key is-t1"></span>', "First trimester, 0+0 to 13+6"],
			['<span class="wk-key is-t2"></span>', "Second trimester, 14+0 to 27+6"],
			['<span class="wk-key is-t3"></span>', "Third trimester, 28+0 to 42+6"],
			['<span class="wk-key wk-key-text">22+0</span>', "First day of a week"],
		];
		if (p.focusIsToday) {
			keys.push(['<span class="wk-key wk-key-focus wk-key-today"></span>', "Today"]);
		} else {
			keys.push(['<span class="wk-key wk-key-focus"></span>', "Calculation date"]);
			keys.push(['<span class="wk-key wk-key-today"></span>', "Today"]);
		}
		keys.push(['<span class="wk-key wk-key-due"></span>', "Due date, " + W.shortDate(p.edd, true)]);
		legend.innerHTML = keys
			.map(function (key) {
				return '<li><span class="wk-key-box" aria-hidden="true">' + key[0] + "</span>" + key[1] + "</li>";
			})
			.join("");
	}

	function setDisabled(button, disabled) {
		button.setAttribute("aria-disabled", disabled ? "true" : "false");
	}

	function drawMonth(p) {
		bounds = {
			min: Math.min(monthNumber(p.start), focusMonth),
			max: Math.max(monthNumber(W.dateOf(p, LAST_DAY)), focusMonth),
		};
		if (view !== null) {
			view = Math.min(Math.max(view, bounds.min), bounds.max);
			if (view === focusMonth) {
				view = null;
			}
		}
		var shown = view === null ? focusMonth : view;
		nav.hidden = false;
		monthTitle.textContent = monthStart(shown).format("MMMM YYYY");
		setDisabled(prevBtn, shown <= bounds.min);
		setDisabled(nextBtn, shown >= bounds.max);
		months.className = "wk-months-list is-single";
		months.innerHTML = monthHtml(p, shown, false);
		back.hidden = view === null;
		backText.textContent = p.focusIsToday ? "Back to today" : "Back to " + W.shortDate(p.focus);
		back.title = p.focusIsToday ? "Show this month again" : "Show the month of the calculation date again";
	}

	// Months from 0+0 to 42+6. A focus a little outside them (a date past 42 weeks,
	// say) adds its month, so the focus is always drawn; one years away does not.
	var REACH_MONTHS = 6;

	function drawAll(p) {
		bounds = null;
		nav.hidden = true;
		var first = monthNumber(p.start);
		var last = monthNumber(W.dateOf(p, LAST_DAY));
		if (focusMonth < first && first - focusMonth <= REACH_MONTHS) {
			first = focusMonth;
		} else if (focusMonth > last && focusMonth - last <= REACH_MONTHS) {
			last = focusMonth;
		}
		var html = "";
		for (var n = first; n <= last; n++) {
			html += monthHtml(p, n, true);
		}
		months.className = "wk-months-list is-all";
		months.innerHTML = html;
		backText.textContent = p.focusIsToday ? "Go to today" : "Go to " + W.shortDate(p.focus);
		back.title = p.focusIsToday ? "Scroll to this month" : "Scroll to the month of the calculation date";
		showGoTo();
	}

	// "Go to" scrolls the page to the focus month. It stays put whenever that
	// month is drawn: a button that came and went with scrolling was confusing.
	function showGoTo() {
		back.hidden = !months.querySelector(".is-focus-month");
	}

	function syncControls(mode) {
		radios.forEach(function (radio) {
			radio.checked = radio.value === mode;
		});
		hint.textContent = HINTS[mode];
	}

	function render(opening) {
		var mode = setting.get();
		syncControls(mode);
		root.setAttribute("data-wk-mode", mode);
		if (isPip || mode === "off") {
			root.hidden = true;
			root.setAttribute("data-wk-state", "off");
			root.removeAttribute("data-wk-week");
			bounds = null;
			return;
		}
		var wasHidden = root.hidden;
		root.hidden = false;

		var p = W.pregnancy(values);
		if (p) {
			focusMonth = monthNumber(p.focus);
			root.setAttribute("data-wk-state", "ready");
			root.setAttribute("data-wk-week", String(W.weekOf(p.focusDays)));
			empty.hidden = true;
			ready.hidden = false;
			ready.className = "wk-ready " + (mode === "month" ? "is-month" : "is-all");
			drawInfo(p);
			if (mode === "month") {
				drawMonth(p);
			} else {
				drawAll(p);
			}
		} else {
			root.setAttribute("data-wk-state", "empty");
			root.removeAttribute("data-wk-week");
			empty.hidden = false;
			ready.hidden = true;
			back.hidden = true;
			bounds = null;
		}
		if (opening && wasHidden) {
			play(root, "wk-opening");
		}
	}

	// Restarts a short CSS animation. The CSS only defines them when motion is welcome.
	var ANIMATIONS = ["wk-opening", "wk-from-next", "wk-from-prev", "wk-fade"];

	function play(element, name) {
		ANIMATIONS.forEach(function (n) {
			element.classList.remove(n);
		});
		void element.offsetWidth;
		element.classList.add(name);
	}

	[root, months].forEach(function (element) {
		element.addEventListener("animationend", function (event) {
			if (event.target === element) {
				ANIMATIONS.forEach(function (n) {
					element.classList.remove(n);
				});
			}
		});
	});

	function announce(text) {
		status.textContent = "";
		window.setTimeout(function () {
			status.textContent = text;
		}, 30);
	}

	function scrollToFocus() {
		var target = months.querySelector(".is-focus-month");
		if (target) {
			target.scrollIntoView({ block: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });
		}
	}

	// ---- Browsing ----

	function step(delta) {
		if (!bounds) {
			return;
		}
		var shown = view === null ? focusMonth : view;
		var next = Math.min(Math.max(shown + delta, bounds.min), bounds.max);
		if (next === shown) {
			return;
		}
		view = next;
		render(false);
		play(months, delta > 0 ? "wk-from-next" : "wk-from-prev");
		announce(monthTitle.textContent);
	}

	prevBtn.addEventListener("click", function () {
		step(-1);
	});
	nextBtn.addEventListener("click", function () {
		step(1);
	});

	back.addEventListener("click", function () {
		if (setting.get() === "pregnancy") {
			scrollToFocus();
			var heading = months.querySelector(".is-focus-month .wk-mon-title");
			if (heading) {
				heading.setAttribute("tabindex", "-1");
				heading.focus({ preventScroll: true });
			}
			return;
		}
		var shown = view;
		view = null;
		render(false);
		if (shown !== null && focusMonth !== null) {
			play(months, focusMonth > shown ? "wk-from-next" : "wk-from-prev");
		}
		// The button hides itself, so keep the keyboard in the calendar.
		monthTitle.focus();
		announce(monthTitle.textContent);
	});

	root.addEventListener("keydown", function (event) {
		if (!bounds || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		if (event.key === "PageUp" || event.key === "PageDown") {
			event.preventDefault();
			step(event.key === "PageUp" ? -1 : 1);
		}
	});

	// ---- The page's values ----

	document.addEventListener("ga:values", function (event) {
		values = event.detail;
		var key = keyOf(W.pregnancy(values));
		if (key !== focusKey) {
			focusKey = key;
			view = null;
		}
		render(false);
	});

	// ---- The setting and its dialog ----

	var lastMode = setting.get();

	// Also fires when another tab changes the setting.
	setting.onChange(function (mode) {
		var switched = lastMode !== "off" && mode !== "off" && mode !== lastMode;
		lastMode = mode;
		view = null;
		render(true);
		if (switched) {
			play(months, "wk-fade");
		}
	});

	radios.forEach(function (radio) {
		radio.addEventListener("change", function () {
			if (!radio.checked) {
				return;
			}
			scrollPending = radio.value === "pregnancy" && setting.get() !== "pregnancy";
			setting.set(radio.value);
		});
	});

	function openDialog() {
		syncControls(setting.get());
		if (typeof dialog.showModal === "function") {
			dialog.showModal();
		} else {
			dialog.setAttribute("open", "");
		}
		var checked = dialog.querySelector('input[name="wkMode"]:checked');
		if (checked) {
			checked.focus();
		}
	}

	function closeDialog() {
		if (typeof dialog.close === "function") {
			dialog.close();
		} else {
			dialog.removeAttribute("open");
			onClosed();
		}
	}

	function onClosed() {
		gear.focus();
		if (scrollPending) {
			scrollPending = false;
			if (setting.get() === "pregnancy" && root.getAttribute("data-wk-state") === "ready") {
				scrollToFocus();
			}
		}
	}

	gear.addEventListener("click", openDialog);
	dialog.querySelector("[data-wk-close]").addEventListener("click", closeDialog);
	dialog.addEventListener("close", onClosed);
	// A click on the backdrop lands on the dialog itself; the content fills it edge to edge.
	dialog.addEventListener("click", function (event) {
		if (event.target === dialog) {
			closeDialog();
		}
	});

	focusKey = keyOf(W.pregnancy(values));
	render(false);
})();
