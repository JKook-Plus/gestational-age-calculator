/*
 * Loads the libraries from their CDNs, falls back to the copies in
 * assets/vendor when a CDN is blocked or slow, then starts the calculator.
 */
(function () {
	"use strict";

	var LIBRARIES = [
		{
			cdn: "https://code.jquery.com/jquery-3.7.1.min.js",
			integrity: "sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs",
			local: "assets/vendor/jquery-3.7.1.min.js",
		},
		{
			cdn: "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js",
			integrity: "sha384-KIix3a0qkeD2RPwPvpkJ+Knc91vkmDI+i2c7phIO+EfV3dpfDXIGSqQjpIaJXlR9",
			local: "assets/vendor/moment-2.30.1.min.js",
		},
		{
			cdn: "https://cdn.jsdelivr.net/npm/bootstrap-datepicker@1.10.0/dist/js/bootstrap-datepicker.min.js",
			integrity: "sha384-hrC0I6QUg0tSdzNW47DRT7ohgBLywmjg37cLYZbdXVZLJHwJhFfqo7ouWr5yfSmv",
			local: "assets/vendor/bootstrap-datepicker-1.10.0.min.js",
		},
	];

	// Added to the calculator's own file names so that a new release is never
	// mixed with cached copies of the old one. Change it, and the ?v= tags in
	// index.html, whenever these files change.
	var VERSION = "2026-10-20";

	// The calculator's own files, in dependency order.
	var APP = ["assets/calc.js", "assets/main.js", "assets/pip.js", "assets/weeks.js", "assets/calendar.js"].map(function (file) {
		return file + "?v=" + VERSION;
	});

	// A blocked CDN can hang instead of failing, so give up on it after this long.
	var CDN_TIMEOUT_MS = 4000;

	function addScript(src, integrity, done) {
		var script = document.createElement("script");
		var settled = false;
		var timer = null;

		function finish(ok) {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			done(ok);
		}

		script.src = src;
		if (integrity) {
			script.integrity = integrity;
			script.crossOrigin = "anonymous";
			timer = setTimeout(function () {
				finish(false);
			}, CDN_TIMEOUT_MS);
		}
		script.onload = function () {
			finish(true);
		};
		script.onerror = function () {
			finish(false);
		};
		document.head.appendChild(script);
	}

	function showLoadError() {
		var message = document.getElementById("loadError");
		if (message) {
			message.hidden = false;
		}
	}

	function loadApp(index) {
		if (index >= APP.length) {
			return;
		}
		addScript(APP[index], null, function (ok) {
			if (ok) {
				loadApp(index + 1);
			} else {
				showLoadError();
			}
		});
	}

	function loadLibrary(index) {
		if (index >= LIBRARIES.length) {
			loadApp(0);
			return;
		}
		var library = LIBRARIES[index];
		addScript(library.cdn, library.integrity, function (ok) {
			if (ok) {
				loadLibrary(index + 1);
				return;
			}
			addScript(library.local, null, function (localOk) {
				if (localOk) {
					loadLibrary(index + 1);
				} else {
					showLoadError();
				}
			});
		});
	}

	loadLibrary(0);
})();
