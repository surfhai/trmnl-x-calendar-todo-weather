/**
 * waste.gs – Waste collection dates (district of Rhön-Grabfeld) for the TRMNL X plugin
 *
 * Source: the same JSON API that the calendar widget on
 * https://www.abfallinfo-rhoen-grabfeld.de/service/abfuhr-wecker uses
 * (provider sqronline.de). Unofficial – may change without notice.
 *
 * Setup: add this file to the same Apps Script project as trmnl_feed.gs and
 * config.gs (+ → Script → "waste"). pushDataToTrmnl() calls getWasteData().
 *
 * Read from CONFIG (config.gs):
 *   WASTE_CITY_ID   municipality ID, e.g. 4 (find it with listWasteAreas)
 *   WASTE_AREA_ID   district ID, e.g. 26 (find it with listWasteAreas)
 *   TIMEZONE        time zone for "today" (fallback: Europe/Berlin)
 * Without WASTE_CITY_ID / WASTE_AREA_ID no dates are fetched and [] is returned.
 */

var WASTE = {
  API_URL: 'https://aht1gh-api.sqronline.de/api/modules/abfall/webshow',
  // District-wide collection calendar at the provider ("Abfallkalender LKR neu") – public
  DIVISION_UUID: 'fde08d95-111b-11ef-bbd4-b2fd53c2005a',

  RETRY_HOURS: 2,   // after a failed fetch, wait at least this long before retrying
  TODAY_UNTIL: 9,   // from this hour on, a collection today counts as done → next date

  // Bins to send – in this order, each with its next collection date.
  // IDs from the API: 9 Restmüll (residual), 11 Bio (organic), 13 Gelbe Tonne (recycling),
  //                   3 Papier (paper), 1 Problemmüll (hazardous)
  BINS: [
    { id: 9,  key: 'waste',     label: 'Schwarz' },  // Restmüll / Schwarze Tonne (residual waste, black bin)
    { id: 13, key: 'recycling', label: 'Gelb' },     // Gelbe Tonne (yellow bin, packaging)
    { id: 3,  key: 'paper',     label: 'Blau' }      // Papier / Blaue Tonne (paper, blue bin)
  ]
};

/**
 * Returns the next collection date per bin, in the order of BINS. A collection
 * today counts until TODAY_UNTIL o'clock; after that the following date is used:
 *   [ { "key": "waste",     "label": "Schwarz", "date": "2026-11-06" },   // Restmüll
 *     { "key": "recycling", "label": "Gelb",    "date": "2026-11-20" },   // Gelbe Tonne
 *     { "key": "paper",     "label": "Blau",    "date": "2026-11-06" } ]  // Papier
 * The markup derives the distance (today/tomorrow/…) from "date".
 * If no future date is known for a bin, date is null.
 * On errors with no stored data: [].
 */
function getWasteData() {
  try {
    var loc = wasteLocation_();
    if (!loc) {
      Logger.log('Waste: WASTE_CITY_ID / WASTE_AREA_ID not set in config.gs – run listWasteAreas');
      return [];
    }

    var todayIso = Utilities.formatDate(new Date(), wasteTz_(), 'yyyy-MM-dd');
    var store = loadWaste_(todayIso);
    if (!store) return [];

    var today = wasteDayNum_(todayIso);
    var hour = Number(Utilities.formatDate(new Date(), wasteTz_(), 'H'));
    var fromIso = hour < WASTE.TODAY_UNTIL ? todayIso : wasteIsoFromDay_(today + 1);

    // store.dates is sorted by date: [ [ 'yyyy-MM-dd', typeId, 'note' ], … ]
    var items = WASTE.BINS.map(function (bin) {
      var next = null;
      for (var i = 0; i < store.dates.length; i++) {
        var d = store.dates[i];
        if (d[1] === bin.id && d[0] >= fromIso) { next = d[0]; break; }
      }
      return { key: bin.key, label: bin.label, date: next };
    });

    Logger.log('Waste: ' + items.map(function (x) { return x.label + ' ' + (x.date || '–'); }).join(', ') +
      ' (as of ' + store.day + ', last stored date: ' + wasteLastDate_(store.dates) + ')');
    return items;
  } catch (e) {
    Logger.log('Waste: error – ' + e);
    return [];
  }
}

/** Editor test: writes the result of getWasteData() to the log. */
function testWaste() {
  Logger.log(JSON.stringify(getWasteData(), null, 2));
}

/** Lists all municipalities (city) and districts (area) with their IDs in the log. */
function listWasteAreas() {
  var data = fetchWasteJson_(true);
  if (!data) return;
  var cfg = data.mdiv.config, cities = {};
  cfg.cities.forEach(function (c) { cities[c.id] = c.name; });
  var lines = cfg.areas.map(function (a) {
    return (cities[a.city_id] || '?') + ' (CITY_ID ' + a.city_id + ') → ' + a.name + ' (AREA_ID ' + a.id + ')';
  }).sort();
  Logger.log(lines.join('\n'));
}

/** Deletes the stored dates, e.g. after changing WASTE_CITY_ID/WASTE_AREA_ID.
 *  The next run then fetches from the API immediately. */
function clearWasteCache() {
  if (!wasteLocation_()) {
    Logger.log('Waste: WASTE_CITY_ID / WASTE_AREA_ID not set in config.gs – nothing to clear');
    return;
  }
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(wasteCacheKey_());
  props.deleteProperty(wasteCacheKey_() + '_attempt');
  Logger.log('Waste: stored dates cleared');
}

/* ------------------------------------------------------------------ */
/* Storage: at most 1 fetch per day, stale data on errors             */
/* ------------------------------------------------------------------ */

/**
 * Returns { day, names: {id: name}, dates: [[date, typeId, note], …] } or null.
 * Fetches only if there has been no successful fetch today. If the fetch fails,
 * the last stored dates are used and the next attempt is made after RETRY_HOURS.
 */
function loadWaste_(todayIso) {
  var props = PropertiesService.getScriptProperties();
  var key = wasteCacheKey_();
  var store = null;
  try { store = JSON.parse(props.getProperty(key) || 'null'); } catch (e) { store = null; }

  if (store && store.day === todayIso) return store;          // already fetched today

  var lastAttempt = Number(props.getProperty(key + '_attempt') || 0);
  if (store && Date.now() - lastAttempt < WASTE.RETRY_HOURS * 3600000) {
    return store;                                              // recent failed attempt
  }

  var data = fetchWasteJson_();
  if (data && data.abfall_dates) {
    var names = wasteTypeNames_(data);
    var dates = data.abfall_dates
      .filter(function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= todayIso; })
      .map(function (d) { return [d.date, Number(d.abfall_type_id), wasteStripHtml_(d.comment)]; })
      .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });

    var fresh = { day: todayIso, names: names, dates: dates };
    var json = JSON.stringify(fresh);
    // Script properties are limited to 9 KB per value → trim later dates if necessary
    while (json.length > 8500 && fresh.dates.length > 0) {
      fresh.dates = fresh.dates.slice(0, Math.floor(fresh.dates.length * 0.8));
      json = JSON.stringify(fresh);
    }
    props.setProperty(key, json);
    props.deleteProperty(key + '_attempt');
    Logger.log('Waste: API fetched, ' + fresh.dates.length + ' dates stored');
    return fresh;
  }

  props.setProperty(key + '_attempt', String(Date.now()));
  if (store) {
    Logger.log('Waste: fetch failed – using stored dates from ' + store.day);
    return store;
  }
  Logger.log('Waste: fetch failed, no stored dates');
  return null;
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

/** onlyConf = true: list of municipalities/districts only (no location needed). */
function fetchWasteJson_(onlyConf) {
  try {
    var url = WASTE.API_URL + '?module_division_uuid=' + encodeURIComponent(WASTE.DIVISION_UUID);
    if (onlyConf) {
      url += '&onlyConf=true';
    } else {
      var loc = wasteLocation_();
      if (!loc) return null;
      url += '&cityIds=' + loc.city + '&areaIds=' + loc.area;
    }
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://www.abfallinfo-rhoen-grabfeld.de/'
      }
    });
    var code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('Waste: HTTP ' + code + ' – ' + res.getContentText().substring(0, 200));
      return null;
    }
    var data = JSON.parse(res.getContentText('UTF-8'));
    if (data.status !== 0) Logger.log('Waste: status ' + data.status + ' in the response');
    return data;
  } catch (e) {
    Logger.log('Waste: fetch failed – ' + e);
    return null;
  }
}

function wasteTypeNames_(data) {
  var names = {};
  var t = (data.mdiv && data.mdiv.config && data.mdiv.config.abfall_types) || {};
  ['normal', 'special'].forEach(function (grp) {
    (t[grp] || []).forEach(function (x) { names[Number(x.id)] = x.name; });
  });
  return names;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Location from config.gs as { city, area } (positive integers), or null if not set. */
function wasteLocation_() {
  if (typeof CONFIG === 'undefined') return null;
  var city = Number(CONFIG.WASTE_CITY_ID), area = Number(CONFIG.WASTE_AREA_ID);
  var ok = function (n) { return n > 0 && Math.floor(n) === n; };
  return ok(city) && ok(area) ? { city: city, area: area } : null;
}

/** Script property key, e.g. 'waste_4_26' – one entry per location. */
function wasteCacheKey_() {
  var loc = wasteLocation_();
  return 'waste_' + loc.city + '_' + loc.area;
}

function wasteTz_() {
  return (typeof CONFIG !== 'undefined' && CONFIG.TIMEZONE) || 'Europe/Berlin';
}

function wasteStripHtml_(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function wasteLastDate_(dates) {
  return dates.length ? dates[dates.length - 1][0] : '–';
}

/** Days since 1970 → 'yyyy-MM-dd'. */
function wasteIsoFromDay_(n) {
  return new Date(n * 86400000).toISOString().substring(0, 10);
}

/** 'yyyy-MM-dd' → days since 1970 (independent of time of day / DST). */
function wasteDayNum_(iso) {
  var p = iso.split('-');
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
}
