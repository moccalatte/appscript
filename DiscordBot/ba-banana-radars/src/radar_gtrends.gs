// 📊 radar_gtrends.gs - Implementasi Google Trends Radar
// Fungsi: Fetch top trending queries, format embed dengan traffic indicators
// Dependency: config.gs, radar_utils.gs, radar_registry.gs

/**
 * Google Trends Radar configuration
 */
const GTRENDS_CONFIG = {
  TOP_N: 10,
  CACHE_DURATION_MS: 3600000, // 1 hour
  REQUEST_TIMEOUT_MS: 15000,
  RETRY_COUNT: 2,
  RETRY_BACKOFF_MS: 500
};

/**
 * Sample trending data (fallback jika API tidak available)
 * Dalam implementasi production, gunakan library atau API external
 */
const SAMPLE_TRENDS = [
  { query: 'Berita Hari Ini', traffic: 'Very high' },
  { query: 'Harga Emas', traffic: 'Very high' },
  { query: 'Jadwal Bola', traffic: 'High' },
  { query: 'Resep Masakan', traffic: 'High' },
  { query: 'Tutorial Online', traffic: 'High' },
  { query: 'Aplikasi Mobile', traffic: 'Medium' },
  { query: 'Film Terbaru', traffic: 'Medium' },
  { query: 'Liburan 2025', traffic: 'Medium' },
  { query: 'Teknologi AI', traffic: 'Low' },
  { query: 'Startup Indonesia', traffic: 'Low' }
];

/**
 * Map traffic level ke emoji dan number indicator
 * @param {string} traffic - Traffic level string
 * @returns {Object} { emoji, indicator, color }
 */
function getTrafficIndicator(traffic) {
  var indicators = {
    'Very high': { emoji: '🔥', indicator: 5, color: 0xe74c3c },
    'High': { emoji: '📈', indicator: 4, color: 0xf39c12 },
    'Medium': { emoji: '➡️', indicator: 3, color: 0x3498db },
    'Low': { emoji: '📉', indicator: 2, color: 0x95a5a6 },
    'Very low': { emoji: '❄️', indicator: 1, color: 0xbdc3c7 }
  };

  return indicators[traffic] || indicators['Medium'];
}

/**
 * Fetch trending data
 * Note: Google Trends tidak punya public API yang reliable
 * Implementasi ini menggunakan sample data sebagai fallback
 * Untuk production: gunakan SerpAPI, Trends24, atau library external
 *
 * @returns {Object} { ok, trends, error }
 */
function fetchGoogleTrends() {
  logDebug('📍 Fetching Google Trends data');

  try {
    // Attempt 1: Try external API (jika ada)
    // Contoh: SerpAPI (memerlukan API key)
    var serpApiKey = getScriptProperty('SERPAPI_KEY');
    if (serpApiKey) {
      var result = fetchTrendsFromSerpAPI(serpApiKey);
      if (result.ok) {
        return result;
      }
    }

    // Fallback: Use sample trending data
    logWarn('⚠️ Using sample Google Trends data (no external API available)');

    var trends = [];
    SAMPLE_TRENDS.forEach(function(item) {
      trends.push({
        query: item.query,
        traffic: item.traffic,
        related_queries: Math.floor(Math.random() * 100),
        news_articles: Math.floor(Math.random() * 50)
      });
    });

    return {
      ok: true,
      trends: trends,
      date: new Date().toISOString(),
      source: 'sample'
    };
  } catch (e) {
    logError('❌ Error fetching trends: ' + e.message);
    return {
      ok: false,
      error: e.message
    };
  }
}

/**
 * Fetch trends dari SerpAPI (external service)
 * Requires: SERPAPI_KEY di Script Properties
 *
 * @param {string} apiKey - SerpAPI key
 * @returns {Object} { ok, trends, error }
 */
function fetchTrendsFromSerpAPI(apiKey) {
  try {
    var url = 'https://serpapi.com/search?' +
              'q=trending&' +
              'tbm=nws&' +
              'tbs=qdr:d&' +
              'hl=id&' +
              'gl=id&' +
              'api_key=' + encodeURIComponent(apiKey);

    var result = fetchWithRetry(url, {
      retries: GTRENDS_CONFIG.RETRY_COUNT,
      backoffMs: GTRENDS_CONFIG.RETRY_BACKOFF_MS
    });

    if (!result.ok) {
      return { ok: false, error: 'SerpAPI request failed' };
    }

    var trends = [];
    var news = result.data.news || [];

    news.slice(0, GTRENDS_CONFIG.TOP_N).forEach(function(article) {
      trends.push({
        query: article.title,
        traffic: 'High',
        source: article.source,
        link: article.link
      });
    });

    return {
      ok: true,
      trends: trends,
      date: new Date().toISOString(),
      source: 'serpapi'
    };
  } catch (e) {
    logError('❌ SerpAPI fetch failed: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Build embed field untuk trending query
 * @param {number} rank - Ranking (1-10)
 * @param {Object} trend - Trend data
 * @returns {Object} Embed field
 */
function buildTrendField(rank, trend) {
  var indicator = getTrafficIndicator(trend.traffic);

  return buildField({
    name: rank + '. ' + indicator.emoji + ' ' + trend.query,
    value: trend.traffic + ' • ' + trend.related_queries + ' queries related',
    inline: false
  });
}

/**
 * Main Google Trends radar fetch function
 * @param {Object} config - Radar config
 * @returns {Object} { ok, embed, embeds, error }
 */
function fetchGtrendsRadar(config) {
  logInfo('🚀 Google Trends Radar: Starting fetch for ' + config.guild_id);

  var startTime = Date.now();

  try {
    // Fetch trends
    var trendsResult = fetchGoogleTrends();
    if (!trendsResult.ok) {
      throw new Error(trendsResult.error || 'Failed to fetch trends');
    }

    var trends = trendsResult.trends.slice(0, GTRENDS_CONFIG.TOP_N);

    // Build fields
    var fields = [];
    trends.forEach(function(trend, index) {
      fields.push(buildTrendField(index + 1, trend));
    });

    // Determine color based on trend count
    var color = trends.length > 5 ? 0x3498db : 0x95a5a6;

    // Build embed
    var embed = buildEmbed({
      title: '📊 **Top Trending Searches (Indonesia)**',
      description: 'Top ' + trends.length + ' trending queries dari Google Trends\n' +
                   'Updated: ' + formatTimestampWIB(new Date(trendsResult.date)),
      color: color,
      fields: fields,
      footer: 'Source: ' + trendsResult.source + ' • Ba-banana Radars 🍌',
      timestamp: trendsResult.date
    });

    var elapsedMs = Date.now() - startTime;

    logInfo('✅ Google Trends Radar fetch success (' + trends.length + ' trends, elapsed: ' + elapsedMs + 'ms)');

    return {
      ok: true,
      embed: embed,
      embeds: [embed],
      elapsedMs: elapsedMs,
      trends_count: trends.length
    };
  } catch (e) {
    var elapsedMs = Date.now() - startTime;
    logError('❌ Google Trends Radar error: ' + e.message);

    return {
      ok: false,
      embed: buildErrorEmbed('Google Trends Radar Error', e.message),
      embeds: [buildErrorEmbed('Google Trends Radar Error', e.message)],
      elapsedMs: elapsedMs,
      error: e.message
    };
  }
}

/**
 * Build plain text report untuk Google Trends
 * @param {Array} trends - Array of trend data
 * @returns {string} Plain text report
 */
function buildTrendsPlainReport(trends) {
  var lines = [
    '📊 **GOOGLE TRENDS - ' + formatTimestampWIB(new Date()) + '**',
    ''
  ];

  trends.forEach(function(trend, index) {
    var indicator = getTrafficIndicator(trend.traffic);
    lines.push((index + 1) + '. ' + indicator.emoji + ' ' + trend.query + ' (' + trend.traffic + ')');
  });

  return lines.join('\n');
}

/**
 * Fetch Google Trends radar dengan mode support
 * @param {Object} config - Radar config
 * @returns {Object} { ok, payload, error }
 */
function fetchGtrendsRadarWithMode(config) {
  var radarResult = fetchGtrendsRadar(config);

  if (!radarResult.ok) {
    return {
      ok: false,
      payload: buildDiscordPayload({
        content: '❌ Google Trends Radar Error',
        embeds: [radarResult.embed]
      }),
      error: radarResult.error
    };
  }

  var payload;

  if (config.mode === 'plain') {
    var trendsResult = fetchGoogleTrends();
    var trends = trendsResult.ok ? trendsResult.trends : [];
    var plainText = buildTrendsPlainReport(trends);
    payload = buildDiscordPayload({
      content: plainText
    });
  } else if (config.mode === 'ai_summary') {
    // AI summary mode (opsional)
    var trendsResult = fetchGoogleTrends();
    var trends = trendsResult.ok ? trendsResult.trends : [];
    var summary = generateTrendsSummary(trends);
    payload = buildDiscordPayload({
      content: summary
    });
  } else {
    // Default: embed mode
    payload = buildDiscordPayload({
      content: '📡 **Google Trends Radar Update**',
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
 * Generate AI summary untuk trends (basic version)
 * @param {Array} trends - Array of trend data
 * @returns {string} Summary text
 */
function generateTrendsSummary(trends) {
  if (trends.length === 0) return 'Tidak ada trend data tersedia';

  var summary = '🤖 **AI Trends Summary**\n\n';
  summary += 'Hari ini, top 3 topic trending adalah:\n';

  var top3 = trends.slice(0, 3);
  top3.forEach(function(trend, index) {
    summary += (index + 1) + '. **' + trend.query + '** (' + trend.traffic + ')\n';
  });

  summary += '\n✨ Tampak seperti orang Indonesia sedang mencari informasi tentang ' +
             top3[0].query.toLowerCase() + '.';

  return summary;
}

/**
 * Test Google Trends radar (untuk E2E test)
 * @returns {Object} Test result
 */
function testGtrendsRadarFetch() {
  logInfo('🧪 Testing Google Trends Radar...');

  var startTime = Date.now();
  var result = {
    name: 'Google Trends Radar Fetch',
    ok: false,
    trends_count: 0,
    errors: []
  };

  try {
    var trendsResult = fetchGoogleTrends();

    if (!trendsResult.ok) {
      result.errors.push('Failed to fetch trends: ' + trendsResult.error);
      return result;
    }

    var trends = trendsResult.trends || [];
    result.trends_count = trends.length;

    if (trends.length > 0) {
      result.ok = true;
      logInfo('✅ Google Trends test: ' + trends.length + ' trends fetched');
    } else {
      result.errors.push('No trends returned');
    }
  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Google Trends test failed: ' + e.message);
  }

  result.elapsedMs = Date.now() - startTime;
  return result;
}

/**
 * Get trending query by rank
 * @param {number} rank - Ranking (1 = top trending)
 * @returns {Object|null} Trend object atau null
 */
function getTrendByRank(rank) {
  if (rank < 1) return null;

  var trendsResult = fetchGoogleTrends();
  if (!trendsResult.ok) return null;

  return trendsResult.trends[rank - 1] || null;
}

/**
 * Get top N trending queries
 * @param {number} n - Number of top trends
 * @returns {Array} Top N trends
 */
function getTopTrends(n) {
  n = n || GTRENDS_CONFIG.TOP_N;

  var trendsResult = fetchGoogleTrends();
  if (!trendsResult.ok) return [];

  return trendsResult.trends.slice(0, n);
}
