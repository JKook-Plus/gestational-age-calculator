/*
 * Document Picture-in-Picture: pops out a small, always-on-top copy of the
 * calculator.
 *
 * The floating window holds a frame showing this same page, loaded with
 * ?pip=<id>. That copy runs the real calculator in its own document, so its
 * fields, calendars and copy buttons behave exactly like the main page's.
 * main.js mirrors the fields between the two copies over a channel named
 * after the id.
 *
 * Docs: https://developer.chrome.com/docs/web-platform/document-picture-in-picture
 */
(function () {
	"use strict";

	// Feature detection. The button starts hidden (display: none in the markup),
	// so on unsupported browsers we leave it hidden and do nothing. The copy
	// inside the floating window has no button of its own.
	if (!("documentPictureInPicture" in window) || document.documentElement.classList.contains("pip")) {
		return;
	}

	var pipButton = document.getElementById("pipToggle");
	if (!pipButton) {
		return;
	}

	// The API is available, so reveal the button.
	pipButton.style.display = "";

	function setButtonActive(isActive) {
		pipButton.classList.toggle("active", isActive);
		pipButton.setAttribute("aria-pressed", isActive ? "true" : "false");
	}

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
			pipWindow = await documentPictureInPicture.requestWindow({ width: 380, height: 440 });
		} catch (err) {
			console.error("Could not open the Picture-in-Picture window:", err);
			return;
		}

		var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
		if (window.GAPage) {
			window.GAPage.connect(id);
		}

		var pipDoc = pipWindow.document;
		pipDoc.title = "Gestational Age Calculator";
		pipDoc.documentElement.lang = "en";
		pipDoc.body.style.margin = "0";
		// Match the page behind the frame so there is no white flash in dark mode.
		pipDoc.body.style.background = getComputedStyle(document.body).backgroundColor;

		var frame = pipDoc.createElement("iframe");
		frame.src = window.location.origin + window.location.pathname + "?pip=" + id;
		frame.title = "Gestational Age Calculator";
		frame.style.cssText = "display:block;width:100%;height:100vh;border:0";
		pipDoc.body.appendChild(frame);

		setButtonActive(true);

		pipWindow.addEventListener("pagehide", function () {
			if (window.GAPage) {
				window.GAPage.disconnect();
			}
			setButtonActive(false);
		});
	}
})();
