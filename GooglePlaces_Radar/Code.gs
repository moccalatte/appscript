/**
 * Code.gs
 * Radar Lonjakan Keramaian — GMaps Places API only
 * Output: Discord embed + Google Sheets logs
 *
 * INGAT:
 * - Masukkan API keys dan webhook di bagian CONFIG.
 * - Jalankan ensureSheets() sekali lalu createTriggers() (atau pasang trigger manual).
 */

/**
* KONFIGURASI VIA Script Properties (lihat README untuk cara set):
* - Wajib: GOOGLE_MAPS_API_KEY, DISCORD_WEBHOOK_URL
* - Opsional: AVATAR_USERNAME, AVATAR_URL, SURGE_THRESHOLD, AVG_WINDOW,
*             SEARCH_RADIUS_METERS, MAX_PLACES_PER_FETCH, SLEEP_BETWEEN_REQUESTS_MS,
*             SHEET_SNAPSHOTS, SHEET_LOGS, LOCATIONS_JSON (JSON array)
*/

 // Helpers to read Script Properties safely
function getStringProp(key, def) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v !== null && v !== undefined && String(v).length > 0) ? String(v) : def;
}
function getNumberProp(key, def) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v !== null && v !== undefined && String(v).length > 0 && !isNaN(Number(v))) ? Number(v) : def;
}
function parseJsonProp(key, defObj) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return defObj;
  try {
    var obj = JSON.parse(raw);
    return obj;
  } catch (e) {
    return defObj;
  }
}

// =========================
// CONFIG — prefer Script Properties
// =========================
const GOOGLE_MAPS_API_KEY = getStringProp('GOOGLE_MAPS_API_KEY', 'PASTE_GOOGLE_MAPS_API_KEY_HERE');
const DISCORD_WEBHOOK_URL = getStringProp('DISCORD_WEBHOOK_URL', 'PASTE_DISCORD_WEBHOOK_URL_HERE');
const AVATAR_USERNAME = getStringProp('AVATAR_USERNAME', 'PotionRadar'); // opsional
const AVATAR_URL = getStringProp('AVATAR_URL', ''); // opsional

const SURGE_THRESHOLD = getNumberProp('SURGE_THRESHOLD', 0.30); // 30% default
const AVG_WINDOW = getNumberProp('AVG_WINDOW', 3); // rata-rata 3 snapshot terakhir
const SEARCH_RADIUS_METERS = getNumberProp('SEARCH_RADIUS_METERS', 3000); // radius per titik (default 3000, ubah kalau perlu)
const MAX_PLACES_PER_FETCH = getNumberProp('MAX_PLACES_PER_FETCH', 60); // Places Nearby paged results limit handling
const SLEEP_BETWEEN_REQUESTS_MS = getNumberProp('SLEEP_BETWEEN_REQUESTS_MS', 800); // jeda antar request (biar aman)
const SHEET_SNAPSHOTS = getStringProp('SHEET_SNAPSHOTS', 'radar_snapshots');
const SHEET_LOGS = getStringProp('SHEET_LOGS', 'radar_logs');

// Realtime-ish crowd index properties (opsional)
const REALTIME_INDEX_ENABLED = (getStringProp('REALTIME_INDEX_ENABLED', 'false') === 'true');
const REALTIME_INDEX_EMA_ALPHA = getNumberProp('REALTIME_INDEX_EMA_ALPHA', 0.3);
const HOTSPOT_WEIGHT = getNumberProp('HOTSPOT_WEIGHT', 1.0);
const OPEN_REF = getNumberProp('OPEN_REF', 40); // referensi normalisasi open_now count
const DAY_PART_WEIGHTS = parseJsonProp('DAY_PART_WEIGHTS', { morning:0.8, afternoon:1.0, evening:1.1, night:1.2 });

// warna embed
const COLOR_GREEN = 3066993; // cafe / resto / mall
const COLOR_PURPLE = 9323693; // nightclub

// default titik — bisa kamu sesuaikan (bisa override via Script Property: LOCATIONS_JSON)
const DEFAULT_LOCATIONS = [
  { name: 'Jakarta Pusat', lat: -6.1900, lng: 106.8228 },
  { name: 'Jakarta Selatan', lat: -6.2764, lng: 106.8272 },
  { name: 'Jakarta Barat', lat: -6.1700, lng: 106.7823 },
  { name: 'Jakarta Timur', lat: -6.2346, lng: 106.8956 },
  { name: 'Jakarta Utara', lat: -6.1214, lng: 106.8429 },
  { name: 'Bekasi', lat: -6.2340, lng: 106.9922 }
];
let LOCATIONS = DEFAULT_LOCATIONS;
(function () {
  var json = getStringProp('LOCATIONS_JSON', '');
  if (json) {
    try {
      var parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length) {
        LOCATIONS = parsed;
      }
    } catch (e) {
      appendLog(new Date(), 'config_error', '—', '—', 0, 0, 0, false, 'LOCATIONS_JSON parse error');
    }
  }
})();

// categories map ke Places 'type'
const CATEGORIES = [
  { key: 'cafe', type: 'cafe', label: 'Cafe / Kopi' },
  { key: 'restaurant', type: 'restaurant', label: 'Restaurant' },
  { key: 'mall', type: 'shopping_mall', label: 'Mall / Pusat Perbelanjaan' },
  { key: 'night_club', type: 'night_club', label: 'Night Club' }
];

/**
 * KONFIGURASI VIA Script Properties (lihat README untuk cara set):
 * - Wajib: GOOGLE_MAPS_API_KEY, DISCORD_WEBHOOK_URL (atau DISCORD_WEBHOOK_URLS)
 * - Opsional: AVATAR_USERNAME, AVATAR_URL, SURGE_THRESHOLD, AVG_WINDOW,
 *             SEARCH_RADIUS_METERS, MAX_PLACES_PER_FETCH, SLEEP_BETWEEN_REQUESTS_MS,
 *             SHEET_SNAPSHOTS, SHEET_LOGS, LOCATIONS_JSON, SPREADSHEET_NAME
 */

 // time windows (informational) — Apps Script trigger schedule harus disesuaikan
const TIME_WINDOWS = {
  cafe_restaurant_mall: ['10:00','13:00','17:00','20:00'],
  nightclub: ['21:00','22:00','23:00','00:00','01:00','02:00']
};

// =========================
// Config Helpers — Properties, Spreadsheet, Webhooks
// =========================
function setProp(key, value) { PropertiesService.getScriptProperties().setProperty(key, value); }

function getOrCreateSpreadsheet() {
  var id = getStringProp('SPREADSHEET_ID', '');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* will create new if invalid */ }
  }
  var defaultName = 'Radar Keramaian Logs ' + formatWIB(new Date());
  var name = getStringProp('SPREADSHEET_NAME', defaultName);
  var ss = SpreadsheetApp.create(name);
  setProp('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getWebhookUrls() {
  var list = [];
  var multi = getStringProp('DISCORD_WEBHOOK_URLS', '');
  if (multi) {
    try {
      if (multi.trim().startsWith('[')) {
        var arr = JSON.parse(multi);
        if (Array.isArray(arr)) {
          arr.forEach(function(u){ if (u && String(u).trim()) list.push(String(u).trim()); });
        }
      } else {
        multi.split(/[,\n;]/).forEach(function(u){ if (u && String(u).trim()) list.push(String(u).trim()); });
      }
    } catch (e) {
      appendLog(new Date(), 'config_error', '—', '—', 0, 0, 0, false, 'DISCORD_WEBHOOK_URLS parse error');
    }
  }
  var single = getStringProp('DISCORD_WEBHOOK_URL', '');
  if (single && String(single).trim()) list.push(String(single).trim());
  var out = [], seen = {};
  list.forEach(function(u){ if (!seen[u]) { seen[u] = true; out.push(u); } });
  return out;
}

// =========================
// MAIN
// =========================
function main() {
  ensureSheets(); // pastikan sheet ada
  const now = new Date();
  const isNightclubWindow = isNowInNightWindow(now);
  // decide which categories to run in this run:
  const categoriesToRun = CATEGORIES.filter(cat => {
    if (cat.key === 'night_club') return isNightclubWindow;
    return true; // run others always (but triggers ideally control frequency)
  });

  LOCATIONS.forEach(loc => {
    categoriesToRun.forEach(cat => {
      Utilities.sleep(SLEEP_BETWEEN_REQUESTS_MS);
      try {
        const places = fetchPlacesNearby(loc.lat, loc.lng, cat.type);
        const count = places.length;
        // save snapshot
        saveSnapshot(now, loc.name, cat.key, count, places.map(p => p.place_id));
        // compare with previous snapshots
        const avgPrev = getAveragePreviousCount(loc.name, cat.key, AVG_WINDOW);
        const deltaPct = avgPrev === 0 ? 0 : (count - avgPrev) / avgPrev;

        // compute realtime-ish crowd index if enabled
        let crowdIndexField = '—';
        if (REALTIME_INDEX_ENABLED) {
          const openNowCount = countOpenNow(places);
          const dayPartW = getDayPartWeight(now);
          const hotspotW = HOTSPOT_WEIGHT;
          const rawIndex = computeCrowdIndex(openNowCount, deltaPct, dayPartW, hotspotW);
          const emaIndex = computeEma(loc.name, cat.key, rawIndex);
          crowdIndexField = String(emaIndex);
        }

        const notified = deltaPct >= SURGE_THRESHOLD;
        // prepare top 3 sample details
        const topSamples = places.slice(0,3);
        const sampleInfo = topSamples.map(p => `${p.name} (${p.rating||'n/a'}⭐ / ${p.user_ratings_total||0} reviews)`).join('\n');

        if (notified) {
          postSurgeToDiscord(loc.name, cat, count, avgPrev, deltaPct, sampleInfo, now, crowdIndexField === '—' ? null : Number(crowdIndexField));
        }
        const note = (notified ? 'notified' : 'no-surge') + (REALTIME_INDEX_ENABLED ? `; index=${crowdIndexField}` : '');
        appendLog(now, 'check', loc.name, cat.key, count, avgPrev, Math.round(deltaPct*100), notified, note);
      } catch (e) {
        appendLog(new Date(), 'error', loc.name, cat.key, 0, 0, 0, false, e.message);
      }
    });
  });
}

// =========================
// Helpers: Fetch Places
// =========================
function fetchPlacesNearby(lat, lng, type) {
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  let results = [];
  let pageToken = null;
  let attempts = 0;
  do {
    let url = baseUrl + '?location=' + encodeURIComponent(lat + ',' + lng) +
      '&radius=' + encodeURIComponent(SEARCH_RADIUS_METERS) +
      '&type=' + encodeURIComponent(type) +
      '&key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY);
    if (pageToken) url += '&pagetoken=' + encodeURIComponent(pageToken);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = resp.getResponseCode();
    if (code !== 200) {
      throw new Error('Places Nearby failed: HTTP ' + code);
    }
    const json = JSON.parse(resp.getContentText());
    if (json.results && json.results.length) {
      // For each result, fetch details (rating, reviews_count, opening_hours, photos)
      json.results.forEach(r => results.push({
        place_id: r.place_id,
        name: r.name,
        rating: r.rating,
        user_ratings_total: r.user_ratings_total,
        opening_hours: r.opening_hours,
        types: r.types,
        vicinity: r.vicinity
      }));
    }
    pageToken = json.next_page_token || null;
    attempts++;
    Utilities.sleep(1200); // Google may require slight delay before next_page_token valid
  } while (pageToken && attempts < 3 && results.length < MAX_PLACES_PER_FETCH);

  // As optimization: we can fetch Place Details for top N to get more fields if needed
  return results;
}

// =========================
// Snapshot & Logs (Sheets)
// =========================
function ensureSheets() {
  var ss = getOrCreateSpreadsheet();
  if (!ss.getSheetByName(SHEET_SNAPSHOTS)) {
    var s1 = ss.insertSheet(SHEET_SNAPSHOTS);
    s1.appendRow(['timestamp', 'area', 'category', 'count', 'sample_ids_json']);
  }
  if (!ss.getSheetByName(SHEET_LOGS)) {
    var s2 = ss.insertSheet(SHEET_LOGS);
    s2.appendRow(['timestamp', 'action', 'area', 'category', 'count', 'avg_prev', 'delta_pct', 'notified', 'note']);
  }
}

function saveSnapshot(ts, area, category, count, sampleIds) {
  var ss = getOrCreateSpreadsheet();
  var s = ss.getSheetByName(SHEET_SNAPSHOTS);
  s.appendRow([ts.toISOString(), area, category, count, JSON.stringify(sampleIds)]);
}

function appendLog(ts, action, area, category, count, avgPrev, deltaPct, notified, note) {
  var ss = getOrCreateSpreadsheet();
  var s = ss.getSheetByName(SHEET_LOGS);
  s.appendRow([ts.toISOString(), action, area, category, count, avgPrev, deltaPct, notified ? 'TRUE' : 'FALSE', note]);
}

function getAveragePreviousCount(area, category, window) {
  var ss = getOrCreateSpreadsheet();
  var s = ss.getSheetByName(SHEET_SNAPSHOTS);
  if (!s) return 0;
  var data = s.getDataRange().getValues();
  var rows = [];
  for (var i = data.length - 1; i >= 1 && rows.length < window; i--) {
    var row = data[i];
    if (row[1] === area && row[2] === category) {
      rows.push(Number(row[3]));
    }
  }
  if (rows.length === 0) return 0;
  var sum = rows.reduce(function(a,b){ return a+b; }, 0);
  return Math.round(sum / rows.length);
}

// =========================
// Discord Posting
// =========================
function postSurgeToDiscord(areaName, categoryObj, count, avgPrev, deltaPct, sampleInfo, now, crowdIndex) {
  const color = categoryObj.key === 'night_club' ? COLOR_PURPLE : COLOR_GREEN;
  const title = `📈 LONJAKAN: ${areaName} — ${categoryObj.label}`;
  const description = `🔥 **Ada lonjakan** ${Math.round(deltaPct*100)}% dibanding rata-rata ${AVG_WINDOW} cek terakhir.\n⏱ Waktu cek: *${formatWIB(now)}*`;
  const fields = [
    { name: 'Jumlah Terpantau', value: String(count), inline: true },
    { name: 'Rata-rata sebelumnya', value: String(avgPrev), inline: true },
    { name: 'Delta', value: `${Math.round(deltaPct*100)}%`, inline: true },
    { name: 'Contoh tempat (top 3)', value: sampleInfo || '—' }
  ];
  if (REALTIME_INDEX_ENABLED && crowdIndex !== null && crowdIndex !== undefined) {
    fields.unshift({ name: 'Crowd Index', value: String(crowdIndex), inline: true });
  }

  const embed = {
    title: title,
    description: description,
    color: color,
    fields: fields,
    footer: { text: 'Radar by PotionBot • snapshot tersimpan' }
  };

  const payload = {
    username: AVATAR_USERNAME || 'PotionRadar',
    avatar_url: AVATAR_URL || '',
    embeds: [embed]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var urls = getWebhookUrls();
    if (!urls.length) {
      appendLog(new Date(), 'discord_error', areaName, categoryObj.key, count, avgPrev, Math.round(deltaPct*100), false, 'No webhook URLs configured');
    } else {
      urls.forEach(function(wh) {
        try {
          var resp = UrlFetchApp.fetch(wh, options);
          if (resp.getResponseCode() >= 400) {
            appendLog(new Date(), 'discord_error', areaName, categoryObj.key, count, avgPrev, Math.round(deltaPct*100), false, 'Discord HTTP ' + resp.getResponseCode());
          } else {
            appendLog(new Date(), 'discord_post', areaName, categoryObj.key, count, avgPrev, Math.round(deltaPct*100), true, 'notified');
          }
        } catch (e2) {
          appendLog(new Date(), 'discord_exception', areaName, categoryObj.key, count, avgPrev, Math.round(deltaPct*100), false, e2.message);
        }
      });
    }
  } catch (e) {
    appendLog(new Date(), 'discord_exception', areaName, categoryObj.key, count, avgPrev, Math.round(deltaPct*100), false, e.message);
  }
}

 // =========================
 // Util
 // =========================
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getDayPartWeight(date) {
  var h = date.getHours();
  var part = (h>=6 && h<12) ? 'morning' : (h>=12 && h<18) ? 'afternoon' : (h>=18 && h<22) ? 'evening' : 'night';
  var w = DAY_PART_WEIGHTS[part];
  return (typeof w === 'number' && !isNaN(w)) ? w : 1.0;
}

function countOpenNow(places) {
  var c = 0;
  for (var i=0;i<places.length;i++) {
    var oh = places[i].opening_hours;
    if (oh && oh.open_now === true) c++;
  }
  return c;
}

function computeCrowdIndex(openNowCount, deltaPct, dayPartW, hotspotW) {
  var openNorm = clamp(OPEN_REF > 0 ? (openNowCount / OPEN_REF) : 0, 0, 1);
  var deltaNorm = clamp(deltaPct, 0, 1); // cap at +100% increase
  var base = (0.6 * openNorm) + (0.4 * deltaNorm);
  var idx = 100 * base * dayPartW * hotspotW;
  return Math.round(clamp(idx, 0, 100));
}

function getEmaKey(areaName, categoryKey) {
  return 'EMA_' + areaName + '_' + categoryKey;
}
function computeEma(areaName, categoryKey, newIdx) {
  var alpha = REALTIME_INDEX_EMA_ALPHA;
  var key = getEmaKey(areaName, categoryKey);
  var prevRaw = PropertiesService.getScriptProperties().getProperty(key);
  var prev = prevRaw ? Number(prevRaw) : null;
  var ema = prev === null || isNaN(prev) ? newIdx : Math.round(alpha * newIdx + (1 - alpha) * prev);
  PropertiesService.getScriptProperties().setProperty(key, String(ema));
  return ema;
}

function formatWIB(date) {
  // WIB = UTC+7
  const d = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return d.getUTCFullYear() + '-' +
    pad(d.getUTCMonth()+1) + '-' +
    pad(d.getUTCDate()) + ' ' +
    pad(d.getUTCHours()) + ':' +
    pad(d.getUTCMinutes()) + ' WIB';
}
function pad(n) { return n < 10 ? '0' + n : n; }

function isNowInNightWindow(now) {
  const hour = now.getHours();
  // Night check: 21..23 OR 0..2
  return (hour >= 21 && hour <= 23) || (hour >= 0 && hour <= 2);
}

// =========================
// Trigger helpers — jalankan sekali manual
// =========================
function createTriggers() {
  // Hati-hati: jalankan sekali untuk memasang trigger sesuai rekomendasi.
  // Hapus trigger jika mau ubah (lihat deleteAllTriggers).
  // Rekomendasi:
  // - 10:00, 13:00, 17:00, 20:00 WIB untuk cafe/restaurant/mall
  // - hourly 21:00-02:00 untuk nightclubs (pilih hourly global atau custom)
  deleteAllTriggers();

  // Convert WIB times to script timezone (Apps Script default biasanya GMT). We will use simple hourly triggers for robustness.
  // Simpler: buat 4x daily trigger + hourly night trigger.
  ScriptApp.newTrigger('main')
    .timeBased().everyHours(6).create(); // backup every 6 hours

  // create daily triggers at approximate times using clock
  ScriptApp.newTrigger('main').timeBased().atHour(10).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger('main').timeBased().atHour(13).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger('main').timeBased().atHour(17).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger('main').timeBased().atHour(20).nearMinute(5).everyDays(1).create();

  // hourly trigger to catch night (will run hourly, internal check isNowInNightWindow filters)
  ScriptApp.newTrigger('main').timeBased().everyHours(1).create();
  Logger.log('Triggers created. Adjust as needed.');
}

function deleteAllTriggers() {
  const all = ScriptApp.getProjectTriggers();
  all.forEach(t => {
    ScriptApp.deleteTrigger(t);
  });
}

// =========================
// Debug / utilities
// =========================
function runTest() {
  // sekali jalan untuk testing manual (tanpa trigger)
  ensureSheets();
  main();
}

function runProductionSetup() {
  // sekali jalan untuk produksi: memastikan sheets dan memasang trigger terjadwal
  ensureSheets();
  createTriggers();
}