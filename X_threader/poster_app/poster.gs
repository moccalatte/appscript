/**
 * Poster App - poster.gs
 *
 * This Apps Script file implements a secure webhook receiver (doPost) that accepts
 * payloads from the Scraper App and forwards them to configured destinations:
 * - Slack
 * - Discord
 * - Telegram
 * - Custom endpoint (forward full payload)
 *
 * Features:
 * - Validates shared secret via header `X-Poster-Secret`
 * - Reads configuration from bound Spreadsheet `Config` sheet (Key | Value)
 * - Logs events into `Logs` sheet (timestamp | level | component | message | meta)
 * - Posts to destinations with retry + exponential backoff
 * - Defensive parsing and comprehensive logging
 *
 * Usage:
 * - Deploy this Apps Script project as a Web App (get the URL) and set that URL
 *   into the Scraper App's `Config.poster_webhook`.
 * - In the Spreadsheet (bound to this script) create `Config` and `Logs` sheets.
 *   `Config` rows: Key | Value. Example keys:
 *     - poster_shared_secret
 *     - destination_type (slack|discord|telegram|custom)
 *     - slack_webhook
 *     - discord_webhook
 *     - telegram_bot_token
 *     - telegram_chat_id
 *     - custom_endpoint
 *     - max_retries
 *     - retry_backoff_ms
 *
 * Note: Do not hardcode secrets in code. Put them in the spreadsheet `Config`.
 */

/* ===== Constants ===== */
const CONFIG_SHEET_NAME = 'Config';
const LOGS_SHEET_NAME = 'Logs';

/* ===== Spreadsheet helpers ===== */
function getSpreadsheet() {
  // Bound script: active spreadsheet
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(doc, name, headers) {
  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  // Ensure header exists without overwriting data
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  let mismatch = false;
  for (let i = 0; i < headers.length; i++) {
    if (String(firstRow[i] || '').trim() !== String(headers[i] || '').trim()) {
      mismatch = true;
      break;
    }
  }
  if (mismatch) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

/* ===== Config & Logging ===== */
function readConfig() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  const cfg = {};
  if (!sheet) return cfg;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const k = rows[i][0];
    const v = rows[i][1];
    if (k) cfg[String(k).trim()] = v;
  }
  return cfg;
}

function logEvent(level, component, message, meta) {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOGS_SHEET_NAME, ['timestamp', 'level', 'component', 'message', 'meta']);
    const ts = new Date();
    let metaStr = '';
    try { metaStr = meta ? JSON.stringify(meta) : ''; } catch (e) { metaStr = String(meta); }
    sheet.appendRow([ts, String(level || ''), String(component || ''), String(message || ''), metaStr]);
  } catch (e) {
    // Best-effort: log to console if writing to sheet fails
    console.error('logEvent failed', e);
  }
}

/* ===== Header extraction helper =====
 * Note: Apps Script's `e` object may not include headers in the same shape
 * in all contexts. We try several places.
 */
function getHeaderFromEvent(e, headerName) {
  if (!e) return '';
  headerName = String(headerName || '').toLowerCase();
  try {
    // Try postData.headers (some Apps Script environments provide it)
    if (e.postData && e.postData.headers) {
      for (var hk in e.postData.headers) {
        if (String(hk || '').toLowerCase() === headerName) {
          return e.postData.headers[hk];
        }
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    // Try e.headers (some environments)
    if (e.headers) {
      for (var h2 in e.headers) {
        if (String(h2 || '').toLowerCase() === headerName) {
          return e.headers[h2];
        }
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    // As a fallback, maybe provided in parameters (not secure, but we try)
    if (e.parameter && e.parameter[headerName]) {
      return e.parameter[headerName];
    }
  } catch (err) {
    // ignore
  }
  return '';
}

/* ===== Web app entrypoint =====
 * Expects:
 * - Header 'X-Poster-Secret' matching Config.poster_shared_secret
 * - JSON body
 */
function doPost(e) {
  const cfg = readConfig();
  const sharedSecret = cfg.poster_shared_secret;
  const receivedSecret = getHeaderFromEvent(e, 'X-Poster-Secret') || getHeaderFromEvent(e, 'x-poster-secret');

  // If shared secret configured, enforce it. If not configured, we still accept but log a warning.
  if (sharedSecret) {
    if (!receivedSecret || String(receivedSecret) !== String(sharedSecret)) {
      logEvent('WARN', 'doPost', 'Invalid or missing shared secret', { received: receivedSecret ? '[REDACTED]' : null });
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid_secret' })).setMimeType(ContentService.MimeType.JSON);
    }
  } else {
    logEvent('WARN', 'doPost', 'No poster_shared_secret configured - accepting incoming request (insecure)', {});
  }

  // Parse JSON body
  let payload = null;
  try {
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      // If no postData, fallback to parameters
      payload = e.parameter || {};
    }
  } catch (err) {
    logEvent('ERROR', 'doPost', 'Failed to parse JSON body', { error: String(err), contents: e && e.postData && e.postData.contents ? String(e.postData.contents).substring(0, 1000) : null });
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid_json' })).setMimeType(ContentService.MimeType.JSON);
  }

  // Minimal validation
  if (!payload) {
    logEvent('ERROR', 'doPost', 'Empty payload', {});
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'empty_payload' })).setMimeType(ContentService.MimeType.JSON);
  }

  logEvent('INFO', 'doPost', 'Received payload', { preview: getPayloadPreview(payload) });

  try {
    const result = handleIncomingPayload(payload, cfg);
    logEvent('INFO', 'doPost', 'Handled payload', { result: result });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, result: result })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    logEvent('ERROR', 'doPost', 'Unhandled exception in handler', { error: String(err) });
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

/* ===== Helper to create a small payload preview for logs ===== */
function getPayloadPreview(p) {
  try {
    if (!p) return null;
    const txt = p.text || p.body || (p.message ? p.message.text : null) || '';
    if (typeof txt === 'string' && txt.length > 200) return txt.substring(0, 200) + '...';
    return txt || (p.username ? 'from:' + p.username : JSON.stringify(p).substring(0, 200));
  } catch (e) {
    return null;
  }
}

/* ===== Incoming payload router ===== */
function handleIncomingPayload(payload, cfg) {
  const dest = String(cfg.destination_type || 'slack').toLowerCase();
  const maxRetries = Math.max(1, parseInt(cfg.max_retries || 3, 10));
  const backoffMs = Math.max(100, parseInt(cfg.retry_backoff_ms || 1000, 10));

  if (dest === 'slack') {
    if (!cfg.slack_webhook) throw new Error('slack_webhook not configured');
    return sendToSlack(cfg.slack_webhook, payload, maxRetries, backoffMs);
  } else if (dest === 'discord') {
    if (!cfg.discord_webhook) throw new Error('discord_webhook not configured');
    return sendToDiscord(cfg.discord_webhook, payload, maxRetries, backoffMs);
  } else if (dest === 'telegram') {
    if (!cfg.telegram_bot_token || !cfg.telegram_chat_id) throw new Error('telegram_bot_token or telegram_chat_id not configured');
    return sendToTelegram(cfg.telegram_bot_token, cfg.telegram_chat_id, payload, maxRetries, backoffMs);
  } else if (dest === 'custom') {
    if (!cfg.custom_endpoint) throw new Error('custom_endpoint not configured');
    return sendToCustom(cfg.custom_endpoint, payload, maxRetries, backoffMs);
  } else {
    throw new Error('unsupported destination_type: ' + dest);
  }
}

/* ===== Destination implementations ===== */

function sendToSlack(webhookUrl, payload, maxRetries, backoffMs) {
  const text = buildTextFromPayload(payload);
  const body = {
    text: text,
    // Provide some context as attachments (Slack-compatible)
    attachments: [{
      title: payload.username || null,
      text: payload.text || null,
      footer: payload.id ? ('id:' + payload.id) : undefined,
      ts: payload.created_at ? Math.floor(new Date(payload.created_at).getTime() / 1000) : undefined
    }]
  };
  const headers = { 'Content-Type': 'application/json' };
  return postJsonWithRetries(webhookUrl, body, headers, maxRetries, backoffMs, 'slack');
}

function sendToDiscord(webhookUrl, payload, maxRetries, backoffMs) {
  const body = {
    content: buildTextFromPayload(payload)
  };
  const headers = { 'Content-Type': 'application/json' };
  return postJsonWithRetries(webhookUrl, body, headers, maxRetries, backoffMs, 'discord');
}

function sendToTelegram(botToken, chatId, payload, maxRetries, backoffMs) {
  const url = 'https://api.telegram.org/bot' + encodeURIComponent(botToken) + '/sendMessage';
  const body = {
    chat_id: chatId,
    text: buildTextFromPayload(payload),
    disable_web_page_preview: true
  };
  const headers = { 'Content-Type': 'application/json' };
  return postJsonWithRetries(url, body, headers, maxRetries, backoffMs, 'telegram');
}

function sendToCustom(endpoint, payload, maxRetries, backoffMs) {
  const headers = { 'Content-Type': 'application/json' };
  // Forward the entire payload
  return postJsonWithRetries(endpoint, payload, headers, maxRetries, backoffMs, 'custom');
}

/* ===== Build a human readable text for destinations ===== */
function buildTextFromPayload(payload) {
  try {
    const parts = [];
    if (payload.username) parts.push('*' + payload.username + '*');
    if (payload.text) parts.push(String(payload.text));
    if (payload.id) parts.push('(id:' + payload.id + ')');
    if (payload.created_at) parts.push('[' + payload.created_at + ']');
    if (parts.length === 0) return JSON.stringify(payload).substring(0, 2000);
    return parts.join(' ');
  } catch (e) {
    return String(payload);
  }
}

/* ===== HTTP POST with retries & exponential backoff =====
 * - url: string
 * - body: object (will be stringified)
 * - headers: object
 * - maxRetries: integer
 * - backoffMs: integer (initial wait)
 * - component: string (for logging)
 */
function postJsonWithRetries(url, body, headers, maxRetries, backoffMs, component) {
  maxRetries = Math.max(1, parseInt(maxRetries || 3, 10));
  backoffMs = Math.max(100, parseInt(backoffMs || 1000, 10));
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
        headers: headers || {}
      };
      const resp = UrlFetchApp.fetch(url, options);
      const code = resp.getResponseCode();
      const respBody = resp.getContentText();
      const logMeta = { url: maskUrlForLogs(url), status: code, attempt: attempt, responseBody: tryTruncate(respBody, 2000) };

      if (code >= 200 && code < 300) {
        logEvent('INFO', component + '.post', 'POST success', logMeta);
        return { ok: true, status: code, body: respBody };
      }

      // For 5xx server errors we retry (if attempts remain)
      if (code >= 500 && attempt < maxRetries) {
        logEvent('WARN', component + '.post', 'Server error, will retry', logMeta);
        Utilities.sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }

      // Non-retriable or exhausted
      logEvent(code >= 400 && code < 500 ? 'ERROR' : 'WARN', component + '.post', 'POST returned non-success', logMeta);
      return { ok: false, status: code, body: respBody };
    } catch (e) {
      const logMeta = { url: maskUrlForLogs(url), attempt: attempt, error: String(e) };
      logEvent('WARN', component + '.post', 'Exception during POST attempt', logMeta);
      if (attempt >= maxRetries) {
        logEvent('ERROR', component + '.post', 'Exhausted retries with exception', logMeta);
        throw e;
      }
      Utilities.sleep(backoffMs);
      backoffMs *= 2;
    }
  }

  throw new Error('postJsonWithRetries exhausted for ' + url);
}

/* ===== Utilities ===== */
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
    // remove query params for safety in logs
    if (!url) return '';
    const idx = url.indexOf('?');
    if (idx >= 0) return url.substring(0, idx) + '?[REDACTED]';
    return url;
  } catch (e) {
    return '';
  }
}

/* ===== Optional admin/test endpoints =====
 * - testSend(payload) can be executed from script editor to validate posting
 */

function testSendToDestination() {
  const cfg = readConfig();
  const payload = {
    username: 'test_user',
    text: 'This is a test message from Poster App',
    id: 'test-123',
    created_at: (new Date()).toISOString()
  };
  try {
    const res = handleIncomingPayload(payload, cfg);
    logEvent('INFO', 'testSendToDestination', 'Test send result', res);
    return res;
  } catch (e) {
    logEvent('ERROR', 'testSendToDestination', 'Test send failed', { error: String(e) });
    throw e;
  }
}
