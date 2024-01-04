$(document).ready(function () {
    // Initialize datepicker
    $('#datepicker').datepicker({
        dateFormat: 'dd/mm/yy', // Set the desired date format
        constrainInput: false,
        onSelect: function () {
            validateDate($(this).val());
        }
    });

    // Validate date on blur
    $('#datepicker').on('blur', function () {
        var valDate = validateDate($(this).val());
        if (valDate) {
            $(this).val(valDate);
            $(this).removeClass('invalid-date');
        };
    });

    function validateDate(inputDate) {
        var parsedDate = parseDate(inputDate);

        if (parsedDate.isValid()) {
            // Use the parsedDate for further processing
            console.log("Parsed Date:", parsedDate.format('DD/MM/YYYY'), typeof(parsedDate));

            return(parsedDate.format('DD/MM/YYYY'))
        } else {
            console.log("Invalid date format");
            $('#datepicker').addClass('invalid-date');
            return null;
        }
    }

    function parseDate(input) {
        var formats = [
            'DD/MM/YYYY',       // 03/07/2024
            'DD/MM',            // 03/07
            'D/M/YY',           // 3/7/24
            'D/M/YYYY',         // 3/7/2024
            'YYYY/MM/DD',       // 2024/07/03
            'YY/MM/DD',         // 24/07/03
            'DD-MMM-YYYY',      // 03-Jul-2024
            'D-MMM-YYYY',       // 3-Jul-2024
            'MMMM DD YYYY',     // July 03 2024
            'MMM DD YYYY',      // Jul 03 2024
            'MMM D YYYY',       // Jul 3 2024
            'MMMM, D YYYY',     // July, 3 2024
            'MMMM D, YYYY',     // July 3, 2024
            'MMM DD, YYYY',     // Jul 03, 2024
            'MMM D, YYYY',      // Jul 3, 2024
            'DD MMMM YYYY',     // 03 July 2024
            'D MMMM YYYY',      // 3 July 2024
            'DD MMM YYYY',      // 03 Jul 2024
            'D MMM YYYY',       // 3 Jul 2024
            'YYYY-MM-DD',       // 2024-07-03
            'MM/DD/YYYY',       // 07/03/2024
            'MM/DD',            // 07/03
            'M/D/YY',           // 7/3/24
            'M/D/YYYY',         // 7/3/2024
            'MMM DD',           // Jul 03
            'MMM D',            // Jul 3
            'MMMM DD',          // July 03
            'MMMM D',           // July 3
            'DD.MM.YYYY',       // 03.07.2024
            'DD.MM',            // 03.07
            'D.M.YY',           // 3.7.24
            'D.M.YYYY',         // 3.7.2024
            'DD MMMM, YYYY',    // 03 July, 2024
            'D MMMM, YYYY',     // 3 July, 2024
            'MMM DD, YY',       // Jul 03, 24
            'DDMM',             // 0307
            'DMM',              // 307
            'MMDDYY',           // e.g., 030724
            'MMDDYYYY',         // e.g., 03072024
        ];

        return moment(input, formats);
    }
});