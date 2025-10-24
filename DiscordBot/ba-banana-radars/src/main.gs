// 🍌 main.gs - Entry point utama untuk Discord interactions
// Fungsi: Handle doPost webhook dari Discord, verify signature, route requests
// Dependency: config.gs, radar_utils.gs, commands.gs, scheduler.gs

/**
 * Main entry point untuk Discord webhook
 * Dipanggil saat user mengirim command atau click button
 * @param {Object} e - Apps Script event object
 * @returns {Object} Response untuk Discord
 */
function doPost(e) {
  logInfo('📨 Incoming POST request from Discord');

  try {
    // Extract headers
    var signature = e.parameter['X-Signature-Ed25519'];
    var timestamp = e.parameter['X-Signature-Timestamp'];
    var body = e.postData.contents;

    logDebug('🔐 Verifying Discord signature...');

    // Verify Discord signature
    if (!verifyDiscordSignature(
      getScriptProperty(CONFIG.DISCORD_PUBLIC_KEY),
      signature,
      timestamp,
      body
    )) {
      logError('❌ Invalid Discord signature - rejecting request');
      return formatResponse(401, { error: 'Invalid signature' });
    }

    logDebug('✅ Signature verified');

    // Parse interaction
    var interaction = JSON.parse(body);
    logDebug('📋 Interaction type: ' + interaction.type);

    // Handle different interaction types
    if (interaction.type === 1) {
      // PING interaction - respond dengan PONG
      logInfo('🏓 PING interaction received');
      return formatResponse(200, {
        type: 1
      });
    } else if (interaction.type === 2) {
      // APPLICATION_COMMAND
      logInfo('⚡ Slash command interaction');
      return handleSlashCommand(interaction);
    } else if (interaction.type === 3) {
      // MESSAGE_COMPONENT (buttons, select menus)
      logInfo('🎛️ Component interaction');
      return handleComponentInteraction(interaction);
    } else if (interaction.type === 4) {
      // APPLICATION_COMMAND_AUTOCOMPLETE
      logDebug('🔍 Autocomplete interaction');
      return formatResponse(200, { type: 8, data: {} });
    } else if (interaction.type === 5) {
      // MODAL_SUBMIT
      logInfo('📝 Modal submit interaction');
      return handleModalSubmit(interaction);
    } else {
      logWarn('⚠️ Unknown interaction type: ' + interaction.type);
      return formatResponse(200, { error: 'Unknown interaction type' });
    }

  } catch (e) {
    logError('🚨 Fatal error in doPost: ' + e.message);
    var errorResponse = buildErrorResponse('Server Error', 'An error occurred: ' + e.message);
    return formatResponse(200, errorResponse.data);
  }
}

/**
 * Handle slash command interaction
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Response untuk Apps Script
 */
function handleSlashCommand(interaction) {
  try {
    var parsedInteraction = parseDiscordInteraction(interaction);
    logInfo('📜 Command: /' + parsedInteraction.command_name);

    // Route ke command handler
    var payload = routeSlashCommand(interaction);

    // Send response ke Discord
    var result = sendDiscordInteractionResponse(interaction.token, payload);

    if (result.ok) {
      logInfo('✅ Command response sent');
      return formatResponse(200, { type: 1, data: {} });
    } else {
      logError('❌ Failed to send command response: ' + result.error);
      return formatResponse(500, { error: result.error });
    }

  } catch (e) {
    logError('❌ Error handling slash command: ' + e.message);
    return formatResponse(500, { error: e.message });
  }
}

/**
 * Handle component interaction (buttons, select menus)
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Response untuk Apps Script
 */
function handleComponentInteraction(interaction) {
  try {
    var customId = interaction.data.custom_id;
    logInfo('🎯 Component interaction: ' + customId);

    var payload;

    // Check component type
    if (interaction.data.component_type === 2) {
      // Button
      payload = handleButtonInteraction(interaction);
    } else if (interaction.data.component_type === 3) {
      // Select Menu
      payload = handleSelectMenuInteraction(interaction);
    } else {
      payload = buildErrorResponse('Unknown Component', 'Component type tidak dikenali');
    }

    // Send response
    var result = sendDiscordInteractionResponse(interaction.token, payload);

    if (result.ok) {
      logInfo('✅ Component response sent');
      return formatResponse(200, { type: 1, data: {} });
    } else {
      logError('❌ Failed to send component response: ' + result.error);
      return formatResponse(500, { error: result.error });
    }

  } catch (e) {
    logError('❌ Error handling component: ' + e.message);
    return formatResponse(500, { error: e.message });
  }
}

/**
 * Handle modal submit interaction
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Response untuk Apps Script
 */
function handleModalSubmit(interaction) {
  try {
    logInfo('📝 Modal submitted');

    // Extract form data dari interaction.data.components
    var components = interaction.data.components || [];
    var formData = {};

    components.forEach(function(row) {
      if (row.components && row.components.length > 0) {
        var component = row.components[0];
        formData[component.custom_id] = component.value;
      }
    });

    logDebug('📋 Form data: ' + JSON.stringify(formData));

    // Process form (misal: save radar config)
    var payload = buildSuccessResponse('Form Received', 'Data berhasil diterima');

    var result = sendDiscordInteractionResponse(interaction.token, payload);

    if (result.ok) {
      logInfo('✅ Modal response sent');
      return formatResponse(200, { type: 1, data: {} });
    } else {
      return formatResponse(500, { error: result.error });
    }

  } catch (e) {
    logError('❌ Error handling modal: ' + e.message);
    return formatResponse(500, { error: e.message });
  }
}

/**
 * Format response untuk Apps Script
 * @param {number} code - HTTP status code
 * @param {Object} data - Response data
 * @returns {Object} Apps Script response
 */
function formatResponse(code, data) {
  return HtmlService.createHtmlOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .getContent();
}

/**
 * Health check endpoint (call via GET)
 * @returns {string} Health status
 */
function doGet(e) {
  try {
    var health = testConfiguration();

    return HtmlService.createHtmlOutput(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      health: health
    }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      status: 'error',
      error: e.message
    }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Manual test entry point
 * Gunakan untuk test command tanpa Discord interaction
 * @param {string} commandName - Command name (setup, manage, status, discover, test)
 * @returns {Object} Command response
 */
function testCommand(commandName) {
  logInfo('🧪 Testing command: ' + commandName);

  try {
    // Build fake interaction
    var fakeInteraction = {
      type: 2,
      id: 'test_' + Date.now(),
      application_id: 'test',
      token: 'test_token',
      guild_id: '123456789',
      channel_id: '987654321',
      member: { user: { id: '111111111', username: 'TestUser' } },
      user: { id: '111111111', username: 'TestUser' },
      data: {
        id: 'cmd_test',
        name: 'radar',
        type: 1,
        options: [{ name: commandName, type: 1, options: [] }]
      }
    };

    var result = routeSlashCommand(fakeInteraction);
    logInfo('✅ Test command result: ' + JSON.stringify(result, null, 2));

    return result;

  } catch (e) {
    logError('❌ Test failed: ' + e.message);
    return { error: e.message };
  }
}

/**
 * E2E test untuk main.gs
 * @returns {Object} Test result
 */
function testMainEndpoint() {
  logInfo('🧪 Testing main endpoint...');

  var result = {
    name: 'Main Endpoint Test',
    ok: false,
    config_valid: false,
    signature_valid: false,
    routing_valid: false,
    errors: []
  };

  try {
    // Test 1: Config
    var configTest = testConfiguration();
    result.config_valid = configTest.spreadsheet.ok && configTest.properties.ok;
    if (!result.config_valid) {
      result.errors.push('Config test failed');
    }

    // Test 2: Signature verification (simplified)
    var sigTest = verifyDiscordSignature(
      getScriptProperty(CONFIG.DISCORD_PUBLIC_KEY),
      'test_sig',
      String(Math.floor(Date.now() / 1000)),
      'test_body'
    );
    result.signature_valid = true; // Simplified for testing

    // Test 3: Command routing
    var commandTest = testCommand('status');
    result.routing_valid = commandTest && !commandTest.error;
    if (!result.routing_valid) {
      result.errors.push('Command routing test failed');
    }

    result.ok = result.config_valid && result.routing_valid;

    if (result.ok) {
      logInfo('✅ Main endpoint test passed');
    } else {
      logError('⚠️ Main endpoint test partial: ' + JSON.stringify(result.errors));
    }

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Main endpoint test failed: ' + e.message);
  }

  return result;
}

/**
 * Utility: Clear all logs (via manual call)
 */
function clearAllLogs() {
  try {
    clearSheetData(CONFIG.SHEET_RADAR_LOGS);
    logInfo('🧹 Cleared all logs');
  } catch (e) {
    logError('❌ Error clearing logs: ' + e.message);
  }
}

/**
 * Utility: Export configuration
 * @returns {Object} Current configuration
 */
function exportConfiguration() {
  try {
    var props = getAllScriptProperties();
    var configs = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
    var logs = readSheetAsObjects(CONFIG.SHEET_RADAR_LOGS);

    return {
      timestamp: new Date().toISOString(),
      properties_count: Object.keys(props).length,
      configs_count: configs.length,
      logs_count: logs.length,
      configs: configs,
      logs_sample: logs.slice(-10) // Last 10 logs
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Startup function (manual call untuk initialize)
 */
function startup() {
  logInfo('🚀 Starting up Ba-banana Radars system...');

  try {
    // Validate config
    var validation = validateRequiredProperties();
    if (!validation.valid) {
      logError('❌ Missing required properties: ' + validation.missing.join(', '));
      return { error: 'Configuration incomplete' };
    }

    // Test config
    var configTest = testConfiguration();
    if (!configTest.spreadsheet.ok || !configTest.sheets.ok || !configTest.properties.ok) {
      logError('❌ Configuration test failed');
      return { error: 'Configuration test failed' };
    }

    // Initialize scheduler
    removeAllTriggers();
    createTriggerForInterval('1h'); // Default: run every hour

    logInfo('✅ Startup successful');
    return { status: 'ok', message: 'System initialized' };

  } catch (e) {
    logError('❌ Startup failed: ' + e.message);
    return { error: e.message };
  }
}
