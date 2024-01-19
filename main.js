$(function () {
	$("#EDDDatepicker").datepicker({
		format: {
			toDisplay: function (date, format, language) {
				validatedDate = validateDate(date);
				formValidate(validatedDate, date, "#EDDDatepicker");
				return customToDisplay(validatedDate, format, language, "#estimatedDueDateText", "Estimated Due Date (EDD)");
			},
			toValue: function (date, format, language) {
				validatedDate = validateDate(date);
				formValidate(validatedDate, date, "#EDDDatepicker");
				return customToValue(validatedDate, format, language, "#estimatedDueDateText", "Estimated Due Date (EDD)");
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
		container: "#EDDDatePickerGroup",
	});

	$("#dateFromDatepicker").datepicker({
		format: {
			toDisplay: function (date, format, language) {
				validatedDate = validateDate(date);
				formValidate(validatedDate, date, "#dateFromDatepicker");
				return customToDisplay(validatedDate, format, language, "#calculateDateText", "Calculate from date");
			},
			toValue: function (date, format, language) {
				validatedDate = validateDate(date);
				formValidate(validatedDate, date, "#dateFromDatepicker");
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
		container: "#dateFromDatepickerGroup",
	});

	$("#dateFromDatepicker")
		.datepicker()
		.on("input", function () {
			val = $(this).datepicker("getValue").val();
			if (val === null || val.match(/^ *$/) !== null) {
				$(this).removeClass("is-invalid");
				$(this).removeClass("is-valid");
			}
		});
	$("#EDDDatepicker")
		.datepicker()
		.on("input", function () {
			val = $(this).datepicker("getValue").val();
			if (val === null || val.match(/^ *$/) !== null) {
				$(this).removeClass("is-invalid");
				$(this).removeClass("is-valid");
			}
		});

	function validateDate(userInput) {
		var validDateFormats = [
			"DD/MM/YYYY", // 03/07/2024
			"DD/MM", // 03/07
			"D/M/YY", // 3/7/24
			"D/M/YYYY", // 3/7/2024
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
			"D MMMM YYYY", // 3 July 2024
			"DD MMM YYYY", // 03 Jul 2024
			"DD MMM", // 03 Jul
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

		// console.log(userInput);

		var parsedDate = moment(userInput, validDateFormats, true);

		return parsedDate;
	}

	function formValidate(validatedDate, date, datepickerID) {
		if (typeof date === "string" || date instanceof String) {
			if (date.replace(/\s/g, "") == "") {
				$(datepickerID).removeClass("is-invalid").removeClass("is-valid");
				return;
			}
		}

		isValid = validatedDate.isValid();

		if (isValid) {
			$(datepickerID).addClass("is-valid");
			$(datepickerID).removeClass("is-invalid");
		} else {
			$(datepickerID).addClass("is-invalid");
			$(datepickerID).removeClass("is-valid");
		}
	}

	function customToValue(validatedDate, format, language, textId, textPrefix) {
		updateLabels(validatedDate, textId, textPrefix);

		if (validatedDate.isValid()) {
			calculateGestationalAge(validatedDate, textId);

			return validatedDate.toDate();
		} else {
			return null;
		}
	}

	function customToDisplay(validatedDate, format, language, textId, textPrefix) {
		updateLabels(validatedDate, textId, textPrefix);

		if (validatedDate.isValid()) {
			calculateGestationalAge(validatedDate, textId);
			return validatedDate.format("DD/MM/YYYY");
		} else {
			return null;
		}
	}

	function calculateGestationalAge(validatedDate, textId) {
		// console.log(validatedDate.format("DD/MM/YYYY"), textId);
	}

	function updateLabels(validatedDate, textId, textPrefix) {
		// console.log(validatedDate);
		if (validatedDate.isValid()) {
			var formattedDate = validatedDate.format("DD/MM/YYYY");
			$(textId).text(`${textPrefix}: ${formattedDate}`);
			return;
		} else {
			$(textId).text("Invalid date! Please enter a valid date.");
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

			// console.log(`Input:  ${userInput}\nOutput: ${weeks} + ${days}`);
			return { weeks, days };
		} else {
			const simpleMatch = userInput.match(/^(\d+)\s+(\d+)$/);
			if (simpleMatch) {
				const weeks = parseInt(simpleMatch[1], 10);
				const days = parseInt(simpleMatch[2], 10);
				// console.log(`Input:  ${userInput}\nOutput: ${weeks} + ${days}`);
				return { weeks, days };
			} else {
				// console.log(`Input:  ${userInput} - Not a valid format`);
				return null;
			}
		}
	}

	$("#gestationalAge").on("input", function () {
		input = $(this).val();

		if ((input === "") | (textToGestationalAge(input) == null)) {
			$("#gestationalAgeText").text(``);
			return;
		}

		$("#gestationalAgeText").html(`Input: ${input}<br>Output: ${textToGestationalAge(input)[0]}`);
	});
});
