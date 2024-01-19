/*!
 * Color mode toggler for Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2023 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 */

(() => {
	"use strict";

	const getStoredTheme = () => localStorage.getItem("theme");
	const setStoredTheme = (theme) => localStorage.setItem("theme", theme);

	const getPreferredTheme = () => {
		const storedTheme = getStoredTheme();
		if (storedTheme) {
			return storedTheme;
		}

		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	};

	const setTheme = (theme) => {
		if (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
			document.documentElement.setAttribute("data-bs-theme", "dark");
			console.log("auto");
		} else {
			console.log(`Setting theme to: ${theme}`);
			document.documentElement.setAttribute("data-bs-theme", theme);
		}
	};

	setTheme(getPreferredTheme());

	const showActiveTheme = (theme, focus = false) => {
		const themeSwitcher = document.querySelector("#bd-theme");

		if (!themeSwitcher) {
			return;
		}

		const themeSwitcherText = document.querySelector("#bd-theme-text");
		const activeThemeIcon = document.querySelector(".theme-icon-active use");
		const btnToActive = document.querySelector(`[data-bs-theme-value="${theme}"]`);
		const svgOfActiveBtn = btnToActive.querySelector("svg use").getAttribute("href");

		document.querySelectorAll("[data-bs-theme-value]").forEach((element) => {
			element.classList.remove("active");
			element.setAttribute("aria-pressed", "false");
		});

		btnToActive.classList.add("active");
		btnToActive.setAttribute("aria-pressed", "true");
		activeThemeIcon.setAttribute("href", svgOfActiveBtn);
		const themeSwitcherLabel = `${themeSwitcherText.textContent} (${btnToActive.dataset.bsThemeValue})`;
		themeSwitcher.setAttribute("aria-label", themeSwitcherLabel);

		if (focus) {
			themeSwitcher.focus();
		}
	};

	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		const storedTheme = getStoredTheme();
		if (storedTheme !== "light" && storedTheme !== "dark") {
			setTheme(getPreferredTheme());
		}
	});
})();

let defaultFlavortext = "Light/Dark<br />Mode";
let darkFlavortext = "Wish You<br />Were Here";
let lightFlavortext = "Day 3<br />1:3";

document.addEventListener("DOMContentLoaded", function () {
	var rootPreference = document.documentElement.getAttribute("data-bs-theme");
	if (rootPreference === "dark" || rootPreference === null) {
		document.getElementById("colorToggle").innerHTML = lightFlavortext;
	} else if (rootPreference === "light" || rootPreference === null) {
		document.getElementById("colorToggle").innerHTML = darkFlavortext;
	} else {
		document.getElementById("colorToggle").innerHTML = defaultFlavortext;
	}
});

// Below is modified code from https://www.gethalfmoon.com/

// Function to read cookie
function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(";");
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) === " ") {
			c = c.substring(1, c.length);
		}
		if (c.indexOf(nameEQ) === 0) {
			return c.substring(nameEQ.length, c.length);
		}
	}
	return null;
}

// Function to set cookie
function setCookie(name, value, days) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// Set system preference if cookie (with saved preference) not present
var systemColorMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
if (readCookie("halfmoonColorMode") === null) {
	document.documentElement.setAttribute("data-bs-theme", systemColorMode);
}

// Function to toggle dark mode and set cookie
function toggleDarkMode() {
	var rootPreference = document.documentElement.getAttribute("data-bs-theme");
	if (rootPreference === "light" || rootPreference === null) {
		document.documentElement.setAttribute("data-bs-theme", "dark");
		$("#colorToggle").html(lightFlavortext);
		setCookie("halfmoonColorMode", "dark", 365);
	} else {
		document.documentElement.setAttribute("data-bs-theme", "light");
		$("#colorToggle").html(darkFlavortext);
		setCookie("halfmoonColorMode", "light", 365);
	}
}

// Function to set the core
function setCore(src) {
	document.documentElement.setAttribute("data-bs-core", src.value);
	try {
		document.getElementById(src.value + "-core-1").checked = true;
		document.getElementById(src.value + "-core-2").checked = true;
		document.getElementById(src.value + "-core-3").checked = true;
		document.getElementById(src.value + "-core-4").checked = true;
		document.getElementById(src.value + "-core-5").checked = true;
	} catch (e) {}
	try {
		document.querySelectorAll(".core-theme-indicator").forEach((indicator) => {
			indicator.classList.add("d-none");
		});
	} catch (e) {}
	setCookie("halfmoonCore", src.value, 365);
}
