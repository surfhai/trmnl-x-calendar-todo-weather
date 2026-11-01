# TRMNL X – Private Plugin "Calendar, Events, Tasks/Notes, Weather, Waste"

Functional and display specification (detailed enough to rebuild the plugin)

Status: 2026-11-01 (including the en/de language switch and the task lead-time setting)

| File | Content |
|---|---|
| `trmnl_calendar_todo_weather.md` | Liquid markup (HTML, CSS, JavaScript) for the **Full** tab of the Private Plugin. The `.md` extension is only for storage; the content is not Markdown. |
| `README_TRMNL_FRONTEND.md` | Setup guide for the markup |
| `README.md` | Setup guide for the Google Apps Script |
| Google Apps Script (`pushDataToTrmnl`) | Collects the data and sends it via webhook |

---

## 0. Prerequisite

Private Plugins require the device's **Developer Edition** ($20 one-time per device, as of November 2026; [Developer edition](https://trmnl.com/blog/developer-edition)).

## 1. Overview

The plugin shows the following on a TRMNL X (e-paper, black/white with greyscale) in a single full-screen view:

1. a **calendar grid** across the full width (default 14 days = 2 rows × 7 days),
2. an **event list** with date badges and a day or age counter,
3. a **weather table** for the next 24 h with sunrise/sunset lines and rows that can be shown or hidden,
4. **tasks & notes** from a Google Sheet,
5. the **waste collection** (days until the next pickup per bin),
6. a **status line** with calendar week, data send time and render time,
7. a **battery indicator** of the device.

### Architecture

```
Google Calendar ─┐
Bright Sky (DWD) ─┤
Google Sheet ─────┼─► Google Apps Script ──(POST webhook, JSON)──► TRMNL Private Plugin ──► Liquid + JS ──► image ──► display
Waste calendar ───┘     (time-driven)                              (merge_variables)        (server rendering)
```

- **Data strategy:** webhook ("push"). The script delivers **data only**; the entire **presentation** (date formats, weekdays, counters, highlighting, language) is handled by the markup.
- **Rendering:** TRMNL renders the markup on the server in a browser (Chromium) into an image. Embedded JavaScript runs **once** during this rendering; the device later only fetches the finished image.
- **Time zone:** TRMNL's server time zone can differ from Europe/Berlin. Everything that depends on today's date (calendar week, render time, days until an event/pickup) is therefore computed in JavaScript explicitly with `Intl.DateTimeFormat(…, { timeZone: "Europe/Berlin" })`, not with the Liquid filter `date: "now"`.
- **Payload limit:** without TRMNL+ at most **5 KB** (otherwise HTTP 422). The data format is designed for this (no preformatted texts, no duplicate fields, weather in columns).
- **Compatibility:** markup and script belong together. The markup only understands the format described here.

---

## 2. Screen layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CALENDAR GRID (full width, max. --cal-max-height)                          │
│  Wed 21 Oct │ Thu 22 Oct │ … │ Tue 27 Oct  ← row 1 (cal_cols days)         │
│  ───────────────────────────────────────    ← black line                   │
│  Wed 28 Oct │ …                             ← row 2                        │
├──────────────────────────────────────────────────────────────────────────┤ ← black line
│ LEFT (--bottom-left-width = 50 %)     │ RIGHT (rest)                       │
│ ┌───────────────────────────────────┐ │ Tasks/Notes          Due [Days]    │
│ │ EVENT LIST (top)             days │ │ ────────────────────────────────── │
│ │ Sat 10/24 10:00  Museum         2 │ │ Clean bathroom                –    │
│ │ Tue 10/27 - 10/28  Fair         5 │ │ Wash towels                  -2    │
│ └───────────────────────────────────┘ │ Note                               │
│        (free, grows/shrinks)          │                                    │
│ ┌───────────────────────────────────┐ │                                    │
│ │ WEATHER TABLE (pinned to bottom)  │ │  Black 🗑 14 | Yellow 🗑 28 | …     │
│ └───────────────────────────────────┘ │                                    │
│ [▮▮▮ ] 82 %   ↑07:53        ↓18:16    │   CW 43  Data 20:52  Display …     │
└──────────────────────────────────────────────────────────────────────────┘
```

| Area | Width | Height / position |
|---|---|---|
| Calendar grid | 100 % | content height, rows only as tall as their content, at most `--cal-max-height` |
| Bottom area | 100 % | remaining height, two columns (gap 12 px) |
| Event list | left column | top; uses the space down to the weather table (`--list-height: none`), overflow cut off at the bottom |
| Weather table | left column | **pinned to the bottom** (`margin-top: auto`), never squeezed; 28 px free below it for sun times and battery |
| Tasks & notes | right column | top, overflow cut off at the bottom |
| Waste collection | right column | above the status line, right-aligned, single line |
| Status line | right column | at the very bottom, right-aligned |
| Battery | – | absolutely positioned bottom left |

There is **no** TRMNL title bar (`title_bar`).

---

## 3. Configuration in the markup

### 3.0 Language

At the very top of the markup: `{% assign lang = "en" %}` – `"en"` (default) or `"de"`. A translation block then sets all display texts (`weekday_names`, `month_names`, `date_fmt`, `t_more`, `t_no_events`, `t_no_tasks`, `t_tn_title`, `t_tn_due`, `t_dew`, `t_gust`, `t_week`, `t_data`, `t_render`, `t_age`). JavaScript receives the week prefix and the age suffix via `data-week` / `data-age` on the status line. Bin names: `de` = `label` + "e" (Schwarz → Schwarze), `en` = by `key` (waste → Black, recycling → Yellow, paper → Blue), falling back to `label`. Date format of the event list: `en` = `%m/%d`, `de` = `%d.%m`. Code and comments are English throughout.

| Element | `en` | `de` |
|---|---|---|
| Calendar header | `Tue` / `27 Oct` | `Di` / `27 Okt` |
| Event list badge | `Tue 10/27 10:00 - 10/28 14:00` | `Di 27.10 10:00 - 28.10 14:00` |
| Overflow in a grid cell | `+2 more` | `+2 weitere` |
| Empty lists | `No upcoming events` / `No tasks or notes` | `Keine anstehenden Termine` / `Keine Aufgaben oder Notizen` |
| Weather labels | `Dew [°C]`, `Gusts` | `Tau [°C]`, `Böen` |
| Waste collection | `Black 🗑 14 \| Yellow 🗑 28 \| Blue 🗑 14` | `Schwarze 🗑 14 \| Gelbe 🗑 28 \| Blaue 🗑 14` |
| Age | `36 y` | `36 J.` |
| Status line | `CW 43  Data 20:52  Display 20:58` | `KW 43  Daten 20:52  Anzeige 20:58` |

### 3.0a Task lead time

Directly below `lang`: `{% assign task_lead_days = 2 %}`. Shown are tasks without a date and tasks with `due_in_days ≤ task_lead_days`. The script filters beforehand with `TASK_LEAD_DAYS`; the markup can therefore only restrict further. The empty message appears when neither tasks nor notes remain after filtering.

### 3.1 Liquid variables (`CONFIGURATION` block at the top of the file)

| Variable | Default | Effect |
|---|---|---|
| `cal_days` | `14` | days in the calendar grid; must match `DAYS_AHEAD` in the script |
| `cal_cols` | `7` | days per row; `cal_days` should be a multiple of it |
| `max_events_per_day` | `4` | events per grid cell, the rest as "+N more" |
| `weekday_names` | depends on `lang` | weekday names, index from `date: "%w"` |
| `month_names` | depends on `lang` | month names, index from `date: "%m"` − 1 |
| `cake_icon` / `holiday_icon` / `bin_icon` | inline SVG | birthday (cake), holiday (flag), waste bin |
| `min_col_width` | `30` | only for the legacy hourly weather format (condensing) |
| `horizontal_spacing` / `vertical_spacing` | `"4px"` / `"2px"` | column gap / row padding of the weather table |
| `timezone` | `"Europe/Berlin"` | time zone of all calculations in JavaScript |

### 3.2 Weather rows (`<script id="weather-rows-config">`)

JSON array; `"visible": false` hides a row, the order in the array is the order of the table. Current state:

```json
[
  { "row": "hours",  "visible": true },
  { "row": "cond",   "visible": true },
  { "row": "temp",   "visible": true },
  { "row": "dew",    "visible": false },
  { "row": "prob",   "visible": true },
  { "row": "precip", "visible": true },
  { "row": "wind",   "visible": true },
  { "row": "gust",   "visible": true }
]
```

Invalid JSON → the configuration is ignored and all rows are visible.

### 3.3 CSS variables (`:root`)

| Variable | Default | Effect |
|---|---|---|
| `--cal-max-height` | `38vh` | maximum height of the calendar grid |
| `--list-height` | `none` | maximum height of the event list (`none` = down to the weather table) |
| `--bottom-left-width` | `50%` | width of the left column |
| `--section-gap` | `2px` | gap calendar ↔ line ↔ bottom area |
| `--cal-col-gap` | `8px` | gap between the day columns |
| `--cal-hline-gap` | `2px` | space above/below the lines between grid rows |
| `--cal-cell-pad-bottom` | `2px` | space below the last event of a grid cell |
| `--grid-title-size` | `16px` | font size of event titles in the grid |
| `--row-gap` | `3px` | row padding of the event list |
| `--tn-row-gap` | `4px` | row padding of tasks & notes |
| `--line-color` | `#000` | **all** divider lines (grid vertical/horizontal, lists, weather) |
| `--font-family` | system sans-serif | font for lists, grid titles, status |
| `--bg-badge` | `#d4d4d4` | grey of the date badges in the event list |
| `--cal-ev-bg` | `#fff` | background of the 1st, 3rd, … event in the grid (`#d4d4d4` = alternating grey) |
| `--kw-size` | `14px` | font size of the calendar week; base for the waste line |

---

## 4. Data source: Google Apps Script

### 4.1 Important `CONFIG` values

| Key | Meaning |
|---|---|
| `TRMNL_WEBHOOK_URL` | `https://trmnl.com/api/custom_plugins/<plugin UUID>` |
| `LATITUDE`, `LONGITUDE` | location for weather and sun times |
| `TIMEZONE` | `Europe/Berlin` |
| `DAYS_AHEAD` | `14` – days in the grid |
| `CALENDAR_IDS` | Google calendars (including the holiday calendar) |
| `BIRTHDAY_KEYWORDS` | `geburtstag`, `birthday`, `bday` |
| `WEATHER_HOURS` / `WEATHER_POINTS` | `24` / `12` → blocks of 2 h |
| `SPREADSHEET_ID`, `SHEET_TASKS`, `SHEET_NOTES`, `TASK_LEAD_DAYS` | Google Sheet for tasks/notes |
| `PAYLOAD_LIMIT` | `5000` – warning threshold in the log |

Time zone of the Apps Script project and of the sheet: Europe/Berlin. Execution via a time-driven trigger (every 15–30 min; without TRMNL+ TRMNL allows at most 12 webhooks per hour).

### 4.2 Calendar – `getCalendarGrid()`

- Period: today 00:00 until the end of day `today + DAYS_AHEAD − 1`.
- Events of all calendars; duplicates discarded via the event ID.
- Birthday: title or calendar name contains a keyword → `is_birthday: true`.
- Holiday: event from the holiday calendar → `public_holiday: true` (also includes observances such as "Halloween").
- Every event appears on **every** day it touches in `events` (for the grid).
- Only on its **first occurrence** in the grid does it get `start` (and possibly `end`); on following days only `title` (+ flags).
- `start`: `"yyyy-MM-dd HH:mm"` (with time) or `"yyyy-MM-dd"` (all-day). If the event is already running, `start` = today without a time.
- `end`: only for multi-day events (last day = end − 1 ms ≠ start day). All-day = inclusive last day `"yyyy-MM-dd"`, otherwise the real end `"yyyy-MM-dd HH:mm"`; also beyond the period. Ongoing timed events also get `end` if they end today.
- All times local (Europe/Berlin), without offset.

### 4.3 Weather

- Bright Sky (DWD): `https://api.brightsky.dev/weather?lat=…&lon=…&date=…&last_date=…&tz=Europe/Berlin` (the `tz` parameter is mandatory, otherwise everything is shifted by the UTC offset).
- 24 h from the current hour, aggregated into 12 blocks of 2 h: `temp`/`dew` average, `prob`/`wind`/`gust` maximum, `mm` sum, `cond` "worst" icon (❄️ > 🌧️ > ☁️ > ⛅ > ☀️/🌙).
- Sunrise/sunset computed locally (SunCalc algorithm), the next event in each case.
- Fallback on API error: `{ "start_ts": 0, "hours": [] }`.

### 4.4 Tasks and notes – Google Sheet

- Sheet "Recurring Tasks": A = Active (`x`/`-`), B = Date (last done), C = ignored, D = Interval (days), E = Title.
- `due_in_days = Date + Interval − today`; the field is missing if there is no date. Sent are active tasks with `due_in_days ≤ TASK_LEAD_DAYS` (2) or without a date.
- Sheet "Notes": column A from row 2, empty cells ignored.

### 4.5 Waste collection

- Per bin, the date of the **next** pickup as `"yyyy-MM-dd"`, plus `key` and `label`. The days until then are computed by the markup (section 6.6).

### 4.6 Send time

- `updated_at = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm")`.

---

## 5. Payload (`merge_variables`)

```json
{
  "merge_variables": {
    "days": [
      { "date": "2026-10-27", "events": [
        { "title": "Doctor", "start": "2026-10-27 10:00" },
        { "title": "Fair",   "start": "2026-10-27 10:00", "end": "2026-10-28 14:00" },
        { "title": "Vacation" },
        { "title": "Birthday Anna 1990", "start": "2026-10-27", "is_birthday": true },
        { "title": "Reformation Day", "start": "2026-10-27", "public_holiday": true }
      ] }
    ],
    "weather": {
      "start_ts": 1792778400000, "step_h": 2,
      "hours": [20,22,0,2,4,6,8,10,12,14,16,18],
      "temp": […], "prob": […], "mm": […], "cond": ["☁️",…],
      "wind": […], "gust": […], "dew": […],
      "sunrise": "07:56", "sunset": "18:12"
    },
    "tasks": [ { "title": "Clean bathroom" }, { "title": "Wash towels", "due_in_days": -2 } ],
    "notes": [ { "title": "Reminder" } ],
    "waste": [
      { "key": "waste",     "label": "Schwarz", "date": "2026-11-06" },
      { "key": "recycling", "label": "Gelb",    "date": "2026-11-20" },
      { "key": "paper",     "label": "Blau",    "date": "2026-11-06" }
    ],
    "updated_at": "20:35"
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `days[].date` | string | day `yyyy-MM-dd` |
| `days[].events[].title` | string | event title (on every affected day) |
| `…start` | string, optional | first occurrence: `yyyy-MM-dd HH:mm` or `yyyy-MM-dd` (10 chars = all-day) |
| `…end` | string, optional | end of multi-day/ongoing events, same format |
| `…is_birthday` | bool, optional | only if true |
| `…public_holiday` | bool, optional | only if true |
| `weather.start_ts` | number (ms, UTC) | start of the first block; `0` = no data |
| `weather.step_h` | number | block size in hours |
| `weather.hours[i]` | number | local start hour of block i |
| `weather.temp/prob/mm/cond/wind/gust/dew` | arrays | values per block |
| `weather.sunrise/sunset` | `"HH:mm"` | next sunrise/sunset |
| `tasks[].due_in_days` | number, optional | > 0 due in X days, 0 today, < 0 overdue; missing = never done |
| `notes[].title` | string | note |
| `waste[].key` | string | `waste`, `recycling`, `paper` – used for the English bin names |
| `waste[].label` | string | colour in German ("Schwarz", "Gelb", "Blau") – used for the German bin names |
| `waste[].date` | string | next pickup `yyyy-MM-dd` |
| `updated_at` | `"HH:mm"` | send time of the script |

No longer used (old format): `day_num`, `month_name`, `day_short`, `is_all_day`, `time_str`, `end_str`, `end_time_str`, `end_date`.

---

## 6. Display in detail

Examples are shown in English (`lang = "en"`); see 3.0 for the German equivalents.

### 6.1 Calendar grid (top)

- Own CSS grid `.cw-grid` with `grid-template-columns: repeat(cal_cols, minmax(0, 1fr))`, `grid-auto-rows: auto`, row gap 0, column gap `--cal-col-gap`. The TRMNL `.grid` is deliberately not used because it distributes spare height across the rows.
- Day cells use the TRMNL `.item` with `.content`; the empty `.meta` is hidden. Content aligned to the top.
- **Vertical lines:** black line on the left (`.cw-vline`) of every cell **except the first one in a row** (`col_pos == 1`). The TRMNL class `border--v-60` is no longer used (it draws on the left and is grey).
- **Horizontal lines:** after every full row except the last (`.cw-hline`, black, spanning all columns).
- **Day header** from `date`: weekday (`weekday_names[%w]`, TRMNL `value value--xsmall`) and "day month" (`%-d` + `month_names`, TRMNL `label`), e.g. "Tue" / "27 Oct".
- **Events:** one line per event without a colour bar; background of the 1st, 3rd, … event = `--cal-ev-bg` (currently white), 2nd, 4th, … white. No time. Icon before the title: cake for `is_birthday`, filled flag for `public_holiday` (birthday takes precedence).
- **Title:** normal font weight, single line; titles that are too long are shortened by a script to the longest fitting length and ended with exactly one "…" (U+2026) (CSS `text-overflow` as fallback). Note: in TRMNL's rendering the text is partly clipped by an outer element, so the "…" does not always appear (known, accepted flaw).
- More than `max_events_per_day` events → "+N more".

### 6.2 Event list (top left)

- Shows every entry with `start` (order: days chronologically, within a day as delivered by the script). Following days (only `title`) are skipped; no title-based duplicate filter.
- **Date badge** (light grey `--bg-badge`, bold, single line):

| Case | `en` | `de` |
|---|---|---|
| single day, all-day | `Tue 10/27` | `Di 27.10` |
| single day, with time | `Tue 10/27 10:00` | `Di 27.10 10:00` |
| multi-day, all-day | `Tue 10/27 - 10/28` | `Di 27.10 - 28.10` |
| multi-day, with time | `Tue 10/27 10:00 - 10/28 14:00` | `Di 27.10 10:00 - 28.10 14:00` |
| started yesterday, ends today | `Sun 10/18 - 10:00` | `So 18.10 - 10:00` |

  Built with Liquid `date` (`%w`, `date_fmt`, `%H:%M`); all-day detection via `start.size == 10`.
- **Title:** single line with "…", icon as in the grid.
- **Right column** (via script, Europe/Berlin):
  - Regular events: calendar days until the event day (today 00:00 to event day 00:00, time ignored), e.g. `4`.
  - Events today and ongoing events (value ≤ 0): **no number, title bold**.
  - Birthdays with a four-digit year at the end of the title (regex `(?:^|\D)(\d{4})\s*$`): age on the event day = year of the event − birth year, shown as "36 y" (`de`: "36 J.").
  - Birthdays without a year at the end: empty.
- Divider lines black (`--line-color`), padding `--row-gap`. Empty: "No upcoming events".

### 6.3 Weather table (bottom left)

- Hidden if `weather.hours` is empty.
- Rows: label column 85 px (icon + unit, bold, 12 px), next to it a CSS grid with one column per block; black divider lines.

| `row` | Label | Value |
|---|---|---|
| `hours` | clock icon | `hours[i]` + "h" |
| `cond` | – | weather SVG from trmnl.com (☀️ 🌙 ⛅ ☁️ 🌧️ ⛈️ ❄️/🌨️) |
| `temp` | thermometer [°C] | rounded + "°" |
| `dew` | Dew [°C] | rounded + "°" |
| `prob` | drop [%] | + "%" |
| `precip` | cloud [mm] | value |
| `wind` | wind [km/h] | value |
| `gust` | Gusts | value |

- **JavaScript:**
  1. Remove/reorder rows according to `weather-rows-config`.
  2. Convert the column format into blocks: `ts = start_ts + i × step_h × 3,600,000`.
  3. Drop expired blocks (a block covers `[ts, ts + step_h)`); no rotation.
  4. Blocks shown 1:1 as columns; only the legacy hourly format (`hourly[]`) is condensed to the width.
  5. First column = current block: grey (`#d8d8d8`), 19 px, extra bold, icon 33 px.
- **Sun lines:** dashed black line for `sunrise`/`sunset`, position `85px + (100% − 85px) × (time − start hour) / (columns × step_h)`; ▲/▼ at the top, icon + time at the bottom. No lines without values.

### 6.4 Tasks & notes (right)

- Bold header: "Tasks/Notes" left, "Due [Days]" right.
- Order: tasks without a date (right "–"), then tasks by `due_in_days` ascending (most overdue at the top), then notes (right empty).
- Filter: tasks with `due_in_days > task_lead_days` are not shown.
- **Bold:** tasks without a date (never done) and tasks with `due_in_days ≤ 0`.
- Titles wrap (no truncation); due value right-aligned, tabular figures.
- Empty: "No tasks or notes".
- Liquid: check for a missing date with `== nil` (`0` is truthy in Liquid).

### 6.5 Status line (bottom right)

- **CW**: ISO calendar week of the render day (JavaScript, Europe/Berlin), bold, `--kw-size`. Liquid fallback from `days[0].date`.
- **Data HH:mm**: last 5 characters of `updated_at`; "–" if missing.
- **Display HH:mm**: time at which TRMNL generated the image (JavaScript during rendering, Europe/Berlin). Not the time at which the device fetches the image.

### 6.6 Waste collection (right, above the status line)

- Format: **Black 🗑 14 | Yellow 🗑 28 | Blue 🗑 14** (🗑 = custom bin SVG; name per language, see 3.0). The separator belongs to the following entry.
- Days = pickup date − today (both as UTC midnight, today in Europe/Berlin) → whole days, independent of server time zone and DST; 0 = today.
- Right-aligned, always **single line**: the font starts at `2 × --kw-size` and is reduced in 0.5 px steps until the line fits (min. `--kw-size`). Measurement is done temporarily left-aligned, because right-aligned overflow does not count in `scrollWidth`.
- Hidden if there is no `waste` in the payload.

### 6.7 Battery (bottom left)

- Source: `trmnl.device.percent_charged` (from TRMNL, not from the script); rounded, clamped to 0–100.
- Battery SVG with a proportional fill bar and "82 %"; hidden without a value (e.g. in the editor preview).

---

## 7. Robustness & known pitfalls

| Topic | Solution |
|---|---|
| Payload > 5 KB | raw data only, weather in columns, optional fields only when true, size in the log |
| Server time zone ≠ Berlin | "today" in JavaScript with `Intl.DateTimeFormat` and `timeZone`, differences as UTC midnight |
| Weather shifted | `tz` parameter for Bright Sky |
| Weekday/month names in the wrong language | fixed name lists per language in the markup instead of `%a`/`%b` |
| Vertical grid line missing | `border--v-60` draws on the left → own `.cw-vline` on all cells except the first one per row |
| Empty space in grid rows | own grid instead of TRMNL `.grid`, `.meta` hidden |
| "…" in the grid sometimes missing | shortened by script; does not apply when an outer TRMNL element clips (accepted) |
| Liquid code inside JavaScript | scripts wrapped in `{% raw %} … {% endraw %}` |
| API outage | weather fallback → table hidden |
| Many events | grid "+N more", list cut off at the bottom, weather stays visible |
| Task lead time longer than the script sends | raise `TASK_LEAD_DAYS` in the script to at least `task_lead_days` |
