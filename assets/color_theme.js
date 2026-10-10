/*!
 * Color mode toggler — adapted from Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2023 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 */

(() => {
	"use strict";

	// Storage can be blocked (strict cookie settings, some kiosks). Treat that as
	// "no saved choice", and accept only the two values this page writes.
	const getStoredTheme = () => {
		try {
			const stored = localStorage.getItem("theme");
			return stored === "light" || stored === "dark" ? stored : null;
		} catch (e) {
			return null;
		}
	};

	const getPreferredTheme = () => {
		return getStoredTheme() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	};

	// The toggle button's icon follows this attribute through CSS, so it can't go stale.
	const setTheme = (theme) => {
		document.documentElement.setAttribute("data-bs-theme", theme);
	};

	// Apply the preferred theme as early as possible to avoid a flash of the wrong theme.
	setTheme(getPreferredTheme());

	// Follow the OS setting only while the user hasn't made an explicit choice.
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (!getStoredTheme()) {
			setTheme(getPreferredTheme());
		}
	});

	// Another copy of the page (a second tab, or the Picture-in-Picture window) changed the theme.
	window.addEventListener("storage", (event) => {
		if (event.key === "theme" || event.key === null) {
			setTheme(getPreferredTheme());
		}
	});

	// Toggle between light and dark, persisting the choice to localStorage.
	window.toggleDarkMode = () => {
		const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
		setTheme(next);
		try {
			localStorage.setItem("theme", next);
		} catch (e) {}
	};
})();
