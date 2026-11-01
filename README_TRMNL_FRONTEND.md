# TRMNL X – Setting up the markup ("Calendar, Events, Tasks/Notes, Weather, Waste")

This guide describes how to set up the display markup from the file **`trmnl_calendar_todo_weather.md`** in a TRMNL Private Plugin.

The markup only renders – the data is delivered by a Google Apps Script via webhook.

| File | Content |
|---|---|
| `trmnl_calendar_todo_weather.md` | Liquid markup for the **Full** tab (this guide) |
| `trmnl_calendar_todo_weather_spec.md` | Detailed specification of the whole plugin: layout, configuration, payload format, display and calculation logic, known pitfalls – enough to rebuild everything |
| `trmnl_feed.gs` | Google Apps Script that collects the data and sends it via webhook |
| `config.example.gs` | Configuration template for the script (copy to `config.gs`, which is not committed) |
| `README.md` | Setting up the Google Apps Script (`trmnl_feed.gs`) |

---

## Prerequisites

- TRMNL account with a **TRMNL X**
- **Developer Edition** for the device: Private Plugins (custom markup, webhook) are a Developer Edition feature. It is a paid add-on: **$20 one-time per device**, no subscription (as of November 2026). It can be purchased in the device settings in the TRMNL dashboard. Details: [What's the Developer edition?](https://trmnl.com/blog/developer-edition), [Developer Edition Features](https://help.trmnl.com/en/articles/12410549-developer-edition-features)
- A **Private Plugin** with the **Webhook** strategy (see `README.md`, step 1)
- The Google Apps Script is set up and has **sent data successfully at least once** (`TRMNL Response Code: 200`). Without data the preview stays empty.
- The file `trmnl_calendar_todo_weather.md`

---

## Steps overview

1. Open the plugin's markup editor
2. Paste the markup into the **Full** tab
3. Check the preview
4. Add the plugin to a playlist and set the refresh interval
5. Optional: adjust the layout

---

## 1. Open the markup editor

1. In the TRMNL dashboard open **Plugins → Private Plugin** (the plugin whose webhook URL is configured in the script).
2. Click **Edit Markup**.

The editor has several tabs for the different view sizes: **Full**, **Half Horizontal**, **Half Vertical**, **Quadrant** and possibly **Shared**.

---

## 2. Paste the markup

1. Open `trmnl_calendar_todo_weather.md` in a text editor (Notepad++, VS Code or similar).
2. Select and copy the **entire content** (`Ctrl + A`, `Ctrl + C`).
3. In the markup editor select the **Full** tab, delete the existing content and paste.
4. **Save**.

Important:

- **Only the "Full" tab** is needed. The layout is designed for the whole screen and does not work in half or quadrant views. Leave the other tabs empty and do **not** use the plugin in a mashup (split screen) in the playlist.
- Do **not** copy anything into the "Shared" tab. The markup is fully self-contained (CSS, Liquid and JavaScript in one file).
- The `.md` file extension is only for storage – the content is Liquid markup (HTML, CSS, JavaScript), not Markdown. Paste the plain text into the editor.
- The file contains JavaScript blocks inside `{% raw %} … {% endraw %}`. These two tags must be kept, otherwise Liquid tries to evaluate the JavaScript code and the weather table stays empty.

### Variables used

The markup reads this data:

| Variable | Source | Used for |
|---|---|---|
| `days` | Script (webhook) | Calendar grid and event list (format see below) |
| `weather` | Script (webhook) | Weather table and sun lines |
| `tasks` | Script (webhook) | Tasks bottom right |
| `notes` | Script (webhook) | Notes bottom right |
| `waste` | Script (webhook) | Waste collection bottom right: `[{ key, label, date: "yyyy-MM-dd" }]` per bin |
| `updated_at` | Script (webhook) | Send time `HH:mm` for the status line ("Data …") |
| `trmnl.device.percent_charged` | TRMNL (automatic) | Battery indicator bottom left |

### Right column of the event list

- **Regular events:** number of calendar days until the event day, counted from today 00:00 to the event day 00:00 (Europe/Berlin). The time of the event does not matter; tomorrow = `1`. Events today and multi-day events that are already running show no number; their title is bold instead.
- **Birthdays** (`is_birthday`): if the title ends with a four-digit year, e.g. "Birthday Anna 1990", the column shows the age reached on that day ("36 y" in English, "36 J." in German). Without a year at the end the column stays empty.

### Format of `days`

The script only delivers date and time values; weekday, date and time are formatted by the markup itself (Liquid filter `date`, weekday and month names from fixed lists per language in the markup).

```json
{ "date": "2026-10-27", "events": [
  { "title": "Doctor",   "start": "2026-10-27 10:00" },
  { "title": "Fair",     "start": "2026-10-27 10:00", "end": "2026-10-28 14:00" },
  { "title": "Vacation" },
  { "title": "Birthday Anna", "start": "2026-10-27", "is_birthday": true },
  { "title": "Reformation Day", "start": "2026-10-27", "public_holiday": true }
] }
```

| Field | Meaning |
|---|---|
| `date` | Day `yyyy-MM-dd`; the grid builds its header from it ("Tue" / "27 Oct") |
| `title` | Event title – on every day the event takes place (for the grid) |
| `start` | only on the **first occurrence** of an event: `yyyy-MM-dd HH:mm` (with time) or `yyyy-MM-dd` (all-day, or an ongoing event starting today) |
| `end` | only for multi-day or ongoing events: all-day = inclusive last day `yyyy-MM-dd`, otherwise the real end `yyyy-MM-dd HH:mm` |
| `is_birthday` | only present if true → cake icon (black stroke SVG) before the title |
| `public_holiday` | only present if true → filled flag icon before the title |

The **event list** shows every entry with `start`; following days of multi-day events (only `title`) are skipped:

| Case | Display (`en`) | Display (`de`) |
|---|---|---|
| single day, all-day | `Tue 10/27` | `Di 27.10` |
| single day, with time | `Tue 10/27 10:00` | `Di 27.10 10:00` |
| multi-day, all-day | `Tue 10/27 - 10/28` | `Di 27.10 - 28.10` |
| multi-day, with time | `Tue 10/27 10:00 - 10/28 14:00` | `Di 27.10 10:00 - 28.10 14:00` |
| started yesterday, ends today | `Sun 10/18 - 10:00` | `So 18.10 - 10:00` |

Script and markup must match: the markup only understands this format (no longer the earlier one with `day_num`, `month_name`, `day_short`, `time_str`, `is_all_day`).

The markup editor shows the most recently received values in its variable overview (depending on the UI, "Your Variables" or similar). If it is empty, the script has not sent data successfully yet.

---

## 3. Check the preview

After saving, the preview renders with the most recently sent data. You should see:

| Area | Expected |
|---|---|
| Top, full width | `cal_days` days in rows of `cal_cols` (default: 2 × 7) with weekday, date and events; events on a white background (alternating grey possible via `--cal-ev-bg`) |
| Left, below the calendar | Event list with grey date badges, e.g. "Tue 10/27 10:00" or "Tue 10/27 - 10/28"; on the far right the days until the event day (events today/ongoing: no number, title bold) or, for birthdays with a year at the end of the title, the age ("36 y") |
| Left, bottom | Weather table, first column highlighted in grey |
| Below the weather table | Dashed lines with sunrise and sunset times |
| Right | Header "Tasks/Notes" and "Due [Days]", below tasks and notes (long titles wrap); tasks due today, overdue (Due ≤ 0) and never done (no date) in bold |
| Bottom left | Battery icon with percentage (**on the device only**, often hidden in the preview) |
| Bottom right, above the status line | "Black 🗑 14 \| Yellow 🗑 28 \| Blue 🗑 14" (🗑 = bin icon) = days until the next collection (0 = today), right-aligned, always on one line (the font is shrunk automatically until everything fits) |
| Bottom right | Status line: **CW 43** · "Data 20:44" (send time of the script) · "Display 20:47" (render time at TRMNL) |

The browser preview does not necessarily have the exact resolution of the TRMNL X. Always check the final result on the device.

---

## 4. Playlist and refresh

1. Open **Playlists** and add the plugin to the TRMNL X playlist (if not done yet).
2. Choose a **refresh interval** for the plugin that matches the script trigger (e.g. 15 or 30 minutes). The display only redraws on refresh – sending more often from the script brings no benefit beyond that.
3. To see the result immediately: set the playlist to the plugin in the dashboard or trigger a manual refresh on the device.

---

## 5. Adjust the layout (optional)

All settings are at the **top** of `trmnl_calendar_todo_weather.md`. After changes, copy the whole file into the **Full** tab again (or edit directly in the editor and then update the local file so both stay identical).

### Display language

At the very top of `trmnl_calendar_todo_weather.md`:

```liquid
{% assign lang = "en" %}
```

| Value | Display |
|---|---|
| `"en"` | English (default) |
| `"de"` | German |

All texts on the display are switched: weekdays, months, date format of the event list, "+N more/weitere", empty-list messages, weather labels (Dew/Tau, Gusts/Böen), status line, bin names and age suffix.

| Element | `en` | `de` |
|---|---|---|
| Event list badge | `Tue 10/27 10:00 - 10/28 14:00` | `Di 27.10 10:00 - 28.10 14:00` |
| Calendar header | `Tue` / `27 Oct` | `Di` / `27 Okt` |
| Status line | `CW 43  Data 20:52  Display 20:58` | `KW 43  Daten 20:52  Anzeige 20:58` |
| Waste collection | `Black 🗑 14 \| Yellow 🗑 28 \| Blue 🗑 14` | `Schwarze 🗑 14 \| Gelbe 🗑 28 \| Blaue 🗑 14` |
| Age | `36 y` | `36 J.` |
| Empty lists | `No upcoming events`, `No tasks or notes` | `Keine anstehenden Termine`, `Keine Aufgaben oder Notizen` |

All texts are defined in one translation block directly below the settings. Code and comments in the markup are English throughout.

### Task lead time

Directly below the language setting:

```liquid
{% assign task_lead_days = 2 %}
```

A recurring task appears this many days **before** it is due (`2` = from two days before, `0` = only when due or overdue). Overdue tasks and tasks that were never done are always shown.

Important: the script only sends tasks within its own `TASK_LEAD_DAYS` (default 2). The markup can therefore only show **fewer** days than the script sends. For a longer lead time, set `TASK_LEAD_DAYS` in the script to at least the same value.

### Liquid variables (top block `CONFIGURATION`)

| Variable | Default | Effect |
|---|---|---|
| `lang` | `"en"` | Display language: `"en"` or `"de"` (see above) |
| `task_lead_days` | `2` | Days before the due date from which a task is shown (see above) |
| `cal_days` | `14` | Number of days in the calendar grid – must match `DAYS_AHEAD` in the script |
| `cal_cols` | `7` | Days per row; the number of rows is `cal_days / cal_cols` |
| `max_events_per_day` | `4` | Events per grid cell, the rest as "+N more" |
| `min_col_width` | `30` | Min. width of a weather column (px), only for the legacy weather format |
| `horizontal_spacing` | `"4px"` | Column gap in the weather table |
| `vertical_spacing` | `"2px"` | Row padding in the weather table |
| `timezone` | `"Europe/Berlin"` | Time zone for all date/time calculations |

### CSS variables (`:root` block in `<style>`)

| Variable | Default | Effect |
|---|---|---|
| `--cal-max-height` | `38vh` | Maximum height of the calendar grid |
| `--list-height` | `none` | Maximum height of the event list; `none` = all space down to the weather table |
| `--bottom-left-width` | `50%` | Width of the left column (event list + weather) |
| `--section-gap` | `2px` | Gap between the calendar, the divider and the area below (event list, tasks/notes) |
| `--cal-col-gap` | `8px` | Gap between the day columns in the calendar grid |
| `--cal-hline-gap` | `2px` | Space above/below the horizontal lines in the calendar grid |
| `--cal-cell-pad-bottom` | `2px` | Space below the last event of a grid cell |
| `--grid-title-size` | `16px` | Font size of event titles in the calendar |
| `--row-gap` | `3px` | Row padding of the event list |
| `--tn-row-gap` | `4px` | Row padding of tasks & notes |
| `--bg-badge` | `#d4d4d4` | Grey of the date badges in the event list |
| `--kw-size` | `14px` | Font size of the calendar week; the waste line starts at twice this size and shrinks down to at most this size until it fits on one line |
| `--cal-ev-bg` | `#fff` | Background of the 1st, 3rd, … event in the calendar grid (2nd, 4th, … always white); `#d4d4d4` = grey like the badges |
| `--line-color` | `#000` | All divider lines: calendar grid (vertical and horizontal), event list, tasks & notes, weather table |

Further values directly in the CSS:

| Location | Effect |
|---|---|
| `#custom-weather-box { margin-bottom: 28px; }` | Space below the weather table for sun times and battery; `0` = table flush with the bottom (sun times and battery then overlap) |
| `.grid-cell.is-current` | Highlight of the current weather column (size, grey) |

### Showing and hiding weather rows

Directly above the weather data in the markup there is a `weather-rows-config` block:

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

| `row` | Row |
|---|---|
| `hours` | Time |
| `cond` | Weather icon |
| `temp` | Temperature [°C] |
| `prob` | Precipitation probability [%] |
| `precip` | Precipitation [mm] |
| `dew` | Dew point [°C] |
| `wind` | Wind [km/h] |
| `gust` | Gusts [km/h] |

- `"visible": false` hides the row. The table stays pinned to the bottom and the freed space goes to the event list.
- The order in the array is the order of the rows in the table.
- It must remain valid JSON: commas between entries, no comma after the last one, `true`/`false` in lowercase.

### Changing the number of calendar days

The default is **14 days** (2 rows of 7 = two full weeks). The number of days must be set the same in **two places**:

| Location | 14 days (default) | 10 days |
|---|---|---|
| Apps Script, `CONFIG` | `DAYS_AHEAD: 14` | `DAYS_AHEAD: 10` |
| Markup, configuration | `cal_days = 14`, `cal_cols = 7` | `cal_days = 10`, `cal_cols = 5` |

Notes:

- `cal_days` should be a multiple of `cal_cols`, otherwise the last row stays incomplete.
- More columns make the cells narrower. Event titles are shortened with "…" earlier; reduce `--grid-title-size` if needed (e.g. `14px` with 7 columns).
- More days mean more events in the payload. After a change, check the `Payload size` line in the script log (limit 5 KB).
- The event list automatically shows all events of the period; if it gets too long it is cut off at the bottom. Multi-day events show their real end (`end` from the script), even if it lies after the last displayed day.

---

## Troubleshooting

| Symptom | Cause / solution |
|---|---|
| Preview completely empty | The script has not sent data successfully yet. Check the Apps Script log for `TRMNL Response Code: 200`. |
| Calendar shown, weather table missing | The script sent the weather fallback (`hours: []`, Bright Sky not reachable) – usually resolves on the next run. Or the `{% raw %}` tags are missing. |
| Weather table shows only 1–2 columns | Data is outdated (script no longer sends) or the script does not pass the `tz` parameter to Bright Sky. Check trigger and log. |
| Weather table cut off at the bottom | Reduce `--cal-max-height`, hide weather rows via `weather-rows-config` or set `vertical_spacing` to `"1px"`. |
| All weather rows visible despite `"visible": false` | JSON in `weather-rows-config` is invalid (e.g. comma after the last entry) – the configuration is then ignored. |
| No sun lines | The script does not send `sunrise`/`sunset` (the sunrise/sunset log line is missing). |
| Tasks & notes empty | No active tasks within the lead time and no notes – or a sheet error, see `README.md`. |
| Battery missing | Normal in the browser preview. On the device it is only missing if TRMNL does not provide `trmnl.device.percent_charged`. |
| Event titles in the calendar wrap instead of "…" | Markup only partially copied – paste the whole file into the **Full** tab again. |
| Calendar headers without weekday/date, event list empty | The script still sends the old format without `date`/`start`. Update script and markup together. |
| Event missing in the event list but shown in the grid | The entry has no `start` – only the first occurrence of an event carries `start`. Check in the script log. |
| Waste line shows "–" instead of days | Date in `waste` is not in the format `yyyy-MM-dd`. |
| Status line shows "Data –" | The script does not send `updated_at`. |
| "Data" no longer changes | The script no longer sends successfully – check trigger and log. |
| Different look in the playlist | The plugin is used in a mashup (half/quadrant). Use it full screen only. |
| Liquid error message in the preview | Usually caused by incomplete pasting. Clear the tab and paste the whole file again. |
