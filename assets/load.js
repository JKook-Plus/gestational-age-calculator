/*
 * Loads the libraries from assets/vendor, then starts the calculator.
 */
(function () {
	"use strict";

	// The libraries carry their versions in their file names.
	var LIBRARIES = ["assets/vendor/jquery-3.7.1.min.js", "assets/vendor/moment-2.30.1.min.js", "assets/vendor/bootstrap-datepicker-1.10.0.min.js"];

	// Added to the calculator's own file names so that a new release is never
	// mixed with cached copies of the old one. Change it, and the ?v= tags in
	// index.html, whenever these files change.
	var VERSION = "2026-10-20";

	// The calculator's own files, in dependency order.
	var APP = ["assets/calc.js", "assets/main.js", "assets/pip.js", "assets/weeks.js", "assets/calendar.js"].map(function (file) {
		return file + "?v=" + VERSION;
	});

	var FILES = LIBRARIES.concat(APP);

	function showLoadError() {
		var message = document.getElementById("loadError");
		if (message) {
			message.hidden = false;
		}
	}

	// Each file waits for the one before it, which keeps them in order.
	function load(index) {
		if (index >= FILES.length) {
			return;
		}
		var script = document.createElement("script");
		script.src = FILES[index];
		script.onload = function () {
			load(index + 1);
		};
		script.onerror = showLoadError;
		document.head.appendChild(script);
	}

	load(0);
})();
