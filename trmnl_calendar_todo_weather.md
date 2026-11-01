{% comment %}
=====================================================================
 LANGUAGE / SPRACHE
 Display language of all texts on the screen (weekdays, months, labels,
 status line, empty-list messages, waste bins, age suffix, date format).
 Available values:
   "en" = English (default)
   "de" = German / Deutsch
 To switch to German, change the value below from "en" to "de".
=====================================================================
{% endcomment %}
{% assign lang = "en" %}

{% comment %}
=====================================================================
 TRMNL X – Calendar, events, tasks/notes, weather, waste (Full view)
 Layout:
   1. Calendar grid (cal_days days, cal_cols per row; default 14 = 2x7), full width
   2. Event list (left, top, 50 % width, height up to the weather table)
   3. Weather table (left, bottom, 50 % width, pinned to the bottom edge)
   4. Tasks & notes (right), below: waste collection and status line (week, data, render time)
   5. Battery (bottom left)
 Merge variables (from the Google Apps Script):
 days: [{ date: "yyyy-MM-dd", events: [{ title, start?, end?, is_birthday?, public_holiday? }] }]
 weather: { start_ts, step_h, hours[], temp[], prob[], mm[], cond[], wind[], gust[], dew[], sunrise, sunset }
 tasks: [{ title, due_in_days? }]   notes: [{ title }]
 waste: [{ key, label, date: "yyyy-MM-dd" }] (next collection per bin)
 updated_at: "HH:mm" (time the script sent the data, Europe/Berlin)
=====================================================================
{% endcomment %}

{% assign day_list = days %}
{% assign w_data = weather %}
{% assign task_list = tasks %}
{% assign note_list = notes %}
{% assign waste_list = waste %}
{% comment %} nil | plus → 0, so this is safe even without tasks/notes in the payload {% endcomment %}
{% assign tn_total = task_list.size | plus: 0 | plus: note_list.size %}

{% comment %} ---------- TRANSLATIONS (selected by "lang" above) ---------- {% endcomment %}
{% if lang == "de" %}
  {% assign weekday_names = "So,Mo,Di,Mi,Do,Fr,Sa" | split: "," %}
  {% assign month_names = "Jan,Feb,Mär,Apr,Mai,Jun,Jul,Aug,Sep,Okt,Nov,Dez" | split: "," %}
  {% assign date_fmt = "%d.%m" %}
  {% assign t_more = "weitere" %}
  {% assign t_no_events = "Keine anstehenden Termine" %}
  {% assign t_no_tasks = "Keine Aufgaben oder Notizen" %}
  {% assign t_tn_title = "Tasks/Notes" %}
  {% assign t_tn_due = "Due [Days]" %}
  {% assign t_dew = "Tau [°C]" %}
  {% assign t_gust = "Böen" %}
  {% assign t_week = "KW" %}
  {% assign t_data = "Daten" %}
  {% assign t_render = "Anzeige" %}
  {% assign t_age = " J." %}
{% else %}
  {% assign weekday_names = "Sun,Mon,Tue,Wed,Thu,Fri,Sat" | split: "," %}
  {% assign month_names = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec" | split: "," %}
  {% assign date_fmt = "%m/%d" %}
  {% assign t_more = "more" %}
  {% assign t_no_events = "No upcoming events" %}
  {% assign t_no_tasks = "No tasks or notes" %}
  {% assign t_tn_title = "Tasks/Notes" %}
  {% assign t_tn_due = "Due [Days]" %}
  {% assign t_dew = "Dew [°C]" %}
  {% assign t_gust = "Gusts" %}
  {% assign t_week = "CW" %}
  {% assign t_data = "Data" %}
  {% assign t_render = "Display" %}
  {% assign t_age = " y" %}
{% endif %}

{% comment %} ---------- CONFIGURATION ---------- {% endcomment %}
{% assign cal_days = 14 %}           {% comment %} days in the calendar grid – must match DAYS_AHEAD in the script {% endcomment %}
{% assign cal_cols = 7 %}            {% comment %} days per row (10 days → 5, 14 days → 7) {% endcomment %}
{% assign max_events_per_day = 4 %}   {% comment %} events per grid cell, the rest is shown as "+N" {% endcomment %}
{% comment %} Birthday icon: black stroke SVG instead of an emoji (much more legible on e-paper) {% endcomment %}
{% capture cake_icon %}<svg class="cw-cake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>{% endcapture %}
{% comment %} Holiday icon (public_holiday): filled black flag, same style as the birthday icon {% endcomment %}
{% capture holiday_icon %}<svg class="cw-cake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/></svg>{% endcapture %}
{% comment %} Waste bin icon (custom SVG, inline) {% endcomment %}
{% capture bin_icon %}<svg class="cw-waste-icon" viewBox="0 0 174.80241 202.34554" aria-hidden="true"><g transform="translate(-18.373551,-52.114752)"><path fill="currentColor" d="m 97.687762,253.32156 c -4.977029,-0.0207 -7.092065,-2.89701 -7.429942,-10.24102 l -0.884446,-19.22409 c -0.916451,-10.26393 -8.75705,-20.05302 -18.12859,-24.62789 -5.283176,-2.97166 -11.169322,-3.52274 -17.067375,-3.94874 L 44.691303,77.863842 20.4575,63.247092 c -2.185573,-1.31824 -2.63134,-3.820497 -1.434659,-5.69923 l 2.128953,-3.342355 c 1.46077,-2.29334 3.840647,-1.999697 5.935351,-0.893379 L 53.625419,67.328317 H 187.8265 c 3.12431,0.240248 5.13416,3.2503 5.34946,6.614584 0,5.165227 -3.77881,6.618517 -8.29264,6.867249 L 181.57603,80.954359 168.8625,240.7627 c -0.63899,8.03213 -2.03517,12.84677 -6.71698,12.82727 z M 59.856572,52.114752 H 166.75936 c 4.55099,1.713346 7.26777,5.483083 7.87294,10.183133 l -122.637824,0.0022 c 0.842625,-6.544245 3.326687,-7.952559 7.862096,-10.185333 z M 79.811266,229.98604 c -4e-6,13.51676 -10.957501,24.47425 -24.474257,24.47425 -13.516756,0 -24.474252,-10.95749 -24.474256,-24.47425 -2e-6,-13.51676 10.957496,-24.47426 24.474256,-24.47426 13.51676,0 24.474259,10.9575 24.474257,24.47426 z"/></g></svg>{% endcapture %}
{% assign min_col_width = 30 %}       {% comment %} min. width of a weather column in px (legacy hourly format only) {% endcomment %}
{% assign horizontal_spacing = "4px" %}
{% assign vertical_spacing = "2px" %}
{% assign timezone = "Europe/Berlin" %}
{% comment %} sun lines only if the script sends sunrise/sunset – no fake defaults {% endcomment %}
{% assign sunrise_time = w_data.sunrise | default: "" %}
{% assign sunset_time = w_data.sunset | default: "" %}

{% comment %}
  ---------- WEATHER TABLE: SHOW / HIDE ROWS ----------
  "visible": false hides a row. The table stays pinned to the bottom and the
  freed space goes to the event list. The order of this array is also the
  order of the rows in the table.
    hours  = time               cond = weather icon
    temp   = temperature [°C]   prob = precipitation probability [%]
    precip = precipitation [mm] dew  = dew point [°C]
    wind   = wind [km/h]        gust = gusts [km/h]
{% endcomment %}
<script id="weather-rows-config" type="application/json">
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
</script>

<script id="data-weather" type="application/json">
  {{ w_data | json }}
</script>

<style>
  :root {
    /* Layout – fine-tune here */
    --cal-max-height: 38vh;   /* max. height of the calendar grid */
    --list-height: none;      /* max. height of the event list; none = all space down to the weather table */
    --bottom-left-width: 50%; /* width of event list + weather */
    --section-gap: 2px;       /* gap calendar ↔ divider ↔ event list/tasks */
    --cal-col-gap: 8px;       /* gap between the day columns */
    --cal-hline-gap: 2px;     /* space above/below the horizontal grid lines */
    --cal-cell-pad-bottom: 2px; /* space below the last event of a grid cell */
    --grid-title-size: 16px;  /* font size of event titles in the calendar grid */

    --row-gap: 3px;
    --tn-row-gap: 4px;        /* vertical padding (top & bottom) per task/note row */
    --line-color: #000;       /* all divider lines (calendar, lists, weather) */
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    --bg-badge: #d4d4d4;
    --kw-size: 14px;          /* font size of the calendar week; waste line starts at 2x and shrinks to fit */
    --cal-ev-bg: #fff;        /* background of the 1st, 3rd, … event in the grid; #d4d4d4 = grey like the badges */
  }

  /* ---------- Overall layout ---------- */
  .cw-root {
    position: relative; /* reference box for the battery indicator */
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: var(--section-gap);
    overflow: hidden;
  }

  .cw-calendar {
    flex: 0 0 auto;
    max-height: var(--cal-max-height);
    overflow: hidden;
    width: 100%;
  }

  .cw-bottom {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 12px;
    width: 100%;
  }

  .cw-left {
    width: var(--bottom-left-width);
    flex: 0 0 var(--bottom-left-width);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .cw-right {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ---------- Status line (bottom right) ---------- */
  .cw-status {
    flex: 0 0 auto;
    margin-top: auto;
    padding-top: 4px;
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 12px;
    font-family: var(--font-family);
    font-size: 12px;
    color: #000;
    white-space: nowrap;
  }

  .cw-kw { font-size: var(--kw-size); font-weight: 700; }

  /* ---------- Waste collection (above the status line, right-aligned) ---------- */
  .cw-waste {
    flex: 0 0 auto;
    margin-top: auto;           /* pushes waste + status line to the bottom */
    padding-top: 4px;
    display: flex;
    flex-wrap: nowrap;          /* always one line; the script shrinks the font to fit */
    overflow: hidden;
    justify-content: flex-end;
    align-items: center;
    column-gap: 8px;
    font-family: var(--font-family);
    font-size: calc(var(--kw-size) * 2);
    line-height: 1.2;
    color: #000;
  }
  .cw-waste + .cw-status { margin-top: 0; }
  .cw-waste-icon { width: 0.95em; height: 1.1em; vertical-align: -0.2em; }
  .cw-waste-item { white-space: nowrap; flex-shrink: 0; }

  /* ---------- Battery indicator (bottom left) ----------
     Sits in the 28 px strip below the weather table, under the label
     column (85 px), so it never collides with the sunrise/sunset labels. */
  .cw-battery {
    position: absolute;
    left: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-family);
    font-size: 11px;
    font-weight: 700;
    color: #000;
    z-index: 20;
  }

  .cw-battery svg { width: 22px; height: 12px; }

  /* ---------- Tasks & Notes ---------- */
  .tn-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    width: 100%;
    font-family: var(--font-family);
    color: #000;
  }

  .tn-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start; /* with a multi-line title the due value stays at the top */
    gap: 12px;
    padding-top: var(--tn-row-gap);
    padding-bottom: var(--tn-row-gap);
    border-bottom: 1px solid var(--line-color);
    width: 100%;
    box-sizing: border-box;
    font-size: 0.95rem;
    line-height: 1.3;
    font-weight: 500;
  }

  .tn-row:last-child { border-bottom: none; }
  .tn-row--due { font-weight: 700; }

  .tn-header {
    font-weight: 700;
    border-bottom: 1px solid var(--line-color);
  }

  /* Titles wrap instead of being cut off; very long words without
     spaces are broken mid-word if necessary */
  .tn-title {
    flex: 1 1 auto;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .tn-due {
    flex: 0 0 auto;
    min-width: 5.5em;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Calendar grid: event titles on one line, not bold, "…" on overflow.
     min-width: 0 is required, otherwise flex/grid children grow with the
     text and text-overflow never kicks in. */
  .cw-calendar .item,
  .cw-calendar .content {
    min-width: 0;
  }

  .cw-calendar .content {
    flex: 1 1 auto;
    overflow: hidden;
  }

  /* Day cells: content aligned to the top instead of vertically centred.
     The cell itself keeps full height so the vertical lines are continuous. */
  .cw-day {
    align-items: stretch !important;
  }

  .cw-day > .content {
    display: flex;
    flex-direction: column;
    justify-content: flex-start !important;
    align-self: stretch;
  }

  /* Calendar grid: column count comes from cal_cols (inline style).
     Vertically compact: no row gap, the empty TRMNL .meta is hidden (it
     added empty space at the top), no top/bottom padding in the cells. */
  .cw-grid {
    display: grid;
    grid-auto-rows: auto;   /* each row only as tall as its content */
    align-content: start;
    column-gap: var(--cal-col-gap);
    row-gap: 0;
    height: auto;
  }
  .cw-calendar .cw-day { height: auto !important; }
  .cw-day > .meta { display: none !important; }
  .cw-calendar .cw-day {
    padding-top: 0 !important;
    padding-bottom: var(--cal-cell-pad-bottom) !important;
    min-height: 0 !important;
  }
  .cw-row-divider { grid-column: 1 / -1; }

  /* Divider lines: black instead of the grey TRMNL classes border--v-60 / divider */
  .cw-vline { border-left: 1px solid var(--line-color); }
  .cw-hline {
    height: 0;
    border-top: 1px solid var(--line-color);
    width: 100%;
    margin: var(--cal-hline-gap) 0;
  }
  .cw-hline--section { margin: 0; flex: 0 0 auto; }

  /* Birthday and holiday icon (inline SVG), scales with the font size */
  .cw-cake {
    width: 1.1em;
    height: 1.1em;
    vertical-align: -0.15em;
    margin-right: 0.3em;
    color: #000;
  }

  /* Event in the calendar grid: no colour bar; instead the background
     alternates between --cal-ev-bg and white */
  .cw-ev {
    margin-top: 3px;
    padding: 1px 4px;
    border-radius: 3px;
    min-width: 0;
    overflow: hidden;
  }

  .cw-ev--shaded { background-color: var(--cal-ev-bg); }

  .cw-grid-title {
    display: block;
    width: 100%;
    font-family: var(--font-family);
    font-size: var(--grid-title-size);
    line-height: 1.25;
    font-weight: 400;
    color: #000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis; /* fallback in case the script below does not run */
  }

  .cw-more {
    font-size: 0.75rem;
    font-weight: 700;
    margin-top: 2px;
  }

  /* ---------- Event list ---------- */
  /* List only as tall as needed, max. --list-height; shrinks first when space
     is short so the weather table always stays fully visible */
  .cw-list {
    flex: 0 1 auto;
    max-height: var(--list-height);
    min-height: 0;
    overflow: hidden;
    font-family: var(--font-family);
    color: #000;
    display: flex;
    flex-direction: column;
  }

  .event-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding-top: var(--row-gap);
    padding-bottom: var(--row-gap);
    border-bottom: 1px solid var(--line-color);
    width: 100%;
    box-sizing: border-box;
  }

  .event-item:last-child { border-bottom: none; }
  .event-item--now .event-title,
  .event-item--now .event-right { font-weight: 700; }

  .event-badge {
    background-color: var(--bg-badge);
    color: #000;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 700;
    line-height: 1.2;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .badge-line { white-space: nowrap; }
  .until-text { font-weight: 500; font-size: 0.8rem; padding: 0 2px; }

  .event-title {
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.3;
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-right {
    flex: 0 0 auto;
    min-width: 2.5em;
    text-align: right;
    white-space: nowrap;
    font-size: 0.95rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .no-events {
    padding: 16px 0;
    text-align: center;
    font-style: italic;
    color: #555;
  }

  /* ---------- Weather table ---------- */
  #custom-weather-box,
  #custom-weather-box * {
    font-family: Arial, Helvetica, sans-serif !important;
    color: #000;
    box-sizing: border-box;
  }

  #custom-weather-box {
    flex: 0 0 auto;   /* the weather table is never squeezed */
    margin-top: auto; /* pinned to the bottom, regardless of the list length */
    width: 100%;
    margin-bottom: 28px; /* room for the sunrise/sunset labels below the table */
  }

  .epaper-icon { width: 16px; height: 16px; flex-shrink: 0; }

  .epaper-icon-grid {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: brightness(0);
  }

  .sun-arrow-icon {
    width: 15px;
    height: 15px;
    display: inline-block;
    vertical-align: middle;
  }

  .weather-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    padding-top: {{ vertical_spacing }};
    padding-bottom: {{ vertical_spacing }};
    border-bottom: 1px solid var(--line-color);
  }

  .weather-row:last-child { border-bottom: none; }

  .row-label {
    width: 85px;
    min-width: 85px;
    max-width: 85px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding-right: 12px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .row-grid {
    display: grid;
    flex-grow: 1;
    width: 0;
    height: 100%;
    align-items: center;
    column-gap: {{ horizontal_spacing }};
  }

  .grid-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    height: 100%;
  }

  .grid-cell.is-current {
    font-size: 19px !important;
    font-weight: 900 !important;
    background-color: #d8d8d8 !important;
    border-radius: 3px;
  }

  .grid-cell.is-current .epaper-icon-grid {
    width: 33px !important;
    height: 33px !important;
  }

  .table-container-relative { position: relative; width: 100%; }

  .sun-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 1px dashed #000;
    z-index: 10;
    pointer-events: none;
  }

  .sun-arrow-up, .sun-arrow-down {
    position: absolute;
    top: -2px;
    left: -4px;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
  }
  .sun-arrow-up   { border-bottom: 7px solid #000; }
  .sun-arrow-down { border-top: 7px solid #000; }

  .sun-badge-bottom {
    position: absolute;
    bottom: -25px;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 2px;
  }
</style>

<div class="layout layout--col layout--top layout--left">
  <div class="cw-root">

    <!-- ===================================================== -->
    <!-- 1. CALENDAR GRID (full width)                        -->
    <!-- ===================================================== -->
    <div class="cw-calendar">
      <div class="cw-grid" style="grid-template-columns: repeat({{ cal_cols }}, minmax(0, 1fr));">
        {% for day in day_list limit: cal_days %}
          {% assign col_pos = forloop.index | modulo: cal_cols %}
          <div class="item cw-day flex--col gap--xsmall text--left {% unless col_pos == 1 or cal_cols == 1 %}cw-vline{% endunless %}">
            <div class="meta"></div>
            <div class="content text--left w--full">
              <div class="flex flex--row justify--between w--full">
                {% assign wd = day.date | date: "%w" | plus: 0 %}
                {% assign mi = day.date | date: "%m" | minus: 1 %}
                <span class="value value--xsmall">{{ weekday_names[wd] }}</span>
                <span class="label">{{ day.date | date: "%-d" }} {{ month_names[mi] }}</span>
              </div>

              {% for event in day.events limit: max_events_per_day %}
                {% comment %} 1st, 3rd, … event of the day uses --cal-ev-bg, 2nd, 4th, … white {% endcomment %}
                {% assign ev_mod = forloop.index0 | modulo: 2 %}
                <div class="cw-ev{% if ev_mod == 0 %} cw-ev--shaded{% endif %}">
                  <span class="cw-grid-title">{% if event.is_birthday %}{{ cake_icon }}{% elsif event.public_holiday %}{{ holiday_icon }}{% endif %}<span class="cw-t">{{ event.title }}</span></span>
                </div>
              {% endfor %}

              {% assign extra = day.events.size | minus: max_events_per_day %}
              {% if extra > 0 %}
                <div class="cw-more">+{{ extra }} {{ t_more }}</div>
              {% endif %}
            </div>
          </div>

          {% comment %} divider after every full row except the last one {% endcomment %}
          {% if col_pos == 0 and forloop.last == false %}
            <div class="cw-hline cw-row-divider"></div>
          {% endif %}
        {% endfor %}
      </div>
    </div>

    <div class="cw-hline cw-hline--section"></div>

    <!-- ===================================================== -->
    <!-- BOTTOM AREA                                           -->
    <!-- ===================================================== -->
    <div class="cw-bottom">
      <div class="cw-left">

        <!-- 2. EVENT LIST (left, 50 % width) -->
        <div class="cw-list">
          {% comment %}
            The list shows every entry that has "start" (= first occurrence of an
            event in the grid). Following days of multi-day events have no
            "start" and are skipped – no duplicate filter needed.
            start: "yyyy-MM-dd" (all-day, 10 chars) or "yyyy-MM-dd HH:mm" (16 chars)
            end:   only for multi-day / ongoing events, same format

            Display (en / de):
              Tue 10/27                       Di 27.10                      single day, all-day
              Tue 10/27 10:00                 Di 27.10 10:00                single day, with time
              Tue 10/27 - 10/28               Di 27.10 - 28.10              multi-day, all-day
              Tue 10/27 10:00 - 10/28 14:00   Di 27.10 10:00 - 28.10 14:00  multi-day, with time
              Sun 10/18 - 10:00               So 18.10 - 10:00              started yesterday, ends today
          {% endcomment %}
          {% assign event_count = 0 %}

          {% for day in day_list %}
            {% for event in day.events %}
              {% if event.start %}
                {% assign wd = event.start | date: "%w" | plus: 0 %}
                {% assign start_dm = event.start | date: date_fmt %}
                {% assign badge = weekday_names[wd] | append: " " | append: start_dm %}
                {% if event.start.size > 10 %}
                  {% assign start_hm = event.start | date: "%H:%M" %}
                  {% assign badge = badge | append: " " | append: start_hm %}
                {% endif %}

                {% if event.end %}
                  {% assign start_day = event.start | slice: 0, 10 %}
                  {% assign end_day = event.end | slice: 0, 10 %}
                  {% if end_day == start_day %}
                    {% comment %} ends on the same day → time only {% endcomment %}
                    {% assign end_hm = event.end | date: "%H:%M" %}
                    {% assign badge = badge | append: " - " | append: end_hm %}
                  {% else %}
                    {% assign end_dm = event.end | date: date_fmt %}
                    {% assign badge = badge | append: " - " | append: end_dm %}
                    {% if event.end.size > 10 %}
                      {% assign end_hm = event.end | date: "%H:%M" %}
                      {% assign badge = badge | append: " " | append: end_hm %}
                    {% endif %}
                  {% endif %}
                {% endif %}

                {% assign event_count = event_count | plus: 1 %}

                <div class="event-item">
                  <div class="event-badge">
                    <span class="badge-line">{{ badge }}</span>
                  </div>
                  <div class="event-title">{% if event.is_birthday %}{{ cake_icon }}{% elsif event.public_holiday %}{{ holiday_icon }}{% endif %}{{ event.title }}</div>
                  {% comment %}
                    Right column, filled by the script below (Europe/Berlin):
                    birthday with a year at the end of the title → age on that day,
                    birthday without a year → empty, otherwise → days until the event day.
                  {% endcomment %}
                  <span class="event-right"
                        data-day="{{ event.start | slice: 0, 10 }}"
                        data-bday="{% if event.is_birthday %}1{% endif %}"
                        data-title="{{ event.title | escape }}"></span>
                </div>
              {% endif %}
            {% endfor %}
          {% endfor %}

          {% if event_count == 0 %}
            <div class="no-events">{{ t_no_events }}</div>
          {% endif %}
        </div>

        <!-- 3. WEATHER TABLE (50 % width) – hidden on the API fallback (hours: []) -->
        {% assign w_count = w_data.hours.size | default: 0 %}
        {% if w_count > 0 %}
        <div id="custom-weather-box"
             data-min-col-width="{{ min_col_width }}"
             data-horizontal-spacing="{{ horizontal_spacing }}"
             data-timezone="{{ timezone }}"
             data-sunrise="{{ sunrise_time }}"
             data-sunset="{{ sunset_time }}">

          <div class="table-container-relative" id="table-container">

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div id="row-hours" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label"></div>
              <div id="row-cond" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                <span>[°C]</span>
              </div>
              <div id="row-temp" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                <span>[%]</span>
              </div>
              <div id="row-prob" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M8 16v3"></path><path d="M12 16v3"></path><path d="M16 16v3"></path></svg>
                <span>[mm]</span>
              </div>
              <div id="row-precip" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path><path d="M12 11v4"></path></svg>
                <span>{{ t_dew }}</span>
              </div>
              <div id="row-dew" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"></path><path d="M12.59 19.41A2 2 0 1 0 14 16H2"></path><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                <span>[km/h]</span>
              </div>
              <div id="row-wind" class="row-grid"></div>
            </div>

            <div class="weather-row">
              <div class="row-label">
                <svg class="epaper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"></path><path d="M9.59 4.59A2 2 0 1 1 11 8H2"></path><path d="M14 16H2"></path><path d="M22 16l-3-3m3 3l-3 3"></path></svg>
                <span>{{ t_gust }}</span>
              </div>
              <div id="row-gust" class="row-grid"></div>
            </div>

          </div>
        </div>
        {% endif %}

      </div>

      <!-- BATTERY (bottom left) – TRMNL provides the charge level as a global variable -->
      {% assign batt = trmnl.device.percent_charged %}
      {% if batt != nil %}
        {% assign batt_pct = batt | round %}
        {% if batt_pct > 100 %}{% assign batt_pct = 100 %}{% endif %}
        {% if batt_pct < 0 %}{% assign batt_pct = 0 %}{% endif %}
        {% assign batt_fill = batt_pct | times: 16 | divided_by: 100.0 | round: 1 %}
        <div class="cw-battery">
          <svg viewBox="0 0 22 12" aria-hidden="true">
            <rect x="0.5" y="0.5" width="19" height="11" rx="2" fill="none" stroke="#000" stroke-width="1"></rect>
            <rect x="20" y="3.5" width="1.5" height="5" fill="#000"></rect>
            <rect x="2" y="2" width="{{ batt_fill }}" height="8" fill="#000"></rect>
          </svg>
          <span>{{ batt_pct }} %</span>
        </div>
      {% endif %}

      <!-- 4. TASKS & NOTES (right half) -->
      <div class="cw-right">
        <div class="tn-list">
          <div class="tn-row tn-header">
            <span class="tn-title">{{ t_tn_title }}</span>
            <span class="tn-due">{{ t_tn_due }}</span>
          </div>

          {% comment %}
            Sorting: tasks without a date (never done) first, then ascending by
            due_in_days → most overdue at the top.
            Note: 0 is truthy in Liquid, so always compare against nil.
          {% endcomment %}
          {% for task in task_list %}
            {% if task.due_in_days == nil %}
              {% comment %} never done → bold like overdue tasks {% endcomment %}
              <div class="tn-row tn-row--due">
                <span class="tn-title">{{ task.title }}</span>
                <span class="tn-due">–</span>
              </div>
            {% endif %}
          {% endfor %}

          {% assign sorted_tasks = task_list | sort: "due_in_days" %}
          {% for task in sorted_tasks %}
            {% unless task.due_in_days == nil %}
              {% comment %} due today (0) or overdue (< 0) → bold {% endcomment %}
              <div class="tn-row{% if task.due_in_days <= 0 %} tn-row--due{% endif %}">
                <span class="tn-title">{{ task.title }}</span>
                <span class="tn-due">{{ task.due_in_days }}</span>
              </div>
            {% endunless %}
          {% endfor %}

          {% for note in note_list %}
            <div class="tn-row">
              <span class="tn-title">{{ note.title }}</span>
              <span class="tn-due"></span>
            </div>
          {% endfor %}

          {% if tn_total == 0 %}
            <div class="no-events">{{ t_no_tasks }}</div>
          {% endif %}
        </div>

        <!-- WASTE COLLECTION: days until the next collection per bin.
             The script below computes the days in Europe/Berlin (not in the
             TRMNL server time zone); until then "–" is shown. -->
        {% if waste_list.size > 0 %}
        <div class="cw-waste">
          {% for w in waste_list %}
            {% comment %}
              Bin name: German = label + "e" (Schwarz → Schwarze);
              English = by key (waste → Black, recycling → Yellow, paper → Blue),
              falling back to the label. The separator belongs to the following entry.
            {% endcomment %}
            {% if lang == "de" %}
              {% assign bin_name = w.label | append: "e" %}
            {% else %}
              {% case w.key %}
                {% when "waste" %}{% assign bin_name = "Black" %}
                {% when "recycling" %}{% assign bin_name = "Yellow" %}
                {% when "paper" %}{% assign bin_name = "Blue" %}
                {% else %}{% assign bin_name = w.label %}
              {% endcase %}
            {% endif %}
            <span class="cw-waste-item">{% unless forloop.first %}<span class="cw-waste-sep">|</span> {% endunless %}{{ bin_name }} {{ bin_icon }} <span class="cw-waste-days" data-date="{{ w.date }}">–</span></span>
          {% endfor %}
        </div>
        {% endif %}

        <!-- STATUS LINE: calendar week, data time (script), render time (TRMNL) -->
        {% assign kw_fallback = day_list.first.date | date: "%V" | plus: 0 %}
        <div class="cw-status" id="cw-status" data-tz="{{ timezone }}" data-week="{{ t_week }}" data-age="{{ t_age }}">
          <span class="cw-kw" id="cw-kw">{{ t_week }} {{ kw_fallback }}</span>
          <span>{{ t_data }} <span id="cw-data-time">{% if updated_at %}{{ updated_at | slice: -5, 5 }}{% else %}–{% endif %}</span></span>
          <span>{{ t_render }} <span id="cw-render-time">–</span></span>
        </div>
      </div>
    </div>

  </div>
</div>

{% raw %}
<script>
/* Event titles in the calendar grid: if a title is too long it is shortened
   and ended with exactly one "…" character (U+2026), independent of how the
   browser/renderer implements text-overflow. Runs again after load in case
   fonts change the width. */
(function () {
  const ELLIPSIS = "\u2026";
  function fitTitles() {
    document.querySelectorAll('.cw-grid-title').forEach(box => {
      const t = box.querySelector('.cw-t');
      if (!t) return;
      if (t.dataset.full === undefined) t.dataset.full = t.textContent;
      const full = t.dataset.full;
      t.textContent = full;
      if (box.scrollWidth <= box.clientWidth) return;
      // binary search for the longest length that still fits including "…"
      let lo = 0, hi = full.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        t.textContent = full.slice(0, mid).trimEnd() + ELLIPSIS;
        if (box.scrollWidth <= box.clientWidth) lo = mid; else hi = mid - 1;
      }
      t.textContent = full.slice(0, lo).trimEnd() + ELLIPSIS;
    });
  }
  document.addEventListener("DOMContentLoaded", fitTitles);
  window.addEventListener("load", fitTitles);
})();
</script>

<script>
/* Status line, event list and waste line: everything that depends on
   "today" is computed here in Europe/Berlin – not in the TRMNL server time
   zone. The data time ("Data HH:mm") comes straight from updated_at via Liquid. */
document.addEventListener("DOMContentLoaded", function() {
  const box = document.getElementById('cw-status');
  if (!box) return;
  const tz = box.dataset.tz || "Europe/Berlin";

  let p = {};
  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  } catch (e) { return; }

  const y = +p.year, m = +p.month, d = +p.day;

  // render time
  document.getElementById('cw-render-time').textContent = `${p.hour}:${p.minute}`;

  // ISO calendar week
  const t = new Date(Date.UTC(y, m - 1, d));
  const wd = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - wd);
  const kw = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  document.getElementById('cw-kw').textContent = `${box.dataset.week || 'CW'} ${kw}`;

  // Waste collection: days from today (Europe/Berlin) until the pickup day.
  // Both dates as UTC midnight → the difference is exactly whole days,
  // independent of the server time zone and daylight saving time.
  const todayUtc = Date.UTC(y, m - 1, d);
  document.querySelectorAll('.cw-waste-days').forEach(el => {
    const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.dataset.date || "");
    if (!mt) return;
    const diff = Math.round((Date.UTC(+mt[1], +mt[2] - 1, +mt[3]) - todayUtc) / 86400000);
    el.textContent = String(diff);
  });

  // Event list, right column: days until the event day, or age for birthdays.
  // Whole calendar days only (time of day ignored), today in Europe/Berlin.
  document.querySelectorAll('.event-right').forEach(el => {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.dataset.day || "");
    if (!dm) return;
    if (el.dataset.bday) {
      // four-digit year at the end of the title, e.g. "Birthday Anna 1990"
      const ym = /(?:^|\D)(\d{4})\s*$/.exec(el.dataset.title || "");
      if (!ym) return;
      const age = +dm[1] - +ym[1];        // age reached on the event day
      if (age >= 0 && age < 150) el.textContent = age + (box.dataset.age || " y");
      return;
    }
    const diff = Math.round((Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) - todayUtc) / 86400000);
    if (diff <= 0) {
      // event is today / ongoing → no 0, make the row bold instead
      const row = el.closest('.event-item');
      if (row) row.classList.add('event-item--now');
    } else {
      el.textContent = String(diff);
    }
  });

  // Fit the waste line into exactly one line: start at twice the week font
  // size and shrink in 0.5 px steps until it fits (min. = week font size).
  const waste = document.querySelector('.cw-waste');
  if (waste) {
    const kwPx = parseFloat(getComputedStyle(document.getElementById('cw-kw')).fontSize) || 14;
    let size = kwPx * 2;
    // Measure left-aligned: right-aligned overflow sticks out to the left
    // and would not be counted in scrollWidth.
    waste.style.justifyContent = 'flex-start';
    waste.style.fontSize = size + 'px';
    while (waste.scrollWidth > waste.clientWidth && size > kwPx) {
      size -= 0.5;
      waste.style.fontSize = size + 'px';
    }
    waste.style.justifyContent = '';
  }

});
</script>

<script>
document.addEventListener("DOMContentLoaded", function() {
  // hide / reorder rows according to weather-rows-config
  // (before anything else so the table height is right immediately)
  (function applyRowConfig() {
    const cfgEl = document.getElementById('weather-rows-config');
    const table = document.getElementById('table-container');
    if (!cfgEl || !table) return;
    let cfg;
    try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
    if (!Array.isArray(cfg)) return;
    const sunLines = [...table.querySelectorAll('.sun-line')];
    cfg.forEach(c => {
      const grid = document.getElementById('row-' + c.row);
      if (!grid) return;
      const rowEl = grid.closest('.weather-row');
      if (c.visible === false) rowEl.remove();
      else table.appendChild(rowEl); // order as in the array
    });
    sunLines.forEach(l => table.appendChild(l));
  })();

  const dataEl = document.getElementById('data-weather');
  if (!dataEl) return;

  let w;
  try { w = JSON.parse(dataEl.textContent || "{}") || {}; } catch (e) { w = {}; }

  // Convert the compact column format (one array per value) into block objects.
  // ts = start_ts + i * step (UTC based, therefore correct across DST changes).
  // step_h = hours between two values (the script already aggregates).
  const stepH = (typeof w.step_h === 'number' && w.step_h > 0) ? w.step_h : 1;
  const stepMs = stepH * 3600000;

  let rawHourly = [];
  let preAggregated = false; // true = script delivers ready-made blocks → show 1:1
  if (Array.isArray(w.hours) && typeof w.start_ts === 'number' && w.start_ts > 0) {
    preAggregated = true;
    rawHourly = w.hours.map((h, i) => ({
      ts: w.start_ts + i * stepMs,
      hour: h + 'h',
      temp: (w.temp || [])[i],
      precip_prob: (w.prob || [])[i],
      precip_mm: (w.mm || [])[i],
      condition: (w.cond || [])[i],
      wind_speed: (w.wind || [])[i],
      wind_gust_speed: (w.gust || [])[i],
      dew_point: (w.dew || [])[i]
    }));
  } else if (Array.isArray(w.hourly)) {
    rawHourly = w.hourly; // legacy format as fallback
  }
  if (rawHourly.length === 0) return;

  const tableContainer = document.getElementById('table-container');
  const customBox = document.getElementById('custom-weather-box');
  if (!tableContainer || !customBox) return;

  const TRMNL_SVG_MAP = {
    '☀️': 'https://trmnl.com/images/plugins/weather/wi-day-sunny.svg',
    '🌙': 'https://trmnl.com/images/plugins/weather/wi-night-clear.svg',
    '⛅': 'https://trmnl.com/images/plugins/weather/wi-day-cloudy.svg',
    '☁️': 'https://trmnl.com/images/plugins/weather/full/cloudy-gusts.svg',
    '🌧️': 'https://trmnl.com/images/plugins/weather/full/showers.svg',
    '☔': 'https://trmnl.com/images/plugins/weather/full/showers.svg',
    '⛈️': 'https://trmnl.com/images/plugins/weather/wi-day-thunderstorm.svg',
    '🌨️': 'https://trmnl.com/images/plugins/weather/full/snow.svg',
    '❄️': 'https://trmnl.com/images/plugins/weather/full/snow.svg'  // sent by the script
  };

  const WEATHER_SEVERITY = {
    '⛈️': 10, '🌧️': 8, '☔': 8, '🌨️': 7, '❄️': 7,
    '☁️': 5, '⛅': 3, '☀️': 1, '🌙': 1
  };

  const hourOf = item => parseInt(String(item.hour).replace('h', ''), 10);

  // 1. current hour in local time
  const timezone = customBox.dataset.timezone || "Europe/Berlin";
  let currentHour;
  try {
    currentHour = parseInt(new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "numeric", hour12: false
    }).format(new Date()), 10) % 24;
  } catch (e) {
    currentHour = new Date().getHours();
  }

  // 2. Drop past blocks (do not rotate).
  //    Preferably via the absolute timestamp "ts" (ms) – unambiguous even if
  //    the same hour occurs today and tomorrow.
  if (rawHourly[0] && typeof rawHourly[0].ts === 'number') {
    const nowMs = Date.now();
    // a value covers [ts, ts + step) – keep it until its window has passed
    const remaining = rawHourly.filter(it => it.ts + stepMs > nowMs);
    if (remaining.length > 0) rawHourly = remaining;
  } else {
    // fallback without ts: only compensate short render delays (max. 3 h) so
    // the same hour of tomorrow is not matched by mistake
    const currentIdx = rawHourly.findIndex(item => hourOf(item) === currentHour);
    if (currentIdx > 0 && currentIdx <= 3) rawHourly = rawHourly.slice(currentIdx);
  }

  // 3. number of columns from the available width
  const availableWidth = tableContainer.clientWidth - 85;
  const horizGap = parseInt(customBox.dataset.horizontalSpacing || '0', 10);
  const minColWidth = parseInt(customBox.dataset.minColWidth || '30', 10) + horizGap;
  let targetCols = Math.floor(availableWidth / minColWidth);
  targetCols = Math.max(4, Math.min(24, targetCols));

  // Already aggregated by the script → one column per block.
  // Only the legacy hourly format is condensed to the width here.
  const chunkSize = preAggregated ? 1 : Math.ceil(rawHourly.length / targetCols);
  const avg = (chunk, key) => chunk.reduce((s, it) => s + (it[key] || 0), 0) / chunk.length;
  const max = (chunk, key) => Math.max(...chunk.map(it => it[key] || 0));

  // 4. aggregation
  const aggregated = [];
  for (let i = 0; i < rawHourly.length; i += chunkSize) {
    const chunk = rawHourly.slice(i, i + chunkSize);
    if (!chunk.length) continue;

    // same rules as in the script: worst icon, temp/dew average,
    // prob/wind/gust maximum, mm sum
    let bestCondition = chunk[0].condition || '☁️';
    chunk.forEach(it => {
      const c = it.condition || '☁️';
      if ((WEATHER_SEVERITY[c] || 0) > (WEATHER_SEVERITY[bestCondition] || 0)) bestCondition = c;
    });

    aggregated.push({
      hour: chunk[0].hour,
      temp: Math.round(avg(chunk, 'temp') * 10) / 10,
      precip_prob: Math.round(max(chunk, 'precip_prob')),
      precip_mm: Math.round(chunk.reduce((s, it) => s + (it.precip_mm || 0), 0) * 10) / 10,
      dew_point: Math.round(avg(chunk, 'dew_point') * 10) / 10,
      wind_speed: Math.round(max(chunk, 'wind_speed')),
      wind_gust_speed: Math.round(max(chunk, 'wind_gust_speed')),
      condition: bestCondition,
      isCurrent: aggregated.length === 0
    });
  }

  // 5. fill the rows
  // hidden rows no longer exist → getElementById returns null
  const rows = {
    hours: document.getElementById('row-hours'),
    cond: document.getElementById('row-cond'),
    temp: document.getElementById('row-temp'),
    prob: document.getElementById('row-prob'),
    precip: document.getElementById('row-precip'),
    dew: document.getElementById('row-dew'),
    wind: document.getElementById('row-wind'),
    gust: document.getElementById('row-gust')
  };
  const gridStyle = `grid-template-columns: repeat(${aggregated.length}, 1fr);`;
  Object.values(rows).forEach(r => { if (r) r.style.cssText = gridStyle; });

  function addCell(row, item, content, isHtml) {
    if (!row) return;
    const d = document.createElement('div');
    d.className = 'grid-cell' + (item.isCurrent ? ' is-current' : '');
    if (isHtml) d.innerHTML = content; else d.innerText = content;
    row.appendChild(d);
  }

  aggregated.forEach(item => {
    addCell(rows.hours, item, item.hour);
    const svgUrl = TRMNL_SVG_MAP[item.condition];
    if (svgUrl) addCell(rows.cond, item, `<img src="${svgUrl}" class="epaper-icon-grid" alt="" />`, true);
    else addCell(rows.cond, item, item.condition || '');
    addCell(rows.temp, item, `${Math.round(item.temp)}°`);
    addCell(rows.prob, item, `${item.precip_prob}%`);
    addCell(rows.precip, item, `${item.precip_mm}`);
    addCell(rows.dew, item, `${Math.round(item.dew_point)}°`);
    addCell(rows.wind, item, `${item.wind_speed}`);
    addCell(rows.gust, item, `${item.wind_gust_speed}`);
  });

  // 6. sun lines – position relative to the time span actually shown
  function parseTimeToDecimal(t) {
    if (!t) return null;
    const parts = String(t).replace('h', '').trim().split(':');
    const h = parseInt(parts[0], 10);
    if (isNaN(h)) return null;
    return h + (parts[1] ? parseInt(parts[1], 10) / 60 : 0);
  }

  const startHourDec = hourOf(rawHourly[0]) || 0;
  const totalSpanHours = aggregated.length * chunkSize * stepH;

  const SUNRISE_SVG = `<svg class="sun-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="12" r="4"/><path d="M10 3v2"/><path d="M10 19v2"/><path d="M3.7 5.7l1.4 1.4"/><path d="M14.9 16.9l1.4 1.4"/><path d="M1 12h2"/><path d="M3.7 18.3l1.4-1.4"/><path d="M19 16V8" stroke-width="2.5"/><path d="M16 11l3-3 3 3" stroke-width="2.5"/></svg>`;
  const SUNSET_SVG = `<svg class="sun-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="12" r="4"/><path d="M10 3v2"/><path d="M10 19v2"/><path d="M3.7 5.7l1.4 1.4"/><path d="M14.9 16.9l1.4 1.4"/><path d="M1 12h2"/><path d="M3.7 18.3l1.4-1.4"/><path d="M19 8v8" stroke-width="2.5"/><path d="M16 13l3 3 3-3" stroke-width="2.5"/></svg>`;

  function drawSunLine(timeStr, svgIcon, dir) {
    const timeDec = parseTimeToDecimal(timeStr);
    if (timeDec === null) return;
    let diff = timeDec - startHourDec;
    if (diff < 0) diff += 24;
    if (diff > totalSpanHours) return;

    const frac = diff / totalSpanHours;
    const line = document.createElement('div');
    line.className = 'sun-line';
    line.style.left = `calc(85px + (100% - 85px) * ${frac})`;

    const arrow = document.createElement('div');
    arrow.className = dir === 'up' ? 'sun-arrow-up' : 'sun-arrow-down';
    line.appendChild(arrow);

    const badge = document.createElement('div');
    badge.className = 'sun-badge-bottom';
    badge.innerHTML = `${svgIcon} <span>${timeStr}</span>`;
    line.appendChild(badge);

    tableContainer.appendChild(line);
  }

  drawSunLine(customBox.dataset.sunrise, SUNRISE_SVG, 'up');
  drawSunLine(customBox.dataset.sunset, SUNSET_SVG, 'down');
});
</script>
{% endraw %}
