// 🛠️ test_helpers.gs - Helper functions untuk testing individual components
// Fungsi: Test utilities untuk unit testing radar services
// Dependency: semua *.gs files

/**
 * Test configuration read/write
 * @returns {Object} Test result
 */
function testSpreadsheetAccess() {
  var result = {
    name: 'Spreadsheet Access',
    ok: false,
    errors: []
  };

  try {
    // Test buka spreadsheet
    var ss = getSpreadsheet();
    if (!ss) {
      result.errors.push('Cannot open spreadsheet');
      return result;
    }

    // Test sheets
    var sheets = [
      CONFIG.SHEET_RADAR_CONFIG,
      CONFIG.SHEET_RADAR_LOGS,
      CONFIG.SHEET_CHANNEL_CACHE
    ];

    sheets.forEach(function(sheetName) {
      try {
        var sheet = getSheet(sheetName);
        if (!sheet) {
          result.errors.push('Sheet ' + sheetName + ' not found');
        }
      } catch (e) {
        result.errors.push('Error accessing ' + sheetName + ': ' + e.message);
      }
    });

    result.ok = result.errors.length === 0;
    return result;

  } catch (e) {
    result.errors.push(e.message);
    return result;
  }
}

/**
 * Test Binance API connectivity
 * @returns {Object} Test result
 */
function testBinanceAPI() {
  var result = {
    name: 'Binance API',
    ok: false,
    price: 0,
    errors: []
  };

  try {
    var price = getCryptoPrice('BTCUSDT');
    if (!price || !isFinite(price) || price <= 0) {
      result.errors.push('Invalid price response: ' + price);
      return result;
    }

    result.ok = true;
    result.price = price;
    logInfo('✅ Binance API test: BTC price = $' + formatUSD(price));

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Binance API error: ' + e.message);
  }

  return result;
}

/**
 * Test Google Trends API
 * @returns {Object} Test result
 */
function testGoogleTrendsAPI() {
  var result = {
    name: 'Google Trends API',
    ok: false,
    trends_count: 0,
    errors: []
  };

  try {
    var trendsResult = fetchGoogleTrends();
    if (!trendsResult.ok) {
      result.errors.push(trendsResult.error || 'Fetch failed');
      return result;
    }

    var trends = trendsResult.trends || [];
    if (trends.length === 0) {
      result.errors.push('No trends returned');
      return result;
    }

    result.ok = true;
    result.trends_count = trends.length;
    logInfo('✅ Google Trends test: ' + trends.length + ' trends fetched');

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Google Trends API error: ' + e.message);
  }

  return result;
}

/**
 * Test AI Summary availability
 * @returns {Object} Test result
 */
function testAISummaryAvailability() {
  var result = {
    name: 'AI Summary',
    ok: false,
    available: isAISummaryAvailable(),
    errors: []
  };

  if (!result.available) {
    logWarn('⚠️ AI Summary not available (no API key configured)');
    result.ok = true; // Not an error, just not configured
    return result;
  }

  try {
    var testResult = testAISummary();
    result.ok = testResult.ok;
    result.errors = testResult.errors || [];

  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

/**
 * Test registry
 * @returns {Object} Test result
 */
function testRadarRegistryIntegrity() {
  var result = {
    name: 'Radar Registry',
    ok: false,
    services_count: 0,
    errors: []
  };

  try {
    var registryTest = testRadarRegistry();
    result.services_count = registryTest.services_count;
    result.ok = registryTest.services_valid;
    result.errors = registryTest.errors || [];

  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

/**
 * Test validation functions
 * @returns {Object} Test result
 */
function testValidationFunctions() {
  var result = {
    name: 'Validation Functions',
    ok: false,
    errors: []
  };

  try {
    // Test valid config
    var validConfig = {
      guild_id: '123456',
      service: 'crypto',
      channel_id: '789012',
      interval: '1h',
      mode: 'embed'
    };

    var validation = validateRadarConfig(validConfig);
    if (!validation.valid) {
      result.errors.push('Valid config rejected: ' + validation.errors.join(', '));
      return result;
    }

    // Test invalid config
    var invalidConfig = {
      guild_id: '',
      service: 'invalid',
      channel_id: '789012',
      interval: 'invalid',
      mode: 'embed'
    };

    var invalidValidation = validateRadarConfig(invalidConfig);
    if (invalidValidation.valid) {
      result.errors.push('Invalid config accepted');
      return result;
    }

    result.ok = true;
    logInfo('✅ Validation test passed');

  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

/**
 * Test logging system
 * @returns {Object} Test result
 */
function testLoggingSystem() {
  var result = {
    name: 'Logging System',
    ok: false,
    errors: []
  };

  try {
    var testMessage = 'Test log entry at ' + new Date().toISOString();

    // Test all log levels
    logDebug('🔍 ' + testMessage);
    logInfo('ℹ️ ' + testMessage);
    logWarn('⚠️ ' + testMessage);
    logError('❌ ' + testMessage);

    // Test radar log
    logRadarRun({
      service: 'test',
      guild_id: 'test_guild',
      status_emoji: '✅',
      elapsed_ms: 123,
      error_msg: ''
    });

    result.ok = true;
    logInfo('✅ Logging test passed');

  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

/**
+ * Test utility functions
+ * @returns {Object} Test result
+ */
function testUtilityFunctions() {
  var result = {
    name: 'Utility Functions',
    ok: false,
    errors: []
  };

  try {
    // Test formatUSD
    var usdFormatted = formatUSD(1234.567);
    if (!usdFormatted || !usdFormatted.includes('$')) {
      result.errors.push('formatUSD failed');
    }

    // Test formatPercentage
    var percentFormat = formatPercentage(5.25);
    if (!percentFormat.emoji || !percentFormat.formatted) {
      result.errors.push('formatPercentage failed');
    }

    // Test formatNumber
    var numFormatted = formatNumber(3.14159, 2);
    if (numFormatted !== '3.14') {
      result.errors.push('formatNumber failed');
    }

    // Test calculateAverage
    var avg = calculateAverage([10, 20, 30]);
    if (avg !== 20) {
      result.errors.push('calculateAverage failed');
    }

    // Test chunkArray
    var chunks = chunkArray([1, 2, 3, 4, 5], 2);
    if (chunks.length !== 3) {
      result.errors.push('chunkArray failed');
    }

    result.ok = result.errors.length === 0;
    if (result.ok) {
      logInfo('✅ Utility functions test passed');
    }

  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

/**
 * Performance benchmark test
 * @returns {Object} Benchmark result
 */
function benchmarkRadarServices() {
  var result = {
    name: 'Performance Benchmark',
    benchmarks: {}
  };

  try {
    // Benchmark Crypto Radar
    var cryptoStart = Date.now();
    var cryptoResult = fetchCryptoRadar({ guild_id: 'bench', mode: 'embed' });
    result.benchmarks.crypto_radar_ms = Date.now() - cryptoStart;

    // Benchmark Gtrends Radar
    var gtrendsStart = Date.now();
    var gtrendsResult = fetchGtrendsRadar({ guild_id: 'bench', mode: 'embed' });
    result.benchmarks.gtrends_radar_ms = Date.now() - gtrendsStart;

    // Benchmark Config Read
    var configStart = Date.now();
    var configData = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
    result.benchmarks.config_read_ms = Date.now() - configStart;

    logInfo('⏱️ Benchmark results: ' + JSON.stringify(result.benchmarks));

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Integration test: Full radar run
 * @returns {Object} Test result
 */
function testFullRadarRun() {
  var result = {
    name: 'Full Radar Run',
    ok: false,
    radars_run: 0,
    errors: []
  };

  try {
    var startTime = Date.now();

    // Get test configs
    var testConfigs = [
      {
        guild_id: 'test',
        service: 'crypto',
        channel_id: 'test_ch',
        interval: '1h',
        mode: 'embed',
        status: '🟢'
      },
      {
        guild_id: 'test',
        service: 'gtrends',
        channel_id: 'test_ch',
        interval: '1h',
        mode: 'embed',
        status: '🟢'
      }
    ];

    var successCount = 0;

    testConfigs.forEach(function(config) {
      try {
        var runResult = runSingleRadar(config);
        if (runResult.ok) {
          successCount++;
        } else {
          result.errors.push(config.service + ': ' + runResult.error);
        }
      } catch (e) {
        result.errors.push(config.service + ' error: ' + e.message);
      }
    });

    result.radars_run = successCount;
    result.ok = successCount > 0;
    result.elapsedMs = Date.now() - startTime;

    if (result.ok) {
      logInfo('✅ Full radar run test: ' + successCount + '/' + testConfigs.length + ' radars executed');
    }

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Full radar run error: ' + e.message);
  }

  return result;
}

/**
 * Run comprehensive diagnostic
 * @returns {Object} Diagnostic report
 */
function runDiagnostic() {
  logInfo('🔧 Running comprehensive diagnostic...');

  var tests = [
    testSpreadsheetAccess(),
    testBinanceAPI(),
    testGoogleTrendsAPI(),
    testAISummaryAvailability(),
    testRadarRegistryIntegrity(),
    testValidationFunctions(),
    testLoggingSystem(),
    testUtilityFunctions(),
    benchmarkRadarServices(),
    testFullRadarRun()
  ];

  var passed = tests.filter(function(t) { return t.ok; }).length;
  var total = tests.length;

  var report = {
    timestamp: new Date().toISOString(),
    total_tests: total,
    passed: passed,
    failed: total - passed,
    pass_rate: ((passed / total) * 100).toFixed(1) + '%',
    tests: tests
  };

  logInfo('🔧 Diagnostic complete: ' + passed + '/' + total + ' passed');
  return report;
}

/**
 * Memory and quota usage check
 * @returns {Object} Usage info
 */
+function checkResourceUsage() {
+  try {
+    var usage = {
+      timestamp: new Date().toISOString(),
+      spreadsheet_rows: 0,
+      errors: []
+    };
+
+    try {
+      var configRows = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
+      var logRows = readSheetAsObjects(CONFIG.SHEET_RADAR_LOGS);
+      usage.spreadsheet_rows = configRows.length + logRows.length;
+    } catch (e) {
+      usage.errors.push('Could not count rows: ' + e.message);
+    }
+
+    return usage;
+
+  } catch (e) {
+    return { error: e.message };
+  }
+}
+
+/**
+ * Test Reddit Radar subreddit parsing
+ * @returns {Object} Test result
+ */
+function testRedditSubredditParsing() {
+  logInfo('🧪 Testing Reddit subreddit parsing...');
+
+  var result = testSubredditParsing();
+  return result;
+}
+
+/**
+ * Test Reddit Radar fetch
+ * @returns {Object} Test result
+ */
+function testRedditAPI() {
+  logInfo('🧪 Testing Reddit API...');
+
+  var result = {
+    name: 'Reddit API',
+    ok: false,
+    subreddits_tested: 0,
+    errors: []
+  };
+
+  try {
+    var testSubreddits = ['indonesia', 'tech', 'news'];
+    var successCount = 0;
+
+    testSubreddits.forEach(function(sub) {
+      var postsResult = fetchRedditPosts({
+        subreddit: sub,
+        sortBy: 'hot'
+      });
+
+      if (postsResult.ok && postsResult.posts && postsResult.posts.length > 0) {
+        successCount++;
+      } else {
+        result.errors.push('Failed to fetch r/' + sub);
+      }
+    });
+
+    result.subreddits_tested = testSubreddits.length;
+    result.ok = successCount > 0;
+
+    if (result.ok) {
+      logInfo('✅ Reddit API test: ' + successCount + '/' + testSubreddits.length + ' subreddits fetched');
+    }
+
+  } catch (e) {
+    result.errors.push(e.message);
+    logError('❌ Reddit API test failed: ' + e.message);
+  }
+
+  return result;
+}
+
+/**
+ * Test Reddit Radar full run
+ * @returns {Object} Test result
+ */
+function testRedditRadarFullRun() {
+  logInfo('🧪 Testing Reddit Radar full run...');
+
+  var result = {
+    name: 'Reddit Radar Full Run',
+    ok: false,
+    errors: []
+  };
+
+  try {
+    var testConfig = {
+      guild_id: 'test',
+      service: 'reddit',
+      subreddit: 'indonesia',
+      sort_by: 'hot',
+      mode: 'embed'
+    };
+
+    // Test embed mode
+    var embedResult = fetchRedditRadarWithMode(testConfig);
+
+    if (!embedResult.ok) {
+      result.errors.push('Embed mode failed: ' + embedResult.error);
+      return result;
+    }
+
+    // Test plain mode
+    testConfig.mode = 'plain';
+    var plainResult = fetchRedditRadarWithMode(testConfig);
+
+    if (!plainResult.ok) {
+      result.errors.push('Plain mode failed: ' + plainResult.error);
+      return result;
+    }
+
+    // Test top posts
+    var topResult = getTopRedditPosts('indonesia', 5);
+    if (!topResult || topResult.length === 0) {
+      result.errors.push('Top posts fetch failed');
+      return result;
+    }
+
+    // Test hot posts
+    var hotResult = getHotRedditPosts('indonesia', 5);
+    if (!hotResult || hotResult.length === 0) {
+      result.errors.push('Hot posts fetch failed');
+      return result;
+    }
+
+    result.ok = true;
+    logInfo('✅ Reddit Radar full run test passed');
+
+  } catch (e) {
+    result.errors.push(e.message);
+    logError('❌ Reddit Radar full run test failed: ' + e.message);
+  }
+
+  return result;
+}
+
+/**
+ * Test custom subreddit input (various formats)
+ * @returns {Object} Test result
+ */
+function testRedditCustomSubreddit() {
+  logInfo('🧪 Testing Reddit custom subreddit input formats...');
+
+  var result = {
+    name: 'Reddit Custom Subreddit',
+    ok: false,
+    formats_tested: 0,
+    errors: []
+  };
+
+  try {
+    var testFormats = [
+      { input: 'indonesia', expected: 'indonesia' },
+      { input: 'r/tech', expected: 'tech' },
+      { input: 'https://reddit.com/r/news', expected: 'news' },
+      { input: 'R/cryptocurrency', expected: 'cryptocurrency' }
+    ];
+
+    var successCount = 0;
+
+    testFormats.forEach(function(test) {
+      var postsResult = fetchRedditPosts({
+        subreddit: test.input,
+        sortBy: 'hot'
+      });
+
+      if (postsResult.ok) {
+        successCount++;
+      } else {
+        result.errors.push('Failed with input: ' + test.input);
+      }
+    });
+
+    result.formats_tested = testFormats.length;
+    result.ok = successCount === testFormats.length;
+
+    if (result.ok) {
+      logInfo('✅ Reddit custom subreddit test: all formats passed');
+    }
+
+  } catch (e) {
+    result.errors.push(e.message);
+    logError('❌ Reddit custom subreddit test failed: ' + e.message);
+  }
+
+  return result;
+}
+}
