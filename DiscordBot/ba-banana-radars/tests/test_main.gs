// 🧪 test_main.gs - E2E Test Suite Utama
// Fungsi: Jalankan comprehensive testing untuk semua components
// Dependency: semua *.gs files

/**
 * Run semua E2E tests
 * Entry point untuk testing
 */
function runAllE2ETests() {
  logInfo('✅ [E2E Test Suite Started]');
  var startTime = Date.now();
  var results = [];

  try {
    // Test 1: Config
    var configTest = testConfigReadWrite();
    results.push(configTest);
    logTestResult('Config: Spreadsheet read/write test', configTest);

    // Test 2: Utils
    var utilsTest = testEmbedBuilder();
    results.push(utilsTest);
    logTestResult('Utils: Embed builder test', utilsTest);

    // Test 3: Crypto Radar
    var cryptoTest = testCryptoRadarFetch();
    results.push(cryptoTest);
    logTestResult('Crypto: Binance fetch test', cryptoTest);

    // Test 4: Gtrends Radar
    var gtrendsTest = testGtrendsRadarFetch();
    results.push(gtrendsTest);
    logTestResult('Gtrends: Trends fetch test', gtrendsTest);

    // Test 5: Reddit Radar
    var redditTest = testRedditRadarFetch();
    results.push(redditTest);
    logTestResult('Reddit: Subreddit fetch test', redditTest);

    // Test 6: Scheduler
    var schedulerTest = testScheduler();
    results.push(schedulerTest);
    logTestResult('Scheduler: Trigger creation test', schedulerTest);

    // Test 7: Commands
    var commandsTest = testCommandRouting();
    results.push(commandsTest);
    logTestResult('Commands: Slash command routing test', commandsTest);

    // Test 8: Main Endpoint
    var mainTest = testMainEndpoint();
    results.push(mainTest);
    logTestResult('Discord: Signature verification test', mainTest);

    // Summary
    var passedCount = results.filter(function(r) { return r.ok; }).length;
    var totalCount = results.length;

    logInfo('✅ [E2E Test Suite Completed] - ' + passedCount + '/' + totalCount + ' tests PASSED ✅');

    // Log to spreadsheet
    logRadarRun({
      service: 'test_suite',
      guild_id: 'test',
      status_emoji: passedCount === totalCount ? '✅' : '⚠️',
      elapsed_ms: Date.now() - startTime,
      error_msg: passedCount < totalCount ? 'Some tests failed' : ''
    });

    return {
      ok: passedCount === totalCount,
      passed: passedCount,
      total: totalCount,
      results: results,
      elapsedMs: Date.now() - startTime
    };

  } catch (e) {
    logError('🚨 [E2E Test Suite Failed] - ' + e.message);
    return {
      ok: false,
      error: e.message,
      results: results,
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Log test result
 * @param {string} testName - Nama test
 * @param {Object} result - Test result object
 */
function logTestResult(testName, result) {
  if (result.ok) {
    logInfo('✅ ' + testName + ' PASSED');
  } else {
    logWarn('❌ ' + testName + ' FAILED - ' + (result.errors ? result.errors.join(', ') : 'Unknown error'));
  }
}

/**
 * Test konfigurasi sistem
 * @returns {Object} Test result
 */
function testConfigReadWrite() {
  var result = {
    name: 'Config Read/Write',
    ok: false,
    errors: []
  };

  try {
    // Test read spreadsheet
    var ss = getSpreadsheet();
    if (!ss) {
      result.errors.push('Cannot open spreadsheet');
      return result;
    }

    // Test read sheet
    var configSheet = getSheet(CONFIG.SHEET_RADAR_CONFIG);
    if (!configSheet) {
      result.errors.push('Cannot access RadarConfig sheet');
      return result;
    }

    // Test read data
    var data = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
    if (!Array.isArray(data)) {
      result.errors.push('Data not array');
      return result;
    }

    // Test write log entry
    logRadarRun({
      service: 'test',
      guild_id: 'test_guild',
      status_emoji: '✅',
      elapsed_ms: 100,
      error_msg: ''
    });

    // Test read properties
    var props = getAllScriptProperties();
    if (!props || Object.keys(props).length === 0) {
      result.errors.push('Properties empty');
      return result;
    }

    result.ok = true;
    logInfo('✅ Config test passed');

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Config test error: ' + e.message);
  }

  return result;
}

/**
 * Test embed builder utilities
 * @returns {Object} Test result
 */
function testEmbedBuilder() {
  var result = {
    name: 'Embed Builder',
    ok: false,
    errors: []
  };

  try {
    // Test build field
    var field = buildField({
      name: 'Test Field',
      value: 'Test Value',
      inline: true
    });

    if (!field || !field.name || !field.value) {
      result.errors.push('Field build failed');
      return result;
    }

    // Test build embed
    var embed = buildEmbed({
      title: 'Test Embed',
      description: 'Test Description',
      color: 0x3498db,
      fields: [field]
    });

    if (!embed || !embed.title || !embed.fields) {
      result.errors.push('Embed build failed');
      return result;
    }

    // Test build action row
    var button = buildButton({
      custom_id: 'test_btn',
      label: 'Test',
      style: 1
    });

    var actionRow = buildActionRow([button]);

    if (!actionRow || !actionRow.components) {
      result.errors.push('Action row build failed');
      return result;
    }

    // Test build payload
    var payload = buildDiscordPayload({
      content: 'Test',
      embeds: [embed],
      components: [actionRow]
    });

    if (!payload || !payload.data) {
      result.errors.push('Payload build failed');
      return result;
    }

    result.ok = true;
    logInfo('✅ Embed builder test passed');

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Embed builder test error: ' + e.message);
  }

  return result;
}

/**
 * Test command routing
 * @returns {Object} Test result
 */
function testCommandRouting() {
  var result = {
    name: 'Command Routing',
    ok: false,
    errors: []
  };

  try {
    var commands = ['setup', 'manage', 'status', 'discover', 'test'];
    var successCount = 0;

    commands.forEach(function(cmd) {
      var fakeInteraction = {
        type: 2,
        id: 'test_' + cmd,
        token: 'test_token',
        guild_id: 'test_guild',
        user: { id: 'test_user' },
        data: {
          name: 'radar',
          options: [{ name: cmd, type: 1, options: [] }]
        }
      };

      try {
        var response = routeSlashCommand(fakeInteraction);
        if (response && response.data) {
          successCount++;
        } else {
          result.errors.push('Command ' + cmd + ' returned empty response');
        }
      } catch (e) {
        result.errors.push('Command ' + cmd + ' error: ' + e.message);
      }
    });

    result.ok = successCount === commands.length;
    logInfo('✅ Command routing test: ' + successCount + '/' + commands.length + ' commands routed');

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Command routing test error: ' + e.message);
  }

  return result;
}

/**
 * Summary statistics dari tests
 * @returns {Object} Test statistics
 */
function getTestStatistics() {
  try {
    var allLogs = readSheetAsObjects(CONFIG.SHEET_RADAR_LOGS);
    var testLogs = allLogs.filter(function(log) { return log.service === 'test' || log.service === 'test_suite'; });

    var stats = {
      total_tests: testLogs.length,
      passed: testLogs.filter(function(l) { return l.status_emoji === '✅'; }).length,
      failed: testLogs.filter(function(l) { return l.status_emoji === '🔴'; }).length,
      warnings: testLogs.filter(function(l) { return l.status_emoji === '⚠️'; }).length,
      avg_elapsed_ms: Math.round(
        testLogs.reduce(function(sum, l) { return sum + (parseFloat(l.elapsed_ms) || 0); }, 0) / Math.max(testLogs.length, 1)
      )
    };

    return stats;
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Report test results
 * Untuk generate report dari E2E tests
 * @returns {Object} Test report
 */
function generateTestReport() {
  var stats = getTestStatistics();
  var health = schedulerHealthCheck();
  var config = testConfiguration();

  var report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_tests: stats.total_tests,
      passed: stats.passed,
      failed: stats.failed,
      pass_rate: stats.total_tests > 0 ? ((stats.passed / stats.total_tests) * 100).toFixed(1) + '%' : 'N/A'
    },
    system_health: health,
    configuration: config,
    performance: {
      avg_response_ms: stats.avg_elapsed_ms
    }
  };

  return report;
}
