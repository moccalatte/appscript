/**
 * X_threader - Scraper App (Nitter HTML-only)
 * utils.gs
 *
 * This file implements Nitter HTML-only scraping.
 *
 * Strategy:
 *  - Fetch profile page HTML from a configured Nitter instance (default: https://nitter.net)
 *  - Extract tweet IDs via robust regex that targets "/{username}/status/{id}"
 *  - For each found id, attempt to extract a nearby text snippet from the profile HTML
 *    using heuristics (common tags/classes).
 *  - Optionally, if configured (`fetch_per_tweet=true`), fetch the per-tweet page
 *    to obtain fuller text. This is rate-limited and optional because it increases load.
 *
 * Safety & best practices:
 *  - All sheets (`Config`, `Targets`, `Logs`) are auto-created with headers if missing.
 *  - HTTP fetches use `fetchWithRetries` with exponential backoff and muteHttpExceptions.
 *  - Per-target isolation: exceptions for one target do not interrupt others.
 *  - Rate limiting configurable via `rate_limit_ms` and `post_interval_ms`.
 *  - Max items per user per run configurable via `max_items_per_user`.
 *  - Detailed logging to `Logs` sheet including meta JSON; responses truncated to avoid huge rows.
 *  - Poster webhook integration with optional `poster_shared_secret` header.
 *
 * Config keys (Config sheet):
 *  - nitter_instance (string)        : e.g. https://nitter.net   (default: https://nitter.net)
 *  - poster_webhook (string)         : URL of Poster App (required)
 *  - poster_shared_secret (string)   : optional header secret sent to Poster
 *  - rate_limit_ms (integer)         : delay between processing targets (default: 500)
 *  - post_interval_ms (integer)      : delay between posts to Poster (default: same as rate_limit_ms)
 *  - max_retries (integer)           : HTTP retry attempts (default: 4)
 *  - max_items_per_user (integer)    : max tweets processed per user per run (default: 20)
 *  - user_agent (string)             : optional UA for requests
 *  - fetch_per_tweet (true/false)    : whether to fetch individual tweet pages for fuller text (default: false)
 *  - per_tweet_fetch_delay_ms        : extra delay between per-tweet fetches to reduce load (default: 500)
 *
 * NOTE:
 *  - This script intentionally avoids using the official X/Twitter API.
 *  - HTML scraping is inherently fragile. Use a stable Nitter instance (self-hosted preferred).
 *  - Respect Nitter instance usage policies and rate limits. Tune configs accordingly.
 */

/* Configuration: sheet names */
const CONFIG_SHEET_NAME = 'Config';
const TARGETS_SHEET_NAME = 'Targets';
const LOGS_SHEET_NAME = 'Logs';

/* ======= Basic spreadsheet helpers ======= */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * getOrCreateSheet(doc, name, headers)
 * Ensures sheet with `name` exists and that headers are present.
 * If headers differ, a new header row is inserted to avoid overwriting data.
 */
function getOrCreateSheet(doc, name, headers) {
  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  let headerMismatch = false;
  for (let i = 0; i < headers.length; i++) {
    if (String(firstRow[i] || '').trim() !== String(headers[i] || '').trim()) {
      headerMismatch = true;
      break;
    }
  }
  if (headerMismatch) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

/* ======= Configuration & Logging ======= */

function readConfig() {
  const ss = getSpreadsheet();
  const sheet = getOrCreateSheet(ss, CONFIG_SHEET_NAME, ['Key', 'Value']);
  const values = sheet.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    const value = values[i][1];
    if (key && String(key).trim() !== '') {
      cfg[String(key).trim()] = value;
    }
  }
  return cfg;
}

/**
 * logEvent(level, component, message, meta)
 * Writes a log row to Logs sheet. `meta` is JSON-stringified and truncated.
 */
function logEvent(level, component, message, meta) {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOGS_SHEET_NAME, ['timestamp', 'level', 'component', 'message', 'meta']);
    const ts = new Date();
    let metaStr = '';
    try {
      metaStr = meta ? JSON.stringify(meta) : '';
    } catch (e) {
      metaStr = String(meta);
    }
    metaStr = tryTruncate(metaStr, 2000);
    sheet.appendRow([ts, String(level || ''), String(component || ''), String(message || ''), metaStr]);
  } catch (e) {
    // Best-effort fallback
    console.error('logEvent failure', e);
  }
}

/* ======= HTTP fetch with retries & exponential backoff ======= */

/**
 * fetchWithRetries(url, options, maxTries)
 * - options: method, headers, payload, contentType
 * Returns { code, body, headers } or throws after retries exhausted.
 */
function fetchWithRetries(url, options, maxTries) {
  maxTries = Math.max(1, parseInt(maxTries || 4, 10));
  let attempt = 0;
  let waitMs = 1000;
  while (attempt < maxTries) {
    attempt++;
    try {
      const fetchOptions = Object.assign({}, options || {});
      fetchOptions.muteHttpExceptions = true;
      const response = UrlFetchApp.fetch(url, fetchOptions);
      const code = response.getResponseCode();
      const body = response.getContentText();
      const headers = (typeof response.getAllHeaders === 'function') ? response.getAllHeaders() : {};
      // Retry on 5xx or network issues (code 0 sometimes)
      if ((code >= 500 || code === 0) && attempt < maxTries) {
        logEvent('WARN', 'fetchWithRetries', 'Server/network error, retrying', { url: maskUrlForLogs(url), code: code, attempt: attempt });
        Utilities.sleep(waitMs);
        waitMs *= 2;
        continue;
      }
      return { code: code, body: body, headers: headers };
    } catch (e) {
      logEvent('WARN', 'fetchWithRetries', 'Fetch exception', { url: maskUrlForLogs(url), error: String(e), attempt: attempt });
      if (attempt >= maxTries) {
        throw new Error('Max fetch retries reached for ' + url + ': ' + String(e));
      }
      Utilities.sleep(waitMs);
      waitMs *= 2;
    }
  }
  throw new Error('fetchWithRetries exhausted for ' + url);
}

/* ======= Targets handling ======= */

function getTargets() {
  const ss = getSpreadsheet();
  const sheet = getOrCreateSheet(ss, TARGETS_SHEET_NAME, ['username', 'last_tweet_id', 'enabled', 'notes']);
  const values = sheet.getDataRange().getValues();
  const targets = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const username = row[0] ? String(row[0]).trim() : '';
    if (!username) continue;
    const last_tweet_id = row[1] ? String(row[1]) : '';
    const enabled = String(row[2] || 'true').toLowerCase() !== 'false';
    const notes = row[3] || '';
    targets.push({
      rowIdx: i + 1,
      username: username,
      last_tweet_id: last_tweet_id,
      enabled: enabled,
      notes: notes
    });
  }
  return { sheet: sheet, targets: targets };
}

function saveLastTweetId(sheet, rowIdx, id) {
  try {
    sheet.getRange(rowIdx, 2).setValue(id);
  } catch (e) {
    logEvent('ERROR', 'saveLastTweetId', 'Failed to save last tweet id', { rowIdx: rowIdx, id: id, error: String(e) });
  }
}

/* ======= ID helpers ======= */

/**
 * compareIds - safe comparison for numeric ID strings (big integers)
 * returns negative if a < b, 0 if equal, positive if a > b
 */
function compareIds(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return a.length - b.length;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/* ======= Nitter HTML scraping (profile + optional per-tweet) ======= */

/**
 * getTweetsFromNitter(username, sinceId, cfg, maxRetries)
 * - HTML-only scraping from Nitter profile pages.
 * - Optionally fetches per-tweet pages if `cfg.fetch_per_tweet` is truthy.
 * Returns { data: [ { id, text, created_at } ] }
 */
function getTweetsFromNitter(username, sinceId, cfg, maxRetries) {
  cfg = cfg || {};
  maxRetries = Math.max(1, parseInt(maxRetries || cfg.max_retries || 4, 10));
  const nitterBase = String(cfg.nitter_instance || 'https://nitter.net').replace(/\/$/, '');
  username = String(username || '').replace(/^@/, '');
  const result = { data: [] };
  if (!username) return result;

  try {
    const profileUrl = nitterBase + '/' + encodeURIComponent(username);
    const headers = { 'User-Agent': cfg.user_agent || 'X_threader-nitter-scraper' };
    const resp = fetchWithRetries(profileUrl, { method: 'get', headers: headers }, maxRetries);
    if (!resp || resp.code < 200 || resp.code >= 300 || !resp.body) {
      logEvent('WARN', 'getTweetsFromNitter', 'Profile fetch non-200 or empty', { username: username, code: resp ? resp.code : null });
      return result;
    }
    const html = resp.body;

    // Robust extraction of tweet ids from profile HTML:
    // Look for patterns like /username/status/1234567890
    const idRegex = new RegExp('\\/' + escapeRegExp(username) + '\\/status\\/(\\d+)', 'gi');
    const found = {};
    let match;
    while ((match = idRegex.exec(html)) !== null) {
      const id = match[1];
      if (!id) continue;
      // skip ids <= sinceId
      if (sinceId && compareIds(id, sinceId) <= 0) continue;
      found[id] = true;
    }

    // If no ids found, try alternative patterns: data-id attributes or tweet links
    if (Object.keys(found).length === 0) {
      // data-id="1234567890"
      const dataIdRegex = /data-id=["']?(\d{5,})["']?/gi;
      while ((match = dataIdRegex.exec(html)) !== null) {
        const id = match[1];
        if (!id) continue;
        if (sinceId && compareIds(id, sinceId) <= 0) continue;
        found[id] = true;
      }
    }

    const ids = Object.keys(found).sort(function (a, b) { return compareIds(a, b); });
    if (ids.length === 0) {
      // No new IDs
      return result;
    }

    // Heuristic snippet extraction: for each id locate link index and grab nearby <p> or other likely container.
    const maxPerUser = Math.max(1, parseInt(cfg.max_items_per_user || 20, 10));
    const candidateIds = ids.slice(-maxPerUser); // newest N
    const snippets = [];

    for (let i = 0; i < candidateIds.length; i++) {
      const id = candidateIds[i];
      // find a position of the status link in html
      const linkFragment = '/' + username + '/status/' + id;
      const pos = html.indexOf(linkFragment);
      let text = '';
      let created_at = null;

      if (pos >= 0) {
        // Window around link to search for content
        const windowStart = Math.max(0, pos - 1200);
        const windowEnd = Math.min(html.length, pos + 1200);
        const windowHtml = html.substring(windowStart, windowEnd);

        // Common nitter structure: tweet content often inside <p class="tweet-content"> or <div class="tweet-content">
        let pMatch = windowHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch && pMatch[1]) {
          text = stripHtml(pMatch[1]).trim();
        } else {
          // Try div with known classes
          pMatch = windowHtml.match(/<div[^>]*(tweet|content|tweet-content|tweet-body)[^>]*>([\s\S]*?)<\/div>/i);
          if (pMatch && pMatch[2]) {
            text = stripHtml(pMatch[2]).trim();
          } else {
            // Fallback: take nearby plaintext
            const cleaned = stripHtml(windowHtml).replace(/\s+/g, ' ').trim();
            text = cleaned.length > 800 ? cleaned.substring(0, 800) + '...' : cleaned;
          }
        }

        // Try to capture a timestamp if present near link (e.g., <span class="tweet-date"> or <time>)
        const timeMatch = windowHtml.match(/<time[^>]*datetime=["']?([^"'>\s]+)["']?[^>]*>/i);
        if (timeMatch && timeMatch[1]) {
          created_at = timeMatch[1];
        } else {
          // fallback: pubdate-like strings
          const dateMatch = windowHtml.match(/(\w{3,9}\s+\d{1,2},\s*\d{4})/i);
          if (dateMatch) created_at = dateMatch[1];
        }
      } else {
        // If not found, skip - but could still include as id-only
        text = '';
      }

      // Optional: per-tweet page fetch for fuller content
      if (String(cfg.fetch_per_tweet || 'false').toLowerCase() === 'true') {
        try {
          const perTweetDelay = Math.max(0, parseInt(cfg.per_tweet_fetch_delay_ms || 500, 10));
          Utilities.sleep(perTweetDelay);
          const tweetUrl = nitterBase + '/' + encodeURIComponent(username) + '/status/' + encodeURIComponent(id);
          const tr = fetchWithRetries(tweetUrl, { method: 'get', headers: { 'User-Agent': cfg.user_agent || 'X_threader-nitter-scraper' } }, maxRetries);
          if (tr && tr.code >= 200 && tr.code < 300 && tr.body) {
            const tweetHtml = tr.body;
            // try to extract main tweet content: <div class="tweet-content"> <p>...</p>
            let mainMatch = tweetHtml.match(/<div[^>]*(tweet-content|tweet-body|status-content)[^>]*>([\s\S]*?)<\/div>/i);
            if (mainMatch && mainMatch[2]) {
              const fullText = stripHtml(mainMatch[2]).trim();
              if (fullText) text = fullText;
            } else {
              // fallback: any <p> inside article or main
              mainMatch = tweetHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
              if (mainMatch && mainMatch[1]) {
                const pInner = mainMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
                if (pInner && pInner[1]) {
                  text = stripHtml(pInner[1]).trim();
                }
              }
            }
            // try one more for created_at using <time datetime="">
            const ttime = tweetHtml.match(/<time[^>]*datetime=["']?([^"'>\s]+)["']?[^>]*>/i);
            if (ttime && ttime[1]) created_at = ttime[1];
          }
        } catch (e) {
          logEvent('WARN', 'getTweetsFromNitter', 'Per-tweet fetch failed, continuing', { username: username, id: id, error: String(e) });
        }
      }

      snippets.push({ id: id, text: text, created_at: created_at });
    }

    // Ensure chronological order
    snippets.sort(function (a, b) { return compareIds(a.id, b.id); });
    result.data = snippets;
    return result;
  } catch (e) {
    logEvent('ERROR', 'getTweetsFromNitter', 'Unhandled exception scraping profile', { username: username, error: String(e) });
    return result;
  }
}

/* ======= Posting to Poster App (webhook) ======= */

function safePostToPoster(webhook, payload, cfg, maxRetries) {
  if (!webhook) {
    logEvent('ERROR', 'safePostToPoster', 'Poster webhook URL not configured', { payload: payload });
    return;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (cfg && cfg.poster_shared_secret) {
    headers['X-Poster-Secret'] = cfg.poster_shared_secret;
  }
  try {
    const resp = fetchWithRetries(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: headers
    }, maxRetries);
    const status = resp.code;
    if (status >= 200 && status < 300) {
      logEvent('INFO', 'safePostToPoster', 'Posted to poster successfully', { to: maskUrlForLogs(webhook), status: status, id: payload.id || null });
    } else {
      logEvent(status >= 500 ? 'WARN' : 'ERROR', 'safePostToPoster', 'Poster responded with error status', { to: maskUrlForLogs(webhook), status: status, body: tryTruncate(resp.body, 1000), payload: payload });
    }
    return resp;
  } catch (e) {
    logEvent('ERROR', 'safePostToPoster', 'Failed to post to poster', { error: String(e), payload: payload });
    throw e;
  }
}

/* ======= Main workflow ======= */

/**
 * runScrapeAndPost
 * - Entry point for scheduled trigger
 */
function runScrapeAndPost() {
  const cfg = readConfig();
  const posterWebhook = cfg.poster_webhook;
  const maxRetries = Math.max(1, parseInt(cfg.max_retries || 4, 10));
  const rateLimitMs = Math.max(0, parseInt(cfg.rate_limit_ms || 500, 10));
  const postIntervalMs = Math.max(0, parseInt(cfg.post_interval_ms || rateLimitMs, 10));
  const maxPerUser = Math.max(1, parseInt(cfg.max_items_per_user || 20, 10));

  if (!posterWebhook) {
    logEvent('ERROR', 'runScrapeAndPost', 'poster_webhook not configured in Config sheet', {});
    return;
  }

  const { sheet, targets } = getTargets();
  if (!targets || targets.length === 0) {
    logEvent('INFO', 'runScrapeAndPost', 'No targets found in Targets sheet', {});
    return;
  }

  for (let idx = 0; idx < targets.length; idx++) {
    const t = targets[idx];
    if (!t.enabled) {
      logEvent('INFO', 'runScrapeAndPost', 'Skipping disabled target', { username: t.username });
      continue;
    }
    try {
      logEvent('INFO', 'runScrapeAndPost', 'Processing target', { username: t.username });
      const tweetsResp = getTweetsFromNitter(t.username, t.last_tweet_id, cfg, maxRetries);
      if (!tweetsResp || !tweetsResp.data || tweetsResp.data.length === 0) {
        logEvent('INFO', 'runScrapeAndPost', 'No new items for target', { username: t.username });
        Utilities.sleep(rateLimitMs);
        continue;
      }

      // Cap to configured maxPerUser
      let tweets = tweetsResp.data;
      if (tweets.length > maxPerUser) tweets = tweets.slice(tweets.length - maxPerUser);

      // Ensure chronological order (oldest first)
      tweets.sort(function (a, b) { return compareIds(a.id, b.id); });

      for (let i = 0; i < tweets.length; i++) {
        const tw = tweets[i];
        const payload = {
          source: 'scraper',
          platform: 'x',
          username: t.username,
          id: tw.id,
          text: tw.text,
          created_at: tw.created_at || null,
          notes: t.notes || null,
          fetched_via: 'nitter_html'
        };
        try {
          safePostToPoster(posterWebhook, payload, cfg, maxRetries);
          saveLastTweetId(sheet, t.rowIdx, tw.id);
        } catch (e) {
          logEvent('ERROR', 'runScrapeAndPost', 'Failed to post tweet to poster', { username: t.username, tweetId: tw.id, error: String(e) });
          // continue to next tweet
        }
        Utilities.sleep(postIntervalMs);
      }

      logEvent('INFO', 'runScrapeAndPost', 'Finished processing target', { username: t.username, processed: tweets.length });
    } catch (e) {
      logEvent('ERROR', 'runScrapeAndPost', 'Unhandled exception processing target', { username: t.username, error: String(e) });
    } finally {
      Utilities.sleep(rateLimitMs);
    }
  }
}

/* ======= Optional helper: manual trigger for testing ======= */

function testRunSingle(username) {
  if (!username) {
    logEvent('ERROR', 'testRunSingle', 'username required', {});
    return;
  }
  const cfg = readConfig();
  const maxRetries = Math.max(1, parseInt(cfg.max_retries || 4, 10));
  const posterWebhook = cfg.poster_webhook;
  if (!posterWebhook) {
    logEvent('ERROR', 'testRunSingle', 'poster_webhook not configured', {});
    return;
  }
  try {
    const tweetsResp = getTweetsFromNitter(username, null, cfg, maxRetries);
    logEvent('INFO', 'testRunSingle', 'getTweetsFromNitter response', { username: username, count: tweetsResp && tweetsResp.data ? tweetsResp.data.length : 0 });
    if (tweetsResp && tweetsResp.data && tweetsResp.data.length > 0) {
      const tweets = tweetsResp.data.sort(function (a, b) { return compareIds(a.id, b.id); });
      const tw = tweets[tweets.length - 1]; // newest
      const payload = { source: 'scraper', platform: 'x', username: username, id: tw.id, text: tw.text };
      safePostToPoster(posterWebhook, payload, cfg, maxRetries);
    } else {
      logEvent('INFO', 'testRunSingle', 'No tweets found for user', { username: username });
    }
  } catch (e) {
    logEvent('ERROR', 'testRunSingle', 'Exception', { error: String(e) });
  }
}

/* ======= Utility helpers ======= */

function stripHtml(html) {
  try {
    return String(html).replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  } catch (e) {
    return String(html);
  }
}

function tryTruncate(s, maxLen) {
  try {
    if (!s) return s;
    s = String(s);
    if (s.length > maxLen) return s.substring(0, maxLen) + '...';
    return s;
  } catch (e) {
    return String(s);
  }
}

function maskUrlForLogs(url) {
  try {
    if (!url) return '';
    const idx = url.indexOf('?');
    if (idx >= 0) return url.substring(0, idx) + '?[REDACTED]';
    return url;
  } catch (e) {
    return '';
  }
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
