/*
 * Document Picture-in-Picture: pops out a small, always-on-top, fully
 * interactive copy of the calculator. The PiP window holds its own editable
 * fields, mode selector, and date pickers, wired bidirectionally to the real
 * inputs in the main document:
 *
 *   - Editing a PiP field (typing or picking from its calendar) pushes the
 *     value into the matching main input and re-runs the real calculation
 *     pipeline (dates go through the main bootstrap-datepicker, so every
 *     supported format still works).
 *   - Any recompute on the main side is mirrored back into the PiP fields,
 *     their date pickers, and the formatted-date / gestational-age copy
 *     buttons.
 *
 * The PiP window loads its own jQuery + bootstrap-datepicker so its calendars
 * run in the PiP realm (correct positioning, popup anchored to the PiP body).
 * main.js stays the single source of truth: the PiP panel drives the main
 * inputs remotely rather than relocating the card.
 *
 * Docs: https://developer.chrome.com/docs/web-platform/document-picture-in-picture
 */
(function () {
	"use strict";

	// Feature detection. The button starts hidden (display: none in the markup),
	// so on unsupported browsers we leave it hidden and do nothing.
	if (!("documentPictureInPicture" in window)) {
		return;
	}

	var jq = window.jQuery;

	// Libraries loaded into the PiP window so its date pickers run in that realm.
	var LIB_SCRIPTS = [
		{
			src: "https://code.jquery.com/jquery-3.6.4.min.js",
			integrity: "sha384-UG8ao2jwOWB7/oDdObZc6ItJmwUkR/PfMyt9Qs5AwX7PsnYn1CRKCTWyncPTWvaS",
		},
		{
			src: "https://cdn.jsdelivr.net/npm/bootstrap-datepicker@1.10.0/dist/js/bootstrap-datepicker.min.js",
			integrity: "sha384-hrC0I6QUg0tSdzNW47DRT7ohgBLywmjg37cLYZbdXVZLJHwJhFfqo7ouWr5yfSmv",
		},
	];

	// Copy icon (content_copy) shown on each copy button.
	var COPY_ICON =
		'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" ' +
		'fill="currentColor" aria-hidden="true" class="pip-copy-icon">' +
		'<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 ' +
		'2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

	// The three calculator fields and their matching main-document inputs. Each
	// field lists the main summary elements (with data-date values) whose copy
	// buttons are mirrored beneath it.
	var FIELDS = [
		{
			key: "edd",
			label: "Estimated Due Date (EDD)",
			mainSel: "#EDDDatepicker",
			type: "date",
			placeholder: "e.g. 3/7/2024 or t+3",
			// Canonical DD/MM/YYYY value to feed the picker (the main input may
			// hold raw text like "01 10" or "t" that the picker can't parse).
			dateSourceId: "estimated-due-date-text",
			copies: ["estimated-due-date-text", "estimated-due-date-word-text"],
		},
		{
			key: "fromDate",
			label: "At this date",
			mainSel: "#dateFromDatepicker",
			type: "date",
			todayBtn: true,
			placeholder: "e.g. today or t+3",
			dateSourceId: "calculateDateText",
			copies: ["calculateDateText"],
		},
		{
			key: "ga",
			label: "Gestational Age (weeks+days)",
			mainSel: "#gestationalAge",
			type: "ga",
			placeholder: "e.g. 39+2 or 39w2d",
			copies: ["gestationalAgeText"],
		},
	];

	// The mode selector: which field the calculator computes. mainIndex maps to
	// document.getElementsByName("options").
	var OPTIONS = [
		{ pipId: "pip-option1", mainIndex: 0, outputKey: "edd", text: "EDD" },
		{ pipId: "pip-option2", mainIndex: 1, outputKey: "fromDate", text: "Date" },
		{ pipId: "pip-option3", mainIndex: 2, outputKey: "ga", text: "GA" },
	];

	document.addEventListener("DOMContentLoaded", function () {
		var pipButton = document.getElementById("pipToggle");
		if (!pipButton) {
			return;
		}

		// The API is available, so reveal the button.
		pipButton.style.display = "";

		var pipWindow = null;
		var pipDoc = null;
		var pipJQ = null;
		var pipInputs = {};
		var pipRadios = {};
		var pipCopies = {};
		var valueObserver = null;
		var themeObserver = null;
		var datepickersReady = false;
		// Guards mirror-driven datepicker updates from being pushed back to main.
		var suppressPush = false;

		pipButton.addEventListener("click", function () {
			// Toggle: close if one is already open, otherwise open a new one.
			if (documentPictureInPicture.window) {
				documentPictureInPicture.window.close();
				return;
			}
			openPipWindow();
		});

		async function openPipWindow() {
			try {
				// requestWindow() must run inside the user gesture, so it is the
				// first thing we await.
				pipWindow = await documentPictureInPicture.requestWindow({ width: 380, height: 440 });
			} catch (err) {
				console.error("Could not open the Picture-in-Picture window:", err);
				return;
			}

			pipDoc = pipWindow.document;
			pipJQ = null;
			datepickersReady = false;
			pipDoc.title = "Gestational Age Calculator";
			copyStyleSheets(pipWindow);
			syncThemeAttributes(pipWindow);
			buildPanel();
			syncFromMain();

			// Give the PiP window its own date pickers (best-effort — typing still
			// works if the libraries fail to load).
			ensureDatepickerLibs()
				.then(initPipDatepickers)
				.catch(function (err) {
					console.warn("PiP date pickers unavailable, using text entry only:", err);
				});

			// Mirror any recompute on the main side into the PiP fields. The
			// calculator rewrites these summary elements whenever it runs.
			valueObserver = new MutationObserver(syncFromMain);
			["estimated-due-date-text", "estimated-due-date-word-text", "calculateDateText", "gestationalAgeText"].forEach(function (id) {
				var el = document.getElementById(id);
				if (el) {
					valueObserver.observe(el, {
						childList: true,
						characterData: true,
						subtree: true,
						attributes: true,
						attributeFilter: ["data-date"],
					});
				}
			});

			// Keep the PiP window's theme aligned with the main page.
			themeObserver = new MutationObserver(function () {
				syncThemeAttributes(pipWindow);
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["data-bs-theme", "data-bs-core"],
			});

			setButtonActive(true);

			pipWindow.addEventListener("pagehide", function () {
				if (valueObserver) {
					valueObserver.disconnect();
					valueObserver = null;
				}
				if (themeObserver) {
					themeObserver.disconnect();
					themeObserver = null;
				}
				pipWindow = null;
				pipDoc = null;
				pipJQ = null;
				datepickersReady = false;
				pipInputs = {};
				pipRadios = {};
				pipCopies = {};
				setButtonActive(false);
			});
		}

		function setButtonActive(isActive) {
			pipButton.classList.toggle("active", isActive);
			pipButton.setAttribute("aria-pressed", isActive ? "true" : "false");
		}

		// Load jQuery + bootstrap-datepicker into the PiP window (once). Resolves
		// when $.fn.datepicker is available in the PiP realm.
		function ensureDatepickerLibs() {
			return new Promise(function (resolve, reject) {
				if (pipWindow && pipWindow.jQuery && pipWindow.jQuery.fn && pipWindow.jQuery.fn.datepicker) {
					resolve();
					return;
				}

				var index = 0;
				function loadNext() {
					if (!pipWindow || !pipDoc) {
						reject(new Error("PiP window closed before libraries loaded"));
						return;
					}
					if (index >= LIB_SCRIPTS.length) {
						resolve();
						return;
					}
					var spec = LIB_SCRIPTS[index++];
					var script = pipDoc.createElement("script");
					script.src = spec.src;
					script.integrity = spec.integrity;
					script.crossOrigin = "anonymous";
					script.onload = loadNext;
					script.onerror = function () {
						reject(new Error("Failed to load " + spec.src));
					};
					pipDoc.head.appendChild(script);
				}
				loadNext();
			});
		}

		function initPipDatepickers() {
			if (!pipDoc || !pipWindow || !pipWindow.jQuery) {
				return;
			}
			pipJQ = pipWindow.jQuery;
			if (!pipJQ.fn || !pipJQ.fn.datepicker) {
				return;
			}

			FIELDS.forEach(function (field) {
				if (field.type !== "date") {
					return;
				}
				var input = pipInputs[field.key];
				if (!input) {
					return;
				}
				pipJQ(input)
					.datepicker({
						format: "dd/mm/yyyy",
						autoclose: true,
						forceParse: false,
						todayHighlight: true,
						todayBtn: field.todayBtn ? true : false,
						weekStart: 1,
						keyboardNavigation: false,
						orientation: "bottom left",
						container: pipDoc.body,
					})
					.on("changeDate", function () {
						// Fires on calendar picks (and on our own mirror updates,
						// which are guarded). Only push to the calculator here — the
						// value observer mirrors the recompute back afterwards.
						// Calling syncFromMain() synchronously would re-enter this
						// same picker mid-selection (the day click blurs the input),
						// which swallows the first click and needs a second.
						if (suppressPush) {
							return;
						}
						pushToMain(field, input.value);
					})
					.on("hide", function () {
						// Syncs are skipped while the calendar is open; converge
						// once it closes (deferred — hide fires mid-click during
						// autoclose).
						setTimeout(syncFromMain, 0);
					});
			});

			datepickersReady = true;
			// Seed the pickers with whatever the calculator currently holds.
			syncFromMain();
		}

		// Copy same-origin sheets inline (their cssRules are readable); fall back
		// to a <link> for cross-origin CDN sheets, whose cssRules throw.
		function copyStyleSheets(pipWindow) {
			Array.prototype.forEach.call(document.styleSheets, function (styleSheet) {
				try {
					var cssText = Array.prototype.map
						.call(styleSheet.cssRules, function (rule) {
							return rule.cssText;
						})
						.join("");
					var style = document.createElement("style");
					style.textContent = cssText;
					pipWindow.document.head.appendChild(style);
				} catch (err) {
					if (styleSheet.href) {
						var link = document.createElement("link");
						link.rel = "stylesheet";
						link.type = styleSheet.type;
						link.media = styleSheet.media;
						link.href = styleSheet.href;
						pipWindow.document.head.appendChild(link);
					}
				}
			});
		}

		function syncThemeAttributes(pipWindow) {
			["data-bs-theme", "data-bs-core"].forEach(function (attr) {
				var value = document.documentElement.getAttribute(attr);
				if (value) {
					pipWindow.document.documentElement.setAttribute(attr, value);
				}
			});
		}

		function buildPanel() {
			var doc = pipDoc;
			doc.body.className = "pip-body";
			doc.body.textContent = "";
			pipInputs = {};
			pipRadios = {};
			pipCopies = {};

			var wrapper = doc.createElement("div");
			wrapper.className = "pip-wrapper";

			var title = doc.createElement("h1");
			title.className = "pip-title";
			title.textContent = "Gestational Age Calculator";
			wrapper.appendChild(title);

			wrapper.appendChild(buildSelector(doc));

			FIELDS.forEach(function (field) {
				wrapper.appendChild(buildField(doc, field));
			});

			doc.body.appendChild(wrapper);
		}

		function buildSelector(doc) {
			var group = doc.createElement("div");
			group.className = "btn-group btn-group-sm pip-selector";
			group.setAttribute("role", "group");
			group.setAttribute("aria-label", "Choose which value to calculate");

			OPTIONS.forEach(function (option) {
				var input = doc.createElement("input");
				input.type = "radio";
				input.className = "btn-check";
				input.name = "pip-options";
				input.id = option.pipId;
				input.autocomplete = "off";

				var label = doc.createElement("label");
				label.className = "btn btn-outline-secondary";
				label.setAttribute("for", option.pipId);
				label.textContent = option.text;

				input.addEventListener("change", function () {
					if (input.checked) {
						selectOutput(option);
					}
				});

				group.appendChild(input);
				group.appendChild(label);
				pipRadios[option.pipId] = input;
			});

			return group;
		}

		function buildField(doc, field) {
			var groupId = "pip-" + field.key;

			var wrap = doc.createElement("div");
			wrap.className = "pip-field";

			var label = doc.createElement("label");
			label.className = "form-label";
			label.setAttribute("for", groupId);
			label.textContent = field.label;

			var input = doc.createElement("input");
			input.type = "text";
			input.className = "form-control form-control-sm";
			input.id = groupId;
			input.placeholder = field.placeholder;
			input.autocomplete = "off";

			input.addEventListener("input", function () {
				pushToMain(field, input.value);
				syncFromMain();
			});
			// When the field loses focus, pull the canonical (re-formatted) value.
			// Deferred: a blur fired by clicking a day in this field's own
			// calendar arrives on mousedown, before the day's click event. Syncing
			// synchronously would re-render the picker between mousedown and click
			// and swallow the selection (needing a second click).
			input.addEventListener("blur", function () {
				setTimeout(syncFromMain, 0);
			});

			wrap.appendChild(label);
			wrap.appendChild(input);
			pipInputs[field.key] = input;

			var copies = field.copies || [];
			if (copies.length) {
				var copyWrap = doc.createElement("div");
				copyWrap.className = "pip-copies";
				copies.forEach(function (sourceId) {
					copyWrap.appendChild(buildCopyButton(doc, sourceId));
				});
				wrap.appendChild(copyWrap);
			}

			return wrap;
		}

		function buildCopyButton(doc, sourceId) {
			var button = doc.createElement("button");
			button.type = "button";
			button.className = "btn btn-secondary btn-sm pip-copy";
			button.title = "Click to copy";
			button.style.display = "none";
			button.innerHTML = COPY_ICON + '<span class="pip-copy-text"></span>';

			button.addEventListener("click", function () {
				var text = button.getAttribute("data-copy");
				if (!text) {
					return;
				}
				var clipboard = doc.defaultView.navigator.clipboard;
				if (clipboard) {
					clipboard.writeText(text).catch(function (err) {
						console.error("Failed to copy to clipboard:", err);
					});
				}
			});

			pipCopies[sourceId] = button;
			return button;
		}

		// Push a PiP field's value into its main input and run the real pipeline.
		function pushToMain(field, value) {
			if (!jq) {
				return;
			}
			var $main = jq(field.mainSel);
			$main.val(value);
			if (field.type === "date") {
				// Reparse + recompute through bootstrap-datepicker's formatter,
				// then fire input so main.js clears its label when emptied.
				$main.datepicker("update");
				$main.trigger("input");
			} else {
				$main.trigger("input");
			}
		}

		// Select which field the calculator outputs, then force a recompute.
		function selectOutput(option) {
			var mainRadios = document.getElementsByName("options");
			if (mainRadios[option.mainIndex]) {
				mainRadios[option.mainIndex].checked = true;
			}

			// Re-trigger a valid, non-output field so calculate() runs with the
			// new selection and rewrites the output field.
			if (jq) {
				var others = FIELDS.filter(function (f) {
					return f.key !== option.outputKey;
				});
				for (var i = 0; i < others.length; i++) {
					var $main = jq(others[i].mainSel);
					var current = $main.val();
					if (current && current.trim() !== "") {
						if (others[i].type === "date") {
							$main.datepicker("update");
						} else {
							$main.trigger("input");
						}
						break;
					}
				}
			}

			syncFromMain();
		}

		// Mirror the main inputs' values, validity, copy buttons, and selected
		// mode into the PiP window.
		function syncFromMain() {
			if (!pipDoc || !jq) {
				return;
			}

			FIELDS.forEach(syncField);
			syncCopyButtons();

			var mainRadios = document.getElementsByName("options");
			OPTIONS.forEach(function (option) {
				var radio = pipRadios[option.pipId];
				var mainRadio = mainRadios[option.mainIndex];
				if (radio && mainRadio) {
					radio.checked = mainRadio.checked;
				}
			});
		}

		function syncField(field) {
			var input = pipInputs[field.key];
			if (!input) {
				return;
			}
			var $main = jq(field.mainSel);
			input.classList.toggle("is-valid", $main.hasClass("is-valid"));
			input.classList.toggle("is-invalid", $main.hasClass("is-invalid"));

			// Don't overwrite the field the user is currently editing.
			if (pipDoc.activeElement === input) {
				return;
			}

			// For date fields, use the canonical DD/MM/YYYY value the calculator
			// publishes; the raw main input can hold formats the picker can't
			// parse (and would otherwise fall back to today's date).
			var value;
			if (field.type === "date" && field.dateSourceId) {
				var source = document.getElementById(field.dateSourceId);
				value = source ? source.getAttribute("data-date") : null;
			} else {
				value = $main.val();
			}
			value = value == null ? "" : value;

			if (field.type === "date" && datepickersReady && pipJQ) {
				// Never touch a picker whose calendar is open: update() always
				// rebuilds the day grid (fill()), and a rebuild between the
				// mousedown and click of a day selection detaches the clicked
				// cell, swallowing the pick. The hide handler resyncs instead.
				var dp = pipJQ(input).data("datepicker");
				if (dp && dp.picker && dp.picker.is(":visible")) {
					return;
				}
				// Already in sync — skip the pointless re-render.
				if (input.value === value) {
					return;
				}
				// Update through the picker so its calendar highlight tracks too.
				suppressPush = true;
				try {
					pipJQ(input).datepicker("update", value);
				} catch (err) {
					if (input.value !== value) {
						input.value = value;
					}
				}
				suppressPush = false;
			} else if (input.value !== value) {
				input.value = value;
			}
		}

		// Mirror the main summary elements' formatted values into the PiP copy
		// buttons, hiding any that have no value (matching the main page).
		function syncCopyButtons() {
			Object.keys(pipCopies).forEach(function (sourceId) {
				var button = pipCopies[sourceId];
				var source = document.getElementById(sourceId);
				var value = source ? source.getAttribute("data-date") : null;
				var textEl = button.querySelector(".pip-copy-text");

				if (value) {
					if (textEl) {
						textEl.textContent = value;
					}
					button.setAttribute("data-copy", value);
					button.style.display = "";
					button.disabled = false;
				} else {
					if (textEl) {
						textEl.textContent = "";
					}
					button.removeAttribute("data-copy");
					button.style.display = "none";
					button.disabled = true;
				}
			});
		}
	});
})();
