/**
 * TRMNL X Google Apps Script (trmnl_feed.gs)
 * - Calendar grid (number of days via CONFIG.DAYS_AHEAD) with multi-day events split per day,
 *   real event end, duplicate filter, birthday and holiday detection
 * - DWD weather (Bright Sky API), hourly values aggregated into blocks (default: 12 values of 2 h for 24 h)
 * - Sunrise/sunset computed locally (SunCalc algorithm)
 * - Google Sheet: "Recurring Tasks" (due recurring tasks) + "Notes" (column A)
 * - Waste collection dates via waste.gs (optional, separate file in the same project)
 * - Compact payload (< 5 KB webhook limit): weather in columns, unused fields removed
 *
 * Configuration lives in a separate file: config.gs (private, not committed),
 * created from the template config.example.gs. Script files of the project:
 * trmnl_feed.gs, config.gs, waste.gs (optional).
 */

/**
 * Main function: fetches calendar, weather and sheet data and pushes it to TRMNL via webhook.
 */
function pushDataToTrmnl() {
  try {
    if (!checkConfig()) return;
    Logger.log("Starting data fetch for TRMNL X...");

    const calendarGrid = getCalendarGrid();
    const weatherData = getDwdHourlyWeatherData(CONFIG.LATITUDE, CONFIG.LONGITUDE);
    const sheetData = getSheetData();

    const payload = {
      merge_variables: {
        days: calendarGrid,
        weather: weatherData,
        tasks: sheetData.tasks,
        notes: sheetData.notes,
        // waste.gs is optional: without it the field is omitted (undefined is dropped by JSON.stringify)
        waste: typeof getWasteData === "function" ? getWasteData() : undefined,
        updated_at: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "HH:mm")
      }
    };

    const body = JSON.stringify(payload);
    const size = Utilities.newBlob(body).getBytes().length;  // real bytes (umlauts/emojis count multiple times)
    Logger.log("Payload size: " + size + " bytes");
    if (CONFIG.DEBUG_LOG_PAYLOAD) {
      Logger.log("Payload JSON:\n" + JSON.stringify(payload, null, 2));
    }
    if (size > CONFIG.PAYLOAD_LIMIT) {
      Logger.log("WARNING: payload exceeds " + CONFIG.PAYLOAD_LIMIT + " bytes – TRMNL will reject it.");
    }

    const response = UrlFetchApp.fetch(CONFIG.TRMNL_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: body,
      muteHttpExceptions: true
    });

    Logger.log("TRMNL Response Code: " + response.getResponseCode());
    if (response.getResponseCode() !== 200) {
      Logger.log("TRMNL Response Body: " + response.getContentText().substring(0, 300));
    }

  } catch (error) {
    Logger.log("Error in pushDataToTrmnl: " + error.toString());
  }
}

/**
 * Checks that config.gs exists and that the placeholders from config.example.gs were replaced.
 * Returns false (and logs why) if the script must not send.
 */
function checkConfig() {
  if (typeof CONFIG === "undefined") {
    Logger.log("CONFIG missing: add config.gs (copy of config.example.gs) to this Apps Script project.");
    return false;
  }
  const required = ["TRMNL_WEBHOOK_URL", "SPREADSHEET_ID"];
  const unfilled = required.filter(k => !CONFIG[k] || String(CONFIG[k]).indexOf("<") !== -1)
    .concat((CONFIG.CALENDAR_IDS || []).some(id => id.indexOf("<") !== -1) ? ["CALENDAR_IDS"] : []);
  if (unfilled.length) {
    Logger.log("CONFIG not filled in (placeholders left): " + unfilled.join(", ") + " – nothing sent.");
    return false;
  }
  return true;
}

/* =========================================================================
 * GOOGLE SHEET
 * ========================================================================= */

/**
 * Reads both sheets. Errors in the sheet do not block the rest of the payload.
 */
function getSheetData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return {
      tasks: getRecurringTasks(ss),
      notes: getNotes(ss)
    };
  } catch (e) {
    Logger.log("Error reading the Google Sheet: " + e.toString());
    return { tasks: [], notes: [] };
  }
}

/**
 * "Recurring Tasks": columns as in CONFIG.TASK_COLS
 *   (A = Active, B = Date, C = internal automation -> ignored, D = Interval, E = Title)
 *
 * A row is included if:
 *   - Active = "x" (case-insensitive; "-" = inactive)
 *   - Interval = valid integer >= 1
 *   - Title is not empty
 *   - and either no date is set
 *     or due_in_days <= TASK_LEAD_DAYS, with due_in_days = Date + Interval - today
 *
 * due_in_days: positive = due in X days, 0 = due today, negative = X days overdue.
 * Without a date, due_in_days is omitted (never done).
 */
function getRecurringTasks(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_TASKS);
  if (!sheet) {
    Logger.log("Sheet not found: " + CONFIG.SHEET_TASKS);
    return [];
  }

  const rows = sheet.getDataRange().getValues().slice(1);  // row 1 = headers
  const today = dayIndex(new Date());
  const tasks = [];
  const C = CONFIG.TASK_COLS;

  rows.forEach((row, i) => {
    const rowNum = i + 2;

    // A checkbox with custom values returns "x"/"-"; true covers a standard checkbox
    const active = row[C.active];
    if (active !== true && String(active).trim().toLowerCase() !== "x") return;

    const title = String(row[C.title]).trim();
    if (!title) return;

    const interval = parseInterval(row[C.interval]);
    if (interval === null) {
      Logger.log("Recurring Tasks row " + rowNum + ": invalid interval '" + row[C.interval] + "' – skipped");
      return;
    }

    const date = parseSheetDate(row[C.date]);
    if (date === undefined) {
      Logger.log("Recurring Tasks row " + rowNum + ": invalid date '" + row[C.date] + "' – skipped");
      return;
    }

    if (date === null) {
      tasks.push({ title: title });  // no date -> always show
      return;
    }

    const dueInDays = dayIndex(date) + interval - today;
    if (dueInDays <= CONFIG.TASK_LEAD_DAYS) {
      tasks.push({ title: title, due_in_days: dueInDays });
    }
  });

  // Sort: tasks without a date first, then most overdue first
  tasks.sort((a, b) => {
    const da = a.due_in_days === undefined ? -Infinity : a.due_in_days;
    const db = b.due_in_days === undefined ? -Infinity : b.due_in_days;
    return da - db;
  });

  Logger.log("Recurring tasks sent: " + tasks.length);
  return tasks;
}

/**
 * "Notes": entire content of column A (empty cells are ignored).
 * getDisplayValues so that numbers/dates are sent exactly as shown in the sheet.
 */
function getNotes(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_NOTES);
  if (!sheet) {
    Logger.log("Sheet not found: " + CONFIG.SHEET_NOTES);
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  const notes = sheet.getRange(1, 1, lastRow, 1).getDisplayValues()
    .slice(CONFIG.NOTES_HAS_HEADER ? 1 : 0)
    .map(r => String(r[0]).trim())
    .filter(t => t !== "")
    .map(t => ({ title: t }));

  Logger.log("Notes sent: " + notes.length);
  return notes;
}

/**
 * Interval: integers >= 1 only (number or text such as "14"). Otherwise null.
 */
function parseInterval(v) {
  if (typeof v === "number") {
    return Number.isInteger(v) && v >= 1 ? v : null;
  }
  const s = String(v).trim();
  return /^\d+$/.test(s) && parseInt(s, 10) >= 1 ? parseInt(s, 10) : null;
}

/**
 * Date from a cell.
 * Returns: Date | null (cell empty) | undefined (content present but not a valid date)
 * Supports real date cells as well as text "DD.MM.YYYY" and "YYYY-MM-DD".
 */
function parseSheetDate(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;

  const s = String(v).trim();
  if (s === "") return null;

  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0);

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);

  return undefined;
}

/**
 * Calendar day as an integer (days since 1970) in CONFIG.TIMEZONE.
 * This makes day differences independent of time of day and daylight saving time.
 */
function dayIndex(date) {
  const p = Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy-MM-dd").split("-");
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
}

/* =========================================================================
 * CALENDAR
 * ========================================================================= */

/**
 * Builds the calendar grid for CONFIG.DAYS_AHEAD days from today.
 * Delivers date/time values only; all formatting is done by the markup.
 *
 * Per day:   { date: "yyyy-MM-dd", events: [...] }
 * Per event: first occurrence in the grid -> { title, start, end? }, following days -> { title }
 *   start: "yyyy-MM-dd HH:mm" (with time) or "yyyy-MM-dd" (all-day);
 *          if the event started before today: today, date only
 *   end:   for multi-day events (last day = end - 1 ms, date ≠ date of start)
 *          and always for ongoing timed events (e.g. yesterday 22:00 – today 10:00);
 *          all-day: inclusive last day "yyyy-MM-dd", with time: real end "yyyy-MM-dd HH:mm"
 *   is_birthday: only if true
 *   public_holiday: only for events from CONFIG.HOLIDAY_CALENDAR_IDS
 */
function getCalendarGrid() {
  const now = new Date();
  const days = CONFIG.DAYS_AHEAD;

  // From today 00:00 to the end of the last displayed day (today + DAYS_AHEAD - 1)
  const gridStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const gridEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days - 1, 23, 59, 59);

  const ymd = d => Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd");
  const ymdhm = d => Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
  const todayStr = ymd(gridStart);

  // 1. Fetch all raw events
  let rawEvents = [];
  const processedEventIds = new Set();

  const holidayIds = CONFIG.HOLIDAY_CALENDAR_IDS || [];
  CONFIG.CALENDAR_IDS.concat(holidayIds).forEach(calId => {
    const isHolidayCal = holidayIds.indexOf(calId) !== -1;
    let cal;
    try {
      cal = CalendarApp.getCalendarById(calId);
    } catch (e) {
      Logger.log("Calendar not found: " + calId);
      return;
    }
    if (!cal) {
      Logger.log("Calendar not found or no access: " + calId);
      return;
    }

    const calNameLower = cal.getName().toLowerCase();
    const events = cal.getEvents(gridStart, gridEnd);

    events.forEach(evt => {
      const evtId = evt.getId();
      if (processedEventIds.has(evtId)) return;
      processedEventIds.add(evtId);

      const title = evt.getTitle();
      const isBirthday = CONFIG.BIRTHDAY_KEYWORDS.some(kw =>
        title.toLowerCase().includes(kw) || calNameLower.includes(kw)
      );

      const isAllDay = evt.isAllDayEvent();
      // All-day: getAllDay*Date returns midnight in the script time zone. getStartTime/getEndTime
      // return midnight in the calendar time zone instead (e.g. UTC = 02:00 Berlin), which would
      // make single-day events spill into the following day.
      const startTime = isAllDay ? evt.getAllDayStartDate() : evt.getStartTime();
      const endTime = isAllDay ? evt.getAllDayEndDate() : evt.getEndTime();  // exclusive

      // Visible start: if the event started before today -> today, date only
      const startDayStr = ymd(startTime);
      const isRunning = startDayStr < todayStr;
      const start = isRunning ? todayStr
        : (isAllDay ? startDayStr : ymdhm(startTime));

      // Last day: the end is exclusive (all-day = next day 00:00), hence - 1 ms
      const lastDay = new Date(Math.max(endTime.getTime() - 1, startTime.getTime()));
      const lastDayStr = ymd(lastDay);
      let end = null;
      // Ongoing timed events always get end, otherwise the end time would be lost
      if (lastDayStr !== start.substring(0, 10) || (isRunning && !isAllDay)) {
        end = isAllDay ? lastDayStr : ymdhm(endTime);
      }

      rawEvents.push({
        title: title,
        startTime: startTime,
        endTime: endTime,
        start: start,
        end: end,
        isBirthday: isBirthday,
        isHoliday: isHolidayCal
      });
    });
  });

  // 2. Assign events to days
  const firstSeen = new Set();  // event objects already added with start/end
  let daysArray = [];

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i, 0, 0, 0);
    const dayEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i, 23, 59, 59);

    let dayEvents = [];

    rawEvents.forEach(evt => {
      if (evt.startTime < dayEnd && evt.endTime > dayStart) {
        const e = { title: evt.title };

        if (!firstSeen.has(evt)) {
          firstSeen.add(evt);
          e.start = evt.start;
          if (evt.end) e.end = evt.end;
        }

        if (evt.isBirthday) e.is_birthday = true;    // only send if true
        if (evt.isHoliday) e.public_holiday = true;  // only send if true
        dayEvents.push(e);
      }
    });

    daysArray.push({
      date: ymd(dayStart),
      events: dayEvents
    });
  }

  return daysArray;
}

/* =========================================================================
 * WEATHER
 * ========================================================================= */

/**
 * Fetches hourly DWD weather data and aggregates it into blocks.
 *
 * Bright Sky only delivers hourly values. Period values (precipitation, wind, gusts) refer to
 * the PREVIOUS hour: the record with timestamp 15:00 covers 14:00–15:00.
 * A block "14–16" therefore consists of the records 15:00 and 16:00.
 *
 * Aggregation per block:
 *   temp, dew  -> average      prob, wind, gust -> maximum
 *   mm         -> sum          cond             -> "worst" icon
 *
 * Returns columns: one array per measurement + start timestamp + block size + sun times.
 * hours[i] = start hour of the block.
 */
function getDwdHourlyWeatherData(lat, lon) {
  try {
    const HOUR = 3600000;
    const totalHours = CONFIG.WEATHER_HOURS;
    const step = Math.max(1, Math.ceil(totalHours / CONFIG.WEATHER_POINTS));
    const blockCount = Math.ceil(totalHours / step);

    // Start of the current hour (Berlin has a whole-hour UTC offset)
    const h0 = Math.floor(Date.now() / HOUR) * HOUR;

    // Cover records h0+1h ... h0+totalHours; last_date with buffer, filtered below
    const fmtUtc = d => Utilities.formatDate(d, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const url = `https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}`
      + `&date=${encodeURIComponent(fmtUtc(new Date(h0 + HOUR)))}`
      + `&last_date=${encodeURIComponent(fmtUtc(new Date(h0 + (totalHours + 1) * HOUR)))}`
      + `&tz=${encodeURIComponent(CONFIG.TIMEZONE)}`;

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log("Error fetching the weather API: " + response.getResponseCode());
      return getFallbackWeatherData();
    }

    const records = JSON.parse(response.getContentText()).weather || [];

    // Assign records to their blocks
    const blocks = Array.from({ length: blockCount }, () => []);
    records.forEach(rec => {
      const k = Math.round((new Date(rec.timestamp).getTime() - h0) / HOUR);  // 1..totalHours
      if (k < 1 || k > totalHours) return;
      blocks[Math.floor((k - 1) / step)].push(rec);
    });

    const w = {
      start_ts: h0,
      step_h: step,
      hours: [], temp: [], prob: [], mm: [], cond: [], wind: [], gust: [], dew: []
    };

    const vals = (blk, key) => blk.map(r => r[key]).filter(v => v !== null && v !== undefined);
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const max  = a => a.length ? Math.max.apply(null, a) : 0;
    const sum  = a => a.reduce((x, y) => x + y, 0);
    const r1 = v => Math.round(v * 10) / 10;
    const r0 = v => Math.round(v);

    for (let i = 0; i < blockCount; i++) {
      const blk = blocks[i];
      if (blk.length === 0) break;  // data gap: only send contiguous blocks from now on

      const hourNum = parseInt(Utilities.formatDate(new Date(h0 + i * step * HOUR), CONFIG.TIMEZONE, "H"), 10);

      w.hours.push(hourNum);
      w.temp.push(r1(mean(vals(blk, "temperature"))));
      w.prob.push(r0(max(vals(blk, "precipitation_probability"))));
      w.mm.push(r1(sum(vals(blk, "precipitation"))));
      w.cond.push(blockConditionIcon(blk, hourNum));
      w.wind.push(r0(max(vals(blk, "wind_speed"))));
      w.gust.push(r0(max(vals(blk, "wind_gust_speed"))));
      w.dew.push(r1(mean(vals(blk, "dew_point"))));
    }

    if (w.hours.length === 0) return getFallbackWeatherData();
    Logger.log("Weather: " + w.hours.length + " values of " + step + " h");

    // Sunrise/sunset (next event from now)
    const sun = getNextSunTimes(lat, lon);
    w.sunrise = sun.sunrise;
    w.sunset = sun.sunset;
    Logger.log("Sun: sunrise " + w.sunrise + ", sunset " + w.sunset);

    return w;

  } catch (e) {
    Logger.log("Exception in getDwdHourlyWeatherData: " + e.toString());
    return getFallbackWeatherData();
  }
}

/**
 * Weather icon of a block: the "worst" of the contained hours.
 * Ranking: ❄️ > 🌧️ > ☁️ > ⛅ > ☀️/🌙
 * Bright Sky icons: clear-day/-night, partly-cloudy-day/-night, cloudy, fog, wind,
 * rain, sleet, snow, hail, thunderstorm.
 */
function blockConditionIcon(blk, hourNum) {
  const severity = code => {
    code = code || "";
    if (code.includes("snow") || code.includes("sleet")) return 4;
    if (code.includes("rain") || code.includes("drizzle") || code.includes("thunder") || code.includes("hail")) return 3;
    if (code.includes("partly")) return 1;
    if (code.includes("cloud") || code.includes("fog")) return 2;
    if (code.includes("clear") || code.includes("sunny")) return 0;
    return 1;  // wind / unknown
  };
  const worst = Math.max.apply(null, blk.map(r => severity(r.icon)));
  if (worst === 0) return (hourNum >= 6 && hourNum <= 21) ? "☀️" : "🌙";
  return ["", "⛅", "☁️", "🌧️", "❄️"][worst];
}

/**
 * Fallback if the API is offline (the markup then hides the weather table).
 */
function getFallbackWeatherData() {
  return { start_ts: 0, hours: [] };
}

/**
 * Sunrise/sunset for a date (SunCalc algorithm, altitude -0.833° incl. refraction).
 */
function getSunTimes(date, lat, lon) {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const fromJulian = j => new Date((j + 0.5 - J1970) * dayMs);
  const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const lw = -lon * rad, phi = lat * rad;

  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(rad * 23.4397));
  const Jtransit = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  const h0 = rad * -0.833;
  const w = Math.acos((Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const a = 0.0009 + (w + lw) / (2 * Math.PI) + n;
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const Jrise = Jtransit - (Jset - Jtransit);

  return { rise: fromJulian(Jrise), set: fromJulian(Jset) };
}

/**
 * Next sunrise and sunset from now (today or tomorrow), as "HH:mm".
 */
function getNextSunTimes(lat, lon) {
  const now = new Date();
  const today = getSunTimes(now, lat, lon);
  const tomorrow = getSunTimes(new Date(now.getTime() + 86400000), lat, lon);
  const fmt = d => Utilities.formatDate(d, CONFIG.TIMEZONE, "HH:mm");
  return {
    sunrise: fmt(today.rise > now ? today.rise : tomorrow.rise),
    sunset:  fmt(today.set  > now ? today.set  : tomorrow.set)
  };
}
