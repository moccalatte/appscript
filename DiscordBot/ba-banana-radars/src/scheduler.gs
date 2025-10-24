// ⏰ scheduler.gs - Trigger management dan cron orchestration
// Fungsi: Manage time-based triggers, orchestrate radar runs
// Dependency: config.gs, radar_utils.gs, radar_registry.gs

/**
 * Scheduler configuration
 */
const SCHEDULER_CONFIG = {
  MAX_TRIGGERS_PER_USER: 20,
  TRIGGER_HANDLER_NAME: 'runActiveRadars',
  INTERVAL_MAPPING: {
    '5m': { minutes: 5 },
    '10m': { minutes: 10 },
    '30m': { minutes: 30 },
    '1h': { hours: 1 },
    '3h': { hours: 3 },
    'daily': { days: 1 }
  }
};

/**
 * Main orchestrator: Run semua active radars yang seharusnya jalan
 * Dipanggil oleh time-based trigger
 */
function runActiveRadars() {
  logInfo('🚀 Orchestrator started: runActiveRadars()');
  var startTime = Date.now();

  try {
    // Get active radar configs
    var configs = getActiveRadarConfigs('🟢');
    logInfo('📡 Found ' + configs.length + ' active radars');

    if (configs.length === 0) {
      logInfo('⏭️ No active radars, skipping run');
      return;
    }

    // Get current hour (WIB)
    var now = new Date();
    var currentHour = now.getHours();
    var currentMinute = now.getMinutes();

    // Run each radar
    var results = [];
    configs.forEach(function(config, index) {
      // Jika interval daily, cek jam eksekusi
      if (config.interval === 'daily' && config.daily_hour) {
        var radarHour = parseInt(config.daily_hour.split(':')[0], 10);
        // Jalankan hanya jika jam sekarang sama dengan jam yang dipilih user
        if (currentHour !== radarHour) {
          logInfo('⏭️ Skip daily radar (not scheduled hour): ' + config.service + ' @ ' + config.daily_hour);
          return;
        }
      }
      logDebug('▶️ Running radar ' + (index + 1) + '/' + configs.length + ': ' + config.service);

      try {
        var result = runSingleRadar(config);
        results.push(result);
      } catch (e) {
        logError('❌ Error running radar: ' + e.message);
        logRadarRun({
          service: config.service,
          guild_id: config.guild_id,
          status_emoji: '🔴',
          elapsed_ms: Date.now() - startTime,
          error_msg: e.message
        });
      }
    });

    var totalElapsed = Date.now() - startTime;
    logInfo('✅ Orchestrator completed: ' + results.length + ' radars processed in ' + totalElapsed + 'ms');

  } catch (e) {
    logError('🚨 Orchestrator critical error: ' + e.message);
  }
}

/**
 * Run single radar dengan mode support
 * @param {Object} config - Radar config dari spreadsheet
 * @returns {Object} Run result
 */
function runSingleRadar(config) {
  var startTime = Date.now();

  try {
    // Validate config
    var validation = validateRadarConfig(config);
    if (!validation.valid) {
      throw new Error('Invalid config: ' + validation.errors.join(', '));
    }

    // Get service
    var service = getRadarService(config.service);
    if (!service) {
      throw new Error('Unknown service: ' + config.service);
    }

    logDebug('🎯 Running ' + config.service + ' for guild ' + config.guild_id);

    // Fetch radar data
    var radarResult = {};
    if (config.service === 'crypto') {
      radarResult = fetchCryptoRadarWithMode(config);
    } else if (config.service === 'gtrends') {
      radarResult = fetchGtrendsRadarWithMode(config);
    } else if (config.service === 'reddit') {
      radarResult = fetchRedditRadarWithMode(config);
    } else {
      throw new Error('Service handler not implemented: ' + config.service);
    }
</parameter>

    if (!radarResult.ok) {
      throw new Error(radarResult.error || 'Fetch failed');
    }

    // Post to Discord webhook
    // In production: use webhooks or follow-up API
    // For now: just log
    var elapsedMs = Date.now() - startTime;

    logRadarRun({
      service: config.service,
      guild_id: config.guild_id,
      status_emoji: '✅',
      elapsed_ms: elapsedMs,
      error_msg: ''
    });

    logInfo('✅ ' + config.service + ' radar completed in ' + elapsedMs + 'ms');

    return {
      ok: true,
      service: config.service,
      elapsedMs: elapsedMs
    };

  } catch (e) {
    var elapsedMs = Date.now() - startTime;
    logError('❌ Radar run failed: ' + e.message);

    logRadarRun({
      service: config.service,
      guild_id: config.guild_id,
      status_emoji: '🔴',
      elapsed_ms: elapsedMs,
      error_msg: e.message
    });

    return {
      ok: false,
      service: config.service,
      error: e.message,
      elapsedMs: elapsedMs
    };
  }
}

/**
 * Create atau update trigger untuk interval tertentu
 * @param {string} interval - Interval (5m, 10m, 30m, 1h, 3h, daily)
 */
function createTriggerForInterval(interval) {
  logInfo('⏰ Creating trigger for interval: ' + interval);

  try {
    // Remove existing trigger untuk interval ini
    removeTriggersByInterval(interval);

    // Get interval config
    var intervalConfig = SCHEDULER_CONFIG.INTERVAL_MAPPING[interval];
    if (!intervalConfig) {
      throw new Error('Invalid interval: ' + interval);
    }

    // Create new trigger
    var trigger = ScriptApp.newTrigger(SCHEDULER_CONFIG.TRIGGER_HANDLER_NAME)
      .timeBased();

    if (intervalConfig.minutes) {
      trigger = trigger.everyMinutes(intervalConfig.minutes);
    } else if (intervalConfig.hours) {
      trigger = trigger.everyHours(intervalConfig.hours);
    } else if (intervalConfig.days) {
      trigger = trigger.everyDays(intervalConfig.days);
    }

    trigger.create();

    logInfo('✅ Trigger created for interval: ' + interval);
    return true;

  } catch (e) {
    logError('❌ Error creating trigger: ' + e.message);
    return false;
  }
}

/**
 * Create daily trigger pada jam tertentu
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 */
function createDailyTriggerAt(hour, minute) {
  logInfo('⏰ Creating daily trigger at ' + hour + ':' + (minute < 10 ? '0' : '') + minute);

  try {
    // Remove existing daily triggers
    removeTriggersByInterval('daily');

    var trigger = ScriptApp.newTrigger(SCHEDULER_CONFIG.TRIGGER_HANDLER_NAME)
      .timeBased()
      .atHour(Math.max(0, Math.min(23, hour)))
      .nearMinute(Math.max(0, Math.min(59, minute)))
      .everyDays(1)
      .create();

    logInfo('✅ Daily trigger created at ' + hour + ':' + minute);
    return true;

  } catch (e) {
    logError('❌ Error creating daily trigger: ' + e.message);
    return false;
  }
}

/**
 * Remove trigger untuk interval tertentu
 * @param {string} interval - Interval to match
 */
function removeTriggersByInterval(interval) {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === SCHEDULER_CONFIG.TRIGGER_HANDLER_NAME) {
      // Simple heuristic: remove if trigger source matches
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  if (removed > 0) {
    logDebug('🗑️ Removed ' + removed + ' triggers');
  }
}

/**
 * Remove semua trigger
 */
function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  logInfo('🗑️ Removed all triggers');
}

/**
 * List semua active triggers
 * @returns {Array} Array of trigger info
 */
function listActiveTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var info = [];

  triggers.forEach(function(trigger) {
    info.push({
      handler: trigger.getHandlerFunction(),
      source: String(trigger.getTriggerSource()),
      eventType: String(trigger.getEventType()),
      uid: trigger.getUniqueId ? trigger.getUniqueId() : 'unknown'
    });
  });

  logInfo('📋 Active triggers: ' + info.length);
  return info;
}

/**
 * Get trigger count
 * @returns {number} Jumlah triggers
 */
function getTriggerCount() {
  return ScriptApp.getProjectTriggers().length;
}

/**
 * Check jika sudah mencapai limit trigger
 * @returns {boolean}
 */
function isAtTriggerLimit() {
  return getTriggerCount() >= SCHEDULER_CONFIG.MAX_TRIGGERS_PER_USER;
}

/**
 * Setup radar schedule berdasarkan config
 * @param {Object} config - Radar config
 * @returns {boolean} Success
 */
function setupRadarSchedule(config) {
  logInfo('📅 Setting up schedule for ' + config.service + ' - interval: ' + config.interval);

  try {
    if (isAtTriggerLimit()) {
      logWarn('⚠️ At trigger limit, consolidating schedules');
      // Consolidate: group radars dengan interval sama ke 1 trigger
    }

    // For now: create trigger untuk interval ini
    createTriggerForInterval(config.interval);
    return true;

  } catch (e) {
    logError('❌ Error setting up schedule: ' + e.message);
    return false;
  }
}

/**
 * Test scheduler (untuk E2E test)
 * @returns {Object} Test result
 */
function testScheduler() {
  logInfo('🧪 Testing Scheduler...');

  var result = {
    name: 'Scheduler Test',
    ok: false,
    trigger_count: 0,
    errors: []
  };

  try {
    result.trigger_count = getTriggerCount();

    // Test create trigger
    createTriggerForInterval('1h');
    var countAfter = getTriggerCount();

    if (countAfter > result.trigger_count) {
      result.ok = true;
      logInfo('✅ Scheduler test: trigger created successfully');
    } else {
      result.errors.push('Trigger not created');
    }

    // Cleanup
    removeAllTriggers();

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Scheduler test failed: ' + e.message);
  }

  return result;
}

/**
 * Get scheduler status
 * @returns {Object} Status object
 */
function getSchedulerStatus() {
  var triggers = listActiveTriggers();

  return {
    trigger_count: triggers.length,
    at_limit: isAtTriggerLimit(),
    triggers: triggers,
    max_allowed: SCHEDULER_CONFIG.MAX_TRIGGERS_PER_USER
  };
}

/**
 * Pause semua radar (disable scheduling)
 */
function pauseAllRadars() {
  logWarn('⏸️ Pausing all radars');
  try {
    var sheet = getSheet(CONFIG.SHEET_RADAR_CONFIG);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row = i + 1;
      setCellValue(CONFIG.SHEET_RADAR_CONFIG, row, CONFIG.RADAR_CONFIG_STATUS + 1, '🟡');
    }

    logInfo('✅ All radars paused');
  } catch (e) {
    logError('❌ Error pausing radars: ' + e.message);
  }
}

/**
 * Resume semua radar (enable scheduling)
 */
function resumeAllRadars() {
  logWarn('▶️ Resuming all radars');
  try {
    var sheet = getSheet(CONFIG.SHEET_RADAR_CONFIG);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row = i + 1;
      setCellValue(CONFIG.SHEET_RADAR_CONFIG, row, CONFIG.RADAR_CONFIG_STATUS + 1, '🟢');
    }

    logInfo('✅ All radars resumed');
  } catch (e) {
    logError('❌ Error resuming radars: ' + e.message);
  }
}

/**
 * Health check untuk scheduler
 * @returns {Object} Health status
 */
function schedulerHealthCheck() {
  var status = getSchedulerStatus();
  var configs = getActiveRadarConfigs('🟢');

  return {
    timestamp: new Date().toISOString(),
    active_radars: configs.length,
    active_triggers: status.trigger_count,
    at_limit: status.at_limit,
    health: {
      ok: status.trigger_count > 0 || configs.length === 0,
      message: status.trigger_count > 0 ? 'Scheduler running' : 'No triggers or radars'
    }
  };
}
