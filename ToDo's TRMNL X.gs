function onEdit(e) {
  if (!e) return;

  var range = e.range;
  var sheet = range.getSheet();

  // SETTINGS:
  var checkColumn = 3; // Column C (checkboxes are here)
  var dateColumn = 2;  // Column B (the date is written here)

  // When a checkbox in column C is ticked (TRUE)
  if (range.getColumn() == checkColumn && e.value == "TRUE") {
    var row = range.getRow();
    if (row === 1) return; // Skip the header row

    // Format the current date as YYYY-MM-DD in the spreadsheet's time zone
    var timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var formattedDate = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");

    // 1. Write the plain date into column B to the left
    var dateCell = sheet.getRange(row, dateColumn);
    dateCell.setValue(formattedDate);

    // 2. Immediately reset the checkbox in column C to empty (FALSE)
    range.setValue(false);
  }
}
