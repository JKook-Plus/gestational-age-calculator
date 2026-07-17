/*
 * Document Picture-in-Picture: pops out a small, always-on-top, fully
 * interactive copy of the calculator. The PiP window holds its own editable
 * fields and mode selector that are wired bidirectionally to the real inputs
 * in the main document:
 *
 *   - Editing a PiP field pushes the value into the matching main input and
 *     re-runs the real calculation pipeline (dates go through bootstrap-
 *     datepicker, so every supported format still works).
 *   - Any recompute on the main side is mirrored back into the PiP fields.
 *
 * main.js resolves every field via jQuery $("#id") against the main document
 * and bootstrap-datepicker anchors its calendar to the main body, so the card
 * itself can't simply be relocated; this remote-control approach keeps main.js
 * as the single source of truth.
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

	// The three calculator fields and their matching main-document inputs.
	var FIELDS = [
		{
			key: "edd",
			label: "Estimated Due Date (EDD)",
			mainSel: "#EDDDatepicker",
			type: "date",
			placeholder: "e.g. 3/7/2024 or t+3",
		},
		{
			key: "fromDate",
			label: "At this date",
			mainSel: "#dateFromDatepicker",
			type: "date",
			placeholder: "e.g. today or t+3",
		},
		{
			key: "ga",
			label: "Gestational Age (weeks+days)",
			mainSel: "#gestationalAge",
			type: "ga",
			placeholder: "e.g. 39+2 or 39w2d",
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
		var pipInputs = {};
		var pipRadios = {};
		var valueObserver = null;
		var themeObserver = null;

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
				pipWindow = await documentPictureInPicture.requestWindow({ width: 380, height: 320 });
			} catch (err) {
				console.error("Could not open the Picture-in-Picture window:", err);
				return;
			}

			pipDoc = pipWindow.document;
			pipDoc.title = "Gestational Age Calculator";
			copyStyleSheets(pipWindow);
			syncThemeAttributes(pipWindow);
			buildPanel();
			syncFromMain();

			// Mirror any recompute on the main side into the PiP fields. The
			// calculator rewrites these summary elements whenever it runs.
			valueObserver = new MutationObserver(syncFromMain);
			["estimated-due-date-text", "calculateDateText", "gestationalAgeText"].forEach(function (id) {
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
				pipInputs = {};
				pipRadios = {};
				setButtonActive(false);
			});
		}

		function setButtonActive(isActive) {
			pipButton.classList.toggle("active", isActive);
			pipButton.setAttribute("aria-pressed", isActive ? "true" : "false");
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

			var hint = doc.createElement("p");
			hint.className = "pip-hint";
			hint.textContent = "Fill any two values — the third is calculated.";
			wrapper.appendChild(hint);

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

			input.addEventListener("input", function () {
				pushToMain(field, input.value);
				syncFromMain();
			});
			// When the field loses focus, pull the canonical (re-formatted) value.
			input.addEventListener("blur", syncFromMain);

			wrap.appendChild(label);
			wrap.appendChild(input);
			pipInputs[field.key] = input;
			return wrap;
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

		// Mirror the main inputs' values, validity, and selected mode into PiP.
		function syncFromMain() {
			if (!pipDoc || !jq) {
				return;
			}

			FIELDS.forEach(function (field) {
				var input = pipInputs[field.key];
				if (!input) {
					return;
				}
				var $main = jq(field.mainSel);
				input.classList.toggle("is-valid", $main.hasClass("is-valid"));
				input.classList.toggle("is-invalid", $main.hasClass("is-invalid"));

				// Don't overwrite the field the user is currently typing in.
				if (pipDoc.activeElement !== input) {
					var value = $main.val();
					value = value == null ? "" : value;
					if (input.value !== value) {
						input.value = value;
					}
				}
			});

			var mainRadios = document.getElementsByName("options");
			OPTIONS.forEach(function (option) {
				var radio = pipRadios[option.pipId];
				var mainRadio = mainRadios[option.mainIndex];
				if (radio && mainRadio) {
					radio.checked = mainRadio.checked;
				}
			});
		}
	});
})();
