$(function () {
	// run on load
	$("#EDDDatepicker").datepicker({
		format: {
			toDisplay: function (date, format, language) {
				validatedDate = validateDate(date);
				dateFormValidate(validatedDate, date, "#EDDDatepicker");
				calculate("#EDDDatepicker", validatedDate);
				return customToDisplay(validatedDate, format, language, "#estimated-due-date-text", "Estimated Due Date (EDD)");
			},
			toValue: function (date, format, language) {
				validatedDate = validateDate(date);
				dateFormValidate(validatedDate, date, "#EDDDatepicker");
				calculate("#EDDDatepicker", validatedDate);
				return customToValue(validatedDate, format, language, "#estimated-due-date-text", "Estimated Due Date (EDD)");
			},
		},
		autoclose: true,
		todayBtn: false,
		forceParse: false,
		immediateUpdates: true,
		weekStart: 1,
		todayHighlight: true,
		keyboardNavigation: false,
		orientation: "left",
	});

	$("#dateFromDatepicker").datepicker({
		format: {
			toDisplay: function (date, format, language) {
				validatedDate = validateDate(date);
				dateFormValidate(validatedDate, date, "#dateFromDatepicker");
				calculate("#dateFromDatepicker", validatedDate);
				return customToDisplay(validatedDate, format, language, "#calculateDateText", "Calculate from date");
			},
			toValue: function (date, format, language) {
				validatedDate = validateDate(date);
				dateFormValidate(validatedDate, date, "#dateFromDatepicker");
				calculate("#dateFromDatepicker", validatedDate);
				return customToValue(validatedDate, format, language, "#calculateDateText", "Calculate from date");
			},
		},
		autoclose: true,
		todayBtn: true,
		forceParse: false,
		immediateUpdates: true,
		weekStart: 1,
		todayHighlight: true,
		keyboardNavigation: false,
		orientation: "left",
	});

	$("#dateFromDatepicker")
		.datepicker()
		.on("input", function () {
			val = $(this).datepicker("getValue").val();
			if (val === null || val.match(/^ *$/) !== null) {
				$(this).removeClass("is-invalid");
				$(this).removeClass("is-valid");
				$("#calculateDateText").html("");
			}
		});

	$("#EDDDatepicker")
		.datepicker()
		.on("input", function () {
			val = $(this).datepicker("getValue").val();
			if (val === null || val.match(/^ *$/) !== null) {
				$(this).removeClass("is-invalid");
				$(this).removeClass("is-valid");
				$("#estimated-due-date-text").html("");
				$("#estimated-due-date-word-text").html("");
			}
		});

	function validateDate(userInput) {
		var validDateFormats = [
			"DD/MM/YYYY", // 03/07/2024
			"DD/MM/YY", // 03/07/24
			"DD/MM", // 03/07
			"D/MM/YYYY", // 3/07/2024
			"D/MM/YY", // 3/07/24
			"D/MM", // 3/07
			"DD/M/YYYY", // 03/7/2024
			"DD/M/YY", // 03/7/24
			"DD/M", // 03/7
			"D/M/YYYY", // 3/7/2024
			"D/M/YY", // 3/7/24
			"D/M", // 3/7
			"YYYY/MM/DD", // 2024/07/03
			"YY/MM/DD", // 24/07/03
			"DD-MMM-YYYY", // 03-Jul-2024
			"D-MMM-YYYY", // 3-Jul-2024
			"MMMM DD YYYY", // July 03 2024
			"MMM DD YYYY", // Jul 03 2024
			"MMM D YYYY", // Jul 3 2024
			"MMMM, D YYYY", // July, 3 2024
			"MMMM D, YYYY", // July 3, 2024
			"MMM DD, YYYY", // Jul 03, 2024
			"MMM D, YYYY", // Jul 3, 2024
			"DD MMMM YYYY", // 03 July 2024
			"DD MMMM", // 03 July
			"D MMMM YYYY", // 3 July 2024
			"DD MMM YYYY", // 03 Jul 2024
			"DD MMM", // 03 Jul
			"D MMM", // 3 Jul
			"DDMMM", // 03Jul
			"DD, MMM", // 03, Jul
			"DD,MMM", // 03,Jul
			"DD MMM YY", // 03 Jul 24
			"DMMM", // 3Jul
			"D, MMM", // 3, Jul
			"D,MMM", // 3,Jul
			"D MMM YY", // 3 Jul 24
			"D MMM YYYY", // 3 Jul 2024
			"YYYY-MM-DD", // 2024-07-03
			"MMM DD", // Jul 03
			"MMM D", // Jul 3
			"MMMM DD", // July 03
			"MMMM D", // July 3
			"DD.MM.YYYY", // 03.07.2024
			"DD.MM.YY", // 03.07.24
			"DD.MM", // 03.07
			"D.M.YY", // 3.7.24
			"D.M.YYYY", // 3.7.2024
			"DD MMMM, YYYY", // 03 July, 2024
			"D MMMM, YYYY", // 3 July, 2024
			"MMM DD, YY", // Jul 03, 24
			"DDMM", // 0307
			"DD MM", // 03 07
			"D MM", // 3 07
			"DD M", // 03 7
			"D M", // 3 7
			"DDMMYY", // 030724
			"DDMMYYYY", // 03072024
			"DDMM YY", // 0307 24
			"DDMM YYYY", // 0307 2024
			"DD MM YY", // 03 07 24
			"DD MM YYYY", // 03 07 2024
			"D MMYY", // 3 07 24
			"D MMYYYY", // 3 07 2024
			"DD M YY", // 03 7 24
			"DD M YYYY", // 03 7 2024
			"D M YY", // 3 7 24
			"D M YYYY", // 3 7 2024
		];

		try {
			userInput = userInput.trim();
		} catch {}

		try {
			if (userInput.toLowerCase() == "t") {
				return moment.utc();
			}

			var matchDays = userInput.match(/t\+(\d+)/i);
			var matchWays = userInput.match(/w\+(\d+)/i);
			var matchMonths = userInput.match(/m\+(\d+)/i);
			var matchYears = userInput.match(/y\+(\d+)/i);
			if (matchDays) {
				var days = matchDays[1];
				return moment.utc().add(days, "days");
			}
			if (matchWays) {
				var weeks = matchWays[1];
				return moment.utc().add(weeks, "weeks");
			}
			if (matchMonths) {
				var months = matchMonths[1];
				return moment.utc().add(months, "months");
			}
			if (matchYears) {
				var years = matchYears[1];
				return moment.utc().add(years, "years");
			}
		} catch {}

		var parsedDate = moment.utc(userInput, validDateFormats, true);

		return parsedDate;
	}

	function dateFormValidate(validatedDate, date, datepickerID) {
		if (typeof date === "string" || date instanceof String) {
			if (date.replace(/\s/g, "") == "") {
				$(datepickerID).removeClass("is-invalid").removeClass("is-valid");
				return false;
			}
		}

		isValid = validatedDate.isValid();

		if (isValid) {
			$(datepickerID).addClass("is-valid");
			$(datepickerID).removeClass("is-invalid");
			return true;
		} else {
			$(datepickerID).addClass("is-invalid");
			$(datepickerID).removeClass("is-valid");
			return false;
		}
	}

	function GAFormValidate(input) {
		GAform = $("#gestationalAge");
		if (input != "" && input != null) {
			if (textToGestationalAge(input) != null) {
				GAform.addClass("is-valid");
				GAform.removeClass("is-invalid");
				return true;
			} else {
				GAform.addClass("is-invalid");
				GAform.removeClass("is-valid");
				return false;
			}
		} else {
			GAform.removeClass("is-invalid");
			GAform.removeClass("is-valid");
			return false;
		}
	}

	function customToValue(validatedDate, format, language, textId, textPrefix) {
		updateLabels(validatedDate, textId, textPrefix);
		if (validatedDate.isValid()) {
			return validatedDate.toDate();
		} else {
			return null;
		}
	}

	function customToDisplay(validatedDate, format, language, textId, textPrefix) {
		updateLabels(validatedDate, textId, textPrefix);
		if (validatedDate.isValid()) {
			return validatedDate.format("DD/MM/YYYY");
		} else {
			return null;
		}
	}

	function calculate(idOfUpdate, val) {
		expectedDueDate = validateDate($("#EDDDatepicker").val());
		calcFromDate = validateDate($("#dateFromDatepicker").val());
		gestationalAge = $("#gestationalAge").val();

		if (idOfUpdate == "#EDDDatepicker") {
			expectedDueDate = val;
		}

		if (idOfUpdate == "#dateFromDatepicker") {
			calcFromDate = val;
		}

		var radioButtons = document.getElementsByName("options");
		for (var i = 0; i < radioButtons.length; i++) {
			if (radioButtons[i].checked) {
				selectedValue = radioButtons[i].id;
				break;
			}
		}

		valid = 0;

		if (expectedDueDate.isValid()) {
			isExpectedDueDateValid = true;
			valid++;
		} else {
			isExpectedDueDateValid = false;
		}
		if (calcFromDate.isValid()) {
			isCalcFromDateValid = true;
			valid++;
		} else {
			isCalcFromDateValid = false;
		}
		if ((gestationalAge != "") | (gestationalAge != null)) {
			if (textToGestationalAge(gestationalAge) != null) {
				isGestationalAgeValid = true;
				valid++;
			} else {
				isGestationalAgeValid = false;
			}
		} else {
			isGestationalAgeValid = false;
		}

		if (valid == 2) {
			if (!isExpectedDueDateValid && $("#EDDDatepicker").val() === "" && selectedValue != "option1") {
				$("[name='options']")[0].checked = true;
				selectedValue = "option1";
			} else if (!isCalcFromDateValid && $("#dateFromDatepicker").val() === "" && selectedValue != "option2") {
				$("[name='options']")[1].checked = true;
				selectedValue = "option2";
			} else if (!isGestationalAgeValid && $("#gestationalAge").val() === "" && selectedValue != "option3") {
				$("[name='options']")[2].checked = true;
				selectedValue = "option3";
			}
		}

		if (valid >= 2) {
			// UPDATE EDD
			if (isCalcFromDateValid && isGestationalAgeValid && idOfUpdate != "#EDDDatepicker" && selectedValue == "option1") {
				validGA = textToGestationalAge(gestationalAge);

				EDD = calcFromDate.add(40 * 7 - (validGA[1] + validGA[0] * 7), "days");

				$("#EDDDatepicker").datepicker("update", EDD);
			}
			// UPDATE GA
			else if (isExpectedDueDateValid && isCalcFromDateValid && idOfUpdate != "#gestationalAge" && selectedValue == "option3") {
				GAInDays = 40 * 7 - Math.round(expectedDueDate.diff(calcFromDate, "days", true));

				$("#gestationalAge").val(`${Math.floor(GAInDays / 7)} weeks ${Math.round(GAInDays % 7)} days`);

				updateGestationalAge($("#gestationalAge").val());
			}
			// UPDATE At this date
			else if (isGestationalAgeValid && isExpectedDueDateValid && idOfUpdate != "#dateFromDatepicker" && selectedValue == "option2") {
				validGA = textToGestationalAge(gestationalAge);

				atThisDate = expectedDueDate.subtract(40 * 7 - (validGA[1] + validGA[0] * 7), "days");

				$("#dateFromDatepicker").datepicker("update", atThisDate);
			}
		} else {
		}
	}

	function updateLabels(validatedDate, textId, textPrefix) {
		if (validatedDate.isValid()) {
			var formattedDate = validatedDate.format("DD/MM/YYYY");
			$(textId).html(`${textPrefix}: ${formattedDate}`);

			if (textId == "#estimated-due-date-text") {
				var formattedDate = validatedDate.format("MMMM DD YYYY");
				$("#estimated-due-date-word-text").html(`${formattedDate}`);
			}
			return;
		} else {
			if (textId == "#estimated-due-date-text") {
				$("#estimated-due-date-word-text").html("");
			}
			$(textId).html("");
			return;
		}
	}

	function textToGestationalAge(userInput) {
		const regex1 = /^(\d+)\s*(?:\+\s*(\d+)\s*d?)?(?:\/\s*(\d+)\s*d?)?$/;
		const regex2 = /^(\d+)\s*w(?:eeks?)?(?:\s*and)?(?:\s*(\d+)\s*d(?:ays?)?)?$/;

		userInput = userInput.trim();

		const match1 = userInput.match(regex1);
		const match2 = userInput.match(regex2);

		if (match1 || match2) {
			let weeks, days;

			if (match1) {
				const weeks1 = parseInt(match1[1], 10);
				const days1 = match1[2] ? parseInt(match1[2], 10) : 0;
				const days2 = match1[3] && !userInput.includes("/") ? parseInt(match1[3], 10) : 0; // Only consider days2 if no slash present
				const totalDays = days1 + days2;

				if (!match2 || (totalDays > 0 && totalDays <= 6)) {
					weeks = weeks1;
					days = totalDays;
				}
			}

			if (!weeks && !days && match2) {
				weeks = parseInt(match2[1], 10);
				days = match2[2] ? parseInt(match2[2], 10) : 0;
			}

			return [weeks, days];
		} else {
			const simpleMatch = userInput.match(/^(\d+)\s+(\d+)$/);
			if (simpleMatch) {
				const weeks = parseInt(simpleMatch[1], 10);
				const days = parseInt(simpleMatch[2], 10);
				return [weeks, days];
			} else {
				return null;
			}
		}
	}

	function updateGestationalAge(input) {
		GAFormValidate(input);
		if ((input === "") | (textToGestationalAge(input) == null)) {
			$("#gestationalAgeText").html(``);
			return;
		}

		converted = textToGestationalAge(input);

		$("#gestationalAgeText").html(`Gestational Age: ${converted[0]}+${converted[1]}/40`);
	}

	$("#gestationalAge").on("input", function () {
		input = $(this).val();

		calculate("#gestationalAge", input);

		updateGestationalAge(input);
	});

	$(document).ready(function () {
		function checkButton() {
			$("#estimated-due-date-text, #estimated-due-date-word-text, #calculateDateText, #gestationalAgeText").each(function () {
				var button = $(this);
				if (button.text().trim() === "") {
					button.addClass("notClickable");
				} else {
					button.removeClass("notClickable");
				}
			});
		}

		checkButton(); // Check on page load

		// Create a new MutationObserver instance
		var observer = new MutationObserver(function () {
			checkButton();
		});

		// Setup the observer to listen for changes in the subtree of all button elements
		var targetNodes = document.querySelectorAll("#estimated-due-date-text, #estimated-due-date-word-text, #calculateDateText, #gestationalAgeText");

		targetNodes.forEach(function (node) {
			var config = { childList: true, subtree: true };
			observer.observe(node, config);
		});
	});

	$(document).on("click", ".clipboard-btn", function () {
		var text = $(this).text();
		navigator.clipboard.writeText(text);
	});
});
