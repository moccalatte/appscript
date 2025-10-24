// 💰 radar_crypto.gs - Implementasi Crypto Radar dengan fetch dari Binance API
// Fungsi: Fetch harga cryptocurrency real-time, format embed dengan emoji tren
// Dependency: config.gs, radar_utils.gs, radar_registry.gs

/**
 * Crypto Radar configuration
 */
const CRYPTO_CONFIG = {
  BINANCE_API_URL: 'https://data-api.binance.vision/api/v3/ticker/24hr',
  DEFAULT_SYMBOLS: [
    { symbol: 'BTCUSDT', emoji: '🪙', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', emoji: '💎', name: 'Ethereum' },
    { symbol: 'XRPUSDT', emoji: '💧', name: 'XRP' },
    { symbol: 'XLMUSDT', emoji: '⭐', name: 'Stellar' },
    { symbol: 'TONUSDT', emoji: '💠', name: 'TON' }
  ],
  CACHE_DURATION_MS: 60000, // 1 minute
  PRICE_CHANGE_THRESHOLD_GREEN: 2,
  PRICE_CHANGE_THRESHOLD_RED: -2,
  REQUEST_PACE_MS: 100,
  RETRY_COUNT: 2,
  RETRY_BACKOFF_MS: 300
};

/**
 * Fetch cryptocurrency ticker dari Binance
 * @param {string} symbol - Trading pair (misal: 'BTCUSDT')
 * @returns {Object} { ok, data, error }
 */
function fetchBinanceTicker(symbol) {
  logDebug('📍 Fetching Binance ticker: ' + symbol);

  var url = CRYPTO_CONFIG.BINANCE_API_URL + '?symbol=' + symbol;
  var result = fetchWithRetry(url, {
    retries: CRYPTO_CONFIG.RETRY_COUNT,
    backoffMs: CRYPTO_CONFIG.RETRY_BACKOFF_MS
  });

  if (result.ok) {
    var data = result.data;
    return {
      ok: true,
      data: {
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        priceChangePercent: parseFloat(data.priceChangePercent),
        priceChange: parseFloat(data.priceChange),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteAssetVolume: parseFloat(data.quoteAssetVolume)
      }
    };
  } else {
    return {
      ok: false,
      error: result.error || 'Failed to fetch ticker'
    };
  }
}

/**
 * Fetch multiple crypto tickers
 * @param {Array} symbols - Array of symbols
 * @returns {Array} Array of ticker data
 */
function fetchCryptoTickers(symbols) {
  logInfo('💰 Fetching ' + symbols.length + ' crypto tickers');

  var results = [];
  symbols.forEach(function(symbolObj, index) {
    if (index > 0) {
      // Pace requests
      Utilities.sleep(CRYPTO_CONFIG.REQUEST_PACE_MS);
    }

    var result = fetchBinanceTicker(symbolObj.symbol);
    if (result.ok) {
      result.data.emoji = symbolObj.emoji;
      result.data.name = symbolObj.name;
      results.push(result.data);
    } else {
      results.push({
        symbol: symbolObj.symbol,
        emoji: symbolObj.emoji,
        name: symbolObj.name,
        error: result.error
      });
    }
  });

  return results;
}

/**
 * Build embed field untuk crypto ticker
 * @param {Object} ticker - Ticker data
 * @returns {Object} Embed field
 */
function buildCryptoField(ticker) {
  if (ticker.error) {
    return buildField({
      name: (ticker.emoji || '❓') + ' ' + ticker.name,
      value: '⚠️ Error: ' + ticker.error,
      inline: true
    });
  }

  var priceUSD = ticker.lastPrice;
  var changePercent = ticker.priceChangePercent;
  var percentFormat = formatPercentage(changePercent);

  var priceDisplay = formatUSD(priceUSD);
  var chartUrl = 'https://www.binance.com/en/trade/' + ticker.symbol.replace('USDT', '_USDT');

  return buildField({
    name: (ticker.emoji || '💰') + ' ' + ticker.name,
    value: '`' + priceDisplay + '`  ' +
           percentFormat.emoji + ' ' +
           percentFormat.arrow + ' ' +
           percentFormat.formatted + '\n' +
           '[📊 Chart](' + chartUrl + ')',
    inline: true
  });
}

/**
 * Main crypto radar fetch function
 * @param {Object} config - Radar config
 * @returns {Object} { ok, embed, error }
 */
function fetchCryptoRadar(config) {
  logInfo('🚀 Crypto Radar: Starting fetch for ' + config.guild_id);

  var startTime = Date.now();

  try {
    // Get symbols configuration
    var symbols = CRYPTO_CONFIG.DEFAULT_SYMBOLS;

    // Fetch all tickers
    var tickers = fetchCryptoTickers(symbols);

    // Build fields
    var fields = [];
    var changes = [];

    tickers.forEach(function(ticker) {
      fields.push(buildCryptoField(ticker));
      if (ticker.priceChangePercent && isFinite(ticker.priceChangePercent)) {
        changes.push(ticker.priceChangePercent);
      }
    });

    // Calculate average change
    var avgChange = calculateAverage(changes);
    var color = getColorByPercent(avgChange);

    // Build main embed
    var embed = buildEmbed({
      title: '💰 **Crypto Daily Overview (USD)**',
      description: 'Harga spot & perubahan 24 jam dari Binance',
      color: color,
      fields: fields,
      footer: 'Last update: ' + formatTimestampWIB(new Date()),
      timestamp: new Date()
    });

    var elapsedMs = Date.now() - startTime;

    logInfo('✅ Crypto Radar fetch success (avg change: ' + avgChange.toFixed(2) + '%, elapsed: ' + elapsedMs + 'ms)');

    return {
      ok: true,
      embed: embed,
      embeds: [embed],
      elapsedMs: elapsedMs,
      changePercent: avgChange
    };
  } catch (e) {
    var elapsedMs = Date.now() - startTime;
    logError('❌ Crypto Radar error: ' + e.message);

    return {
      ok: false,
      embed: buildErrorEmbed('Crypto Radar Error', e.message),
      embeds: [buildErrorEmbed('Crypto Radar Error', e.message)],
      elapsedMs: elapsedMs,
      error: e.message
    };
  }
}

/**
 * Format crypto ticker untuk plain text
 * @param {Object} ticker - Ticker data
 * @returns {string} Plain text representation
 */
function formatCryptoTickerPlain(ticker) {
  if (ticker.error) {
    return ticker.emoji + ' ' + ticker.name + ': ⚠️ Error - ' + ticker.error;
  }

  var priceUSD = formatUSD(ticker.lastPrice);
  var changePercent = ticker.priceChangePercent.toFixed(2) + '%';
  var changeEmoji = ticker.priceChangePercent >= 0 ? '📈' : '📉';

  return ticker.emoji + ' ' + ticker.name + ': ' + priceUSD + ' (' + changeEmoji + ' ' + changePercent + ')';
}

/**
 * Build plain text report untuk crypto radar
 * @param {Array} tickers - Array of ticker data
 * @returns {string} Plain text report
 */
function buildCryptoPlainReport(tickers) {
  var lines = [
    '💰 **CRYPTO REPORT - ' + formatTimestampWIB(new Date()) + '**',
    ''
  ];

  tickers.forEach(function(ticker) {
    lines.push(formatCryptoTickerPlain(ticker));
  });

  return lines.join('\n');
}

/**
 * Fetch crypto radar dengan mode support
 * @param {Object} config - Radar config
 * @returns {Object} { ok, payload, error }
 */
function fetchCryptoRadarWithMode(config) {
  var radarResult = fetchCryptoRadar(config);

  if (!radarResult.ok) {
    return {
      ok: false,
      payload: buildDiscordPayload({
        content: '❌ Crypto Radar Error',
        embeds: [radarResult.embed]
      }),
      error: radarResult.error
    };
  }

  var payload;

  if (config.mode === 'plain') {
    var tickers = fetchCryptoTickers(CRYPTO_CONFIG.DEFAULT_SYMBOLS);
    var plainText = buildCryptoPlainReport(tickers);
    payload = buildDiscordPayload({
      content: plainText
    });
  } else {
    // Default: embed mode
    payload = buildDiscordPayload({
      content: '📡 **Crypto Radar Update**',
      embeds: radarResult.embeds
    });
  }

  return {
    ok: true,
    payload: payload,
    elapsedMs: radarResult.elapsedMs
  };
}

/**
 * Test crypto radar (untuk E2E test)
 * @returns {Object} Test result
 */
function testCryptoRadarFetch() {
  logInfo('🧪 Testing Crypto Radar...');

  var startTime = Date.now();
  var result = {
+    name: 'Crypto Radar Fetch',
    ok: false,
    tickers: 0,
    errors: []
  };

  try {
    var tickers = fetchCryptoTickers(CRYPTO_CONFIG.DEFAULT_SYMBOLS);
    result.tickers = tickers.length;

    var successCount = 0;
    tickers.forEach(function(ticker) {
      if (ticker.error) {
        result.errors.push('Failed: ' + ticker.symbol + ' - ' + ticker.error);
      } else {
        if (isFinite(ticker.lastPrice) && ticker.lastPrice > 0) {
          successCount++;
        } else {
          result.errors.push('Invalid price for ' + ticker.symbol);
        }
      }
    });

    if (successCount > 0) {
      result.ok = true;
      logInfo('✅ Crypto Radar test: ' + successCount + '/' + result.tickers + ' tickers fetched');
    }
  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Crypto Radar test failed: ' + e.message);
  }

  result.elapsedMs = Date.now() - startTime;
  return result;
}

/**
 * Get crypto ticker price untuk quick lookup
 * @param {string} symbol - Symbol (misal: 'BTCUSDT')
 * @returns {number|null} Last price atau null jika error
 */
function getCryptoPrice(symbol) {
  var result = fetchBinanceTicker(symbol);
  return result.ok ? result.data.lastPrice : null;
}

/**
 * Get top cryptocurrencies by 24h change
 * @param {number} limit - Limit hasil (default: 5)
 * @returns {Array} Sorted tickers
 */
function getTopCryptoByChange(limit) {
  limit = limit || 5;

  var tickers = fetchCryptoTickers(CRYPTO_CONFIG.DEFAULT_SYMBOLS);
  var valid = tickers.filter(function(t) { return !t.error && isFinite(t.priceChangePercent); });

  // Sort by change percent descending
  valid.sort(function(a, b) {
    return b.priceChangePercent - a.priceChangePercent;
  });

  return valid.slice(0, limit);
}

/**
 * Get bottom cryptocurrencies by 24h change (losers)
 * @param {number} limit - Limit hasil (default: 5)
 * @returns {Array} Sorted tickers
 */
function getBottomCryptoByChange(limit) {
  limit = limit || 5;

  var tickers = fetchCryptoTickers(CRYPTO_CONFIG.DEFAULT_SYMBOLS);
  var valid = tickers.filter(function(t) { return !t.error && isFinite(t.priceChangePercent); });

  // Sort by change percent ascending (losers first)
  valid.sort(function(a, b) {
    return a.priceChangePercent - b.priceChangePercent;
  });

  return valid.slice(0, limit);
}
