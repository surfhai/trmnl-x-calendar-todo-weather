/**
 * Configuration template for trmnl_feed.gs.
 *
 * Copy this file to config.gs (excluded via .gitignore) and replace all <...> placeholders
 * and example values with your own. Never commit config.gs.
 * In Apps Script, add config.gs as a separate file next to trmnl_feed.gs in the same project;
 * all .gs files of a project share one global scope, so trmnl_feed.gs sees CONFIG.
 */

const CONFIG = {
  // Your TRMNL webhook URL (TRMNL → Private Plugin → Webhook URL). Treat it like a password.
  TRMNL_WEBHOOK_URL: "https://trmnl.com/api/custom_plugins/<PLUGIN_UUID>",

  // Coordinates & time zone (example: Berlin). Two decimals (~1 km) are enough for the weather.
  LATITUDE: 52.52,
  LONGITUDE: 13.40,
  TIMEZONE: "Europe/Berlin",

  // Calendar preview: number of days from today (must match the layout in the markup)
  DAYS_AHEAD: 14,

  // Calendars to fetch
  CALENDAR_IDS: [
    '<CALENDAR_ID>@group.calendar.google.com'
  ],

  // Holiday calendars: fetched in addition; their events get public_holiday: true
  HOLIDAY_CALENDAR_IDS: [
    'de.german#holiday@group.v.calendar.google.com'
  ],

  // Weather: period (hours) and number of values delivered.
  // Block size = WEATHER_HOURS / WEATHER_POINTS (rounded up), e.g. 24 / 12 = 2 h per value.
  // If the division is not even, the last block is shorter.
  WEATHER_HOURS: 24,
  WEATHER_POINTS: 12,

  // Keywords for automatic birthday detection
  BIRTHDAY_KEYWORDS: ['geburtstag', 'birthday', 'bday'],

  // --- Google Sheet ---
  // ID from the URL: https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
  SPREADSHEET_ID: "<SPREADSHEET_ID>",
  SHEET_TASKS: "Recurring Tasks",   // row 1 = headers
  // Column mapping for "Recurring Tasks" (A=0, B=1, C=2, ...). Column C is ignored.
  TASK_COLS: { active: 0, date: 1, interval: 3, title: 4 },
  SHEET_NOTES: "Notes",             // column A
  TASK_LEAD_DAYS: 2,                // a task is sent once it is due in <= 2 days (or overdue)
  NOTES_HAS_HEADER: true,           // true if row 1 in "Notes" is a header

  // Webhook limit (bytes) without TRMNL+
  PAYLOAD_LIMIT: 5000,

  // Debug: write the sent JSON to the execution log (pretty-printed, log only)
  DEBUG_LOG_PAYLOAD: false
};
