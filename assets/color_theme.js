/*!
 * Color mode toggler — adapted from Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2023 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 */

(() => {
	"use strict";

	const getStoredTheme = () => localStorage.getItem("theme");

	const getPreferredTheme = () => {
		const storedTheme = getStoredTheme();
		if (storedTheme) {
			return storedTheme;
		}

		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	};

	const setTheme = (theme) => {
		if (theme === "auto") {
			theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		}
		document.documentElement.setAttribute("data-bs-theme", theme);
	};

	// Apply the preferred theme as early as possible to avoid a flash of the wrong theme.
	setTheme(getPreferredTheme());

	// Follow the OS setting only while the user hasn't made an explicit choice.
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		const storedTheme = getStoredTheme();
		if (storedTheme !== "light" && storedTheme !== "dark") {
			setTheme(getPreferredTheme());
		}
	});
})();

let defaultFlavorText = "Light/Dark<br />Mode";
let darkFlavorText = "Wish You<br />Were Here";
let lightFlavorText = "Day 3<br />1:3";

// Update the toggle button's flavour text to match the active theme.
function updateColorToggleText() {
	var toggle = document.getElementById("colorToggle");
	if (!toggle) {
		return;
	}

	var theme = document.documentElement.getAttribute("data-bs-theme");
	if (theme === "dark") {
		toggle.innerHTML = lightFlavorText;
	} else if (theme === "light") {
		toggle.innerHTML = darkFlavorText;
	} else {
		toggle.innerHTML = defaultFlavorText;
	}
}

document.addEventListener("DOMContentLoaded", updateColorToggleText);

// Toggle between light and dark, persisting the choice to localStorage.
function toggleDarkMode() {
	var current = document.documentElement.getAttribute("data-bs-theme");
	var next = current === "dark" ? "light" : "dark";

	document.documentElement.setAttribute("data-bs-theme", next);
	try {
		localStorage.setItem("theme", next);
	} catch (e) {}
	updateColorToggleText();
}
