/** Daily Google Trends Indonesia to Discord — Apps Script implementation */
/** PRD-compliant: fetch daily trends, AI summary via OpenRouter, post to Discord, log to Sheet, idempotent, retry. */
/** Entry points:
 * - testOnce(): Safe test run (DRY_RUN preview; no idempotency mark)
 * - runOnceNow(): One-off full production run (calls main())
 * - main(): Daily orchestrator (used by time-driven trigger)
 */

function main() {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props);
  var dateKey = todayKey_();
  var t0 = Date.now();
  try {
    if (!(cfg.RUNTIME_BYPASS_IDEMP || cfg.RUNTIME_FORCE_PRODUCTION) && isAlreadyPostedToday_(dateKey)) {
      var postedHash = props.getProperty('POSTED_HASH') || '';
      logToSheet_({ status: 'SKIPPED', count: 0, elapsed_ms: 0, err_msg: '', posted_hash: postedHash, date_key: dateKey, keywords_joined: '' }, cfg, props);
      return;
    }
    var trends = fetchDailyTrends_();
    var items = trends.items.slice(0, cfg.TOP_N);
    if (!items.length) {
      logToSheet_({ status: 'SKIPPED_NO_DATA', count: 0, elapsed_ms: Date.now() - t0, err_msg: '', posted_hash: '', date_key: dateKey, keywords_joined: '' }, cfg, props);
      return;
    }
    // Build AI lead and informative bullet lines per keyword when OpenRouter is available
    var ai = cfg.OPENROUTER_API_KEY
      ? summarizeWithAI_(items, trends.date, cfg)
      : { lead: defaultLead_(), bullets: buildDefaultBullets_(items) };

    // Enrich bullets with metrics (traffic K/M, +percentage, start time)
    var bullets = enrichBulletsWithMetrics_(ai.bullets, items);

    // Compose payload with title, lead, bullets (each keyword one line), and footer
    var payload = composeDiscordPayload_(ai.lead, bullets, '', trends.date, cfg);

    // Always route through postToDiscord_.
    // When DRY_RUN=true, it will attempt preview webhook if available, otherwise skip silently.
    postToDiscord_(payload, cfg);

    markPostedToday_(dateKey, items, props);
    logToSheet_({ status: 'OK', count: items.length, elapsed_ms: Date.now() - t0, err_msg: '', posted_hash: props.getProperty('POSTED_HASH') || '', date_key: dateKey, keywords_joined: items.map(function(it){return it.query;}).join('; ') }, cfg, props);
  } catch (e) {
    var msg = (e && e.message) ? e.message : String(e);
    tryHealthPing_(msg, cfg);
    logToSheet_({ status: 'ERROR', count: 0, elapsed_ms: Date.now() - t0, err_msg: msg, posted_hash: '', date_key: dateKey, keywords_joined: '' }, cfg, props);
    // If we are forcing production (runOnceNow), bubble up errors instead of swallowing under DRY_RUN
    if (!(cfg.DRY_RUN && !cfg.RUNTIME_FORCE_PRODUCTION)) throw e;
  }
}

/** Safe test: DRY_RUN preview; does NOT mark idempotency; still logs as TEST/TEST_ERROR */
function testOnce() {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props);
  cfg.DRY_RUN = true; // enforce preview mode
  var t0 = Date.now();
  try {
    var trends = fetchDailyTrends_();
    var items = trends.items.slice(0, cfg.TOP_N);
    if (!items.length) {
      logToSheet_({
        status: 'TEST_NO_DATA',
        count: 0,
        elapsed_ms: Date.now() - t0,
        err_msg: '',
        posted_hash: '(test)',
        date_key: todayKey_(),
        keywords_joined: ''
      }, cfg, props);
      return;
    }
    // Build AI lead and informative bullet lines per keyword when OpenRouter is available (preview)
    var ai = cfg.OPENROUTER_API_KEY
      ? summarizeWithAI_(items, trends.date, cfg)
      : { lead: defaultLead_(), bullets: buildDefaultBullets_(items) };

    // Enrich bullets dengan metrik (traffic K/M, +percentage, start time)
    var bullets = enrichBulletsWithMetrics_(ai.bullets, items);

    // Compose payload with title, lead, bullets (each keyword one line), and footer
    var payload = composeDiscordPayload_(ai.lead, bullets, '', trends.date, cfg);

    // Will send to DISCORD_WEBHOOK_URL_PREVIEW if set; otherwise skip silently.
    postToDiscord_(payload, cfg);

    logToSheet_({
      status: 'TEST',
      count: items.length,
      elapsed_ms: Date.now() - t0,
      err_msg: '',
      posted_hash: '(test)',
      date_key: todayKey_(),
      keywords_joined: items.map(function(i){ return i.query; }).join('; ')
    }, cfg, props);
  } catch (e) {
    tryHealthPing_('TEST failure: ' + (e && e.message ? e.message : String(e)), cfg);
    logToSheet_({
      status: 'TEST_ERROR',
      count: 0,
      elapsed_ms: Date.now() - t0,
      err_msg: (e && e.message) ? e.message : String(e),
      posted_hash: '',
      date_key: todayKey_(),
      keywords_joined: ''
    }, cfg, props);
  }
}

/** One-off full production run; idempotency guard applies; same as running main() manually */
function runOnceNow() {
  var props = PropertiesService.getScriptProperties();
  var prevForce = props.getProperty('RUNTIME_FORCE_PRODUCTION');
  var prevDry = props.getProperty('DRY_RUN');
  try {
    // Force production send even if DRY_RUN=true in properties
    props.setProperty('RUNTIME_FORCE_PRODUCTION', 'true');
    // Also disable DRY_RUN for this one-off execution to guarantee sending
    props.setProperty('DRY_RUN', 'false');
    main();
  } finally {
    if (prevForce !== null && prevForce !== undefined) {
      props.setProperty('RUNTIME_FORCE_PRODUCTION', prevForce);
    } else {
      props.deleteProperty('RUNTIME_FORCE_PRODUCTION');
    }
    if (prevDry !== null && prevDry !== undefined) {
      props.setProperty('DRY_RUN', prevDry);
    } else {
      props.deleteProperty('DRY_RUN');
    }
  }
}

function serpapiPostOnce() {
  // One-off confirmation: force production send and bypass idempotency
  var props = PropertiesService.getScriptProperties();
  var prevForce = props.getProperty('RUNTIME_FORCE_PRODUCTION');
  var prevDry = props.getProperty('DRY_RUN');
  try {
    props.setProperty('RUNTIME_FORCE_PRODUCTION', 'true');
    props.setProperty('DRY_RUN', 'false');
    main();
  } finally {
    if (prevForce !== null && prevForce !== undefined) {
      props.setProperty('RUNTIME_FORCE_PRODUCTION', prevForce);
    } else {
      props.deleteProperty('RUNTIME_FORCE_PRODUCTION');
    }
    if (prevDry !== null && prevDry !== undefined) {
      props.setProperty('DRY_RUN', prevDry);
    } else {
      props.deleteProperty('DRY_RUN');
    }
  }
}

function loadConfig_(props) {
  var get = function(key, def){ var v = props.getProperty(key); return v != null && v !== '' ? v : def; };
  var parseBool = function(v){ return String(v).toLowerCase() === 'true'; };
  var parseIntSafe = function(v, def){ var n = parseInt(v, 10); return isNaN(n) ? def : n; };
  var cfg = {
    DISCORD_WEBHOOK_URL: get('DISCORD_WEBHOOK_URL', ''),
    DISCORD_WEBHOOK_URLS: get('DISCORD_WEBHOOK_URLS', ''),
    DISCORD_WEBHOOK_URL_PREVIEW: get('DISCORD_WEBHOOK_URL_PREVIEW', ''),
    OPENROUTER_API_KEY: get('OPENROUTER_API_KEY', ''),
    OPENROUTER_MODEL: get('OPENROUTER_MODEL', 'openrouter/z-ai/glm-4.5-air:free'),
    OPENROUTER_HTTP_REFERER: get('OPENROUTER_HTTP_REFERER', ''),
    OPENROUTER_X_TITLE: get('OPENROUTER_X_TITLE', ''),
    TOP_N: parseIntSafe(get('TOP_N', '10'), 10),
    POST_TIME_HOUR: parseIntSafe(get('POST_TIME_HOUR', '6'), 6),
    POST_TIME_MINUTE: parseIntSafe(get('POST_TIME_MINUTE', '0'), 0),
    ENABLE_EMBED: parseBool(get('ENABLE_EMBED', 'true')),
    DRY_RUN: parseBool(get('DRY_RUN', 'false')),
    SHEET_ID: get('SHEET_ID', ''),
    HEALTH_WEBHOOK_URL: get('HEALTH_WEBHOOK_URL', ''),
    SERPAPI_KEY: get('SERPAPI_KEY', ''),
    AVATAR_USERNAME: get('AVATAR_USERNAME', get('avatar_username', '')),
    AVATAR_URL: get('AVATAR_URL', get('avatar_url', '')),
    RUNTIME_FORCE_PRODUCTION: parseBool(get('RUNTIME_FORCE_PRODUCTION', 'false'))
  };
  return cfg;
}

function todayKey_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd');
}

function isAlreadyPostedToday_(dateKey) {
  var props = PropertiesService.getScriptProperties();
  var last = props.getProperty('POSTED_DATE');
  return last === dateKey;
}

function markPostedToday_(dateKey, items, props) {
  var first = items && items.length ? items[0].query : '';
  var base = dateKey + '|' + first;
  var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, base);
  var hashHex = toHex_(hashBytes);
  props.setProperty('POSTED_DATE', dateKey);
  props.setProperty('POSTED_HASH', hashHex);
}

function fetchDailyTrends_() {
  var tz = 'Asia/Jakarta';
  var dateStrFallback = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    // SerpAPI Trending Now only: minimal attempts to conserve quota
    var tn = fetchDailyTrendsSerpApi2_();
    if (tn && tn.items && tn.items.length > 0) {
      debugLog_('SERPAPI_TN_OK', 'trending_now', tn.items.length);
      return tn;
    }
  
    // Stop early; do not try other sources to avoid wasted time/quota
    debugLog_('SERPAPI_TN_EMPTY', '', 0);
    return { date: dateStrFallback, items: [] };
}

function sanitizeTrendsJson_(raw) {
  return String(raw).replace(/^\)\]\}',?/, '');
}

// Helper: extract a balanced JSON object that contains a given key string
function extractBalancedJsonByKey_(text, key) {
  try {
    var idx = text.indexOf(key);
    if (idx < 0) return null;
    var start = text.lastIndexOf('{', idx);
    if (start < 0) return null;
    var depth = 0;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Helper: unescape JSON-like string inside JSON.parse("...") patterns
function unescapeJsonLikeString_(s) {
  var t = String(s);
  t = t.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  t = t.replace(/\\u([0-9a-fA-F]{4})/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  t = t.replace(/\\x([0-9a-fA-F]{2})/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  return t;
}

// Helper: extract a balanced JSON object that contains a given key string
function extractBalancedJsonByKey_(text, key) {
  try {
    var idx = text.indexOf(key);
    if (idx < 0) return null;
    var start = text.lastIndexOf('{', idx);
    if (start < 0) return null;
    var depth = 0;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Helper: unescape JSON-like string inside JSON.parse("...") patterns
function unescapeJsonLikeString_(s) {
  var t = String(s);
  t = t.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  t = t.replace(/\\u([0-9a-fA-F]{4})/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  t = t.replace(/\\x([0-9a-fA-F]{2})/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
  return t;
}

/** Decode common HTML entities to plain text for more reliable JSON/regex extraction in SPA HTML */
function htmlEntitiesDecode_(s) {
  var t = String(s || '');
  t = t.replace(/"/g, '"').replace(/&#34;/g, '"');
  t = t.replace(/&/g, '&').replace(/&#38;/g, '&');
  t = t.replace(/</g, '<').replace(/&#60;/g, '<');
  t = t.replace(/>/g, '>').replace(/&#62;/g, '>');
  t = t.replace(/'/g, "'").replace(/'/g, "'");
  return t;
}

// Internal: fetch and parse Trends JSON variant; returns {date, items} or null
function tryFetchTrendsJson_(url, headers) {
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
    headers: headers
  };
  var res = UrlFetchApp.fetch(url, options);
  var status = res.getResponseCode();
  var text = res.getContentText();
  var sanitized = sanitizeTrendsJson_(text);
  var dateStrFallback = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  // Log attempt with status code
  debugLog_('JSON_ATTEMPT', 'status=' + status + ' ' + url, 0);

  try {
    var data = JSON.parse(sanitized);
    // Some responses may wrap differently; try to locate trendingSearchesDays
    var days = data.trendingSearchesDays || (data.default && data.default.trendingSearchesDays) || [];
    var dayObj = null;
    for (var di = 0; di < days.length; di++) {
      var cand = days[di];
      if (cand && cand.trendingSearches && cand.trendingSearches.length) {
        dayObj = cand;
        break;
      }
    }
    if (!dayObj && days && days.length) { dayObj = days[0]; }
    var dateStr = dayObj && dayObj.date ? dayObj.date : dateStrFallback;

    var items = [];
    if (dayObj && dayObj.trendingSearches) {
      for (var i = 0; i < dayObj.trendingSearches.length; i++) {
        var ts = dayObj.trendingSearches[i];
        var query = ts.title && ts.title.query ? ts.title.query : '';
        var traffic = ts.formattedTraffic || '';
        var arts = [];
        if (ts.articles && ts.articles.length) {
          for (var j = 0; j < Math.min(2, ts.articles.length); j++) {
            var a = ts.articles[j];
            var title = a.title || '';
            var source = a.source || '';
            arts.push(title + (source ? (' - ' + source) : ''));
          }
        }
        if (query) items.push({ query: query, traffic: traffic, articles: arts });
      }
    }
    return { date: dateStr, items: items };
  } catch (e) {
    // If obvious HTML or bad status, consider this variant unsuccessful
    var trimmed = String(sanitized).trim();
    if (trimmed.charAt(0) === '<' || status >= 300) {
      debugLog_('JSON_FAIL', 'status=' + status + ' html_or_bad ' + url, 0);
      return null;
    }
    // Try to salvage embedded JSON block
    var m = sanitized.match(/\{[\s\S]*?"trendingSearchesDays"[\s\S]*?\}/);
    if (m) {
      try {
        var data2 = JSON.parse(m[0]);
        var days2 = data2.trendingSearchesDays || (data2.default && data2.default.trendingSearchesDays) || [];
        var dayObj2 = (days2 && days2.length) ? days2[0] : null;
        var dateStr2 = dayObj2 && dayObj2.date ? dayObj2.date : dateStrFallback;
        var items2 = [];
        if (dayObj2 && dayObj2.trendingSearches) {
          for (var i2 = 0; i2 < dayObj2.trendingSearches.length; i2++) {
            var ts2 = dayObj2.trendingSearches[i2];
            var query2 = ts2.title && ts2.title.query ? ts2.title.query : '';
            var traffic2 = ts2.formattedTraffic || '';
            var arts2 = [];
            if (ts2.articles && ts2.articles.length) {
              for (var j2 = 0; j2 < Math.min(2, ts2.articles.length); j2++) {
                var a2 = ts2.articles[j2];
                var title2 = a2.title || '';
                var source2 = a2.source || '';
                arts2.push(title2 + (source2 ? (' - ' + source2) : ''));
              }
            }
            if (query2) items2.push({ query: query2, traffic: traffic2, articles: arts2 });
          }
        }
        return { date: dateStr2, items: items2 };
      } catch (e2) {
        debugLog_('JSON_FAIL', 'status=' + status + ' salvage_error ' + url, 0);
        return null;
      }
    }
    var head = trimmed.substring(0, 200).replace(/\s+/g, ' ');
    debugLog_('JSON_FAIL', 'status=' + status + ' head=' + head + ' ' + url, 0);
    return null;
  }
}

// Fallback: parse Google Trends daily RSS into minimal structure
function fetchDailyTrendsRssFallback_() {
 var urls = [
  'https://trends.google.com/trends/trendingsearches/daily/rss?hl=id&geo=ID',
  'https://trends.google.com/trends/trendingsearches/daily/rss?hl=en&geo=ID',
  'https://trends.google.com/trends/trendingsearches/daily/rss?geo=ID',
  'https://trends.google.com/trends/trendingsearches/daily?hl=id&geo=ID&content=RSS',
  'https://trends.google.com/trends/trendingsearches/daily?hl=en&geo=ID&content=RSS',
  'https://trends.google.co.id/trends/trendingsearches/daily/rss?hl=id&geo=ID',
  'https://trends.google.co.id/trends/trendingsearches/daily/rss?hl=en&geo=ID',
  'https://trends.google.co.id/trends/trendingsearches/daily?hl=id&geo=ID&content=RSS',
  'https://trends.google.co.id/trends/trendingsearches/daily?hl=en&geo=ID&content=RSS'
 ];
 var baseHeaders = {
   'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.1; +https://script.google.com/)',
   'Accept': 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
   'Referer': 'https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=id',
   'Origin': 'https://trends.google.com',
   'Cookie': 'CONSENT=YES+; SOCS=CAISgA'
 };
 var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
 debugLog_('RSS_START', '', 0);
 for (var u = 0; u < urls.length; u++) {
   try {
     var res = UrlFetchApp.fetch(urls[u], {
       method: 'get',
       muteHttpExceptions: true,
       followRedirects: true,
       validateHttpsCertificates: true,
       headers: baseHeaders
     });
     var xml = res.getContentText();
     var status = res.getResponseCode();
     if (!xml || xml.trim().charAt(0) !== '<') {
       var head = (xml || '').trim().substring(0, 120).replace(/\s+/g, ' ');
       debugLog_('RSS_EMPTY', 'status=' + status + ' head=' + head + ' ' + urls[u], 0);
       continue;
     }
     var doc = XmlService.parse(xml);
     var root = doc.getRootElement();
     var channel = root.getChild('channel');
     if (!channel) continue;
     var itemEls = channel.getChildren('item');
     var items = [];
     for (var i = 0; i < itemEls.length; i++) {
       var it = itemEls[i];
       var titleEl = it.getChild('title');
       var title = titleEl ? titleEl.getText() : '';
       if (!title) continue;
       items.push({ query: title, traffic: '', articles: [] });
       if (items.length >= 50) break;
     }
     if (items.length > 0) {
       var pubDateEl = channel.getChild('pubDate');
       var dateOut = pubDateEl ? Utilities.formatDate(new Date(pubDateEl.getText()), 'Asia/Jakarta', 'yyyy-MM-dd') : dateStr;
       return { date: dateOut, items: items };
     } else {
       debugLog_('RSS_EMPTY_PARSE', 'status=' + status + ' items=0 ' + urls[u], 0);
     }
   } catch (e) {
     debugLog_('RSS_ERROR', 'url=' + urls[u] + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
   }
   Utilities.sleep(200);
 }
 return { date: dateStr, items: [] };
}

// Fallback: parse the HTML daily page for embedded JSON (as a last resort)
// Fallback: parse Google Trends realtime API into minimal structure
function fetchRealtimeTrendsFallback_() {
  // Coba beberapa kategori realtime dan dua bahasa (id,en) untuk meningkatkan peluang data tersedia
  var langs = ['id', 'en'];
  var cats = ['all', 'b', 'e', 'h', 't', 's']; // all,business,entertainment,health,sci/tech,sports
  var urls = [];
  for (var li = 0; li < langs.length; li++) {
    for (var ci = 0; ci < cats.length; ci++) {
      urls.push('https://trends.google.com/trends/api/realtimetrends?hl=' + langs[li] + '&tz=420&geo=ID&cat=' + cats[ci] + '&fi=0&fs=0&ri=300&rs=50&sort=0');
    }
  }
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.2; +https://script.google.com/)',
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'id,en;q=0.8',
      'Referer': 'https://trends.google.com/trends/trendingsearches/realtime?hl=id&geo=ID&category=all',
      'Origin': 'https://trends.google.com',
      'Cookie': 'CONSENT=YES+; SOCS=CAISgA'
    }
  };
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  debugLog_('REALTIME_START', '', 0);
  for (var u = 0; u < urls.length; u++) {
    try {
      var res = UrlFetchApp.fetch(urls[u], options);
      var status = res.getResponseCode();
      var txt = res.getContentText();
      debugLog_('REALTIME_ATTEMPT', 'status=' + status + ' ' + urls[u], 0);
      var sanitized = sanitizeTrendsJson_(txt);
      var data = JSON.parse(sanitized);

      // Known containers for realtime trending stories
      var stories = [];
      if (data && data.storySummaries && data.storySummaries.trendingStories) {
        stories = data.storySummaries.trendingStories;
      } else if (data && data.trendingStories) {
        stories = data.trendingStories;
      } else if (data && data.default && data.default.trendingStories) {
        stories = data.default.trendingStories;
      }

      var items = [];
      if (stories && stories.length) {
        for (var i = 0; i < stories.length; i++) {
          var s = stories[i];
          var query = (s.title && String(s.title).trim()) ? s.title : ((s.entityNames && s.entityNames.length) ? s.entityNames[0] : '');
          var arts = [];
          var artList = s.articles || s.articleList || (s.newsArticles && s.newsArticles.length ? s.newsArticles : []);
          if (artList && artList.length) {
            for (var j = 0; j < Math.min(2, artList.length); j++) {
              var a = artList[j];
              var t = a.title || '';
              var srcName = '';
              // Normalize source variants
              if (a.source && typeof a.source === 'object' && a.source.name) {
                srcName = a.source.name;
              } else if (typeof a.source === 'string') {
                srcName = a.source;
              }
              arts.push((t || '') + (srcName ? (' - ' + srcName) : ''));
            }
          }
          if (query) items.push({ query: query, traffic: '', articles: arts });
          if (items.length >= 20) break;
        }
      }
      if (items.length > 0) {
        return { date: dateStr, items: items };
      } else {
        var head = (txt || '').trim().substring(0, 120).replace(/\s+/g, ' ');
        debugLog_('REALTIME_EMPTY', 'status=' + status + ' head=' + head + ' ' + urls[u], 0);
      }
    } catch (e) {
      // lanjut ke URL berikutnya
    }
    Utilities.sleep(200);
  }
  return { date: dateStr, items: [] };
}
function fetchDailyTrendsHtmlFallback_() {
  // Coba beberapa domain/hl untuk meningkatkan peluang ekstraksi
  var urls = [
    'https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=en',
    'https://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=en'
  ];
  var headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.2; +https://script.google.com/)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id,en;q=0.8',
    'Referer': 'https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=id',
    'Origin': 'https://trends.google.com',
    'Cookie': 'CONSENT=YES+; SOCS=CAISgA'
  };
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  debugLog_('HTML_START', '', 0);

  for (var u = 0; u < urls.length; u++) {
    try {
      var res = UrlFetchApp.fetch(urls[u], {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: headers
      });
      var html = res.getContentText();
      html = htmlEntitiesDecode_(html);
      var status = res.getResponseCode();
      if (!html || html.trim().length === 0) {
        debugLog_('HTML_EMPTY', 'status=' + status + ' len=0 ' + urls[u], 0);
        Utilities.sleep(200);
        continue;
      }

      var items = [], seen = {};

      // 1) Balanced JSON berisi "trendingSearchesDays"
      var jsonBlock = extractBalancedJsonByKey_(html, 'trendingSearchesDays');
      if (jsonBlock) {
        try {
          var data = JSON.parse(jsonBlock);
          var days = data.trendingSearchesDays || (data.default && data.default.trendingSearchesDays) || [];
          var dayObj = null;
          for (var di = 0; di < days.length; di++) {
            var cand = days[di];
            if (cand && cand.trendingSearches && cand.trendingSearches.length) {
              dayObj = cand;
              break;
            }
          }
          if (!dayObj && days && days.length) { dayObj = days[0]; }
          var tsList = (dayObj && dayObj.trendingSearches) ? dayObj.trendingSearches : [];
          for (var i = 0; i < tsList.length; i++) {
            var ts = tsList[i];
            var q = ts.title && ts.title.query ? ts.title.query : '';
            if (q && !seen[q]) {
              seen[q] = true;
              items.push({ query: q, traffic: ts.formattedTraffic || '', articles: [] });
              if (items.length >= 50) break;
            }
          }
        } catch (e1) {}
      }

      // 2) Pola JSON.parse("...") dengan konten escaped yang mengandung trendingSearchesDays
      if (items.length < 5) {
        var mParse = html.match(/JSON\.parse\("([\s\S]*?trendingSearchesDays[\s\S]*?)"\)/);
        if (mParse && mParse[1]) {
          try {
            var decoded = unescapeJsonLikeString_(mParse[1]);
            var innerBlock = extractBalancedJsonByKey_(decoded, 'trendingSearchesDays') || decoded;
            var data2 = JSON.parse(innerBlock);
            var days2 = data2.trendingSearchesDays || (data2.default && data2.default.trendingSearchesDays) || [];
            var dayObj2 = null;
            for (var d2 = 0; d2 < days2.length; d2++) {
              var cand2 = days2[d2];
              if (cand2 && cand2.trendingSearches && cand2.trendingSearches.length) {
                dayObj2 = cand2;
                break;
              }
            }
            if (!dayObj2 && days2 && days2.length) { dayObj2 = days2[0]; }
            var tsList2 = (dayObj2 && dayObj2.trendingSearches) ? dayObj2.trendingSearches : [];
            for (var ii = 0; ii < tsList2.length; ii++) {
              var ts2 = tsList2[ii];
              var q2 = ts2.title && ts2.title.query ? ts2.title.query : '';
              if (q2 && !seen[q2]) {
                seen[q2] = true;
                items.push({ query: q2, traffic: ts2.formattedTraffic || '', articles: [] });
                if (items.length >= 50) break;
              }
            }
          } catch (e2) {}
        }
      }

      // 3) Regex langsung untuk "query": "..."
      if (items.length < 5) {
        var reQuery = /"query"\s*:\s*"([^"]+)"/g, m;
        while ((m = reQuery.exec(html)) !== null) {
          var q3 = m[1];
          if (q3 && !seen[q3]) {
            seen[q3] = true;
            items.push({ query: q3, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      // 4) Regex untuk "title": { "query": "..." }
      if (items.length < 5) {
        var reTitleQuery = /"title"\s*:\s*\{\s*"query"\s*:\s*"([^"]+)"/g, m2;
        while ((m2 = reTitleQuery.exec(html)) !== null) {
          var q4 = m2[1];
          if (q4 && !seen[q4]) {
            seen[q4] = true;
            items.push({ query: q4, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      // 5) Fallback elemen HTML: itemprop="name">Nama</span>
      if (items.length < 5) {
        var reName = /itemprop="name"[^>]*>([^<]+)</g, m3;
        while ((m3 = reName.exec(html)) !== null) {
          var qn = m3[1];
          if (qn && !seen[qn]) {
            seen[qn] = true;
            items.push({ query: qn, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      // 6) Ekstrak dari tautan Google Search: href="/search?q=..." atau "https://www.google.com/search?q=..."
      if (items.length < 5) {
        var reHref = /href\s*=\s*"(?:https?:\/\/www\.google\.[^\/]+)?\/search\?q=([^"&]+)"/g, m4;
        while ((m4 = reHref.exec(html)) !== null) {
          var qh = decodeURIComponent(m4[1].replace(/\+/g, ' '));
          if (qh && !seen[qh]) {
            seen[qh] = true;
            items.push({ query: qh, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      if (items.length > 0) {
        debugLog_('HTML_OK', 'status=' + status + ' len=' + html.length + ' ' + urls[u], items.length);
        return { date: dateStr, items: items };
      } else {
        var head = html.trim().substring(0, 200).replace(/\s+/g, ' ');
        debugLog_('HTML_EMPTY', 'status=' + status + ' len=' + html.length + ' ' + urls[u] + ' head=' + head, 0);
      }
    } catch (e) {
      debugLog_('HTML_ERROR', 'url=' + urls[u] + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
    }
    Utilities.sleep(200);
  }

  return { date: dateStr, items: [] };
}

// Parse Realtime HTML page for trendingStories as a last-ditch realtime source
function fetchRealtimeHtmlFallback_() {
  // Coba halaman realtime untuk hl=id lalu fallback hl=en
  var urls = [
    'https://trends.google.com/trends/trendingsearches/realtime?hl=id&geo=ID&category=all',
    'https://trends.google.com/trends/trendingsearches/realtime?hl=en&geo=ID&category=all'
  ];
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.2; +https://script.google.com/)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id,en;q=0.8',
      'Origin': 'https://trends.google.com',
      'Cookie': 'CONSENT=YES+'
    }
  };
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  debugLog_('REALTIME_HTML_START', '', 0);
  for (var u = 0; u < urls.length; u++) {
    try {
      var res = UrlFetchApp.fetch(urls[u], options);
      var html = res.getContentText();
      if (!html || html.trim().length === 0) {
        continue;
      }
      // Ekstrak "trendingStories" dari HTML
      var m = html.match(/"trendingStories"\s*:\s*(\[[\s\S]*?\])/);
      if (!m) {
        continue;
      }
      var jsonText = '{ "trendingStories": ' + m[1] + ' }';
      var data = JSON.parse(jsonText);
      var stories = data.trendingStories || [];
      var items = [];
      for (var i = 0; i < stories.length; i++) {
        var s = stories[i];
        var q = (s.title && String(s.title).trim()) ? s.title : ((s.entityNames && s.entityNames.length) ? s.entityNames[0] : '');
        if (q) items.push({ query: q, traffic: '', articles: [] });
        if (items.length >= 20) break;
      }
      if (items.length > 0) {
        return { date: dateStr, items: items };
      }
    } catch (e) {
      debugLog_('REALTIME_HTML_ERROR', 'url=' + urls[u] + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
    }
    Utilities.sleep(200);
  }
  return { date: dateStr, items: [] };
}

function buildKeywordsSection_(items) {
  var names = (items || []).map(function(it){ return it.query; }).filter(function(s){ return s && s.trim().length; });
  if (!names.length) return '';
  return 'Keywords: ' + names.join('; ');
}

function defaultLead_() {
  return '';
}

function buildDefaultBullets_(items) {
  var out = [];
  var n = items.length;
  for (var i = 0; i < n; i++) {
    var it = items[i];
    var emoji = emojiHeuristic_(it.query, it);
    // Default bullets keep it clean; metrics appended later
    out.push('• ' + emoji + ' ' + it.query);
  }
  return out;
}

function summarizeWithAI_(items, dateStr, cfg) {
  try {
    var systemPrompt = [
      'Anda mengubah Google Trends Indonesia (ID) menjadi 1 paragraf lead dan daftar bullet informatif per keyword.',
      'Format wajib:',
      '- Gunakan bahasa Indonesia santai.',
      '- Lead: 1 paragraf ramah, kaya emoji, ≤ ~60 kata.',
      '- Bullets: SATU baris per keyword, format: "• <emoji> <keyword>: <informasi singkat>"',
      '- Informasi singkat harus ringkas (±8–12 kata), menjelaskan inti tren/konteks, hindari hype.',
      '- Gunakan emoji yang relevan per baris (🔥📈🛍️🎮🎬⚽💰📱🎓❤️ dll).',
      '- Hindari URL mentah dan hashtag.',
      'Input akan berisi daftar {query, traffic, articles[]} untuk top N; gunakan jika bermanfaat.',
      'Output: Kembalikan JSON: { "lead": string, "bullets": [string] } saja.'
    ].join('\n');

    var payloadUser = {
      date: dateStr,
      top_n: Math.min(items.length, cfg.TOP_N),
      items: items.slice(0, cfg.TOP_N).map(function(it){
        return { query: it.query, traffic: it.traffic, articles: it.articles.slice(0, 1) };
      })
    };

    var body = {
      model: cfg.OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payloadUser) }
      ],
      temperature: 0.7
    };

    var headers = {
      Authorization: 'Bearer ' + cfg.OPENROUTER_API_KEY,
      'Content-Type': 'application/json'
    };
    if (cfg.OPENROUTER_HTTP_REFERER) headers['HTTP-Referer'] = cfg.OPENROUTER_HTTP_REFERER;
    if (cfg.OPENROUTER_X_TITLE) headers['X-Title'] = cfg.OPENROUTER_X_TITLE;

    var res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      headers: headers,
      muteHttpExceptions: true
    });

    var txt = res.getContentText();
    var json = JSON.parse(txt);
    var content = (json.choices && json.choices.length && json.choices[0].message && json.choices[0].message.content) ? json.choices[0].message.content : '';
    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (inner) {
      var m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if (!parsed || !parsed.lead) {
      return { lead: defaultLead_(), bullets: buildDefaultBullets_(items.slice(0, cfg.TOP_N)) };
    }
    var desired = Math.min(cfg.TOP_N, items.length);
    var aiBullets = Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, desired) : [];
    if (aiBullets.length < desired) {
      var needed = desired - aiBullets.length;
      var defaults = buildDefaultBullets_(items.slice(aiBullets.length, aiBullets.length + needed));
      aiBullets = aiBullets.concat(defaults);
    }
    return { lead: parsed.lead, bullets: aiBullets };
  } catch (e) {
    return { lead: defaultLead_(), bullets: buildDefaultBullets_(items) };
  }
}

function composeDiscordPayload_(lead, bullets, keywordsLine, dateStr, cfg) {
  var title = '🇮🇩 Google Trends Indonesia — ' + formatDateId_(new Date());
  var footerText = formatFooterLower_();

  // Always use embed with green accent bar
  var bodyLines = [];
  if (lead && String(lead).trim().length) bodyLines.push(lead.trim());
  if (Array.isArray(bullets) && bullets.length) {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (b && String(b).trim().length) bodyLines.push(b);
    }
  } else if (keywordsLine && String(keywordsLine).trim().length) {
    bodyLines.push(keywordsLine.trim());
  }
  var embed = {
    title: title,
    description: bodyLines.join('\n'),
    color: 3066993, // green (#2ECC71)
    footer: { text: footerText }
  };
  var out = { embeds: [embed] };
  if (cfg.AVATAR_USERNAME && String(cfg.AVATAR_USERNAME).trim()) {
    out.username = cfg.AVATAR_USERNAME;
  }
  if (cfg.AVATAR_URL && String(cfg.AVATAR_URL).trim()) {
    out.avatar_url = cfg.AVATAR_URL;
  }
  return out;
}

function postToDiscord_(payload, cfg) {
  var urls = [];
  var dry = cfg.DRY_RUN && !cfg.RUNTIME_FORCE_PRODUCTION;

  if (dry && cfg.DISCORD_WEBHOOK_URL_PREVIEW) {
    urls.push(cfg.DISCORD_WEBHOOK_URL_PREVIEW);
  } else {
    if (cfg.DISCORD_WEBHOOK_URLS) {
      try {
        var arr = JSON.parse(cfg.DISCORD_WEBHOOK_URLS);
        if (Array.isArray(arr)) urls = arr;
      } catch (e) {}
    }
    if (!urls.length && cfg.DISCORD_WEBHOOK_URL) urls.push(cfg.DISCORD_WEBHOOK_URL);
  }

  // In DRY_RUN mode without preview webhook, silently skip sending
  if (!urls.length) {
    if (dry) return;
    throw new Error('No Discord webhook URL configured');
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    var ok = false, lastStatus = 0, lastText = '';
    var delays = [1000, 2000, 4000];
    for (var r = 0; r < delays.length; r++) {
      var res = UrlFetchApp.fetch(url, options);
      lastStatus = res.getResponseCode();
      lastText = res.getContentText();
      if (lastStatus >= 200 && lastStatus < 300) { ok = true; break; }
      Utilities.sleep(delays[r]);
    }
    if (!ok) {
      // Fallback: try sending a minimal content-only payload once
      var alt = payload.content ? { content: payload.content } : {
        content: (payload.embeds && payload.embeds[0] && payload.embeds[0].description)
          ? payload.embeds[0].description
          : 'Google Trends Indonesia — update'
      };
      if (cfg.AVATAR_USERNAME && String(cfg.AVATAR_USERNAME).trim()) {
        alt.username = cfg.AVATAR_USERNAME;
      }
      if (cfg.AVATAR_URL && String(cfg.AVATAR_URL).trim()) {
        alt.avatar_url = cfg.AVATAR_URL;
      }
      var resAlt = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(alt),
        muteHttpExceptions: true
      });
      var altStatus = resAlt.getResponseCode();
      var altText = resAlt.getContentText();
      if (altStatus >= 200 && altStatus < 300) {
        ok = true;
      } else {
        tryHealthPing_('Discord post failed: status=' + lastStatus + ' body=' + lastText + ' | fallback status=' + altStatus + ' body=' + altText, cfg);
        throw new Error('Discord post failed: status=' + lastStatus + ' body=' + lastText + ' | fallback status=' + altStatus + ' body=' + altText);
      }
    }
  }
}

function tryHealthPing_(message, cfg) {
  try {
    if (!cfg.HEALTH_WEBHOOK_URL) return;
    var payload = { content: '[Health] Gtrends Radar error: ' + message };
    UrlFetchApp.fetch(cfg.HEALTH_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    // swallow
  }
}

function logToSheet_(entry, cfg, props) {
  var sheetId = cfg.SHEET_ID;
  var ss;
  if (!sheetId) {
    ss = SpreadsheetApp.create('gtrends_logs');
    sheetId = ss.getId();
    props.setProperty('SHEET_ID', sheetId);
  } else {
    ss = SpreadsheetApp.openById(sheetId);
  }
  var sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(['timestamp', 'date_local', 'count', 'status', 'err_msg', 'elapsed_ms', 'posted_hash', 'keywords_joined']);
  }
  var ts = new Date();
  var dateLocal = Utilities.formatDate(ts, 'Asia/Jakarta', 'yyyy-MM-dd');
  sh.appendRow([
    ts.toISOString(),
    dateLocal,
    entry.count || 0,
    entry.status || '',
    entry.err_msg || '',
    entry.elapsed_ms || 0,
    entry.posted_hash || '',
    entry.keywords_joined || ''
  ]);
}

// Lightweight debug logger to sheet for fetch path visibility
function debugLog_(path, info, count) {
  try {
    var props = PropertiesService.getScriptProperties();
    var cfg = loadConfig_(props);
    logToSheet_({
      status: 'DEBUG_FETCH',
      count: count || 0,
      elapsed_ms: 0,
      err_msg: (path || '') + (info ? (' | ' + info) : ''),
      posted_hash: '',
      date_key: todayKey_(),
      keywords_joined: ''
    }, cfg, props);
  } catch (e) {
    // swallow
  }
}

function ensureTrigger_() {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props);
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getHandlerFunction && t.getHandlerFunction() === 'main') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('main')
    .timeBased()
    .atHour(cfg.POST_TIME_HOUR)
    .nearMinute(cfg.POST_TIME_MINUTE)
    .everyDays(1)
    .create();
}

function formatDateId_(d) {
  var dd = Utilities.formatDate(d, 'Asia/Jakarta', 'dd');
  var mm = Utilities.formatDate(d, 'Asia/Jakarta', 'MM');
  var yyyy = Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy');
  var monthNames = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'Mei','06':'Jun','07':'Jul','08':'Agu','09':'Sep','10':'Okt','11':'Nov','12':'Des' };
  return dd + ' ' + (monthNames[mm] || mm) + ' ' + yyyy;
}

function emojiHeuristic_(query, it) {
  var q = (query || '').toLowerCase();
  if (q.match(/laga|pertandingan|liga|bola|fc|vs|gol|timnas|sepak ?bola/)) return '⚽';
  if (q.match(/film|drama|series|serial|bintang|artis|gosip|sinema|bioskop|trailer/)) return '🎬';
  if (q.match(/game|gim|playstation|xbox|mobile legends|mlbb|steam/)) return '🎮';
  if (q.match(/belanja|diskon|promo|harga|tokopedia|shopee|ecommerce|jual/)) return '🛍️';
  if (q.match(/ekonomi|investasi|saham|crypto|bitcoin|uang|rupiah|inflasi/)) return '💰';
  if (q.match(/hp|smartphone|android|ios|apple|samsung|xiaomi|gadget|teknologi|ai/)) return '📱';
  if (q.match(/pendidikan|ujian|sekolah|kampus|beasiswa|skripsi/)) return '🎓';
  if (q.match(/cinta|nikah|pacar|valentine|romantis|asmara/)) return '❤️';
  if (q.match(/panas|tren|viral|heboh|terkini/)) return '🔥';
  return '📈';
}

function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    var s = b.toString(16);
    if (s.length < 2) s = '0' + s;
    out += s;
  }
  return out;
}
function formatFooterLower_() {
  var tz = 'Asia/Jakarta';
  var now = new Date();
  // Get English short day (EEE) then map to Indonesian lowercase
  var eee = Utilities.formatDate(now, tz, 'EEE').toLowerCase();
  var key = eee.substring(0, 3);
  var map = {
    sun: 'minggu',
    mon: 'senin',
    tue: 'selasa',
    wed: 'rabu',
    thu: 'kamis',
    fri: 'jumat',
    sat: 'sabtu'
  };
  var day = map[key] || eee;
  var dmy = Utilities.formatDate(now, tz, 'dd-MM-yyyy');
  // Lowercase footer: source + localized day,dd-MM-yyyy
  return 'source: google trends · ' + day + ',' + dmy;
}

// Format traffic as K/M (e.g., 20K, 200K, 1.2M)
function formatTrafficK_(v) {
  if (v == null) return '';
  var s = String(v).trim();
  if (!s) return '';
  if (/[KM]\+?$/i.test(s)) {
    return s.replace(/\+$/, '');
  }
  var n = parseFloat(s);
  if (isNaN(n)) return s;
  if (n >= 1000000) {
    var m = Math.round(n / 100000) / 10; // 1 decimal
    return (m % 1 === 0 ? Math.round(m).toString() : m.toFixed(1)) + 'M';
  }
  if (n >= 1000) {
    var k = Math.round(n / 1000);
    return k + 'K';
  }
  return String(Math.round(n));
}

// Normalize percent (e.g., '+45%')
function formatPercent_(p) {
  if (p == null) return '';
  var s = String(p).trim();
  if (!s) return '';
  var n = parseFloat(s.replace('%', ''));
  if (isNaN(n)) return s;
  return Math.round(n) + '%';
}

// Convert start timestamp to Asia/Jakarta HH:mm
function formatStartLocal_(ts) {
  if (!ts) return '';
  try {
    var d;
    if (typeof ts === 'number') {
      d = new Date(ts > 1e12 ? ts : ts * 1000);
    } else {
      var s = String(ts);
      var num = parseFloat(s);
      if (!isNaN(num) && s.match(/^\d+$/)) {
        d = new Date(num > 1e12 ? num : num * 1000);
      } else {
        d = new Date(s);
      }
    }
    if (!d || isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm');
  } catch (e) {
    return '';
  }
}

// Append metrics to AI bullets: " — 20K · +45% · sejak 02:00"
function enrichBulletsWithMetrics_(bullets, items) {
 try {
   if (!Array.isArray(bullets) || !bullets.length) return bullets || [];
   var out = [];
   var n = bullets.length;
   for (var i = 0; i < n; i++) {
     var raw = String(bullets[i] || '').trim();
     // Remove any existing trailing metrics after " — "
     var b = raw.replace(/\s+—\s+.*$/, '');
     // Find matching item by query substring to respect AI ordering
     var it = null;
     var bl = b.toLowerCase();
     for (var j = 0; j < items.length; j++) {
       var qj = String(items[j].query || '').toLowerCase();
       if (qj && bl.indexOf(qj) >= 0) { it = items[j]; break; }
     }
     if (!it) it = items[i] || {};
     var t = formatTrafficK_(it.traffic);
     var p = formatPercent_(it.increase_pct);
     var st = formatStartLocal_(it.start_ts);
     var parts = [];
     if (t) parts.push(t);
     if (p) parts.push('+' + p);
     if (st) parts.push('sejak ' + st);
     var suffix = parts.length ? (' — ' + parts.join(' · ')) : '';
     out.push(b + suffix);
   }
   return out;
 } catch (e) {
   return bullets;
 }
}
/** Attempt the newer v1 daily trends JSON endpoint as an additional source */
function tryFetchTrendsV1Json_(hl, tz) {
  var urls = [
    'https://trends.google.com/v1/trends/trendingsearches/day?hl=' + hl + '&tz=' + tz + '&geo=ID',
    'https://trends.google.co.id/v1/trends/trendingsearches/day?hl=' + hl + '&tz=' + tz + '&geo=ID'
  ];
  var headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.2; +https://script.google.com/)',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'id,en;q=0.8',
    'Referer': 'https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=' + hl,
    'Origin': 'https://trends.google.com',
    'Cookie': 'CONSENT=YES+; SOCS=CAISgA'
  };
  var dateStrFallback = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  for (var u = 0; u < urls.length; u++) {
    try {
      var res = UrlFetchApp.fetch(urls[u], {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: headers
      });
      var status = res.getResponseCode();
      var text = res.getContentText();
      debugLog_('JSON_V1_ATTEMPT', 'status=' + status + ' ' + urls[u], 0);

      if (status >= 300 || !text || !text.trim().length) {
        var head0 = (text || '').trim().substring(0, 120).replace(/\s+/g, ' ');
        debugLog_('JSON_V1_FAIL', 'status=' + status + ' head=' + head0 + ' ' + urls[u], 0);
        continue;
      }

      var data = null;
      try {
        data = JSON.parse(text);
      } catch (e1) {
        try {
          data = JSON.parse(sanitizeTrendsJson_(text));
        } catch (e2) {
          data = null;
        }
      }
      if (!data) {
        var head1 = text.trim().substring(0, 200).replace(/\s+/g, ' ');
        debugLog_('JSON_V1_FAIL', 'parse_error head=' + head1 + ' ' + urls[u], 0);
        continue;
      }

      // Prefer the same shape as classic API
      var days = data.trendingSearchesDays || (data.default && data.default.trendingSearchesDays) || [];
      var dayObj = null;
      for (var di = 0; di < days.length; di++) {
        var cand = days[di];
        if (cand && cand.trendingSearches && cand.trendingSearches.length) {
          dayObj = cand;
          break;
        }
      }
      if (!dayObj && days && days.length) { dayObj = days[0]; }
      var dateStr = (dayObj && dayObj.date) ? dayObj.date : dateStrFallback;

      var items = [];
      if (dayObj && dayObj.trendingSearches && dayObj.trendingSearches.length) {
        for (var i = 0; i < dayObj.trendingSearches.length; i++) {
          var ts = dayObj.trendingSearches[i];
          var query = ts.title && ts.title.query ? ts.title.query : '';
          var traffic = ts.formattedTraffic || '';
          var arts = [];
          if (ts.articles && ts.articles.length) {
            for (var j = 0; j < Math.min(2, ts.articles.length); j++) {
              var a = ts.articles[j];
              var title = a.title || '';
              var source = a.source || (a.source && a.source.name ? a.source.name : '');
              arts.push((title || '') + (source ? (' - ' + source) : ''));
            }
          }
          if (query) items.push({ query: query, traffic: traffic, articles: arts });
        }
      }

      // If the v1 shape is different, capture queries generically from JSON text
      if (items.length < 5) {
        var reQuery = /"title"\s*:\s*\{\s*"query"\s*:\s*"([^"]+)"/g, m;
        while ((m = reQuery.exec(text)) !== null) {
          var q = m[1];
          if (q && !q.match(/^\s*$/)) {
            items.push({ query: q, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      if (items.length > 0) {
        debugLog_('JSON_V1_OK', 'status=' + status + ' items=' + items.length + ' ' + urls[u], items.length);
        return { date: dateStr, items: items };
      } else {
        var head2 = text.trim().substring(0, 200).replace(/\s+/g, ' ');
        debugLog_('JSON_V1_FAIL', 'no_items head=' + head2 + ' ' + urls[u], 0);
      }
    } catch (e) {
      // Continue to next URL
      Utilities.sleep(150);
    }
    Utilities.sleep(200);
  }

  return null;
}
/** Fallback: gunakan r.jina.ai reader untuk mengambil konten halaman Daily Trends dan ekstrak queries */
function fetchDailyTrendsProxyReaderFallback_() {
  var urls = [
    'https://r.jina.ai/http://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://r.jina.ai/https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://r.jina.ai/http://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=en',
    'https://r.jina.ai/https://trends.google.com/trends/trendingsearches/daily?geo=ID&hl=en',
    'https://r.jina.ai/http://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://r.jina.ai/https://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=id',
    'https://r.jina.ai/http://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=en',
    'https://r.jina.ai/https://trends.google.co.id/trends/trendingsearches/daily?geo=ID&hl=en'
  ];
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AppsScript-GtrendsRadar/1.3; +https://script.google.com/)',
      'Accept': 'text/plain,*/*;q=0.8',
      'Accept-Language': 'id,en;q=0.8'
    }
  };
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  debugLog_('PROXY_START', '', 0);

  for (var u = 0; u < urls.length; u++) {
    try {
      var res = UrlFetchApp.fetch(urls[u], options);
      var status = res.getResponseCode();
      var text = res.getContentText() || '';
      debugLog_('PROXY_ATTEMPT', 'status=' + status + ' ' + urls[u], 0);

      if (!text.trim().length) {
        debugLog_('PROXY_EMPTY', 'status=' + status + ' len=0 ' + urls[u], 0);
        Utilities.sleep(150);
        continue;
      }

      // Reader returns plain text; decode entities then find JSON-like or query patterns
      var body = htmlEntitiesDecode_(text);
      var items = [], seen = {};

      // A) JSON-like block containing trendingSearchesDays
      var mJson = body.match(/\{[\s\S]*?"trendingSearchesDays"[\s\S]*?\}/);
      if (mJson && mJson[0]) {
        try {
          var data = JSON.parse(mJson[0]);
          var days = data.trendingSearchesDays || (data.default && data.default.trendingSearchesDays) || [];
          var dayObj = null;
          for (var di = 0; di < days.length; di++) {
            var cand = days[di];
            if (cand && cand.trendingSearches && cand.trendingSearches.length) {
              dayObj = cand; break;
            }
          }
          if (!dayObj && days && days.length) dayObj = days[0];
          var tsList = (dayObj && dayObj.trendingSearches) ? dayObj.trendingSearches : [];
          for (var i = 0; i < tsList.length; i++) {
            var ts = tsList[i];
            var q = ts.title && ts.title.query ? ts.title.query : '';
            if (q && !seen[q]) {
              seen[q] = true;
              items.push({ query: q, traffic: ts.formattedTraffic || '', articles: [] });
              if (items.length >= 50) break;
            }
          }
        } catch (e1) {}
      }

      // B) Regex for "title": {"query": "..."}
      if (items.length < 5) {
        var reTitleQuery = /"title"\s*:\s*\{\s*"query"\s*:\s*"([^"]+)"/g, m1;
        while ((m1 = reTitleQuery.exec(body)) !== null) {
          var q1 = m1[1];
          if (q1 && !seen[q1]) {
            seen[q1] = true;
            items.push({ query: q1, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      // C) Regex for "query": "..."
      if (items.length < 5) {
        var reQuery = /"query"\s*:\s*"([^"]+)"/g, m2;
        while ((m2 = reQuery.exec(body)) !== null) {
          var q2 = m2[1];
          if (q2 && !seen[q2]) {
            seen[q2] = true;
            items.push({ query: q2, traffic: '', articles: [] });
            if (items.length >= 50) break;
          }
        }
      }

      if (items.length > 0) {
        debugLog_('PROXY_OK', 'status=' + status + ' items=' + items.length + ' ' + urls[u], items.length);
        return { date: dateStr, items: items };
      } else {
        var head = body.trim().substring(0, 180).replace(/\s+/g, ' ');
        debugLog_('PROXY_EMPTY', 'status=' + status + ' head=' + head + ' ' + urls[u], 0);
      }
    } catch (e) {
      debugLog_('PROXY_ERROR', 'url=' + urls[u] + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
    }
    Utilities.sleep(200);
  }

  return { date: dateStr, items: [] };
}
/** Primary source via SerpAPI: Google Trends Trending Searches (geo=ID) */
function fetchDailyTrendsSerpApi_() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('SERPAPI_KEY') || '';
  if (!apiKey) {
    debugLog_('SERPAPI_ERROR', 'missing SERPAPI_KEY', 0);
    return { date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'), items: [] };
  }

  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  // Minimize requests to conserve SerpAPI quota: use engine=google_trends with type=daily_trends; try hl=id then hl=en
  var urls = [
    'https://serpapi.com/search.json?engine=google_trends&type=daily_trends&geo=ID&hl=id&api_key=' + encodeURIComponent(apiKey),
    'https://serpapi.com/search.json?engine=google_trends&type=daily_trends&geo=ID&hl=en&api_key=' + encodeURIComponent(apiKey)
  ];

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    try {
      var res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true
      });
      var status = res.getResponseCode();
      var txt = res.getContentText();
      debugLog_('SERPAPI_ATTEMPT', 'status=' + status + ' ' + url, 0);

      if (status >= 300 || !txt || !txt.trim().length) {
        var head = (txt || '').trim().substring(0, 120).replace(/\s+/g, ' ');
        debugLog_('SERPAPI_FAIL', 'status=' + status + ' head=' + head + ' ' + url, 0);
        continue;
      }

      var data;
      try {
        data = JSON.parse(txt);
      } catch (eParse) {
        debugLog_('SERPAPI_FAIL', 'json_parse_error ' + url, 0);
        continue;
      }

      // SerpAPI format: trending_searches: [ { title, query?, formatted_traffic?, articles? [], news_results? [] } ]
      var arr = data.trending_searches || (data.default && data.default.trending_searches) || [];
      var items = [];
      if (arr && arr.length) {
        for (var j = 0; j < arr.length; j++) {
          var ts = arr[j] || {};
          var q = (ts.title || ts.query || '').trim();
          var traffic = ts.formattedTraffic || ts.formatted_traffic || '';
          var arts = [];
          var artsSrc = ts.articles || ts.news_results || [];
          if (artsSrc && artsSrc.length) {
            for (var k = 0; k < Math.min(2, artsSrc.length); k++) {
              var a = artsSrc[k] || {};
              var t = a.title || '';
              var src = '';
              if (a.source && typeof a.source === 'object' && a.source.name) {
                src = a.source.name;
              } else if (typeof a.source === 'string') {
                src = a.source;
              } else if (a.source_name) {
                src = a.source_name;
              }
              arts.push((t || '') + (src ? (' - ' + src) : ''));
            }
          }
          if (q) items.push({ query: q, traffic: traffic, articles: arts });
          if (items.length >= 50) break;
        }
      }

      if (items.length > 0) {
        debugLog_('SERPAPI_OK', 'items=' + items.length + ' ' + url, items.length);
        return { date: dateStr, items: items };
      } else {
        var head2 = txt.trim().substring(0, 180).replace(/\s+/g, ' ');
        debugLog_('SERPAPI_FAIL', 'no_items head=' + head2 + ' ' + url, 0);
      }
    } catch (e) {
      debugLog_('SERPAPI_ERROR', 'url=' + url + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
    }

    // Only try second language if first failed to return items
    if (i === 0) Utilities.sleep(150);
  }

  return { date: dateStr, items: [] };
}
/** SerpAPI-only Trending Now fetch: engine=google_trends_trending_now (geo=ID) — use category_id and hl=id→en */
function fetchDailyTrendsSerpApi2_() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('SERPAPI_KEY') || '';
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  if (!apiKey) {
    debugLog_('SERPAPI_TN_ERROR', 'missing SERPAPI_KEY', 0);
    return { date: dateStr, items: [] };
  }

  // Category IDs: configurable via SERPAPI_TN_CATEGORY_IDS (JSON array or comma-separated),
  // default minimal coverage: Other(11), Sports(17), Entertainment(4)
  var catsProp = props.getProperty('SERPAPI_TN_CATEGORY_IDS') || '11,17,4';
  var catIds = [];
  try {
    if (catsProp && catsProp.trim().charAt(0) === '[') {
      var arrJson = JSON.parse(catsProp);
      if (Array.isArray(arrJson)) {
        catIds = arrJson.map(function(x){ return parseInt(x, 10); }).filter(function(n){ return !isNaN(n) && n > 0; });
      }
    } else {
      catIds = String(catsProp).split(/[, ]+/).map(function(x){ return parseInt(x, 10); }).filter(function(n){ return !isNaN(n) && n > 0; });
    }
  } catch (e) {
    catIds = [11,17,4];
  }
  if (!catIds.length) catIds = [11,17,4];

  // Optional filters
  var hoursProp = props.getProperty('SERPAPI_TN_HOURS') || '';
  var onlyActivePropRaw = props.getProperty('SERPAPI_TN_ONLY_ACTIVE');
  var onlyActiveProp = (onlyActivePropRaw == null || String(onlyActivePropRaw).trim() === '') ? 'true' : String(onlyActivePropRaw);

  var langs = ['id', 'en'];
  var base = 'https://serpapi.com/search.json?engine=google_trends_trending_now&geo=ID';

  // First attempt without category_id (global Trending Now), try hl=id then hl=en
  for (var li0 = 0; li0 < langs.length; li0++) {
    var hl0 = langs[li0];

    // Build URL with optional hours and only_active
    var urlParts0 = [
      base,
      'hl=' + encodeURIComponent(hl0),
      'api_key=' + encodeURIComponent(apiKey)
    ];

    // Append hours if valid (supported: 4,24,48,168)
    if (hoursProp) {
      var hp0 = String(hoursProp).trim();
      if (hp0 === '4' || hp0 === '24' || hp0 === '48' || hp0 === '168') {
        urlParts0.push('hours=' + hp0);
      }
    }

    // Append only_active if truthy
    if (onlyActiveProp && String(onlyActiveProp).toLowerCase() === 'true') {
      urlParts0.push('only_active=true');
    }

    var url0 = urlParts0.join('&');

    try {
      var res0 = UrlFetchApp.fetch(url0, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true
      });
      var status0 = res0.getResponseCode();
      var txt0 = res0.getContentText();
      debugLog_('SERPAPI_TN_ATTEMPT', 'status=' + status0 + ' category_id=none hl=' + hl0, 0);

      if (status0 >= 300 || !txt0 || !txt0.trim().length) {
        var head0 = (txt0 || '').trim().substring(0, 120).replace(/\s+/g, ' ');
        debugLog_('SERPAPI_TN_FAIL', 'status=' + status0 + ' head=' + head0 + ' category_id=none hl=' + hl0, 0);
      } else {
        var data0;
        try { data0 = JSON.parse(txt0); } catch (eParse0) {
          debugLog_('SERPAPI_TN_FAIL', 'json_parse_error category_id=none hl=' + hl0, 0);
          data0 = null;
        }
        if (data0 && data0.error) {
          debugLog_('SERPAPI_TN_FAIL', 'api_error=' + data0.error + ' category_id=none hl=' + hl0, 0);
        }
        if (data0) {
          var items0 = [];
          var arr0 = data0.trending_searches
            || (data0.default && data0.default.trending_searches)
            || data0.trends_results
            || data0.trending_now
            || [];
          if (arr0 && arr0.length) {
            for (var j0 = 0; j0 < arr0.length; j0++) {
              var ts0 = arr0[j0] || {};
              var qOut0 = '';
              if (ts0.title && String(ts0.title).trim()) qOut0 = String(ts0.title).trim();
              else if (ts0.query && String(ts0.query).trim()) qOut0 = String(ts0.query).trim();
              else if (ts0.entity_names && ts0.entity_names.length) qOut0 = String(ts0.entity_names[0]).trim();
              else if (ts0.entityNames && ts0.entityNames.length) qOut0 = String(ts0.entityNames[0]).trim();

              var trafficRaw0 = ts0.formattedTraffic || ts0.formatted_traffic || ts0.search_volume || ts0.search_interest || '';
              var traffic0 = formatTrafficK_(trafficRaw0);

              var arts0 = [];
              var artsSrc0 = ts0.articles || ts0.news_results || ts0.newsResults || [];
              if (artsSrc0 && artsSrc0.length) {
                for (var k0 = 0; k0 < Math.min(2, artsSrc0.length); k0++) {
                  var a0 = artsSrc0[k0] || {};
                  var t0 = a0.title || '';
                  var src0 = '';
                  if (a0.source && typeof a0.source === 'object' && a0.source.name) src0 = a0.source.name;
                  else if (typeof a0.source === 'string') src0 = a0.source;
                  else if (a0.source_name) src0 = a0.source_name;
                  arts0.push((t0 || '') + (src0 ? (' - ' + src0) : ''));
                }
              }

              var incPct0 = ts0.increase_percentage || ts0.increasePercentage || ts0.percent_change || ts0.percent || '';
              var startTs0 = ts0.start_timestamp || ts0.start_time || ts0.startTime || ts0.trend_start_time || ts0.trend_start_date || '';

              if (qOut0) items0.push({ query: qOut0, traffic: traffic0, increase_pct: incPct0, start_ts: startTs0, articles: arts0 });
              if (items0.length >= 50) break;
            }
          }

          if (items0.length > 0) {
            debugLog_('SERPAPI_TN_OK', 'items=' + items0.length + ' category_id=none hl=' + hl0, items0.length);
            return { date: dateStr, items: items0 };
          }
        }
      }
    } catch (e0) {
      debugLog_('SERPAPI_TN_ERROR', 'url=' + url0 + ' err=' + ((e0 && e0.message) ? e0.message : String(e0)), 0);
    }

    Utilities.sleep(150);
  }

  for (var ci = 0; ci < catIds.length; ci++) {
    var cat = catIds[ci];
    for (var li = 0; li < langs.length; li++) {
      var hl = langs[li];

      // Build URL with optional hours and only_active
      var urlParts = [
        base,
        'category_id=' + encodeURIComponent(String(cat)),
        'hl=' + encodeURIComponent(hl),
        'api_key=' + encodeURIComponent(apiKey)
      ];

      // Append hours if valid (supported: 4,24,48,168)
      if (hoursProp) {
        var hp = String(hoursProp).trim();
        if (hp === '4' || hp === '24' || hp === '48' || hp === '168') {
          urlParts.push('hours=' + hp);
        }
      }

      // Append only_active if truthy
      if (onlyActiveProp && String(onlyActiveProp).toLowerCase() === 'true') {
        urlParts.push('only_active=true');
      }

      var url = urlParts.join('&');

      try {
        var res = UrlFetchApp.fetch(url, {
          method: 'get',
          muteHttpExceptions: true,
          followRedirects: true,
          validateHttpsCertificates: true
        });
        var status = res.getResponseCode();
        var txt = res.getContentText();
        debugLog_('SERPAPI_TN_ATTEMPT', 'status=' + status + ' category_id=' + cat + ' hl=' + hl, 0);

        if (status >= 300 || !txt || !txt.trim().length) {
          var head = (txt || '').trim().substring(0, 120).replace(/\s+/g, ' ');
          debugLog_('SERPAPI_TN_FAIL', 'status=' + status + ' head=' + head + ' category_id=' + cat + ' hl=' + hl, 0);
          continue;
        }

        var data;
        try { data = JSON.parse(txt); } catch (eParse) {
          debugLog_('SERPAPI_TN_FAIL', 'json_parse_error category_id=' + cat + ' hl=' + hl, 0);
          continue;
        }
        if (data.error) {
          debugLog_('SERPAPI_TN_FAIL', 'api_error=' + data.error + ' category_id=' + cat + ' hl=' + hl, 0);
        }

        var items = [];

        // Normalize Trending Now JSON
        var arr = data.trending_searches
          || (data.default && data.default.trending_searches)
          || data.trends_results
          || data.trending_now
          || [];

        if (arr && arr.length) {
          for (var j = 0; j < arr.length; j++) {
            var ts = arr[j] || {};
            var qOut = '';
            if (ts.title && String(ts.title).trim()) qOut = String(ts.title).trim();
            else if (ts.query && String(ts.query).trim()) qOut = String(ts.query).trim();
            else if (ts.entity_names && ts.entity_names.length) qOut = String(ts.entity_names[0]).trim();
            else if (ts.entityNames && ts.entityNames.length) qOut = String(ts.entityNames[0]).trim();

            var trafficRaw = ts.formattedTraffic || ts.formatted_traffic || ts.search_volume || ts.search_interest || '';
            var traffic = formatTrafficK_(trafficRaw);

            var arts = [];
            var artsSrc = ts.articles || ts.news_results || ts.newsResults || [];
            if (artsSrc && artsSrc.length) {
              for (var k = 0; k < Math.min(2, artsSrc.length); k++) {
                var a = artsSrc[k] || {};
                var t = a.title || '';
                var src = '';
                if (a.source && typeof a.source === 'object' && a.source.name) src = a.source.name;
                else if (typeof a.source === 'string') src = a.source;
                else if (a.source_name) src = a.source_name;
                arts.push((t || '') + (src ? (' - ' + src) : ''));
              }
            }

            var incPct = ts.increase_percentage || ts.increasePercentage || ts.percent_change || ts.percent || '';
            var startTs = ts.start_timestamp || ts.start_time || ts.startTime || ts.trend_start_time || ts.trend_start_date || '';

            if (qOut) items.push({ query: qOut, traffic: traffic, increase_pct: incPct, start_ts: startTs, articles: arts });
            if (items.length >= 50) break;
          }
        }

        if (items.length > 0) {
          debugLog_('SERPAPI_TN_OK', 'items=' + items.length + ' category_id=' + cat + ' hl=' + hl, items.length);
          return { date: dateStr, items: items };
        } else {
          var head2 = txt.trim().substring(0, 160).replace(/\s+/g, ' ');
          debugLog_('SERPAPI_TN_FAIL', 'no_items head=' + head2 + ' category_id=' + cat + ' hl=' + hl, 0);
        }
      } catch (e) {
        debugLog_('SERPAPI_TN_ERROR', 'url=' + url + ' err=' + ((e && e.message) ? e.message : String(e)), 0);
      }

      Utilities.sleep(150);
    }
  }

  return { date: dateStr, items: [] };
}
// Public entry point to (re)create daily trigger using POST_TIME_HOUR/POST_TIME_MINUTE
function ensureTrigger() {
  ensureTrigger_();
}