/***********************
 *  Rizz Bot — v2 (Properties & Reliability)
 *  Discord Webhook • Daily @ 06:00 Asia/Jakarta
 *  Single-embed by default, auto-split if fields exceed limit
 ***********************/

// ========== CONFIG VIA SCRIPT PROPERTIES ==========
/**
 * Script Properties keys (set via Apps Script: Project Settings → Script Properties):
 * - WEBHOOK_URLS: JSON array of Discord webhook URLs (optional; combined with WEBHOOK_URL if both are set)
 * - WEBHOOK_URL: Discord webhook URL (optional; included alongside WEBHOOK_URLS when present)
 * - BOT_USERNAME: display name (optional)
 * - BOT_AVATAR_URL: avatar URL (optional)
 * - PAIRS_JSON: JSON array of { symbol, emoji, name } (optional; defaults provided)
 * - COLOR_THRESHOLD_GREEN: number (default 0.3)
 * - COLOR_THRESHOLD_RED: number (default -0.3)
 * - PACE_MS: pacing sleep between requests (default 100)
 * - RETRY_COUNT: number of retries for fetch (default 2)
 * - RETRY_BASE_MS: base backoff in ms (default 300)
 * - SORT_BY_CHANGE: "true"/"false" to sort fields by 24h change desc (default false)
 */

// ========== UTIL: Properties & Logging ==========
function getScriptProps() {
  return PropertiesService.getScriptProperties();
}

function getConfig() {
  const props = getScriptProps();
  const defPairs = [
    { symbol: "BTCUSDT", emoji: "🪙", name: "Bitcoin"  },
    { symbol: "ETHUSDT", emoji: "💎", name: "Ethereum" },
    { symbol: "XRPUSDT", emoji: "💧", name: "XRP"      },
    { symbol: "XLMUSDT", emoji: "⭐", name: "Stellar"  },
    { symbol: "TONUSDT", emoji: "💠", name: "TON"      }
  ];
  let pairs = defPairs;
  const pairsRaw = props.getProperty("PAIRS_JSON");
  if (pairsRaw) {
    try {
      const parsed = JSON.parse(pairsRaw);
      if (Array.isArray(parsed) && parsed.length) pairs = parsed;
    } catch (e) {
      logJSON("Invalid PAIRS_JSON, using defaults", { error: e.message });
    }
  }

  // Webhook configuration: WEBHOOK_URLS (array) overrides single WEBHOOK_URL
  const singleWebhook = props.getProperty("WEBHOOK_URL") || "";
  let webhookUrls = [];
  const urlsRaw = props.getProperty("WEBHOOK_URLS");
  if (urlsRaw) {
    try {
      const parsedUrls = JSON.parse(urlsRaw);
      if (Array.isArray(parsedUrls)) {
        webhookUrls = parsedUrls
          .filter(u => typeof u === "string")
          .map(u => u.trim())
          .filter(u => u.length > 0);
      } else if (typeof parsedUrls === "string" && /^https?:\/\//i.test(parsedUrls.trim())) {
        // JSON string of single URL: "https://..."
        webhookUrls = [parsedUrls.trim()];
      } else {
        logJSON("WEBHOOK_URLS parsed but not array/string URL, will try delimiter parsing", { type: typeof parsedUrls });
      }
    } catch (e) {
      // Fallback: accept non-JSON formats (comma/newline/semicolon separated or single raw URL)
      const text = String(urlsRaw).trim();
      let parts = [];
      if (text.length) {
        if (/^https?:\/\//i.test(text)) {
          parts = [text];
        } else {
          parts = text.split(/[,\n;\s]+/).filter(s => /^https?:\/\//i.test(s));
        }
      }
      const uniq = Array.from(new Set(parts.map(u => u.trim()))).filter(u => u.length > 0);
      if (uniq.length) {
        webhookUrls = uniq;
        logJSON("WEBHOOK_URLS accepted via delimiter parsing", { count: uniq.length });
      } else {
        logJSON("Invalid WEBHOOK_URLS, falling back to WEBHOOK_URL", { error: e.message });
      }
    }
  }
  // Always include single WEBHOOK_URL alongside WEBHOOK_URLS (deduplicated)
  if (singleWebhook) {
    webhookUrls = Array.from(new Set(
      [...webhookUrls, singleWebhook]
        .filter(u => typeof u === "string")
        .map(u => u.trim())
        .filter(u => u.length > 0)
    ));
  }

  const cfg = {
    webhookUrl: singleWebhook,
    webhookUrls,
    botUsername: props.getProperty("BOT_USERNAME"),
    botAvatarUrl: props.getProperty("BOT_AVATAR_URL"),
    pairs,
    colorThresholdGreen: parseFloat(props.getProperty("COLOR_THRESHOLD_GREEN") || "0.3"),
    colorThresholdRed: parseFloat(props.getProperty("COLOR_THRESHOLD_RED") || "-0.3"),
    paceMs: parseInt(props.getProperty("PACE_MS") || "100", 10),
    retryCount: parseInt(props.getProperty("RETRY_COUNT") || "2", 10),
    retryBaseMs: parseInt(props.getProperty("RETRY_BASE_MS") || "300", 10),
    sortByChange: (props.getProperty("SORT_BY_CHANGE") || "false").toLowerCase() === "true"
  };
  return cfg;
}

function logJSON(msg, obj) {
  try {
    Logger.log(msg + " " + JSON.stringify(obj));
  } catch (e) {
    Logger.log(msg);
  }
}

// ========== VALIDATION ==========
function validatePairs(pairs) {
  const warnings = [];
  const valid = [];
  for (const p of pairs) {
    if (!p || typeof p !== "object") {
      warnings.push("Pair entry not object: " + String(p));
      continue;
    }
    const { symbol, emoji, name } = p;
    if (!symbol || !/^[A-Z]{2,}USDT$/.test(symbol)) {
      warnings.push("Invalid symbol (must match BASEUSDT): " + String(symbol));
      continue;
    }
    if (!name || typeof name !== "string") {
      warnings.push("Missing name for symbol: " + String(symbol));
      continue;
    }
    valid.push({ symbol, emoji: emoji || "", name });
  }
  return { valid, warnings };
}

// ========== DATA SOURCE ==========
const BINANCE_24H_URL = (symbol) =>
  `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`;

function fetchTicker(symbol, retries, baseMs) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = UrlFetchApp.fetch(BINANCE_24H_URL(symbol), { muteHttpExceptions: true });
      const code = res.getResponseCode();
      if (code === 200) {
        const data = JSON.parse(res.getContentText());
        return { ok: true, data, code };
      } else {
        if (attempt === retries) return { ok: false, code, error: "HTTP " + code };
      }
    } catch (e) {
      if (attempt === retries) return { ok: false, code: -1, error: e.message };
    }
    attempt++;
    const sleepMs = baseMs * Math.pow(2, attempt - 1);
    Utilities.sleep(sleepMs);
  }
  return { ok: false, code: -1, error: "Unknown" };
}

// ========== PRESENTATION HELPERS ==========
function formatUsd(n) {
  // Konsistensi: minimumFractionDigits untuk berbagai rentang
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function buildField(symbol, emoji, name, priceUsd, changePct) {
  const prettyPrice = `$${formatUsd(priceUsd)}`;
  const trendEmoji = changePct >= 0 ? "🟢" : "🔴";
  const sign = changePct >= 0 ? "+" : "";
  const chartUrl = `https://www.binance.com/en/trade/${symbol.replace("USDT", "_USDT")}`;
  const arrow = changePct >= 0 ? "▲" : "▼";
  return {
    name: `${emoji} ${name}`,
    value: `\`${prettyPrice}\`  (${trendEmoji} ${arrow} ${sign}${changePct.toFixed(2)}%)\n[📊 View Chart](${chartUrl})`,
    inline: true
  };
}

function computeAvg(nums) {
  const arr = nums.filter((x) => isFinite(x));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function colorFromAvg(avg, greenThresh, redThresh) {
  if (avg > greenThresh) return 0x2ecc71;
  if (avg < redThresh) return 0xe74c3c;
  return 0x95a5a6;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildEmbeds(fields, avgChange, idTime, now, cfg) {
  const color = colorFromAvg(avgChange, cfg.colorThresholdGreen, cfg.colorThresholdRed);
  const chunks = chunk(fields, 25); // Discord limit ±25 fields
  const embeds = [];
  for (let i = 0; i < chunks.length; i++) {
    const embed = {
      title: i === 0 ? "📊 **Crypto Daily Overview (USD)**" : "📊 **Crypto Daily Overview (USD)** (cont.)",
      description: i === 0 ? "Harga spot & perubahan 24 jam" : undefined,
      color,
      fields: chunks[i],
      footer: { text: `Update: ${idTime} • WIB` },
      timestamp: now.toISOString()
    };
    embeds.push(embed);
  }
  return embeds;
}

// ========== DISCORD POST ==========
function postDiscord(webhookUrl, payload) {
  UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

// ========== MAIN ==========
function sendDailyCryptoEmbed() {
  const cfg = getConfig();
  if (!cfg.webhookUrls || cfg.webhookUrls.length === 0) {
    logJSON("Missing WEBHOOK_URLS/WEBHOOK_URL Script Property", {});
    throw new Error("WEBHOOK_URLS (JSON array) or WEBHOOK_URL is required in Script Properties");
  }
  const { valid: pairs, warnings } = validatePairs(cfg.pairs);
  if (warnings.length) logJSON("Pair validation warnings", { warnings });

  const fields = [];
  const changes = [];

  for (const { symbol, emoji, name } of pairs) {
    if (cfg.paceMs > 0) Utilities.sleep(cfg.paceMs);
    const res = fetchTicker(symbol, cfg.retryCount, cfg.retryBaseMs);
    if (!res.ok) {
      fields.push({
        name: `${emoji || "⚠️"} ${name}`,
        value: `⚠️ Error ${res.code}: ${res.error}`,
        inline: true
      });
      continue;
    }
    const data = res.data;
    const priceUsd = Number(data.lastPrice);
    const changePct = Number(data.priceChangePercent);
    if (isFinite(changePct)) changes.push(changePct);
    fields.push(buildField(symbol, emoji || "", name, priceUsd, changePct));
  }

  // optional sort by change
  if (cfg.sortByChange) {
    fields.sort((a, b) => {
      // extract percent from text between last space and %)
      const re = /([+\-]?\d+(\.\d+)?)%\)$/;
      const am = a.value.match(re);
      const bm = b.value.match(re);
      const av = am ? parseFloat(am[1]) : 0;
      const bv = bm ? parseFloat(bm[1]) : 0;
      return bv - av;
    });
  }

  const avgChange = computeAvg(changes);
  const now = new Date();
  const idTime = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  }).format(now);

  const embeds = buildEmbeds(fields, avgChange, idTime, now, cfg);
  for (const embed of embeds) {
    const payload = {
      username: cfg.botUsername,
      avatar_url: cfg.botAvatarUrl,
      embeds: [embed]
    };
    for (const url of cfg.webhookUrls) {
      postDiscord(url, payload);
    }
  }
  logJSON("Sent embeds", { embeds: embeds.length, targets: cfg.webhookUrls.length, avgChange });
}

// ========== SCHEDULER ==========
/**
 * Buat trigger harian jam 06:00 (WIB).
 * Pastikan: Apps Script → Project Settings → Time zone = Asia/Jakarta
 */
function createDailyTriggerAt6WIB() {
  updateSchedule(6, 0);
}

function updateSchedule(hour, minute) {
  const myFunc = "sendDailyCryptoEmbed";
  removeTriggersByHandler(myFunc);
  ScriptApp.newTrigger(myFunc)
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .nearMinute(Math.min(Math.max(0, minute), 59))
    .create();
  logJSON("Schedule updated", { hour, minute });
}

function listTriggers() {
  const ts = ScriptApp.getProjectTriggers();
  const info = ts.map(t => ({
    handler: t.getHandlerFunction(),
    type: String(t.getTriggerSource()),
    uid: String(t.getUniqueId && t.getUniqueId()),
  }));
  logJSON("Triggers", { info });
  return info;
}

function removeTriggersByHandler(handler) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === handler)
    .forEach(t => ScriptApp.deleteTrigger(t));
  logJSON("Removed triggers for handler", { handler });
}
