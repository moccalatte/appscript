// 🧠 ai_summary.gs - Optional AI summary integration dengan OpenRouter
// Fungsi: Generate AI summaries untuk radar data
// Dependency: config.gs, radar_utils.gs

/**
 * AI Summary configuration
 */
const AI_CONFIG = {
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  MAX_TOKENS: 500,
  TEMPERATURE: 0.7,
  TIMEOUT_MS: 15000
};

/**
 * Check jika AI summary available (API key configured)
 * @returns {boolean}
 */
function isAISummaryAvailable() {
  var apiKey = getScriptProperty('OPENROUTER_API_KEY');
  return apiKey && String(apiKey).trim().length > 0;
}

/**
 * Generate AI summary untuk crypto data
 * @param {Array} tickers - Array of crypto tickers
 * @param {string} mode - Summary mode (brief, detailed, insights)
 * @returns {Object} { ok, summary, error }
 */
function generateCryptoSummary(tickers, mode) {
  mode = mode || 'brief';

  if (!isAISummaryAvailable()) {
    return { ok: false, error: 'AI API key not configured' };
  }

  try {
    var validTickers = tickers.filter(function(t) { return !t.error && isFinite(t.priceChangePercent); });

    if (validTickers.length === 0) {
      return { ok: true, summary: 'No valid crypto data to summarize' };
    }

    // Build prompt
    var topGainers = validTickers.sort(function(a, b) { return b.priceChangePercent - a.priceChangePercent; }).slice(0, 3);
    var topLosers = validTickers.sort(function(a, b) { return a.priceChangePercent - b.priceChangePercent; }).slice(0, 3);

    var prompt = 'Analyze crypto market data dan buat summary singkat dalam Bahasa Indonesia:\n\n';
    prompt += 'Top Gainers:\n';
    topGainers.forEach(function(t) {
      prompt += '- ' + t.name + ': +' + t.priceChangePercent.toFixed(2) + '%\n';
    });

    prompt += '\nTop Losers:\n';
    topLosers.forEach(function(t) {
      prompt += '- ' + t.name + ': ' + t.priceChangePercent.toFixed(2) + '%\n';
    });

    prompt += '\nBuat summary dalam mode: ' + mode + '\nGunakan emoji untuk formatting.';

    var result = callOpenRouterAPI(prompt);
    return result;

  } catch (e) {
    logError('❌ Error generating crypto summary: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Generate AI summary untuk trends data
 * @param {Array} trends - Array of trends
 * @param {string} mode - Summary mode
 * @returns {Object} { ok, summary, error }
 */
function generateTrendsSummary(trends, mode) {
  mode = mode || 'brief';

  if (!isAISummaryAvailable()) {
    return { ok: false, error: 'AI API key not configured' };
  }

  try {
    if (!trends || trends.length === 0) {
      return { ok: true, summary: 'No trends data to summarize' };
    }

    var prompt = 'Analyze trending searches dan buat summary dalam Bahasa Indonesia:\n\n';
    prompt += 'Top Trends:\n';
    trends.slice(0, 10).forEach(function(t, index) {
      prompt += (index + 1) + '. ' + t.query + ' (' + t.traffic + ')\n';
    });

    prompt += '\nBuat insights tentang apa yang sedang trending. Mode: ' + mode;
    prompt += '\nGunakan emoji dan format yang menarik.';

    var result = callOpenRouterAPI(prompt);
    return result;

  } catch (e) {
    logError('❌ Error generating trends summary: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Call OpenRouter API untuk generate text
 * @param {string} prompt - Prompt untuk AI
 * @returns {Object} { ok, summary, error }
 */
function callOpenRouterAPI(prompt) {
  try {
    var apiKey = getScriptProperty('OPENROUTER_API_KEY');
    if (!apiKey) {
      return { ok: false, error: 'API key not configured' };
    }

    var payload = {
      model: getScriptProperty('AI_MODEL', AI_CONFIG.DEFAULT_MODEL),
      messages: [
        {
          role: 'system',
          content: 'You are helpful assistant that generates insightful summaries. Always respond in Bahasa Indonesia dengan emoji.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: AI_CONFIG.MAX_TOKENS,
      temperature: AI_CONFIG.TEMPERATURE
    };

    var options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://script.google.com',
        'X-Title': 'Ba-banana Radars'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: AI_CONFIG.TIMEOUT_MS
    };

    logDebug('🧠 Calling OpenRouter API...');
    var response = UrlFetchApp.fetch(AI_CONFIG.OPENROUTER_API_URL, options);
    var code = response.getResponseCode();

    if (code !== 200) {
      logError('❌ OpenRouter API error: ' + code + ' - ' + response.getContentText());
      return { ok: false, error: 'API returned ' + code };
    }

    var result = JSON.parse(response.getContentText());
    if (!result.choices || !result.choices[0]) {
      return { ok: false, error: 'Invalid API response' };
    }

    var summary = result.choices[0].message.content;
    logDebug('✅ OpenRouter API response received');

    return { ok: true, summary: summary };

  } catch (e) {
    logError('❌ OpenRouter call failed: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Test AI summary (untuk E2E test)
 * @returns {Object} Test result
 */
function testAISummary() {
  logInfo('🧪 Testing AI Summary...');

  var result = {
    name: 'AI Summary Test',
    ok: false,
    available: isAISummaryAvailable(),
    errors: []
  };

  if (!result.available) {
    logWarn('⚠️ AI Summary not available (no API key)');
    result.ok = true; // Not an error, just not available
    return result;
  }

  try {
    var testPrompt = 'Say "✅ AI Summary working!" in one sentence.';
    var apiResult = callOpenRouterAPI(testPrompt);

    if (apiResult.ok) {
      result.ok = true;
      logInfo('✅ AI Summary test: ' + apiResult.summary);
    } else {
      result.errors.push(apiResult.error);
    }
  } catch (e) {
    result.errors.push(e.message);
    logError('❌ AI Summary test failed: ' + e.message);
  }

  return result;
}

/**
 * Generate summary untuk custom prompt
 * @param {string} prompt - Custom prompt
 * @returns {Object} { ok, summary, error }
 */
function generateCustomSummary(prompt) {
  if (!isAISummaryAvailable()) {
    return { ok: false, error: 'AI not available' };
  }

  return callOpenRouterAPI(prompt);
}

/**
 * Build AI summary embed
 * @param {string} summary - Summary text
 * @param {string} radarName - Radar name
 * @returns {Object} Discord embed
 */
function buildAISummaryEmbed(summary, radarName) {
  return buildEmbed({
    title: '🤖 ' + (radarName || 'AI Summary'),
    description: summary || 'Summary sedang diproses...',
    color: 0x9b59b6,
    footer: 'Powered by OpenRouter AI'
  });
}
