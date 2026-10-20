/*
 * The page behind the calculator: reads the three fields, decides which one
 * is being calculated, and shows the result. All parsing and arithmetic is
 * in calc.js.
 */
(function ($, GACalc) {
	"use strict";

	// Run on load
	$(function () {
		// The three values. Any two are entered and the calculator works out the third.
		var FIELDS = {
			edd: { input: $("#EDDDatepicker"), radio: document.getElementById("option1"), isDate: true },
			date: { input: $("#dateFromDatepicker"), radio: document.getElementById("option2"), isDate: true },
			ga: { input: $("#gestationalAge"), radio: document.getElementById("option3"), isDate: false },
		};
		var KEYS = ["edd", "date", "ga"];

		// How long typing has to pause before the calculator runs.
		var INPUT_DELAY_MS = 50;
		// How long a copy button says "Copied".
		var COPIED_MS = 1200;

		// Below this width the fields stack and the calendar opens as a sheet.
		var narrow = window.matchMedia("(max-width: 767.98px)");

		var COPY_ICON =
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="copy-icon">' +
			'<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 ' +
			'2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
		var CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="copy-icon">' + '<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

		// The field holding a result the calculator wrote, so that result can be
		// cleared or replaced without touching anything the user typed.
		var written = null;
		// The field the user is typing in. The calculator never overwrites it.
		var editing = null;
		var inputTimer = null;

		function box(key) {
			return $('.field[data-field="' + key + '"]');
		}

		// Which value is being calculated, from the selector at the top.
		function getOutput() {
			for (var i = 0; i < KEYS.length; i++) {
				if (FIELDS[KEYS[i]].radio.checked) {
					return KEYS[i];
				}
			}
			return "ga";
		}

		function parseField(key) {
			var text = FIELDS[key].input.val();
			return key === "ga" ? GACalc.parseGA(text) : GACalc.parseDate(text, key);
		}

		function calendarIsOpen(key) {
			var picker = FIELDS[key].isDate && FIELDS[key].input.data("datepicker");
			return !!(picker && picker.picker && picker.picker.is(":visible"));
		}

		// Tells a date field's calendar to re-read the field. Never while that
		// calendar is open: the widget rebuilds its day grid, and a rebuild between
		// the mousedown and click of a day selection swallows the pick. The "hide"
		// handler catches up afterwards.
		function syncCalendar(key) {
			if (FIELDS[key].isDate && !calendarIsOpen(key)) {
				FIELDS[key].input.datepicker("update");
			}
		}

		function setText(key, text) {
			if (FIELDS[key].input.val() !== text) {
				FIELDS[key].input.val(text);
			}
			syncCalendar(key);
		}

		// Reads all three fields, settles which one is the output, calculates it
		// and redraws. `edited` is the field the user just changed, if any.
		function recalculate(edited) {
			var parsed = { edd: parseField("edd"), date: parseField("date"), ga: parseField("ga") };
			var output = getOutput();

			// A result left in a field that is no longer the output is now an input.
			if (written && written !== output) {
				written = null;
			}
			// Anything the user edits is theirs, even if the calculator wrote it first.
			if (edited && edited === written) {
				written = null;
			}

			// A user edit to the field the calculator currently outputs makes that
			// value an input: move the output elsewhere (prefer GA; if GA itself was
			// edited, output the calculation date).
			if (edited && edited === output && parsed[edited].ok) {
				output = edited === "ga" ? "date" : "ga";
			}

			// With exactly two values entered, calculate the remaining one.
			var entered = KEYS.filter(function (key) {
				return parsed[key].ok && key !== written;
			});
			if (entered.length === 2) {
				var remaining = KEYS.filter(function (key) {
					return entered.indexOf(key) === -1;
				})[0];
				if (parsed[remaining].empty || remaining === written) {
					output = remaining;
				}
			}
			FIELDS[output].radio.checked = true;
			if (written && written !== output) {
				written = null;
			}

			var inputs = KEYS.filter(function (key) {
				return key !== output;
			});
			var result = null;
			if (parsed[inputs[0]].ok && parsed[inputs[1]].ok) {
				result = GACalc.solve(output, {
					edd: output === "edd" ? null : parsed.edd.date,
					date: output === "date" ? null : parsed.date.date,
					gaDays: output === "ga" ? null : parsed.ga.days,
				});
			}
			// A date before week 0 has no gestational age to show.
			var solved = !!(result && result.ok && result.flag !== "before");

			if (editing !== output) {
				if (solved) {
					setText(output, output === "ga" ? GACalc.formatGA(result.gaDays) : GACalc.formatDate(result[output]));
					written = output;
				} else if (written === output) {
					// The inputs no longer give an answer, so the old one must not stay.
					setText(output, "");
					written = null;
				}
			}

			// While the user is typing in the output field the result is held back,
			// so the field must be judged on their text, not on the result.
			var shown = solved && written === output;
			render(output, parsed, shown ? result : null, !!(result && result.ok && result.flag === "before"));
		}

		// Draws the state of each field: which is calculated, what is valid, the
		// warning under the gestational age, and the copy buttons.
		function render(output, parsed, result, beforePregnancy) {
			var values = { edd: null, date: null, ga: null };
			KEYS.forEach(function (key) {
				if (key === output && result) {
					values[key] = key === "ga" ? result.gaDays : result[key];
				} else if (key !== output || written !== key) {
					// An input, or text the user typed in the output field.
					var own = key === output ? parseField(key) : parsed[key];
					if (own.ok) {
						values[key] = key === "ga" ? own.days : own.date;
					}
				}
			});

			KEYS.forEach(function (key) {
				var isOutput = key === output;
				var text = FIELDS[key].input.val().trim();
				var hasValue = values[key] !== null;
				// The green tick marks values the user entered. The output is marked as calculated instead.
				FIELDS[key].input.toggleClass("is-valid", !isOutput && hasValue).toggleClass("is-invalid", text !== "" && !hasValue);
				box(key)
					.toggleClass("is-out", isOutput)
					.toggleClass("is-bad", text !== "" && !hasValue);
			});

			var tooLong = values.ga !== null && values.ga > GACalc.WARN_ABOVE_DAYS;
			var note = "";
			if (beforePregnancy) {
				note = "This date is before the pregnancy began.";
			} else if (tooLong) {
				note = output === "ga" ? "More than 44 weeks. Check both dates." : "More than 44 weeks. Check this value.";
			}
			$("#gestationalAgeNote").text(note);
			box("ga").toggleClass("is-warn", note !== "");

			renderCopies("edd", values.edd ? [GACalc.formatDate(values.edd), GACalc.formatDateLong(values.edd)] : []);
			renderCopies("date", values.date ? [GACalc.formatDate(values.date)] : []);
			renderCopies("ga", values.ga !== null ? [GACalc.formatGAShort(values.ga)] : []);

			// The week calendar under the card draws from these. A value is null
			// when its field is empty, not understood, or not worked out yet.
			lastValues = { edd: values.edd, date: values.date, gaDays: values.ga, output: output };
			document.dispatchEvent(new CustomEvent("ga:values", { detail: lastValues }));
		}

		var lastValues = null;

		// One copy button per value. Each shows exactly the text it copies.
		function renderCopies(key, texts) {
			var row = $('.copy-row[data-copies="' + key + '"]');
			var signature = texts.join("|");
			if (row.attr("data-shown") === signature) {
				return;
			}
			row.attr("data-shown", signature).empty();
			texts.forEach(function (text) {
				$('<button type="button" class="btn mx-0 btn-secondary copy-chip" title="Copy"></button>').attr("data-copy", text).append(COPY_ICON, $('<span class="copy-text"></span>').text(text)).appendTo(row);
			});
		}

		// The Clipboard API only exists on HTTPS, so fall back to the older
		// command where it is missing or refused.
		function legacyCopy(text) {
			var area = document.createElement("textarea");
			area.value = text;
			area.setAttribute("readonly", "");
			area.style.position = "fixed";
			area.style.opacity = "0";
			document.body.appendChild(area);
			area.select();
			var copied = false;
			try {
				copied = document.execCommand("copy");
			} catch (err) {
				copied = false;
			}
			document.body.removeChild(area);
			return copied;
		}

		function copyText(text) {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				return navigator.clipboard.writeText(text).then(
					function () {
						return true;
					},
					function () {
						return legacyCopy(text);
					}
				);
			}
			return $.Deferred().resolve(legacyCopy(text)).promise();
		}

		$(document).on("click", ".copy-chip", function () {
			var chip = $(this);
			var text = chip.attr("data-copy");
			if (!text || chip.hasClass("is-busy")) {
				return;
			}
			copyText(text).then(function (copied) {
				chip.addClass("is-busy").toggleClass("copied", copied);
				chip.find(".copy-icon").replaceWith(copied ? CHECK_ICON : COPY_ICON);
				chip.find(".copy-text").text(copied ? "Copied" : "Could not copy");
				setTimeout(function () {
					chip.removeClass("is-busy copied");
					chip.find(".copy-icon").replaceWith(COPY_ICON);
					chip.find(".copy-text").text(text);
				}, COPIED_MS);
			});
		});

		// The calendars only read and write dates. All calculating happens in recalculate().
		function initCalendar(key, todayButton) {
			var input = FIELDS[key].input;
			input
				.datepicker({
					format: {
						toDisplay: function (date) {
							return GACalc.formatDate(GACalc.fromJSDate(date));
						},
						toValue: function (text) {
							var parsed = GACalc.parseDate(text, key);
							return parsed.ok ? parsed.date.toDate() : null;
						},
					},
					autoclose: true,
					todayBtn: todayButton ? "linked" : false,
					forceParse: false,
					showOnFocus: false,
					weekStart: 1,
					todayHighlight: true,
					keyboardNavigation: false,
					orientation: "left",
				})
				.on("changeDate", function () {
					// A day was picked from the calendar.
					editing = null;
					clearTimeout(inputTimer);
					recalculate(key);
					broadcast();
				})
				.on("show", function () {
					$("body").addClass("calendar-open");
				})
				.on("hide", function () {
					$("body").removeClass("calendar-open");
					// Deferred: hide fires mid-click when a day closes the calendar.
					setTimeout(function () {
						syncCalendar(key);
					}, 0);
				})
				.on("focus", function () {
					// On a wide screen the calendar drops down under the field as you
					// enter it. On a narrow one it would fight the on-screen keyboard,
					// so it waits for its button.
					if (!narrow.matches) {
						input.datepicker("show");
					}
				});
		}
		initCalendar("edd", false);
		initCalendar("date", true);

		$(".calendar-btn").on("click", function () {
			FIELDS[$(this).attr("data-calendar")].input.datepicker("show");
		});

		KEYS.forEach(function (key) {
			FIELDS[key].input
				.on("input", function () {
					editing = key;
					clearTimeout(inputTimer);
					inputTimer = setTimeout(function () {
						inputTimer = null;
						recalculate(key);
						broadcast();
					}, INPUT_DELAY_MS);
				})
				.on("blur", function () {
					if (editing !== key) {
						return;
					}
					// Leaving a field ends the edit, so a half-typed output goes back to the result.
					editing = null;
					var pending = inputTimer !== null;
					clearTimeout(inputTimer);
					inputTimer = null;
					recalculate(pending ? key : null);
					broadcast();
				});
		});

		// Choosing a different value to calculate recomputes it from the other two.
		$("input[name='options']").on("change", function () {
			recalculate(null);
			broadcast();
		});

		// Shortcuts such as "t" move with the calendar, so refresh when the page
		// comes back into view and just after local midnight.
		document.addEventListener("visibilitychange", function () {
			if (!document.hidden) {
				recalculate(null);
			}
		});
		function scheduleMidnight() {
			var now = new Date();
			var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
			setTimeout(function () {
				recalculate(null);
				scheduleMidnight();
			}, next - now);
		}
		scheduleMidnight();

		// The Picture-in-Picture window shows this same page in a frame. The two
		// copies share a channel and mirror each other's fields.
		var channel = null;

		function broadcast() {
			if (!channel) {
				return;
			}
			channel.postMessage({
				type: "state",
				texts: { edd: FIELDS.edd.input.val(), date: FIELDS.date.input.val(), ga: FIELDS.ga.input.val() },
				output: getOutput(),
				written: written,
			});
		}

		function disconnect() {
			if (channel) {
				channel.close();
				channel = null;
			}
		}

		function connect(id) {
			disconnect();
			if (!("BroadcastChannel" in window)) {
				return;
			}
			channel = new BroadcastChannel("ga-calculator-" + id);
			channel.onmessage = function (event) {
				var message = event.data || {};
				if (message.type === "hello") {
					broadcast();
					return;
				}
				if (message.type !== "state" || !FIELDS[message.output]) {
					return;
				}
				KEYS.forEach(function (key) {
					setText(key, String(message.texts[key] || ""));
				});
				FIELDS[message.output].radio.checked = true;
				written = FIELDS[message.written] ? message.written : null;
				recalculate(null);
			};
		}

		window.GAPage = {
			connect: connect,
			disconnect: disconnect,
			// The values from the last render, for a calendar that starts after it.
			values: function () {
				return lastValues;
			},
		};

		var pipId = (/[?&]pip=([\w-]+)/.exec(window.location.search) || [])[1];
		if (pipId) {
			connect(pipId);
			if (channel) {
				channel.postMessage({ type: "hello" });
			}
		}

		// Browsers can restore field text on reload, so start from whatever is there.
		recalculate(null);
	});
})(window.jQuery, window.GACalc);
