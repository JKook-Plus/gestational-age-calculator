/*
 * Document Picture-in-Picture: pops out a small, always-on-top summary of the
 * calculator (Estimated Due Date, "at this date", and Gestational Age) that
 * stays live while the user works in another tab or app.
 *
 * Docs: https://developer.chrome.com/docs/web-platform/document-picture-in-picture
 */
(function () {
	"use strict";

	// Feature detection. The button starts hidden (display: none in the markup),
	// so on unsupported browsers we simply leave it hidden and do nothing.
	if (!("documentPictureInPicture" in window)) {
		return;
	}

	document.addEventListener("DOMContentLoaded", function () {
		var pipButton = document.getElementById("pipToggle");
		if (!pipButton) {
			return;
		}

		// The API is available, so reveal the button.
		pipButton.style.display = "";

		// The four elements the main calculator keeps updated. Each stores its
		// current value in a data-date attribute.
		var SOURCES = [
			{ id: "estimated-due-date-text", key: "edd" },
			{ id: "estimated-due-date-word-text", key: "eddWord" },
			{ id: "calculateDateText", key: "fromDate" },
			{ id: "gestationalAgeText", key: "ga" },
		];

		var valueObserver = null;
		var themeObserver = null;
		var pipValueEls = {};

		pipButton.addEventListener("click", function () {
			// Toggle: close if one is already open, otherwise open a new one.
			if (documentPictureInPicture.window) {
				documentPictureInPicture.window.close();
				return;
			}
			openPipWindow();
		});

		async function openPipWindow() {
			var pipWindow;
			try {
				// requestWindow() must run inside the user gesture, so it is the
				// first thing we await.
				pipWindow = await documentPictureInPicture.requestWindow({ width: 360, height: 260 });
			} catch (err) {
				console.error("Could not open the Picture-in-Picture window:", err);
				return;
			}

			pipWindow.document.title = "Gestational Age Calculator";
			copyStyleSheets(pipWindow);
			syncThemeAttributes(pipWindow);
			buildPanel(pipWindow);
			refreshValues();

			// Mirror any change the calculator makes into the PiP panel.
			valueObserver = new MutationObserver(refreshValues);
			SOURCES.forEach(function (source) {
				var el = document.getElementById(source.id);
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
				pipValueEls = {};
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

		function buildPanel(pipWindow) {
			var doc = pipWindow.document;
			doc.body.className = "pip-body";
			doc.body.textContent = "";
			pipValueEls = {};

			var wrapper = doc.createElement("div");
			wrapper.className = "pip-wrapper";

			var title = doc.createElement("h1");
			title.className = "pip-title";
			title.textContent = "Gestational Age Calculator";
			wrapper.appendChild(title);

			wrapper.appendChild(buildRow(doc, "edd", "Estimated Due Date", "eddWord"));
			wrapper.appendChild(buildRow(doc, "fromDate", "At this date", null));
			wrapper.appendChild(buildRow(doc, "ga", "Gestational Age", null));

			doc.body.appendChild(wrapper);
		}

		function buildRow(doc, key, labelText, subKey) {
			var row = doc.createElement("button");
			row.type = "button";
			row.className = "pip-row pip-empty";
			row.title = "Click to copy";
			row.disabled = true;

			var label = doc.createElement("span");
			label.className = "pip-label";
			label.textContent = labelText;

			var valueWrap = doc.createElement("span");
			valueWrap.className = "pip-value-wrap";

			var value = doc.createElement("span");
			value.className = "pip-value";
			value.textContent = "—";
			valueWrap.appendChild(value);
			pipValueEls[key] = value;

			if (subKey) {
				var sub = doc.createElement("span");
				sub.className = "pip-sub";
				valueWrap.appendChild(sub);
				pipValueEls[subKey] = sub;
			}

			row.appendChild(label);
			row.appendChild(valueWrap);

			row.addEventListener("click", function () {
				var text = value.getAttribute("data-copy");
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

			return row;
		}

		function refreshValues() {
			var values = {};
			SOURCES.forEach(function (source) {
				var el = document.getElementById(source.id);
				values[source.key] = el ? el.getAttribute("data-date") : null;
			});

			setValue("edd", values.edd);
			setSub("eddWord", values.eddWord);
			setValue("fromDate", values.fromDate);
			setValue("ga", values.ga);
		}

		function setValue(key, text) {
			var el = pipValueEls[key];
			if (!el) {
				return;
			}
			var row = el.closest(".pip-row");
			if (text) {
				el.textContent = text;
				el.setAttribute("data-copy", text);
				if (row) {
					row.classList.remove("pip-empty");
					row.disabled = false;
				}
			} else {
				el.textContent = "—";
				el.removeAttribute("data-copy");
				if (row) {
					row.classList.add("pip-empty");
					row.disabled = true;
				}
			}
		}

		function setSub(key, text) {
			var el = pipValueEls[key];
			if (!el) {
				return;
			}
			el.textContent = text || "";
		}
	});
})();
