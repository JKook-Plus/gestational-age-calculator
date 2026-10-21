/*
 * The week calendar under the calculator.
 *
 * Ordinary Monday-first month grids, like the date picker's, with each day
 * tinted by trimester and the first day of every pregnancy week labelled with
 * its age ("22+0"). A settings dialog behind the gear in the header chooses
 * Off, This month (one month with arrows) or Whole pregnancy (every month
 * from 0+0 to 42+6).
 *
 * Whole pregnancy is sized to the window: the months are laid out in as few
 * rows as the space allows and the day cells take the height left below the
 * calculator, measured live. Nothing inside scrolls. Where even that cannot
 * fit (a short window), the calendar section is sized to the window instead.
 * On a phone it is laid out like the live page, two months across, and the
 * page scrolls: fitting it all into one screen there made the days too small.
 *
 * Browsing to another month is local view state. A change to the focus date
 * or the due date snaps the view back to the focus; a redraw that only moves
 * today (midnight, or the tab coming back) keeps the month being looked at.
 * The page is only ever scrolled when the user turns on Whole pregnancy,
 * never while they type.
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
	// blocked, or full, in which case the choice lasts until the page is closed.
	var setting = (function (key, allowed) {
		var memory = null;
		// False once a write has failed: from then on the choice lives in memory.
		var writable = true;
		var listeners = [];

		function read() {
			if (!writable) {
				return memory;
			}
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
				} catch (e) {
					writable = false;
				}
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
	var LAST_DAY = W.LAST_DAY;
	// While a field is being typed in, the calendar waits this long after the
	// last change, so half-typed dates do not flick it between states.
	var TYPING_PAUSE_MS = 300;
	var HINTS = {
		off: "No calendar under the calculator.",
		month: "One month, opening on the calculation date or today. Arrows move between months.",
		pregnancy: "Every month from 0+0 to 42+6 at once, sized to fit the window.",
	};
	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	// The page's narrow layout. Whole pregnancy is not fitted to the window there.
	var phone = window.matchMedia("(max-width: 767.98px)");

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
	var cal = $("wkCal");
	var card = document.querySelector(".calc-card");
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
	// Set when the user picks Whole pregnancy: the calendar is scrolled into view once the dialog closes.
	var scrollPending = false;
	// What the calendar last drew. A redraw that would draw the same is skipped.
	var drawn = null;
	var typingTimer = null;
	// The calculator's three fields.
	var fields = ["EDDDatepicker", "dateFromDatepicker", "gestationalAge"].map($);

	// Monday first, like the date picker.
	var WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
	var WEEKDAY_HEAD = WEEKDAYS.map(function (day) {
		var m = window.moment.utc().day(day);
		// Two letters, or one when the fitted cells are very narrow.
		return '<th scope="col"><span aria-hidden="true"><span class="wk-wd-l">' + m.format("dd") + '</span><span class="wk-wd-s">' + m.format("dd").charAt(0) + '</span></span><span class="wk-sr">' + m.format("dddd") + "</span></th>";
	}).join("");

	// ---- Dates ----

	var monthNumber = W.monthNumber;

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

	// ---- Drawing ----

	function dayHtml(p, date) {
		var days = W.daysOn(p, date);
		var inside = days >= 0 && days <= LAST_DAY;
		var isFocus = W.sameDay(date, p.focus);
		var isToday = W.sameDay(date, p.today);
		var isDue = days === W.TERM_DAYS;
		var weekStart = inside && days % 7 === 0;
		var milestone = inside ? W.milestoneOn(days) : null;

		var classes = "wk-day";
		classes += inside ? " is-t" + W.trimester(days).number : " is-out";
		classes += weekStart ? " is-wstart" : "";
		classes += isFocus ? " is-focus" : "";
		classes += isToday ? " is-today" : "";
		classes += isDue ? " is-due" : "";

		var name = [longDate(date)];
		if (inside) {
			name.push(window.GACalc.formatGA(days));
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
		// The title shows the age on hover when the cell is too small to carry it.
		html += '<div class="wk-cell"' + (inside ? ' title="' + W.label(days) + ", " + date.format("ddd D MMM YYYY") + (isDue ? ", due date" : "") + '"' : "") + '><span class="wk-num" aria-hidden="true">' + date.date() + "</span>";
		if (weekStart) {
			// "22+0", or just the week ("22") when the fitted cells are small.
			html += '<span class="wk-tag" aria-hidden="true"><span class="wk-l">' + (isDue ? "Due" : W.label(days)) + '</span><span class="wk-s">' + W.weekOf(days) + "</span></span>";
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
			// data-wk-rows: how many weeks the grid has, for fitting the months to the window.
			html += '<section class="wk-mon' + (number === focusMonth ? " is-focus-month" : "") + '" data-wk-month="' + first.format("YYYY-MM") + '" data-wk-rows="' + Math.ceil((lead + total) / 7) + '" aria-labelledby="' + id + '">';
			// "October 2026", shown as "Oct 2026" when the months are narrow.
			html += '<h3 class="wk-mon-title" id="' + id + '"><span class="wk-mon-l">' + first.format("MMMM YYYY") + '</span><span class="wk-mon-s" aria-hidden="true">' + first.format("MMM YYYY") + "</span></h3>";
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

	// "Tue 20 Oct 2026": the one-line summary above the fitted months uses short dates.
	function mediumDate(date) {
		return date.format("ddd D MMM YYYY");
	}

	// The facts as list items. In Whole pregnancy they sit on one line after
	// the week; the week's dates are optional there and drop out when keeping
	// them would wrap the line (see fitInfo).
	function drawInfo(p, mode) {
		var all = mode === "pregnancy";
		var dateText = all ? mediumDate : longDate;
		var focusWeek = W.weekOf(p.focusDays);
		var inside = p.focusDays >= 0 && p.focusDays <= LAST_DAY;
		var date = dateText(p.focus) + (p.focusIsToday ? ", today" : "");

		if (p.focusDays < 0) {
			weekLine.textContent = "Before the pregnancy";
		} else if (!inside) {
			weekLine.textContent = "Week " + focusWeek + ", after 42 weeks";
		} else {
			weekLine.textContent = "Week " + focusWeek + ", " + W.trimester(p.focusDays).name.toLowerCase();
		}

		var lines = [p.focusDays >= 0 ? W.label(p.focusDays) + " on " + date : date];
		var optional = -1;
		if (inside) {
			optional = all ? lines.length : -1;
			lines.push("Week " + focusWeek + " runs " + W.range(W.dateOf(p, focusWeek * 7), W.dateOf(p, focusWeek * 7 + 6), true));
		} else if (p.focusDays < 0) {
			lines.push("0+0 is " + dateText(p.start));
		}
		var toDue = W.TERM_DAYS - p.focusDays;
		lines.push("Due " + (all ? W.shortDate(p.edd, true) : longDate(p.edd)) + (toDue > 0 ? ", in " + spanWords(toDue) : toDue < 0 ? ", " + spanWords(-toDue) + " earlier" : ""));
		facts.innerHTML = lines
			.map(function (line, i) {
				return "<li" + (i === optional ? ' class="wk-opt"' : "") + ">" + line + "</li>";
			})
			.join("");

		var keys = [
			['<span class="wk-key is-t1"></span>', 'First trimester, <span class="wk-nowrap">0+0 to 13+6</span>'],
			['<span class="wk-key is-t2"></span>', 'Second trimester, <span class="wk-nowrap">14+0 to 27+6</span>'],
			['<span class="wk-key is-t3"></span>', 'Third trimester, <span class="wk-nowrap">28+0 to 42+6</span>'],
			// The key matches how the fitted cells label a week start: "22+0", "22", or a bold date only.
			['<span class="wk-key wk-key-text"><span class="wk-l">22+0</span><span class="wk-s">22</span><span class="wk-x">15</span></span>', '<span class="wk-l">First day of a week</span><span class="wk-s">First day of <span class="wk-nowrap">week 22</span></span><span class="wk-x">First day of a week, in bold</span>'],
		];
		if (p.focusIsToday) {
			keys.push(['<span class="wk-key wk-key-focus wk-key-today"></span>', "Today", ".is-focus"]);
		} else {
			keys.push(['<span class="wk-key wk-key-focus"></span>', "Calculation date", ".is-focus"]);
			keys.push(['<span class="wk-key wk-key-today"></span>', "Today", ".is-today"]);
		}
		keys.push(['<span class="wk-key wk-key-due"></span>', 'Due date, <span class="wk-nowrap">' + W.shortDate(p.edd, true) + "</span>", ".is-due"]);
		legend.innerHTML = keys
			.map(function (key) {
				return "<li" + (key[2] ? ' data-wk-shows="' + key[2] + '"' : "") + '><span class="wk-key-box" aria-hidden="true">' + key[0] + "</span><span>" + key[1] + "</span></li>";
			})
			.join("");
	}

	function setDisabled(button, disabled) {
		button.setAttribute("aria-disabled", disabled ? "true" : "false");
	}

	// The month "This month" opens on: the focus month, or the nearest month of
	// the pregnancy when the focus is far outside it (an old due date, say).
	function homeMonth() {
		return Math.min(Math.max(focusMonth, bounds.min), bounds.max);
	}

	function drawMonth(p) {
		// The same months the whole-pregnancy view draws.
		var span = W.monthRange(p);
		bounds = { min: span.first, max: span.last };
		if (view !== null) {
			view = Math.min(Math.max(view, bounds.min), bounds.max);
			if (view === homeMonth()) {
				view = null;
			}
		}
		var shown = view === null ? homeMonth() : view;
		nav.hidden = false;
		monthTitle.textContent = monthStart(shown).format("MMMM YYYY");
		setDisabled(prevBtn, shown <= bounds.min);
		setDisabled(nextBtn, shown >= bounds.max);
		months.className = "wk-months-list is-single";
		months.innerHTML = monthHtml(p, shown, false);
		// Whole pregnancy moves the key into the grid of months; put it back beside the month.
		if (legend.parentNode !== ready) {
			ready.insertBefore(legend, cal);
		}
		back.hidden = view === null;
		if (homeMonth() !== focusMonth) {
			// The focus is too far away to show, so "back" is the nearest month of the pregnancy.
			backText.textContent = "Back to " + monthStart(homeMonth()).format("MMMM YYYY");
			back.title = "Show the nearest month of the pregnancy again";
		} else {
			backText.textContent = p.focusIsToday ? "Back to today" : "Back to " + W.shortDate(p.focus);
			back.title = p.focusIsToday ? "Show this month again" : "Show the month of the calculation date again";
		}
	}

	// Every month from 0+0 to 42+6, and the focus month when it is close by.
	function drawAll(p) {
		bounds = null;
		nav.hidden = true;
		var span = W.monthRange(p);
		var html = "";
		for (var n = span.first; n <= span.last; n++) {
			html += monthHtml(p, n, true);
		}
		months.className = "wk-months-list is-all";
		months.innerHTML = html;
		if (phone.matches) {
			// A phone scrolls, as on the live page: the key goes above the months
			// and "Go to" brings the focus month into view.
			if (legend.parentNode !== ready) {
				ready.insertBefore(legend, cal);
			}
			backText.textContent = p.focusIsToday ? "Go to today" : "Go to " + W.shortDate(p.focus);
			back.title = p.focusIsToday ? "Scroll to this month" : "Scroll to the month of the calculation date";
			back.hidden = !months.querySelector(".is-focus-month");
		} else {
			// The key takes the slot after the last month, which a row of months usually leaves empty.
			months.appendChild(legend);
			// Everything is on screen at once, so there is nothing to go to.
			back.hidden = true;
		}
		// A focus or today far from the pregnancy is not drawn, so its key goes too.
		Array.prototype.forEach.call(legend.querySelectorAll("[data-wk-shows]"), function (item) {
			item.hidden = !months.querySelector(item.getAttribute("data-wk-shows"));
		});
	}

	function syncControls(mode) {
		radios.forEach(function (radio) {
			radio.checked = radio.value === mode;
		});
		hint.textContent = HINTS[mode];
	}

	// Everything a redraw depends on. Midnight moves today, so it is in here.
	function drawKey(mode, p) {
		return [mode, view, phone.matches, p ? [iso(p.start), iso(p.focus), p.focusIsToday, iso(p.today)].join() : "empty"].join("|");
	}

	function render(opening) {
		clearTimeout(typingTimer);
		typingTimer = null;
		var mode = setting.get();
		syncControls(mode);
		root.setAttribute("data-wk-mode", mode);
		if (isPip || mode === "off") {
			root.hidden = true;
			root.setAttribute("data-wk-state", "off");
			root.removeAttribute("data-wk-week");
			bounds = null;
			drawn = null;
			unfit();
			return;
		}
		var p = W.pregnancy(values);
		// Most events (the tab coming back, a click on the selector, leaving a
		// field) change nothing here. Rebuilding anyway costs time on slow
		// phones and throws away keyboard focus inside the months.
		if (drawKey(mode, p) === drawn) {
			return;
		}
		var wasHidden = root.hidden;
		root.hidden = false;
		var refocus = focusedMonth();

		if (p) {
			focusMonth = monthNumber(p.focus);
			root.setAttribute("data-wk-state", "ready");
			root.setAttribute("data-wk-week", String(W.weekOf(p.focusDays)));
			empty.hidden = true;
			ready.hidden = false;
			ready.className = "wk-ready " + (mode === "month" ? "is-month" : "is-all");
			// A phone gets the live page's three full lines of facts.
			drawInfo(p, phone.matches ? "month" : mode);
			if (mode === "month") {
				unfit();
				drawMonth(p);
			} else if (phone.matches) {
				unfit();
				drawAll(p);
				fitTags();
			} else {
				root.classList.add("is-fit");
				drawAll(p);
				fit();
			}
		} else {
			root.setAttribute("data-wk-state", "empty");
			root.removeAttribute("data-wk-week");
			empty.hidden = false;
			ready.hidden = true;
			back.hidden = true;
			bounds = null;
			unfit();
		}
		// drawMonth can settle the view, so the key is taken after drawing.
		drawn = drawKey(mode, p);
		if (refocus) {
			restoreFocus(refocus);
		}
		if (opening && wasHidden) {
			play(root, "wk-opening");
		}
	}

	// The month heading that has keyboard focus, if any, so a rebuild can put it back.
	function focusedMonth() {
		var active = document.activeElement;
		var month = active && months.contains(active) ? active.closest(".wk-mon") : null;
		return month ? month.getAttribute("data-wk-month") : null;
	}

	function restoreFocus(month) {
		var heading = months.querySelector('[data-wk-month="' + month + '"] .wk-mon-title');
		if (heading) {
			heading.setAttribute("tabindex", "-1");
			heading.focus({ preventScroll: true });
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

	// Brings the whole calendar into view. Where the page fits the window this
	// does nothing; on a phone it lines the calendar up with the top of the screen.
	function scrollToCalendar() {
		root.scrollIntoView({ block: "start", behavior: reduceMotion.matches ? "auto" : "smooth" });
	}

	// ---- Fitting Whole pregnancy to the window ----

	// Cell sizes, from roomy to tight: the smallest cell each needs, and the
	// heights of the month heading and the weekday row at that size (the CSS
	// for [data-wk-fit] uses the same numbers). "lg" and "md" label week starts
	// "22+0", "sm" just "22", and "xs" has room for the date alone, so a week
	// start is only bold there and its age is in the cell's title.
	// `fitW` and `fitH` are a comfortable cell at that size: between two
	// arrangements of the same size, the one closer to it in its tighter
	// direction wins.
	var FITS = [
		{ name: "lg", minW: 34, minH: 30, fitW: 40, fitH: 32, title: 22, head: 16 },
		{ name: "md", minW: 24, minH: 25, fitW: 28, fitH: 30, title: 19, head: 14 },
		{ name: "sm", minW: 13, minH: 19, fitW: 18, fitH: 22, title: 17, head: 13 },
		{ name: "xs", minW: 13, minH: 14, fitW: 18, fitH: 16, title: 17, head: 13 },
	];
	// No taller than this, or this many times the width: past that, cells stop looking like days.
	var MAX_CELL = 46;
	var MAX_TALL = 1.8;
	var fitFrame = 0;

	// Distance from the top of the page, leaving out transforms (the opening animation moves the calendar).
	function docTop(element) {
		var top = 0;
		for (; element; element = element.offsetParent) {
			top += element.offsetTop;
		}
		return top;
	}

	// The key's height at `width`: a column of entries when it sits in the
	// slot of one month, a wrapping row when it has more room.
	function keyHeight(width, size, row) {
		var was = root.getAttribute("data-wk-fit");
		// The key's labels follow the cell size, so measure it at the size being tried.
		root.setAttribute("data-wk-fit", size.name);
		legend.classList.toggle("is-row", row);
		legend.style.width = width + "px";
		legend.style.paddingTop = "0";
		var height = legend.offsetHeight;
		legend.style.width = "";
		legend.style.paddingTop = "";
		if (was) {
			root.setAttribute("data-wk-fit", was);
		} else {
			root.removeAttribute("data-wk-fit");
		}
		return height;
	}

	// The best arrangement of the months (each `rows[i]` weeks long) and the
	// key in a box `width` wide with `height` for the months: the biggest
	// cell size that fits, then the biggest cells, then the fewest rows of
	// months. Null when nothing fits. `keyAt(width)` gives the key's height.
	function plan(rows, width, height, keyAt) {
		var n = rows.length;
		var wide = width >= 600;
		var gapY = wide ? 8 : 6;
		var best = null;
		for (var cols = n; cols >= 1; cols--) {
			// Seven or more months across leave narrow days, so they sit closer together.
			var gapX = !wide ? 6 : cols >= 7 ? 8 : 16;
			var monthW = (width - (cols - 1) * gapX) / cols;
			var space = (monthW - 16) / 7 >= 20 ? 2 : 1;
			var cellW = (monthW - 8 * space) / 7;
			var lines = Math.ceil(n / cols);
			var weeks = [];
			for (var r = 0; r < lines; r++) {
				weeks.push(Math.max.apply(null, rows.slice(r * cols, (r + 1) * cols)));
			}
			var free = lines * cols - n;
			// The key goes in the empty slots after the last month, or in a row of its own below the months.
			var places = free ? [free, 0] : [0];
			for (var k = 0; k < places.length; k++) {
				var span = places[k];
				var keyW = span ? span * monthW + (span - 1) * gapX : width;
				for (var i = 0; i < FITS.length; i++) {
					var keyH = keyAt(keyW, FITS[i], span !== 1);
					var cellH = cellHeight(FITS[i], weeks, space, gapY, height, span ? 0 : gapY + keyH, span ? keyH : 0);
					cellH = Math.floor(Math.min(cellH, cellW * MAX_TALL, MAX_CELL) * 4) / 4;
					if (cellW < FITS[i].minW || cellH < FITS[i].minH) {
						continue;
					}
					var layout = { cols: cols, weeks: weeks, size: FITS[i], rank: i, monthW: monthW, cellW: cellW, cellH: cellH, space: space, gapX: gapX, gapY: gapY, keySpan: span, keyRow: span !== 1, score: Math.min(cellW / FITS[i].fitW, cellH / FITS[i].fitH) };
					if (!best || layout.rank < best.rank || (layout.rank === best.rank && layout.score > best.score + 0.02)) {
						best = layout;
					}
					break;
				}
			}
		}
		return best;
	}

	// The tallest cell for which rows of months (`weeks[r]` weeks each) fit in
	// `height`. `extra` is height taken below them (the key in its own row);
	// `beside` is the key's height when it shares the last row instead.
	function cellHeight(size, weeks, space, gapY, height, extra, beside) {
		var fixed = (weeks.length - 1) * gapY + extra;
		var count = 0;
		weeks.forEach(function (w) {
			// Heading, then a table: the weekday row and the weeks, with spacing around every row.
			fixed += size.title + size.head + space * (w + 2);
			count += w;
		});
		var cellH = (height - fixed) / count;
		var last = weeks[weeks.length - 1];
		// The key sits under a gap the height of a month heading, so it lines up with the weekdays.
		var keyRowH = size.title + beside;
		if (beside && size.title + size.head + space * (last + 2) + last * (cellH + space) < keyRowH) {
			// The key is taller than the months beside it, so it sets that row's height.
			fixed += keyRowH - (size.title + size.head + space * (last + 2));
			count -= last;
			cellH = count ? (height - fixed - last * space) / count : height >= fixed ? MAX_CELL : 0;
		}
		return cellH;
	}

	function apply(layout) {
		var style = root.style;
		style.setProperty("--wk-cols", layout.cols);
		style.setProperty("--wk-cell-h", layout.cellH + "px");
		style.setProperty("--wk-space", layout.space + "px");
		style.setProperty("--wk-gap-x", layout.gapX + "px");
		style.setProperty("--wk-gap-y", layout.gapY + "px");
		style.setProperty("--wk-title-h", layout.size.title + "px");
		style.setProperty("--wk-head-h", layout.size.head + "px");
		root.setAttribute("data-wk-fit", layout.size.name);
		// "Oct 2026" and one-letter weekdays when the months are narrow.
		root.classList.toggle("is-narrow-month", layout.monthW < 150);
		root.classList.toggle("is-narrow-day", layout.cellW < 19);
		// Two lines in a short cell: the date drops to 11 px.
		root.classList.toggle("is-short-day", layout.cellH < 22);
		legend.classList.toggle("is-row", layout.keyRow);
		legend.style.gridColumn = layout.keySpan ? "span " + layout.keySpan : "1 / -1";
	}

	var FIT_PROPS = ["--wk-cols", "--wk-cell-h", "--wk-space", "--wk-gap-x", "--wk-gap-y", "--wk-title-h", "--wk-head-h"];

	function unfit() {
		root.classList.remove("is-fit", "is-narrow-month", "is-narrow-day", "is-short-day");
		root.removeAttribute("data-wk-fit");
		legend.classList.remove("is-row");
		legend.style.gridColumn = "";
		FIT_PROPS.forEach(function (name) {
			root.style.removeProperty(name);
		});
	}

	// Sizes the months to the room left in the window. On a desktop that is
	// the space below the calculator, so the whole page fits. Where even the
	// smallest cells would not fit there (a phone, where the calculator alone
	// is most of the screen), the calendar section is sized to the window.
	function fit() {
		if (root.hidden || !root.classList.contains("is-fit")) {
			return;
		}
		var rows = Array.prototype.map.call(months.querySelectorAll(".wk-mon"), function (month) {
			return Number(month.getAttribute("data-wk-rows"));
		});
		// The week's dates stay in the summary only if they do not cost another line.
		var optional = facts.querySelector(".wk-opt");
		if (optional) {
			optional.hidden = false;
			var withIt = docTop(months);
			optional.hidden = true;
			optional.hidden = docTop(months) < withIt;
		}
		var style = getComputedStyle(root);
		var below = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
		var margin = parseFloat(style.marginBottom);
		var head = docTop(months) - docTop(root);
		var width = months.clientWidth;
		var heights = {};
		function keyAt(keyW, size, row) {
			var at = Math.floor(keyW) + size.name + row;
			if (!(at in heights)) {
				heights[at] = keyHeight(Math.floor(keyW), size, row);
			}
			return heights[at];
		}
		var whole = true;
		var room = window.innerHeight - docTop(months) - below - margin;
		var layout = plan(rows, width, room, keyAt);
		if (!layout) {
			whole = false;
			room = window.innerHeight - head - below;
			layout = plan(rows, width, room, keyAt);
		}
		if (!layout) {
			smallest(rows, width);
			return;
		}
		apply(layout);
		// Put right anything the plan did not foresee, such as a key taller than its row.
		for (var tries = 0; tries < 2; tries++) {
			var limit = whole ? window.innerHeight - margin : docTop(root) + window.innerHeight;
			var over = docTop(root) + root.offsetHeight - limit;
			if (over <= 0) {
				return;
			}
			room -= over;
			layout = plan(rows, width, room, keyAt);
			if (!layout) {
				smallest(rows, width);
				return;
			}
			apply(layout);
		}
	}

	// A window too small for even the smallest cells: keep them readable and let the page scroll.
	function smallest(rows, width) {
		var layout = plan(rows, width, 1e6, function (keyW, size, row) {
			return keyHeight(Math.floor(keyW), size, row);
		});
		layout.cellH = FITS[FITS.length - 1].minH;
		layout.size = FITS[FITS.length - 1];
		apply(layout);
	}

	// On a phone the months are two across at their natural height, and days
	// are only about 20 px wide. Where "22+0" does not fit inside a day, week
	// starts are labelled "22" instead (the key follows, through the same "sm"
	// size the fitted view uses). Measured, since it depends on the font.
	function fitTags() {
		if (root.hidden || !phone.matches || setting.get() !== "pregnancy") {
			return;
		}
		root.removeAttribute("data-wk-fit");
		var tags = months.querySelectorAll(".wk-tag");
		for (var i = 0; i < tags.length; i++) {
			if (tags[i].scrollWidth > tags[i].parentNode.clientWidth) {
				root.setAttribute("data-wk-fit", "sm");
				return;
			}
		}
	}

	// At most one fit a frame. Called on window resizes and whenever the
	// calculator card changes height (an error message, the GA note).
	function refit() {
		if (!fitFrame) {
			fitFrame = window.requestAnimationFrame(function () {
				fitFrame = 0;
				fit();
				fitTags();
			});
		}
	}

	// Crossing into or out of the phone layout draws Whole pregnancy again in the other form.
	phone.addEventListener("change", function () {
		render(false);
	});
	window.addEventListener("resize", refit);
	if (window.ResizeObserver && card) {
		new ResizeObserver(refit).observe(card);
	}

	// ---- Browsing ----

	function step(delta) {
		if (!bounds) {
			return;
		}
		var shown = view === null ? homeMonth() : view;
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

	// "Back to" in This month. In Whole pregnancy only a phone shows the button,
	// as "Go to": it scrolls the page to the focus month.
	back.addEventListener("click", function () {
		if (setting.get() === "pregnancy") {
			var target = months.querySelector(".is-focus-month");
			if (target) {
				target.scrollIntoView({ block: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });
				var heading = target.querySelector(".wk-mon-title");
				heading.setAttribute("tabindex", "-1");
				heading.focus({ preventScroll: true });
			}
			return;
		}
		var shown = view;
		view = null;
		render(false);
		if (shown !== null && bounds) {
			play(months, homeMonth() > shown ? "wk-from-next" : "wk-from-prev");
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
		// Leaving the field fires another event, which draws straight away.
		if (fields.indexOf(document.activeElement) !== -1) {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(function () {
				render(false);
			}, TYPING_PAUSE_MS);
		} else {
			render(false);
		}
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
		dialog.showModal();
		var checked = dialog.querySelector('input[name="wkMode"]:checked');
		if (checked) {
			checked.focus();
		}
	}

	function closeDialog() {
		dialog.close();
	}

	function onClosed() {
		if (scrollPending) {
			scrollPending = false;
			var heading = months.querySelector(".is-focus-month .wk-mon-title");
			if (setting.get() === "pregnancy" && heading) {
				scrollToCalendar();
				// Keyboard focus follows the page down, so the next Tab does not jump back up.
				heading.setAttribute("tabindex", "-1");
				heading.focus({ preventScroll: true });
				return;
			}
		}
		gear.focus();
	}

	// Every browser this page supports has <dialog>. Without it the setting
	// cannot be offered properly, so the gear is not shown at all.
	if (typeof dialog.showModal !== "function") {
		gear.hidden = true;
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
